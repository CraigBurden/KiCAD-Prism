"""Comment attachments in forge issues and replies (issue #417).

Local bodies reference files as ``attachment:<id>``; a forge cannot resolve
that. At send time -- never in a frozen draft or a recorded hash of prose --
each reference becomes a URL the forge's readers can load:

* a provider that accepts uploads (GitLab) gets the file itself, uploaded
  once per destination and cached in ``comment_attachment_remote``;
* otherwise (GitHub has no attachment API) a signed, expiring Prism URL,
  served without a session by ``/api/public/comment-attachments``. The
  signature binds project, attachment and expiry, so it opens exactly one
  file and nothing else. The key is ``COMMENT_ATTACHMENT_LINK_SECRET``,
  shared by the API (verifies) and the worker (signs); without it the
  forge gets the file's name instead of an image.

Inbound bodies echo those URLs back. ``canonicalize_inbound`` maps them to
``attachment:<id>`` again before any comparison or write, so a forge echo is
not mistaken for a remote edit and local bodies never accumulate host URLs.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import time
from typing import Any, Callable, Optional
from urllib.parse import quote

from app.core.config import settings
from app.services import comment_attachments, comment_export

PUBLIC_PATH = "/api/public/comment-attachments"
_SIGNED_URL = re.compile(
    r"(?:https?://[^\s)\"']+)?" + re.escape(PUBLIC_PATH)
    + r"/(?P<project>[^/\s)\"']+)/(?P<id>[0-9a-f]{32})\?exp=(?P<exp>\d+)&(?:amp;)?sig=(?P<sig>[0-9a-f]{64})"
)


def apply_schema(conn: Any) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS comment_attachment_remote (
            attachment_id TEXT NOT NULL REFERENCES comment_attachments(id) ON DELETE CASCADE,
            connector_id TEXT NOT NULL,
            container_id TEXT NOT NULL,
            url TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (attachment_id, connector_id, container_id)
        );
        CREATE INDEX IF NOT EXISTS idx_comment_attachment_remote_dest
            ON comment_attachment_remote(connector_id, container_id);
        """,
        prepare=False,
    )


# ------------------------------------------------------------ signed links


def _key() -> Optional[bytes]:
    secret = settings.COMMENT_ATTACHMENT_LINK_SECRET.get_secret_value().strip()
    if not secret:
        return None
    return hmac.new(secret.encode(), b"prism:comment-attachment-link:v1", hashlib.sha256).digest()


def _signature(key: bytes, project_id: str, attachment_id: str, expires: int) -> str:
    message = f"{project_id}\n{attachment_id}\n{expires}".encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def signed_url(project_id: str, attachment_id: str, *, now: Optional[float] = None) -> Optional[str]:
    """An absolute, expiring URL for one attachment, or None when links are off."""
    ttl_days = int(settings.COMMENT_ATTACHMENT_LINK_TTL_DAYS)
    base = (settings.PUBLIC_BASE_URL or "").strip().rstrip("/")
    key = _key()
    if ttl_days <= 0 or not base or key is None:
        return None
    expires = int((now if now is not None else time.time()) + ttl_days * 86400)
    sig = _signature(key, project_id, attachment_id, expires)
    return f"{base}{PUBLIC_PATH}/{quote(project_id, safe='')}/{attachment_id}?exp={expires}&sig={sig}"


def verify_signature(project_id: str, attachment_id: str, expires: int, sig: str, *, now: Optional[float] = None) -> bool:
    key = _key()
    if key is None or expires < int(now if now is not None else time.time()):
        return False
    return hmac.compare_digest(_signature(key, project_id, attachment_id, expires), sig)


# ------------------------------------------------------------ outbound


