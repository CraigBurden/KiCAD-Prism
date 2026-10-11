"""One contract, every issue-capable provider kit, through fake HTTP.

Each case builds the kit's adapters exactly as the connector runtime does
(``providers.issue_adapter_for`` / ``comment_adapter_for``) over a
``TrackerHttp`` whose sender is a route table speaking the forge's own JSON.
A new kit joins by adding one ``_Kit`` subclass; the cases do not change.
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402

from app.services.trackers import providers  # noqa: E402
from app.services.trackers.contracts import (  # noqa: E402
    Destination,
    ForbiddenRead,
    GoneConfirmed,
    IssueContextBlock,
    IssueDraft,
    RemoteIssue,
    UncertainAbsence,
)
from app.services.trackers.github_recovery import RecoveryKind, recover_create_issue  # noqa: E402
from app.services.trackers.http import TrackerHttp  # noqa: E402
from app.services.trackers.markers import build_marker  # noqa: E402

BOT_ID = "900"
HUMAN_ID = "42"


class _Raw:
    def __init__(self, status: int, payload: Any = None, *, headers: dict | None = None, url: str = "") -> None:
        self.status_code = status
        self.headers = headers or {}
        self.content = json.dumps(payload if payload is not None else {}).encode()
        self.reason = "status"
        self.url = url
        self.text = self.content.decode()

    def json(self) -> Any:
        return json.loads(self.content.decode())


class _Kit:
    """How one forge spells the shared contract's requests and payloads."""

    provider = ""
    host = ""
    connector: dict[str, Any] = {}
    material: dict[str, Any] = {}
    dest: Destination

    def setup_auth(self, forge: "_Forge") -> None:
        """Queue whatever the kit's auth needs before the first API call."""

    def issue_url(self, number: int) -> str:
        raise NotImplementedError

    def issues_url(self) -> str:
        raise NotImplementedError

    def comment_id(self, number: int, note: int) -> str:
        raise NotImplementedError

    def comment_url(self, number: int, note: int) -> str:
        raise NotImplementedError

    def issue_payload(self, number: int, *, body: str, author_id: str) -> dict[str, Any]:
        raise NotImplementedError


def _pem() -> str:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()


class _GitHub(_Kit):
    provider = "github"
    host = "api.github.com"
    api = "https://api.github.com"
    connector = {
        "id": "cn_gh", "provider": "github", "instance_kind": "github.com", "base_url": "",
        "bot_forge_user_id": BOT_ID, "bot_login": "prism[bot]",
    }
    dest = Destination(
        connectorId="cn_gh", containerKind="repo", containerPath="acme/board", remoteContainerId="987", generation=1
    )

    def __init__(self) -> None:
        self.material = {"appId": "772215", "installationId": "88001122", "privateKey": _pem()}

    def setup_auth(self, forge: "_Forge") -> None:
        forge.on(
            "POST",
            f"{self.api}/app/installations/88001122/access_tokens",
            201,
            {"token": "installation-token", "expires_at": "2999-01-01T00:00:00Z", "permissions": {"issues": "write"}},
            repeat=True,
        )

    def issue_url(self, number: int) -> str:
        return f"{self.api}/repos/acme/board/issues/{number}"

    def issues_url(self) -> str:
        return f"{self.api}/repos/acme/board/issues"

    def comment_id(self, number: int, note: int) -> str:
        return str(note)

    def comment_url(self, number: int, note: int) -> str:
        return f"{self.api}/repos/acme/board/issues/comments/{note}"

    def issue_payload(self, number: int, *, body: str, author_id: str) -> dict[str, Any]:
        login = "prism[bot]" if author_id == BOT_ID else "ana"
        return {
            "id": 198400000 + number, "number": number, "title": "Fix the TVS diode", "body": body,
            "state": "open", "html_url": f"https://github.com/acme/board/issues/{number}",
            "user": {"id": int(author_id), "login": login, "type": "Bot" if author_id == BOT_ID else "User"},
            "labels": [], "assignees": [], "updated_at": "2026-09-25T10:00:00Z",
        }


class _GitLab(_Kit):
    provider = "gitlab"
    host = "git.example.com"
    api = "https://git.example.com/api/v4"
    connector = {
        "id": "cn_gl", "provider": "gitlab", "instance_kind": "self-hosted", "base_url": "https://git.example.com",
        "bot_forge_user_id": BOT_ID, "bot_login": "project_77_bot",
    }
    material = {"accessToken": "glpat-fixture-not-a-credential"}
    dest = Destination(
        connectorId="cn_gl", containerKind="repo", containerPath="hw/board", remoteContainerId="77", generation=1
    )

    def issue_url(self, number: int) -> str:
        return f"{self.api}/projects/77/issues/{number}"

    def issues_url(self) -> str:
        return f"{self.api}/projects/77/issues"

    def comment_id(self, number: int, note: int) -> str:
        return f"{number}:{note}"

    def comment_url(self, number: int, note: int) -> str:
        return f"{self.api}/projects/77/issues/{number}/notes/{note}"

    def issue_payload(self, number: int, *, body: str, author_id: str) -> dict[str, Any]:
        username = "project_77_bot" if author_id == BOT_ID else "ana"
        return {
            "id": 5000 + number, "iid": number, "project_id": 77, "title": "Fix the TVS diode",
            "description": body, "state": "opened", "labels": [], "assignees": [],
            "author": {"id": int(author_id), "username": username, "name": username},
            "updated_at": "2026-09-25T10:00:00Z", "web_url": f"https://git.example.com/hw/board/-/issues/{number}",
        }


