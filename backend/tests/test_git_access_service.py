"""Tests for how Prism authenticates to Git servers and reports on it."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app.services import git_access_service
from app.services.git_remote_url import parse_remote_url


class HostNameValidation(unittest.TestCase):
    """Host names reach ssh-keyscan's argv, so they get the same care as URLs."""

    def test_option_like_host_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            git_access_service.scan_host_key("-oProxyCommand=id")

    def test_host_with_shell_metacharacters_is_rejected(self) -> None:
        for candidate in ("git.example.com; id", "git.example.com$(id)", "a b"):
            with self.subTest(candidate=candidate):
                with self.assertRaises(ValueError):
                    git_access_service.scan_host_key(candidate)

    def test_blank_host_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            git_access_service.forget_host("   ")

    def test_ordinary_host_passes_validation(self) -> None:
        with mock.patch.object(
            git_access_service.subprocess,
            "run",
            return_value=mock.Mock(stdout="git.example.com ssh-ed25519 AAAA\n", returncode=0),
        ):
            with mock.patch.object(
                git_access_service, "_fingerprints_of", return_value=["SHA256:abc (ED25519)"]
            ):
                candidate = git_access_service.scan_host_key("git.internal.example")
        self.assertEqual(candidate.host, "git.internal.example")


class HostKeyBootstrap(unittest.TestCase):
    """A scan is only as trustworthy as its network; a published fingerprint is not."""

    def test_key_matching_a_published_fingerprint_is_pinned(self) -> None:
        published = next(iter(git_access_service.PUBLISHED_HOST_FINGERPRINTS["github.com"]))
        candidate = git_access_service.HostKeyCandidate(
            host="github.com",
            fingerprints=[f"{published} (ED25519)"],
            entries="github.com ssh-ed25519 AAAA",
        )
        with (
            mock.patch.object(git_access_service, "is_host_trusted", return_value=False),
            mock.patch.object(git_access_service, "scan_host_key", return_value=candidate),
            mock.patch.object(
                git_access_service,
                "_entries_matching",
                return_value="github.com ssh-ed25519 AAAA",
            ),
            mock.patch.object(git_access_service, "trust_host") as trust_host,
        ):
            outcomes = git_access_service.bootstrap_known_hosts()

        self.assertEqual(outcomes["github.com"], "pinned")
        trust_host.assert_called()

    def test_key_that_matches_nothing_published_is_refused(self) -> None:
        candidate = git_access_service.HostKeyCandidate(
            host="github.com",
            fingerprints=["SHA256:somethingelse (ED25519)"],
            entries="github.com ssh-ed25519 AAAA",
        )
        with (
            mock.patch.object(git_access_service, "is_host_trusted", return_value=False),
            mock.patch.object(git_access_service, "scan_host_key", return_value=candidate),
            mock.patch.object(git_access_service, "trust_host") as trust_host,
        ):
            outcomes = git_access_service.bootstrap_known_hosts()

        self.assertEqual(outcomes["github.com"], "fingerprint-mismatch")
        trust_host.assert_not_called()

    def test_an_already_pinned_host_is_not_re_pinned(self) -> None:
        # Re-pinning would let a changed host key in silently.
        with (
            mock.patch.object(git_access_service, "is_host_trusted", return_value=True),
            mock.patch.object(git_access_service, "scan_host_key") as scan,
            mock.patch.object(git_access_service, "trust_host") as trust_host,
        ):
            outcomes = git_access_service.bootstrap_known_hosts()

        self.assertEqual(set(outcomes.values()), {"already-trusted"})
        scan.assert_not_called()
        trust_host.assert_not_called()

    def test_an_unreachable_host_does_not_raise(self) -> None:
        with (
            mock.patch.object(git_access_service, "is_host_trusted", return_value=False),
            mock.patch.object(
                git_access_service, "scan_host_key", side_effect=RuntimeError("no route")
            ),
        ):
            outcomes = git_access_service.bootstrap_known_hosts()
        self.assertTrue(all(value.startswith("scan-failed") for value in outcomes.values()))


