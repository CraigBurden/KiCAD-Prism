"""Files attached to review comments (issue #417).

A reviewer pastes or drops a file into the composer before the comment
exists, so uploads land as ``pending`` rows. Saving a root or reply links
every ``attachment:<id>`` reference in its Markdown body; a pending upload
nobody links is swept after ``PENDING_TTL``.

Blobs are content-addressed under ``attachment_root()`` and never live in the
project repository. Images are decoded and re-encoded before storage for the
same reason as uploaded thumbnails (``derived_assets.store_uploaded_thumbnail``):
Prism serves them back to every project member, so the stored bytes must be
only pixels, never a polyglot or the uploader's EXIF block.
"""

from __future__ import annotations

import hashlib
import io
import os
import re
import tempfile
import uuid
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

from app.core.config import settings
from app.core import errors

PENDING_TTL = timedelta(hours=24)
MAX_IMAGE_PIXELS = 64_000_000
#: Markdown bodies are capped so one comment cannot become a document store.
MAX_CONTENT_CHARS = 64 * 1024

CONTENT_FORMAT_PLAIN = "plain"
CONTENT_FORMAT_MARKDOWN = "md"
CONTENT_FORMATS = (CONTENT_FORMAT_PLAIN, CONTENT_FORMAT_MARKDOWN)

STATE_PENDING = "pending"
STATE_ATTACHED = "attached"

_REF_PATTERN = re.compile(r"attachment:([0-9a-f]{32})\b")

#: Images Prism re-encodes, mapped to the format it stores them in. GIF becomes
#: PNG (first frame only) so the serving path has a single raster pipeline.
_IMAGE_FORMATS = {
    "PNG": ("PNG", "image/png", "png"),
    "JPEG": ("JPEG", "image/jpeg", "jpg"),
    "WEBP": ("WEBP", "image/webp", "webp"),
    "GIF": ("PNG", "image/png", "png"),
}

#: Non-image files stored verbatim, identified by their leading bytes or, for
#: text, by decoding cleanly. Always served as a download, never inline.
_FILE_TYPES = {
    "pdf": "application/pdf",
    "zip": "application/zip",
    "txt": "text/plain",
    "csv": "text/csv",
    "md": "text/markdown",
    "log": "text/plain",
}


class AttachmentError(errors.Invalid, ValueError):
    """An upload or reference was refused (422 unless the route says otherwise); ``code`` is stable for clients."""

    def __init__(self, detail: str, code: str) -> None:
        super().__init__(detail, code=code)


@dataclass(frozen=True)
class PreparedFile:
    data: bytes
    media_type: str
    extension: str
    width: Optional[int] = None
    height: Optional[int] = None

    @property
    def is_image(self) -> bool:
        return self.media_type.startswith("image/")


def attachment_root() -> Path:
    configured = settings.COMMENT_ATTACHMENT_ROOT.strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return (Path(settings.KICAD_PROJECTS_ROOT) / ".kicad-prism" / "comment-attachments").expanduser().resolve()


def max_upload_bytes() -> int:
    return int(settings.COMMENT_ATTACHMENT_MAX_BYTES)


def blob_path(sha256: str) -> Path:
    if not re.fullmatch(r"[0-9a-f]{64}", sha256):
        raise AttachmentError("Invalid attachment digest.", "attachment_invalid")
    return attachment_root() / sha256[:2] / sha256


def normalize_content_format(value: Optional[str]) -> str:
    fmt = (value or CONTENT_FORMAT_PLAIN).strip().lower()
    if fmt not in CONTENT_FORMATS:
        raise AttachmentError(f"contentFormat must be one of {', '.join(CONTENT_FORMATS)}.", "content_format_invalid")
    return fmt


def referenced_ids(content: Optional[str]) -> List[str]:
    """Attachment ids referenced by a Markdown body, in first-seen order."""
    if not content:
        return []
    return list(dict.fromkeys(_REF_PATTERN.findall(content)))


def safe_filename(name: Optional[str], extension: str) -> str:
    base = os.path.basename((name or "").replace("\\", "/")).strip()
    base = re.sub(r"[\x00-\x1f\x7f/]", "", base)[:180]
    stem = base.rsplit(".", 1)[0] if "." in base else base
    return f"{stem or 'attachment'}.{extension}"


def prepare_upload(data: bytes, filename: Optional[str]) -> PreparedFile:
    """Validate an upload by its bytes, never by the client's claimed type."""
    if not data:
        raise AttachmentError("The uploaded file is empty.", "attachment_empty")
    limit = max_upload_bytes()
    if len(data) > limit:
        raise AttachmentError(
            f"Attachments are limited to {limit // (1024 * 1024)} MB.", "attachment_too_large",
        )
    image = _prepare_image(data)
    if image is not None:
        return image
    return _prepare_file(data, filename)


