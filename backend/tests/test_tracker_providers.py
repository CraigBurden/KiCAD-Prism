"""Provider registry: which hosts publish issues, and provider-aware wording."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.trackers import providers  # noqa: E402
from app.services.trackers.errors import ProviderError  # noqa: E402
from app.services.trackers.inbound import CallableFetcher  # noqa: E402
from app.services.trackers.connector_runtime import (  # noqa: E402
    connector_status,
    ContextInboundFetcher,
    DestinationContext,
    TrackerProviderBundle,
)
from app.services.trackers.provenance import resolve_editor  # noqa: E402
from app.services.trackers.state_mutations import supersession_message  # noqa: E402


class ProviderRegistryTests(unittest.TestCase):
    def test_github_is_the_only_issue_provider_today(self) -> None:
        self.assertTrue(providers.is_issue_provider("github"))
        self.assertFalse(providers.is_issue_provider("gitea"))
        self.assertFalse(providers.is_issue_provider(""))

    def test_unknown_provider_is_a_data_error_not_account_linking(self) -> None:
        with self.assertRaises(ProviderError) as caught:
            providers.kit_for("")
        self.assertEqual(caught.exception.class_, "invalid_request")
        self.assertNotIn("account linking", str(caught.exception))

    def test_gitea_is_a_linking_only_kit(self) -> None:
        kit = providers.host_kit("gitea")
        self.assertTrue(kit.linking_only)
        self.assertEqual(kit.instance_kinds, ("self-hosted",))
        self.assertFalse(providers.host_kit("gitlab").linking_only)
        with self.assertRaises(ProviderError):
            providers.host_kit("bitbucket")

    def test_web_urls_follow_the_connectors_instance(self) -> None:
        github = {"provider": "github", "instance_kind": "github.com", "base_url": ""}
        ghes = {"provider": "github", "instance_kind": "ghes", "base_url": "https://ghe.acme.io/api/v3"}
        gitlab = {"provider": "gitlab", "instance_kind": "self-hosted", "base_url": "https://gitlab.acme.io"}
        self.assertEqual(providers.issue_web_url(github, "acme/board", 7), "https://github.com/acme/board/issues/7")
        self.assertEqual(providers.issue_web_url(ghes, "acme/board", 7), "https://ghe.acme.io/acme/board/issues/7")
        self.assertEqual(
            providers.comment_web_url(ghes, "acme/board", 7, "99"),
            "https://ghe.acme.io/acme/board/issues/7#issuecomment-99",
        )
        self.assertEqual(
            providers.comment_web_url(gitlab, "hw/boards/board", 7, "7:99"),
            "https://gitlab.acme.io/hw/boards/board/-/issues/7#note_99",
        )

    def test_inbound_fetcher_carries_the_destination_provider(self) -> None:
        bundle = TrackerProviderBundle(
            connector_id="cn_1", provider="github", issue=object(), comment=object(),
            bot_user_id="", bot_login="",
        )
        ctx = DestinationContext(
            connector_id="cn_1", remote_container_id="1", container_path="acme/board",
            destination_generation=1, paused=False, provider="github", writes_enabled=True,
        )
        self.assertEqual(ContextInboundFetcher(bundle, ctx).provider, "github")
        self.assertEqual(CallableFetcher(provider="gitlab").provider, "gitlab")

    def test_account_linking_hosts_are_refused_by_name(self) -> None:
        with self.assertRaises(ProviderError) as caught:
            providers.kit_for("gitea")
        self.assertEqual(caught.exception.class_, "capability_missing")
        self.assertIn("Gitea", str(caught.exception))

    def test_credential_payload_accepts_snake_case_and_requires_every_field(self) -> None:
        kit = providers.kit_for("github")
        payload = kit.credential_payload({"app_id": "1", "installationId": "2"})
        self.assertEqual(payload, {"appId": "1", "installationId": "2", "privateKey": ""})
        self.assertTrue(kit.has_credentials({"app_id": "1"}))
        with self.assertRaises(ProviderError):
            kit.require_complete(payload)

    def test_display_names_keep_brand_casing(self) -> None:
        self.assertEqual(providers.display_name("gitlab"), "GitLab")
        self.assertEqual(providers.display_name("github.com"), "GitHub")


class ConnectorStatusTests(unittest.TestCase):
    """One status per connector, derived once on the server (the UI only labels it)."""

    def _row(self, **overrides):  # noqa: ANN003
        row = {
            "provider": "github",
            "credentialConfigured": True,
            "bot_forge_user_id": "199001",
            "paused": False,
            "paused_reason": None,
        }
        row.update(overrides)
        return row

    def test_tested_unpaused_connector_is_ready(self) -> None:
        self.assertEqual(connector_status(self._row()), "ready")

    def test_lost_auth_and_revoke_read_as_revoked(self) -> None:
        # auth_lost is what executor_support writes when the forge rejects the credentials.
        self.assertEqual(connector_status(self._row(paused=True, paused_reason="auth_lost")), "revoked")
        self.assertEqual(
            connector_status(self._row(paused=True, paused_reason="revoked", credentialConfigured=False)),
            "revoked",
        )

    def test_github_without_its_app_is_revoked_but_gitlab_links_accounts(self) -> None:
        self.assertEqual(connector_status(self._row(credentialConfigured=False)), "revoked")
        self.assertEqual(connector_status(self._row(provider="gitlab", credentialConfigured=False)), "linking-only")
        self.assertEqual(connector_status(self._row(provider="gitea", credentialConfigured=False)), "linking-only")

    def test_untested_or_failed_test_needs_a_test(self) -> None:
        self.assertEqual(connector_status(self._row(bot_forge_user_id=None)), "needs-test")
        self.assertEqual(connector_status(self._row(paused=True, paused_reason="test_failed")), "needs-test")

    def test_other_pauses_are_paused(self) -> None:
        self.assertEqual(connector_status(self._row(paused=True, paused_reason="admin")), "paused")
        self.assertEqual(connector_status(self._row(paused=True, paused_reason="permissions")), "paused")


class ProviderWordingTests(unittest.TestCase):
    def test_editor_names_the_connectors_forge(self) -> None:
        self.assertEqual(resolve_editor(actor_login="ana", provider="gitlab").display, "ana (GitLab)")
        self.assertEqual(resolve_editor(provider="gitlab").display, "edited on GitLab")
        self.assertEqual(resolve_editor(actor_login="ana").display, "ana (GitHub)")

    def test_supersession_note_names_the_connectors_forge(self) -> None:
        note = supersession_message(remote_state="closed", local_intent_state="open", provider="gitlab")
        self.assertEqual(note, "Closed on GitLab after this thread was reopened in Prism")


if __name__ == "__main__":
    unittest.main()