class TrustedHostListing(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory()
        self.path = Path(self._temporary.name) / "known_hosts"
        self.addCleanup(self._temporary.cleanup)
        patcher = mock.patch.object(
            git_access_service, "known_hosts_path", return_value=self.path
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_hosts_are_listed(self) -> None:
        self.path.write_text(
            "github.com ssh-ed25519 AAAA\n"
            "# a comment\n"
            "[git.internal.example]:2222 ssh-rsa BBBB\n"
            "gitlab.com,172.65.251.78 ssh-ed25519 CCCC\n",
            encoding="utf-8",
        )
        self.assertEqual(
            git_access_service.trusted_hosts(),
            ["172.65.251.78", "git.internal.example", "github.com", "gitlab.com"],
        )

    def test_hashed_entries_are_skipped(self) -> None:
        # Hashed host names are not recoverable, by design.
        self.path.write_text("|1|abc=|def= ssh-ed25519 AAAA\n", encoding="utf-8")
        self.assertEqual(git_access_service.trusted_hosts(), [])

    def test_missing_file_is_empty(self) -> None:
        self.assertEqual(git_access_service.trusted_hosts(), [])


class RepositoryAccessCheck(unittest.TestCase):
    def _remote(self, url: str = "https://github.com/org/repo.git"):
        return parse_remote_url(url)

    def test_readable_repository_reports_its_default_branch(self) -> None:
        fake_git = mock.Mock()
        fake_git.ls_remote.return_value = (
            "ref: refs/heads/main\tHEAD\nabc123\tHEAD\n"
        )
        with mock.patch("git.Git", return_value=fake_git):
            result = git_access_service.check_repository_access(self._remote())

        self.assertTrue(result.authorized)
        self.assertTrue(result.reachable)
        self.assertEqual(result.default_branch, "main")

    def test_refused_key_is_reachable_but_unauthorized(self) -> None:
        # The distinction matters: the server answered, it just said no.
        error = Exception()
        error.stderr = "git@github.com: Permission denied (publickey)."
        fake_git = mock.Mock()
        fake_git.ls_remote.side_effect = error
        with mock.patch("git.Git", return_value=fake_git):
            result = git_access_service.check_repository_access(self._remote())

        self.assertTrue(result.reachable)
        self.assertFalse(result.authorized)
        self.assertEqual(result.reason, "ssh-key-not-authorized")

    def test_unresolvable_host_is_not_reachable(self) -> None:
        error = Exception()
        error.stderr = "fatal: Could not resolve host: git.internal"
        fake_git = mock.Mock()
        fake_git.ls_remote.side_effect = error
        with mock.patch("git.Git", return_value=fake_git):
            result = git_access_service.check_repository_access(self._remote())

        self.assertFalse(result.reachable)
        self.assertFalse(result.authorized)


class ForgeGuidance(unittest.TestCase):
    def test_github_guidance_links_the_repository_deploy_key_page(self) -> None:
        guidance = git_access_service.guidance_for(
            parse_remote_url("https://github.com/pixxelhq/JTYU-IN.git")
        )
        self.assertEqual(guidance.forge, "GitHub")
        self.assertEqual(
            guidance.deploy_key_url, "https://github.com/pixxelhq/JTYU-IN/settings/keys"
        )
        # The single-repository limit is the thing nothing in the product said.
        self.assertIn("machine user", guidance.instructions)

    def test_scp_style_url_produces_the_same_link(self) -> None:
        guidance = git_access_service.guidance_for(
            parse_remote_url("git@github.com:pixxelhq/JTYU-IN.git")
        )
        self.assertEqual(
            guidance.deploy_key_url, "https://github.com/pixxelhq/JTYU-IN/settings/keys"
        )

    def test_gitlab_guidance_is_recognised(self) -> None:
        guidance = git_access_service.guidance_for(
            parse_remote_url("https://gitlab.com/group/board.git")
        )
        self.assertEqual(guidance.forge, "GitLab")
        self.assertIn("/-/settings/repository", guidance.deploy_key_url or "")

    def test_self_hosted_forge_still_gets_instructions(self) -> None:
        guidance = git_access_service.guidance_for(
            parse_remote_url("ssh://git@git.internal.example/hw/board.git")
        )
        self.assertEqual(guidance.forge, "git.internal.example")
        self.assertIsNone(guidance.deploy_key_url)
        self.assertIn("deploy key", guidance.instructions)


class KeyDescription(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory()
        self.public = Path(self._temporary.name) / "id_ed25519.pub"
        self.addCleanup(self._temporary.cleanup)
        patcher = mock.patch.object(
            git_access_service, "public_key_path", return_value=self.public
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_missing_key_reports_absent(self) -> None:
        self.assertFalse(git_access_service.describe_key().exists)

    def test_key_is_described_with_its_fingerprint(self) -> None:
        self.public.write_text("ssh-ed25519 AAAAC3Nz prism@workspace\n", encoding="utf-8")
        with mock.patch.object(
            git_access_service.subprocess,
            "run",
            return_value=mock.Mock(
                returncode=0, stdout="256 SHA256:abcdef prism@workspace (ED25519)\n"
            ),
        ):
            info = git_access_service.describe_key()

        self.assertTrue(info.exists)
        self.assertEqual(info.key_type, "ssh-ed25519")
        self.assertEqual(info.comment, "prism@workspace")
        # The fingerprint is what a forge shows beside an authorised key, so it
        # is the only way to confirm the pasted key is the one Prism uses.
        self.assertEqual(info.fingerprint, "SHA256:abcdef")


if __name__ == "__main__":
    unittest.main()
