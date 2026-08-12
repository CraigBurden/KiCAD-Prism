"""Stage 3 policy-authoring and public-share security boundaries."""

from __future__ import annotations

import hashlib
import asyncio
import unittest
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.release_studio.policy import PolicyError
from app.services import release_policy_service as policy_store
from app.services import release_studio_service as release_store


class PolicyAuthoringTests(unittest.TestCase):
    def test_authoring_uses_the_rule_catalogue_as_its_validation_boundary(self) -> None:
        normalized = policy_store._normalize_document(
            {
                "rules": [
                    {
                        "id": "stackup.min_copper_layers",
                        "severity": "failure",
                        "params": {"minimum": 4},
                    }
                ],
                "required_approvals": [
                    {"role": "pcb_design", "domains": ["bare_board"]}
                ],
            }
        )
        self.assertEqual(normalized["schema"], "prism.release-studio.policy/1")
        with self.assertRaisesRegex(PolicyError, "unknown rule id"):
            policy_store._normalize_document({"rules": [{"id": "python.eval"}]})
        with self.assertRaisesRegex(PolicyError, "must be an integer"):
            policy_store._normalize_document(
                {
                    "rules": [
                        {
                            "id": "stackup.min_copper_layers",
                            "params": {"minimum": "four"},
                        }
                    ]
                }
            )

    def test_version_diff_is_stable_and_field_scoped(self) -> None:
        changes = policy_store._json_diff(
            {"rules": [{"id": "drc.clean"}], "title": "A"},
            {"rules": [{"id": "erc.clean"}], "title": "B"},
        )
        self.assertEqual(
            [change["path"] for change in changes],
            ["$.rules[drc.clean]", "$.rules[erc.clean]", "$.title"],
        )

    def test_version_diff_keys_approval_lists_by_role(self) -> None:
        changes = policy_store._json_diff(
            {
                "required_approvals": [
                    {"role": "manufacturing", "domains": ["assembly"]},
                    {"role": "pcb_design", "domains": ["bare_board"]},
                ]
            },
            {
                "required_approvals": [
                    {"role": "pcb_design", "domains": ["bare_board", "documentation"]},
                    {"role": "manufacturing", "domains": ["assembly"]},
                ]
            },
        )
        self.assertEqual(
            [change["path"] for change in changes],
            ["$.required_approvals[pcb_design].domains"],
        )

    def test_inheritance_preview_binds_a_published_version(self) -> None:
        org = {
            "rules": [{"id": "build.hermetic", "severity": "blocker"}],
            "required_approvals": [],
            "content_digest": "a" * 64,
        }
        with patch.object(policy_store, "load_published", return_value=org):
            preview = policy_store.inheritance_preview(
                {
                    "extends": "org:manufacturing@3",
                    "rules": [{"id": "erc.clean", "params": {"max_errors": 0}}],
                }
            )
        self.assertEqual(
            [rule["rule_id"] for rule in preview["rules"]],
            ["build.hermetic", "erc.clean"],
        )
        self.assertEqual(preview["links"][0]["source"], "org:manufacturing@3")

    def test_retired_version_remains_loadable_only_for_existing_bindings(self) -> None:
        retired = {
            "status": "retired",
            "rules": {"rules": [{"id": "build.hermetic"}]},
            "content_digest": "a" * 64,
        }
        bound_connection = _Connection([retired])
        published_connection = _Connection([None])

        @contextmanager
        def bound_store():
            yield bound_connection

        @contextmanager
        def published_store():
            yield published_connection

        with patch.object(policy_store.store, "connect", bound_store):
            loaded = policy_store.load_bound_version("manufacturing", 3)
        with patch.object(policy_store.store, "connect", published_store):
            self.assertIsNone(policy_store.load_published("manufacturing", 3))

        self.assertEqual(loaded["content_digest"], "a" * 64)
        self.assertEqual(
            bound_connection.calls[0][1],
            ("manufacturing", 3, ["published", "retired"]),
        )
        self.assertEqual(
            published_connection.calls[0][1],
            ("manufacturing", 3, ["published"]),
        )


