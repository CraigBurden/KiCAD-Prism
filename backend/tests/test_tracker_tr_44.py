"""TR-44: backup/restore of encrypted tracker data and key-rotation recovery."""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

from pydantic import SecretStr

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import Settings  # noqa: E402
from app.services.trackers.credential_sidecars import (  # noqa: E402
    load_oauth_client,
    load_webhook_secret,
    store_oauth_client,
    store_webhook_secret,
)
from app.services.trackers.inbox_store import InboxStore, apply_schema as apply_inbox_schema  # noqa: E402
from app.services.trackers.migrations import (  # noqa: E402
    migrate_tracker_webhook_oauth_tables,
    migrate_workspace_tracker_tables,
)
from app.services.trackers.op_store import (  # noqa: E402
    EXECUTE_DISPATCH,
    RECOVERY_DISPATCH,
    OpStore,
    apply_schema as apply_op_schema,
)
from app.services.trackers.secrets import (  # noqa: E402
    SecretIntegrityError,
    SecretStoreLocked,
    decrypt_secret,
    encrypt_secret,
    inspect_envelope,
    rewrap_secret,
)
from app.services.trackers.store import TrackerStore  # noqa: E402
from app.services.comments_schema_migrations import COMMENTS_LEDGER  # noqa: E402
from support.postgres import requires_scratch_postgres, scratch_schema, seed_comment  # noqa: E402

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "tracker-integration"
F3 = json.loads((DOCS / "fixtures" / "F03.json").read_text(encoding="utf-8"))
F5 = json.loads((DOCS / "fixtures" / "F05.json").read_text(encoding="utf-8"))


CONNECTOR = "cn_gh_tr44"
CONTAINER = "987654321"
REPO = "acme/openswitch"
COMMENT_ID = "c_tr44_root"
THREAD_ID = "tt_tr44"
OP_PENDING = "op_tr44_pending"
OP_SENT = "op_tr44_sent"
BOT_ID = "199001"
BOT_LOGIN = "prism[bot]"
INSTALLATION_MATERIAL = "installation-private-key-fixture-text"
WEBHOOK_SECRET = "webhook-signing-secret-fixture"
OAUTH_CLIENT_ID = "Iv1.oauth-client-fixture"
OAUTH_CLIENT_SECRET = "oauth-client-secret-fixture"
USER_TOKEN = "user-oauth-token-fixture"
TEST_SESSION_SECRET = "unit-test-session-secret-not-a-credential"


def _hex_key() -> str:
    return os.urandom(32).hex()


def _settings(**overrides) -> Settings:
    base = {
        "AUTH_ENABLED": True,
        "OIDC_ISSUER_URL": "https://idp.example.com",
        "OIDC_CLIENT_ID": "prism",
        "OIDC_CLIENT_SECRET": "shhh",
        "SESSION_SECRET": TEST_SESSION_SECRET,
        "PRISM_DATABASE_URL": "postgresql://prism@localhost/prism",
        "TRACKER_CREDENTIAL_ROOT_KEY": SecretStr(""),
        "TRACKER_CREDENTIAL_ROOT_KEY_ID": "v1",
        "TRACKER_CREDENTIAL_PREVIOUS_ROOT_KEY": SecretStr(""),
        "TRACKER_CREDENTIAL_PREVIOUS_ROOT_KEY_ID": "",
    }
    base.update(overrides)
    return Settings(_env_file=None, **base)


def _credential_context(connector_id: str = CONNECTOR) -> dict[str, str]:
    return {"record": connector_id, "field": "github_app"}


def _token_context(identity_id: str) -> dict[str, str]:
    return {"record": identity_id, "field": "user_oauth"}