class _Forge:
    def __init__(self) -> None:
        self.routes: dict[tuple[str, str], list[tuple[_Raw, bool]]] = {}
        self.calls: list[tuple[str, str]] = []

    def on(self, method: str, url: str, status: int, payload: Any = None, *, headers=None, repeat=False) -> None:
        self.routes.setdefault((method, url), []).append((_Raw(status, payload, headers=headers, url=url), repeat))

    def send(self, method: str, url: str, **kwargs: Any) -> _Raw:
        self.calls.append((method.upper(), url))
        queued = self.routes.get((method.upper(), url))
        if not queued:
            return _Raw(404, {"message": "404 Not found"}, url=url)
        raw, repeat = queued[0]
        if not repeat:
            queued.pop(0)
        return raw


class KitContract:
    kit_type: type[_Kit]

    def setUp(self) -> None:  # noqa: D401
        self.kit = self.kit_type()
        self.forge = _Forge()
        self.kit.setup_auth(self.forge)
        http = TrackerHttp(extra_hosts=(self.kit.host,), sender=self.forge.send)
        self.issues = providers.issue_adapter_for(self.kit.connector, self.kit.material, http=http)
        self.comments = providers.comment_adapter_for(self.kit.connector, self.issues)

    def test_read_failures_map_to_typed_outcomes(self) -> None:
        for status, expected in ((404, UncertainAbsence), (410, GoneConfirmed), (403, ForbiddenRead)):
            with self.subTest(status=status):  # type: ignore[attr-defined]
                self.forge.on("GET", self.kit.issue_url(status), status, {"message": "nope"})
                self.assertIsInstance(self.issues.get_issue(self.kit.dest, str(status)), expected)  # type: ignore[attr-defined]

    def test_comment_absence_is_uncertain_not_gone(self) -> None:
        self.forge.on("GET", self.kit.comment_url(5, 11), 404, {"message": "nope"})
        result = self.comments.get_comment(self.kit.dest, self.kit.comment_id(5, 11))
        self.assertIsInstance(result, UncertainAbsence)  # type: ignore[attr-defined]

    def test_unauthorised_read_is_auth_lost(self) -> None:
        from app.services.trackers.errors import ProviderError

        self.forge.on("GET", self.kit.issue_url(7), 401, {"message": "bad credentials"})
        with self.assertRaises(ProviderError) as caught:  # type: ignore[attr-defined]
            self.issues.get_issue(self.kit.dest, "7")
        self.assertEqual(caught.exception.class_, "auth_lost")  # type: ignore[attr-defined]

    def test_created_issue_carries_its_number_and_the_kits_web_url(self) -> None:
        self.forge.on("POST", self.kit.issues_url(), 201, self.kit.issue_payload(12, body="Body", author_id=BOT_ID))
        draft = IssueDraft(
            title="Fix the TVS diode", proseBlock="Body", contextBlock=IssueContextBlock(board="board"),
            marker="<!-- prism:x -->", labels=[],
        )
        issue = self.issues.create_issue(self.kit.dest, draft, "op_1")
        self.assertIsInstance(issue, RemoteIssue)  # type: ignore[attr-defined]
        self.assertEqual(issue.number, 12)  # type: ignore[attr-defined]
        # The fallback the executors use when a forge omits the link agrees with the forge.
        self.assertEqual(  # type: ignore[attr-defined]
            providers.issue_web_url(self.kit.connector, self.kit.dest.containerPath, 12), issue.url
        )

    def test_recovery_finds_the_bots_marker_and_ignores_a_human_copy(self) -> None:
        op_id = "op_91a4c0de"
        marker = build_marker(
            connector_id=self.kit.dest.connectorId, container_id=self.kit.dest.remoteContainerId,
            comment_id="c_1", op_id=op_id,
        )
        self.forge.on(
            "GET",
            self.kit.issues_url(),
            200,
            [
                self.kit.issue_payload(3, body=f"copied\n\n{marker}", author_id=HUMAN_ID),
                self.kit.issue_payload(4, body=f"Body\n\n{marker}", author_id=BOT_ID),
            ],
        )
        outcome = recover_create_issue(
            {"id": op_id},
            dest=self.kit.dest,
            comment_id="c_1",
            fetch_page=self.issues.recovery_issue_pages(self.kit.dest),
            bot_user_id=BOT_ID,
        )
        self.assertEqual(outcome.kind, RecoveryKind.FOUND)  # type: ignore[attr-defined]
        self.assertEqual(outcome.match.number, 4)  # type: ignore[attr-defined]
        self.assertEqual([item["reason"] for item in outcome.audit], ["author_not_bot"])  # type: ignore[attr-defined]

    def test_failed_recovery_page_is_incomplete(self) -> None:
        self.forge.on("GET", self.kit.issues_url(), 502, {"message": "bad gateway"})
        outcome = recover_create_issue(
            {"id": "op_1"},
            dest=self.kit.dest,
            comment_id="c_1",
            fetch_page=self.issues.recovery_issue_pages(self.kit.dest),
            bot_user_id=BOT_ID,
        )
        self.assertEqual(outcome.kind, RecoveryKind.INCOMPLETE)  # type: ignore[attr-defined]


class GitHubKitContractTests(KitContract, unittest.TestCase):
    kit_type = _GitHub


class GitLabKitContractTests(KitContract, unittest.TestCase):
    kit_type = _GitLab


class KitCoverageTests(unittest.TestCase):
    def test_every_issue_capable_kit_runs_the_contract(self) -> None:
        covered = {kit.kit_type.provider for kit in (GitHubKitContractTests, GitLabKitContractTests)}
        issue_kits = {kit.provider for kit in providers.host_kits() if not kit.linking_only}
        self.assertEqual(covered, issue_kits)


if __name__ == "__main__":
    unittest.main()