def _prepare_image(data: bytes) -> Optional[PreparedFile]:
    from PIL import Image, UnidentifiedImageError

    try:
        with Image.open(io.BytesIO(data)) as probe:
            source_format = probe.format
            width, height = probe.size
    except (UnidentifiedImageError, OSError):
        return None
    target = _IMAGE_FORMATS.get(source_format or "")
    if target is None:
        raise AttachmentError(f"{source_format} images are not supported.", "attachment_type_unsupported")
    if width * height > MAX_IMAGE_PIXELS:
        raise AttachmentError("The image has too many pixels.", "attachment_too_large")

    pil_format, media_type, extension = target
    with Image.open(io.BytesIO(data)) as image:
        image.seek(0)
        if pil_format == "JPEG":
            image = image.convert("RGB")
        elif image.mode not in ("RGB", "RGBA", "L", "LA"):
            image = image.convert("RGBA")
        out = io.BytesIO()
        options = {"quality": 92} if pil_format in ("JPEG", "WEBP") else {"optimize": True}
        image.save(out, format=pil_format, **options)
    return PreparedFile(out.getvalue(), media_type, extension, width, height)


def _prepare_file(data: bytes, filename: Optional[str]) -> PreparedFile:
    if data.startswith(b"%PDF-"):
        return PreparedFile(data, _FILE_TYPES["pdf"], "pdf")
    if data.startswith(b"PK\x03\x04"):
        return PreparedFile(data, _FILE_TYPES["zip"], "zip")
    claimed = (filename or "").rsplit(".", 1)[-1].lower() if "." in (filename or "") else "txt"
    if claimed in ("txt", "csv", "md", "log"):
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            raise AttachmentError("Text attachments must be UTF-8.", "attachment_type_unsupported") from None
        return PreparedFile(data, _FILE_TYPES[claimed], claimed)
    raise AttachmentError(
        "Attach images (PNG, JPEG, WebP, GIF), PDF, ZIP, or UTF-8 text files.",
        "attachment_type_unsupported",
    )


_EXTENSION_BY_TYPE = {
    **{media: ext for _pil, media, ext in _IMAGE_FORMATS.values()},
    **{media: ext for ext, media in _FILE_TYPES.items() if ext != "log"},
}


def extension_for(media_type: str, filename: str = "") -> str:
    """The extension Prism stores a type under; text keeps its own (md, log)."""
    if media_type in ("text/plain", "text/markdown") and "." in filename:
        claimed = filename.rsplit(".", 1)[-1].lower()
        if claimed in ("txt", "md", "log"):
            return claimed
    return _EXTENSION_BY_TYPE.get(media_type, "bin")


def write_blob(data: bytes) -> str:
    """Store ``data`` once by digest and return the digest."""
    digest = hashlib.sha256(data).hexdigest()
    path = blob_path(digest)
    if path.is_file():
        return digest
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        handle.write(data)
        temp_name = handle.name
    os.replace(temp_name, path)
    return digest


def row_to_dict(row) -> Dict:
    item = {
        "id": row["id"],
        "filename": row["filename"],
        "mediaType": row["media_type"],
        "size": int(row["size_bytes"]),
        "state": row["state"],
    }
    if row.get("width"):
        item["width"] = int(row["width"])
        item["height"] = int(row["height"])
    return item


_COLUMNS = "id, project_id, comment_id, reply_id, uploader_user_id, sha256, filename, media_type, size_bytes, width, height, state, created_at"


def project_quota_bytes() -> int:
    return int(settings.COMMENT_ATTACHMENT_PROJECT_QUOTA_BYTES)


def check_quota(conn, project_id: str, incoming_bytes: int) -> None:
    """Refuse an upload that would take the project past its attachment quota.

    Uploads are serialized per project for the rest of the transaction, so two
    concurrent pastes cannot both squeeze under the limit.
    """
    quota = project_quota_bytes()
    if quota <= 0:
        return
    conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"prism:comment-attachment-quota:{project_id}",))
    row = conn.execute(
        "SELECT COALESCE(SUM(size_bytes), 0) AS used FROM comment_attachments WHERE project_id = %s",
        (project_id,),
    ).fetchone()
    if int(row["used"]) + incoming_bytes > quota:
        raise AttachmentError("This project has reached its attachment storage limit", "attachment_quota")