class _Connection:
    def __init__(self, rows):
        self.rows = iter(rows)
        self.calls = []

    def execute(self, query, params=()):
        self.calls.append((" ".join(str(query).split()), params))
        return self

    def fetchone(self):
        return next(self.rows)

    def fetchall(self):
        return list(self.rows)

    def commit(self):
        return None


class WebReleaseShareTests(unittest.TestCase):
    def test_raw_bearer_token_is_returned_once_and_never_persisted(self) -> None:
        token = "public-token-with-at-least-thirty-two-characters"
        connection = _Connection(
            [
                {"id": "record-1", "project_id": "project-1", "config_key": "default"},
                {"id": "share-1", "record_id": "record-1", "status": "active"},
            ]
        )

        @contextmanager
        def connected():
            yield connection

        with (
            patch.object(release_store, "connect", connected),
            patch.object(release_store.secrets, "token_urlsafe", return_value=token),
            patch.object(release_store, "append_audit_event"),
            patch.object(release_store, "_new_id", return_value="share-1"),
        ):
            share = release_store.create_web_share("record-1", actor="admin@example.com")

        self.assertEqual(share["token"], token)
        insert = next(call for call in connection.calls if "INSERT INTO ws_release_web_shares" in call[0])
        self.assertNotIn(token, insert[1])
        self.assertIn(hashlib.sha256(token.encode()).hexdigest(), insert[1])

    def test_resolution_hashes_the_token_and_filters_revoked_or_expired_rows(self) -> None:
        token = "shared-release-token"
        connection = _Connection([None])

        @contextmanager
        def connected():
            yield connection

        with patch.object(release_store, "connect", connected):
            self.assertIsNone(release_store.resolve_web_share(token))
        query, params = connection.calls[0]
        self.assertIn("s.status='active'", query)
        self.assertIn("s.expires_at > NOW()", query)
        self.assertEqual(params, (hashlib.sha256(token.encode()).hexdigest(),))


class PublicReleaseHardeningTests(unittest.TestCase):
    def test_public_release_fails_closed_when_offline_verification_fails(self) -> None:
        from app.api import release_studio as api

        record = {"id": "record-1", "project_id": "project-1"}
        with (
            patch.object(api, "_release_archive", return_value=(record, b"archive")),
            patch.object(
                api.store,
                "list_signing_keys",
                return_value=[
                    {
                        "key_id": "key-1",
                        "public_key": "-----BEGIN PUBLIC KEY-----\ninvalid\n-----END PUBLIC KEY-----",
                        "status": "active",
                    }
                ],
            ),
            patch.object(
                api,
                "verify_archive_bytes",
                return_value=SimpleNamespace(to_dict=lambda: {"ok": False, "checks": []}),
            ),
        ):
            with self.assertRaises(HTTPException) as caught:
                api._verified_public_archive(record)

        self.assertEqual(caught.exception.status_code, 409)

    def test_public_member_verifies_the_release_before_exposing_a_member(self) -> None:
        from app.api import release_studio as api

        share = {"id": "share-1"}
        record = {"id": "record-1", "project_id": "project-1"}
        build = {"id": "build-1"}
        with (
            patch.object(api, "_public_share", return_value=(share, record, build)),
            patch.object(api, "_verified_public_archive") as verify,
            patch.object(api, "_released_member_response", return_value="response") as serve,
        ):
            result = asyncio.run(api.public_release_member("token", "fabrication/board.gbr"))

        self.assertEqual(result, "response")
        verify.assert_called_once_with(record)
        serve.assert_called_once_with(
            build,
            "fabrication/board.gbr",
            disposition="inline",
            public_share=True,
        )


if __name__ == "__main__":
    unittest.main()