class OutboundAttachments:
    """Resolves ``attachment:<id>`` for one forge destination."""

    def __init__(
        self,
        conn: Any,
        *,
        project_id: str,
        connector_id: str,
        container_id: str,
        upload: Optional[Callable[[str, bytes, str], str]] = None,
    ) -> None:
        self.conn = conn
        self.project_id = project_id
        self.connector_id = connector_id
        self.container_id = container_id
        self.upload = upload

    def _cached(self, attachment_id: str) -> Optional[str]:
        row = self.conn.execute(
            """SELECT url FROM comment_attachment_remote
               WHERE attachment_id = %s AND connector_id = %s AND container_id = %s""",
            (attachment_id, self.connector_id, self.container_id),
        ).fetchone()
        return str(row["url"]) if row else None

    def _uploaded(self, attachment_id: str) -> Optional[str]:
        row = comment_attachments.get(self.conn, self.project_id, attachment_id)
        if row is None or self.upload is None:
            return None
        path = comment_attachments.blob_path(row["sha256"])
        if not path.is_file():
            return None
        url = self.upload(str(row["filename"]), path.read_bytes(), str(row["media_type"]))
        self.conn.execute(
            """INSERT INTO comment_attachment_remote(attachment_id, connector_id, container_id, url)
               VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING""",
            (attachment_id, self.connector_id, self.container_id, url),
        )
        return url

    def target(self, attachment_id: str, _is_image: bool) -> Optional[str]:
        if comment_attachments.get(self.conn, self.project_id, attachment_id) is None:
            return None
        if self.upload is not None:
            return self._cached(attachment_id) or self._uploaded(attachment_id)
        return signed_url(self.project_id, attachment_id)

    def render(self, content: str, content_format: Optional[str]) -> str:
        if not comment_export.is_markdown(content_format):
            return content
        return comment_export.rewrite_attachment_targets(content, self.target)


# ------------------------------------------------------------ inbound


def canonicalize_inbound(
    conn: Any,
    text: str,
    *,
    project_id: str,
    connector_id: Optional[str] = None,
    container_id: Optional[str] = None,
) -> str:
    """Map URLs Prism itself sent back to ``attachment:<id>`` references."""
    if not text:
        return text

    def signed(match: re.Match) -> str:
        if match.group("project") != quote(project_id, safe=""):
            return match.group(0)
        if comment_attachments.get(conn, project_id, match.group("id")) is None:
            return match.group(0)
        return f"attachment:{match.group('id')}"

    text = _SIGNED_URL.sub(signed, text)
    if connector_id and container_id and "](" in text:
        rows = conn.execute(
            """SELECT r.url, r.attachment_id FROM comment_attachment_remote r
               JOIN comment_attachments a ON a.id = r.attachment_id
               WHERE r.connector_id = %s AND r.container_id = %s AND a.project_id = %s""",
            (connector_id, container_id, project_id),
        ).fetchall()
        for row in sorted(rows, key=lambda r: -len(str(r["url"]))):
            text = text.replace(f"]({row['url']})", f"](attachment:{row['attachment_id']})")
            text = text.replace(f"]({row['url']} ", f"](attachment:{row['attachment_id']} ")
    return text


def inbound_format(text: str) -> str:
    """Forge bodies are Markdown; store them so, and they render as written."""
    return comment_attachments.CONTENT_FORMAT_MARKDOWN if text else comment_attachments.CONTENT_FORMAT_PLAIN



def for_destination(conn: Any, *, project_id: str, destination: Any, adapter: Any = None) -> OutboundAttachments:
    """Outbound resolution for one destination; uploads when the adapter can host files."""
    upload = None
    upload_file = getattr(adapter, "upload_file", None)
    if callable(upload_file):
        def upload(filename: str, data: bytes, media_type: str) -> str:
            return upload_file(destination, filename, data, media_type)
    return OutboundAttachments(
        conn,
        project_id=project_id,
        connector_id=str(destination.connectorId),
        container_id=str(destination.remoteContainerId),
        upload=upload,
    )


def render_outbound(
    conn: Any,
    content: str,
    content_format: Optional[str],
    *,
    project_id: str,
    destination: Any,
    adapter_factory: Callable[[], Any],
) -> str:
    """``content`` as a forge receives it. Builds the adapter only if a file is referenced."""
    if not comment_export.attachment_ids(content, content_format):
        return content
    return for_destination(
        conn, project_id=project_id, destination=destination, adapter=adapter_factory(),
    ).render(content, content_format)