@requires_scratch_postgres("tracker persistence tests")
class BackupRestorePostgresTests(unittest.TestCase):
    """Disposable-schema stand-in for restore into a fresh deployment."""

    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "tr44", ledgers=(COMMENTS_LEDGER,), then=(migrate_workspace_tracker_tables,))
        self.schema, self.conn = self.scratch.name, self.scratch.conn
        migrate_tracker_webhook_oauth_tables(self.conn)
        apply_op_schema(self.conn)
        apply_inbox_schema(self.conn)
        self.store = TrackerStore(self.conn)
        self.ops = OpStore(self.conn)
        self.inbox = InboxStore(self.conn)
        self.v1 = _hex_key()
        self.v2 = _hex_key()
        self.settings_v1 = _settings(
            TRACKER_CREDENTIAL_ROOT_KEY=SecretStr(self.v1),
            TRACKER_CREDENTIAL_ROOT_KEY_ID="v1",
        )
        self._seed_destination_and_comment()

    def _seed_destination_and_comment(self) -> None:
        envelope = encrypt_secret(
            INSTALLATION_MATERIAL, _credential_context(), settings=self.settings_v1
        )
        self.store.upsert_connector(
            connector_id=CONNECTOR,
            provider="github",
            instance_kind="github.com",
            bot_forge_user_id=BOT_ID,
            bot_login=BOT_LOGIN,
            credential_envelope=envelope,
        )
        store_webhook_secret(
            self.conn, CONNECTOR, WEBHOOK_SECRET, settings=self.settings_v1
        )
        store_oauth_client(
            self.conn,
            CONNECTOR,
            client_id=OAUTH_CLIENT_ID,
            client_secret=OAUTH_CLIENT_SECRET,
            settings=self.settings_v1,
        )
        identity_id = "ui_tr44"
        token_envelope = encrypt_secret(
            USER_TOKEN, _token_context(identity_id), settings=self.settings_v1
        )
        self.conn.execute(
            """
            INSERT INTO user_identities (
                id, user_id, connector_id, provider, forge_user_id, forge_login, token_envelope
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (identity_id, "u_tr44", CONNECTOR, "github", "42", "alice", token_envelope),
        )
        self.store.set_project_tracker(
            project_tracker_id="pt_tr44",
            project_id="prj_tr44",
            connector_id=CONNECTOR,
            container_kind="repo",
            container_path=REPO,
            remote_container_id=CONTAINER,
            generation=1,
            visibility="private",
        )
        seed_comment(
            self.conn,
            COMMENT_ID,
            "prj_tr44",
            author="Priya",
            author_kind="user",
            content="original body",
            severity="major",
            comment_class="observation",
            context="PCB",
            location_x=1.0,
            location_y=2.0,
            location_layer="F.Cu",
            revision=2,
        )
        self.conn.execute(
            """
            INSERT INTO comment_revisions (
                project_id, target_kind, target_id, revision, change_kind,
                content, severity, comment_class, status, editor_user_id,
                editor_kind, editor_display, origin
            ) VALUES
                (%s, 'root', %s, 1, 'create', 'original body', 'major',
                 'observation', 'OPEN', 'u_tr44', 'user', 'Priya', 'prism'),
                (%s, 'root', %s, 2, 'edit', 'revised body', 'major',
                 'observation', 'OPEN', 'u_tr44', 'user', 'Priya', 'prism')
            """,
            ("prj_tr44", COMMENT_ID, "prj_tr44", COMMENT_ID),
        )
        self.store.insert_thread(
            thread_id=THREAD_ID,
            comment_id=COMMENT_ID,
            project_tracker_id="pt_tr44",
            destination_generation=1,
            connector_id=CONNECTOR,
            remote_container_id=CONTAINER,
            external_id="pending",
            link_state="linked",
        )
        self.conn.commit()

    def _reload_as_restored_deployment(self) -> None:
        """Simulate workers reconnecting after pg_restore into a disposable DB."""
        self.conn.commit()
        self.conn.execute(f'SET search_path TO "{self.schema}", public')
        # Clear any live leases the way a restarted worker fleet would.
        self.conn.execute(
            """
            UPDATE sync_ops
            SET claimed_by = NULL, lease_expires_at = NULL
            WHERE claimed_by IS NOT NULL
            """
        )
        self.conn.execute(
            """
            UPDATE remote_hints
            SET claimed_by = NULL, lease_expires_at = NULL
            WHERE claimed_by IS NOT NULL
            """
        )
        self.conn.commit()

    def test_restored_envelopes_decrypt_with_assigned_key(self) -> None:
        # F3.envelope_encryption_roundtrip under restore settings.
        self._reload_as_restored_deployment()
        restored = _settings(
            TRACKER_CREDENTIAL_ROOT_KEY=SecretStr(self.v1),
            TRACKER_CREDENTIAL_ROOT_KEY_ID="v1",
        )
        row = self.conn.execute(
            "SELECT credential_envelope FROM tracker_connectors WHERE id = %s",
            (CONNECTOR,),
        ).fetchone()
        self.assertIsNotNone(row)
        self.assertNotIn(INSTALLATION_MATERIAL, row["credential_envelope"])
        self.assertEqual(
            decrypt_secret(
                row["credential_envelope"], _credential_context(), settings=restored
            ).decode(),
            INSTALLATION_MATERIAL,
        )
        self.assertEqual(
            load_webhook_secret(self.conn, CONNECTOR, settings=restored), WEBHOOK_SECRET
        )
        client_id, client_secret = load_oauth_client(
            self.conn, CONNECTOR, settings=restored
        )
        self.assertEqual(client_id, OAUTH_CLIENT_ID)
        self.assertEqual(client_secret, OAUTH_CLIENT_SECRET)
        identity = self.conn.execute(
            "SELECT id, token_envelope FROM user_identities WHERE id = %s",
            ("ui_tr44",),
        ).fetchone()
        self.assertEqual(
            decrypt_secret(
                identity["token_envelope"],
                _token_context(identity["id"]),
                settings=restored,
            ).decode(),
            USER_TOKEN,
        )
        revisions = self.conn.execute(
            """
            SELECT revision, content FROM comment_revisions
            WHERE target_id = %s ORDER BY revision
            """,
            (COMMENT_ID,),
        ).fetchall()
        self.assertEqual(
            [(row["revision"], row["content"]) for row in revisions],
            [(1, "original body"), (2, "revised body")],
        )

    def test_wrong_or_missing_key_preserves_ciphertext(self) -> None:
        self._reload_as_restored_deployment()
        before = self.conn.execute(
            "SELECT credential_envelope FROM tracker_connectors WHERE id = %s",
            (CONNECTOR,),
        ).fetchone()["credential_envelope"]
        missing = _settings()
        with self.assertRaises(SecretStoreLocked):
            decrypt_secret(before, _credential_context(), settings=missing)
        wrong = _settings(
            TRACKER_CREDENTIAL_ROOT_KEY=SecretStr(_hex_key()),
            TRACKER_CREDENTIAL_ROOT_KEY_ID="v9",
        )
        with self.assertRaises(SecretIntegrityError):
            decrypt_secret(before, _credential_context(), settings=wrong)
        after = self.conn.execute(
            "SELECT credential_envelope FROM tracker_connectors WHERE id = %s",
            (CONNECTOR,),
        ).fetchone()["credential_envelope"]
        self.assertEqual(after, before)
        comment = self.conn.execute(
            "SELECT content FROM comments WHERE id = %s", (COMMENT_ID,)
        ).fetchone()
        self.assertEqual(comment["content"], "original body")
        redacted = inspect_envelope(before, settings=missing)
        self.assertEqual(redacted.status, "locked")
        self.assertEqual(redacted.keyId, "v1")

    def test_rotation_grace_covers_previous_and_current_kids(self) -> None:
        # F3.key_rotation across a restore-shaped keyring.
        blob_v1 = self.conn.execute(
            "SELECT credential_envelope FROM tracker_connectors WHERE id = %s",
            (CONNECTOR,),
        ).fetchone()["credential_envelope"]
        rotated = _settings(
            TRACKER_CREDENTIAL_ROOT_KEY=SecretStr(self.v2),
            TRACKER_CREDENTIAL_ROOT_KEY_ID="v2",
            TRACKER_CREDENTIAL_PREVIOUS_ROOT_KEY=SecretStr(self.v1),
            TRACKER_CREDENTIAL_PREVIOUS_ROOT_KEY_ID="v1",
        )
        self.assertEqual(
            decrypt_secret(blob_v1, _credential_context(), settings=rotated).decode(),
            INSTALLATION_MATERIAL,
        )
        blob_v2 = rewrap_secret(blob_v1, _credential_context(), settings=rotated)
        self.assertEqual(json.loads(blob_v2)["kid"], "v2")
        self.conn.execute(
            "UPDATE tracker_connectors SET credential_envelope = %s WHERE id = %s",
            (blob_v2, CONNECTOR),
        )
        self.conn.commit()
        self._reload_as_restored_deployment()
        only_v2 = _settings(
            TRACKER_CREDENTIAL_ROOT_KEY=SecretStr(self.v2),
            TRACKER_CREDENTIAL_ROOT_KEY_ID="v2",
        )
        restored = self.conn.execute(
            "SELECT credential_envelope FROM tracker_connectors WHERE id = %s",
            (CONNECTOR,),
        ).fetchone()["credential_envelope"]
        self.assertEqual(
            decrypt_secret(restored, _credential_context(), settings=only_v2).decode(),
            INSTALLATION_MATERIAL,
        )
        with self.assertRaises(SecretIntegrityError):
            decrypt_secret(blob_v1, _credential_context(), settings=only_v2)

    def test_pending_and_sent_ops_resume_without_blind_creates(self) -> None:
        # F5.crash_before_send / F5.claim_of_sent_is_recovery after restore.
        other_comment = "c_tr44_sent"
        other_thread = "tt_tr44_sent"
        seed_comment(
            self.conn,
            other_comment,
            "prj_tr44",
            author="Priya",
            content="already sent",
            severity="major",
            revision=1,
        )
        self.store.insert_thread(
            thread_id=other_thread,
            comment_id=other_comment,
            project_tracker_id="pt_tr44",
            destination_generation=1,
            connector_id=CONNECTOR,
            remote_container_id=CONTAINER,
            external_id="412",
            link_state="linked",
        )
        self.ops.insert(
            op_id=OP_SENT,
            tracked_thread_id=other_thread,
            op="create_issue",
            destination_generation=1,
        )
        claimed = self.ops.claim("pre-restore-worker")
        self.assertEqual(claimed["id"], OP_SENT)
        self.ops.mark_sent(OP_SENT, int(claimed["fence"]))
        self.conn.execute(
            """
            UPDATE sync_ops
            SET claimed_by = NULL, lease_expires_at = NULL
            WHERE id = %s
            """,
            (OP_SENT,),
        )
        self.ops.insert(
            op_id=OP_PENDING,
            tracked_thread_id=THREAD_ID,
            op="create_issue",
            destination_generation=1,
        )
        self.conn.commit()
        self.assertEqual(self.ops.get(OP_PENDING)["state"], "pending")
        self.assertEqual(self.ops.get(OP_SENT)["state"], "sent")

        self._reload_as_restored_deployment()

        pending_claim = self.ops.claim("post-restore-pending")
        self.assertIsNotNone(pending_claim)
        self.assertEqual(pending_claim["id"], OP_PENDING)
        self.assertEqual(pending_claim["dispatch"], EXECUTE_DISPATCH)
        self.assertEqual(pending_claim["state"], "pending")
        # Keep the pending lease so the sent op is next to claim.
        sent_claim = self.ops.claim("post-restore-sent")
        self.assertIsNotNone(sent_claim)
        self.assertEqual(sent_claim["id"], OP_SENT)
        self.assertEqual(sent_claim["dispatch"], RECOVERY_DISPATCH)
        self.assertEqual(sent_claim["state"], "sent")

    def test_webhook_inbox_survives_restore_and_stays_idempotent(self) -> None:
        delivery_id = "del_tr44_restore"
        first = self.inbox.enqueue(
            connector_id=CONNECTOR,
            delivery_id=delivery_id,
            hints=[
                {
                    "objectKind": "issue",
                    "remoteContainerId": CONTAINER,
                    "externalId": "412",
                    "event": "opened",
                }
            ],
        )
        self.assertTrue(first["created"])
        self.conn.commit()
        self._reload_as_restored_deployment()
        deliveries = self.conn.execute(
            "SELECT delivery_id FROM remote_deliveries WHERE connector_id = %s",
            (CONNECTOR,),
        ).fetchall()
        self.assertEqual([row["delivery_id"] for row in deliveries], [delivery_id])
        hints = self.conn.execute(
            "SELECT state, external_id FROM remote_hints WHERE delivery_id = %s",
            (delivery_id,),
        ).fetchall()
        self.assertEqual(len(hints), 1)
        self.assertEqual(hints[0]["state"], "pending")
        self.assertEqual(hints[0]["external_id"], "412")
        replay = self.inbox.enqueue(
            connector_id=CONNECTOR,
            delivery_id=delivery_id,
            hints=[
                {
                    "objectKind": "issue",
                    "remoteContainerId": CONTAINER,
                    "externalId": "999",
                    "event": "opened",
                }
            ],
        )
        self.assertFalse(replay["created"])
        count = self.conn.execute(
            "SELECT COUNT(*) AS n FROM remote_hints WHERE delivery_id = %s",
            (delivery_id,),
        ).fetchone()["n"]
        self.assertEqual(count, 1)


if __name__ == "__main__":
    unittest.main()