def insert_pending(
    conn, *, project_id: str, uploader_user_id: Optional[str], uploader_display: str,
    sha256: str, filename: str, prepared: PreparedFile,
) -> Dict:
    attachment_id = uuid.uuid4().hex
    row = conn.execute(
        f"""
        INSERT INTO comment_attachments(
            id, project_id, uploader_user_id, uploader_display, sha256, filename,
            media_type, size_bytes, width, height, state
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING {_COLUMNS}
        """,
        (attachment_id, project_id, uploader_user_id, uploader_display, sha256, filename,
         prepared.media_type, len(prepared.data), prepared.width, prepared.height, STATE_PENDING),
    ).fetchone()
    return row_to_dict(row)


def get(conn, project_id: str, attachment_id: str):
    if not re.fullmatch(r"[0-9a-f]{32}", attachment_id or ""):
        return None
    return conn.execute(
        f"SELECT {_COLUMNS} FROM comment_attachments WHERE project_id = %s AND id = %s",
        (project_id, attachment_id),
    ).fetchone()


def link_references(
    conn, *, project_id: str, content: Optional[str], linker_user_id: Optional[str],
    comment_id: str, reply_id: Optional[str] = None,
) -> None:
    """Claim every pending attachment the body references for this root/reply.

    Already-attached files from the same project may be referenced again (a
    quoted snip); pending ones must have been uploaded by the person saving.
    """
    ids = referenced_ids(content)
    if not ids:
        return
    rows = conn.execute(
        f"SELECT {_COLUMNS} FROM comment_attachments WHERE project_id = %s AND id = ANY(%s) FOR UPDATE",
        (project_id, ids),
    ).fetchall()
    found = {row["id"]: row for row in rows}
    missing = [attachment_id for attachment_id in ids if attachment_id not in found]
    if missing:
        raise AttachmentError("The comment references an attachment that does not exist.", "attachment_not_found")
    claim = []
    for row in rows:
        if row["state"] != STATE_PENDING:
            continue
        if (row["uploader_user_id"] or None) != (linker_user_id or None):
            raise AttachmentError("You can only attach files you uploaded.", "attachment_forbidden")
        claim.append(row["id"])
    if claim:
        conn.execute(
            """
            UPDATE comment_attachments
            SET state = %s, comment_id = %s, reply_id = %s
            WHERE project_id = %s AND id = ANY(%s)
            """,
            (STATE_ATTACHED, comment_id, reply_id, project_id, claim),
        )


def describe(conn, project_id: str, contents: Iterable[Optional[str]]) -> Dict[str, Dict]:
    """Metadata for every attachment the given bodies reference, by id."""
    ids = sorted({attachment_id for content in contents for attachment_id in referenced_ids(content)})
    if not ids:
        return {}
    rows = conn.execute(
        f"SELECT {_COLUMNS} FROM comment_attachments WHERE project_id = %s AND id = ANY(%s)",
        (project_id, ids),
    ).fetchall()
    return {row["id"]: row_to_dict(row) for row in rows}


def decorate(conn, project_id: str, comments: Sequence[Dict]) -> None:
    """Add ``attachments`` to each root and reply dict that references any."""
    bodies: List[Optional[str]] = []
    for comment in comments:
        bodies.append(comment.get("content"))
        bodies.extend(reply.get("content") for reply in comment.get("replies", []))
    known = describe(conn, project_id, bodies)
    if not known:
        return

    def attach(target: Dict) -> None:
        items = [known[i] for i in referenced_ids(target.get("content")) if i in known]
        if items:
            target["attachments"] = items

    for comment in comments:
        attach(comment)
        for reply in comment.get("replies", []):
            attach(reply)


def sweep_stale_pending(conn, project_id: Optional[str] = None) -> int:
    """Drop pending uploads nobody linked, and their blobs once unreferenced."""
    params: List[object] = [STATE_PENDING, int(PENDING_TTL.total_seconds())]
    scope = ""
    if project_id is not None:
        scope = " AND project_id = %s"
        params.append(project_id)
    removed = conn.execute(
        f"""
        DELETE FROM comment_attachments
        WHERE state = %s AND created_at < NOW() - make_interval(secs => %s){scope}
        RETURNING sha256
        """,
        tuple(params),
    ).fetchall()
    digests = {row["sha256"] for row in removed}
    for digest in digests:
        still_used = conn.execute(
            "SELECT 1 FROM comment_attachments WHERE sha256 = %s LIMIT 1", (digest,),
        ).fetchone()
        if not still_used:
            blob_path(digest).unlink(missing_ok=True)
    return len(removed)
