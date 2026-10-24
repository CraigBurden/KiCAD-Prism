"""The ``.comments/`` bundle a project carries in its repository.

    .comments/comments.json          threads, replies and attachment metadata
    .comments/attachments/<sha>.<ext> every file a live body references
    .comments/threads/<id>.md         each thread as Markdown a forge renders

A clone of the repository therefore keeps every snip, and importing the
bundle into a fresh Prism restores bodies and attachments losslessly. The
files come out of a repository, so on import they are untrusted uploads:
each is re-validated and re-encoded exactly like a browser upload, and a
reference that does not survive that is replaced by its label.
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional

from app.services import comment_attachments, comment_export

ATTACHMENTS_DIR = "attachments"
THREADS_DIR = "threads"
_BLOB_NAME = re.compile(r"^[0-9a-f]{64}\.[a-z0-9]{1,5}$")
_THREAD_NAME = re.compile(r"^[A-Za-z0-9_-]+\.md$")


def _bodies(comments: Iterable[Mapping]) -> Iterable[Mapping]:
    for comment in comments:
        yield comment
        yield from comment.get("replies") or []


def _atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".bundle-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def _prune(directory: Path, pattern: re.Pattern, keep: set[str]) -> None:
    """Remove files Prism wrote earlier and no longer references; nothing else."""
    if not directory.is_dir():
        return
    for entry in directory.iterdir():
        if entry.is_file() and pattern.match(entry.name) and entry.name not in keep:
            entry.unlink()


def write_bundle(conn, project_id: str, bundle_dir: str, snapshot: Dict) -> Dict:
    """Copy referenced blobs and thread Markdown next to ``comments.json``.

    Mutates ``snapshot`` so each attachment entry names its file, and returns it.
    """
    root = Path(bundle_dir)
    comments: List[Dict] = snapshot.get("comments") or []
    ids = sorted({str(item["id"]) for body in _bodies(comments) for item in body.get("attachments") or []})
    rows = {}
    if ids:
        rows = {
            row["id"]: row
            for row in conn.execute(
                "SELECT id, sha256, media_type, filename FROM comment_attachments WHERE project_id = %s AND id = ANY(%s)",
                (project_id, ids),
            ).fetchall()
        }

    files: Dict[str, str] = {}
    for attachment_id, row in rows.items():
        name = f"{row['sha256']}.{comment_attachments.extension_for(row['media_type'], row['filename'])}"
        source = comment_attachments.blob_path(row["sha256"])
        target = root / ATTACHMENTS_DIR / name
        if not source.is_file():
            continue
        if not target.is_file() or target.stat().st_size != source.stat().st_size:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        files[attachment_id] = name

    for body in _bodies(comments):
        for item in body.get("attachments") or []:
            name = files.get(str(item["id"]))
            if name:
                item["sha256"] = name.split(".", 1)[0]
                item["path"] = f"{ATTACHMENTS_DIR}/{name}"

    thread_names = set()
    for comment in comments:
        thread_name = f"{comment['id']}.md"
        if not _THREAD_NAME.match(thread_name):
            continue
        thread_names.add(thread_name)
        _atomic_write(root / THREADS_DIR / thread_name, render_thread_markdown(comment, files).encode("utf-8"))

    _prune(root / ATTACHMENTS_DIR, _BLOB_NAME, set(files.values()))
    _prune(root / THREADS_DIR, _THREAD_NAME, thread_names)
    # comments.json stays format 1.1: ``contentFormat`` and ``attachments`` are
    # additive fields (CONTRACTS.md D6), and the files sit beside it.
    return snapshot


def _body_markdown(body: Mapping, files: Mapping[str, str]) -> str:
    content = str(body.get("content") or "")
    if not comment_export.is_markdown(body.get("contentFormat")):
        # Plain text may contain Markdown punctuation; fence it so it reads as written.
        return "\n".join(f"    {line}" for line in content.splitlines()) or ""
    return comment_export.rewrite_attachment_targets(
        content, lambda attachment_id, _image: (f"../{ATTACHMENTS_DIR}/{files[attachment_id]}"
                                                if attachment_id in files else None),
    )


def render_thread_markdown(comment: Mapping, files: Mapping[str, str]) -> str:
    location = comment.get("location") or {}
    where = comment.get("elementRef") or f"({location.get('x', 0):.2f}, {location.get('y', 0):.2f}) mm"
    header = [
        f"# {comment.get('context', '')} review comment `{comment['id']}`",
        "",
        f"- **Status:** {comment.get('status', 'OPEN')}",
        f"- **Severity:** {comment.get('severity', 'info')} · **Class:** {comment.get('commentClass', 'general')}",
        f"- **Where:** {where}" + (f" on {location['layer']}" if location.get("layer") else ""),
        f"- **Author:** {comment.get('author', '')} · {comment.get('timestamp', '')}",
        "",
        _body_markdown(comment, files),
    ]
    for reply in comment.get("replies") or []:
        header += ["", "---", "", f"**{reply.get('author', '')}** · {reply.get('timestamp', '')}", "",
                   _body_markdown(reply, files)]
    return "\n".join(header).rstrip() + "\n"


# ---------------------------------------------------------------- import


@dataclass
class PendingAttachment:
    attachment_id: str
    digest: str
    filename: str
    prepared: comment_attachments.PreparedFile


@dataclass
class ImportedBody:
    content: str
    content_format: str
    attachments: List[PendingAttachment] = field(default_factory=list)


def _resolve(conn, project_id: str, bundle: Path, meta: Mapping, allocated: Dict[str, str]) -> Optional[PendingAttachment]:
    old_id = str(meta.get("id") or "")
    rel = str(meta.get("path") or "")
    name = rel.rsplit("/", 1)[-1]
    if not re.fullmatch(r"[0-9a-f]{32}", old_id) or not _BLOB_NAME.match(name) or rel != f"{ATTACHMENTS_DIR}/{name}":
        return None
    existing = conn.execute("SELECT project_id FROM comment_attachments WHERE id = %s", (old_id,)).fetchone()
    if existing is not None and existing["project_id"] == project_id:
        allocated[old_id] = old_id  # already restored for an earlier body (a quoted snip)
        return None
    source = (bundle / ATTACHMENTS_DIR / name).resolve()
    if bundle.resolve() not in source.parents or not source.is_file():
        return None
    if source.stat().st_size > comment_attachments.max_upload_bytes():
        return None
    try:
        prepared = comment_attachments.prepare_upload(source.read_bytes(), str(meta.get("filename") or name))
    except comment_attachments.AttachmentError:
        return None
    # Another project already owns this id (the same bundle imported twice).
    new_id = old_id if existing is None else uuid.uuid4().hex
    allocated[old_id] = new_id
    return PendingAttachment(
        attachment_id=new_id,
        digest=comment_attachments.write_blob(prepared.data),
        filename=comment_attachments.safe_filename(str(meta.get("filename") or name), prepared.extension),
        prepared=prepared,
    )


def import_body(conn, project_id: str, raw: Mapping, bundle_dir: Optional[str]) -> ImportedBody:
    """Content, format and attachments to restore for one root or reply."""
    content = str(raw.get("content") or "")
    try:
        content_format = comment_attachments.normalize_content_format(str(raw.get("contentFormat") or "plain"))
    except comment_attachments.AttachmentError:
        content_format = comment_attachments.CONTENT_FORMAT_PLAIN
    if content_format != comment_attachments.CONTENT_FORMAT_MARKDOWN:
        return ImportedBody(content, content_format)

    allocated: Dict[str, str] = {}
    pending: List[PendingAttachment] = []
    if bundle_dir:
        bundle = Path(bundle_dir)
        for meta in raw.get("attachments") or []:
            if isinstance(meta, Mapping):
                item = _resolve(conn, project_id, bundle, meta, allocated)
                if item is not None:
                    pending.append(item)
    content = comment_export.rewrite_attachment_targets(
        content, lambda attachment_id, _image: (f"attachment:{allocated[attachment_id]}"
                                                if attachment_id in allocated else None),
    )
    return ImportedBody(content, content_format, pending)


def link_imported(conn, project_id: str, body: ImportedBody, *, comment_id: str, reply_id: Optional[str] = None) -> None:
    """Record restored attachments once their root/reply row exists in this project."""
    if not body.attachments:
        return
    # Import skips ids that collide with another project's rows; never attach
    # files to a row this project does not own.
    owner = conn.execute(
        "SELECT 1 FROM comments WHERE project_id = %s AND id = %s", (project_id, comment_id),
    ).fetchone()
    if reply_id is not None and owner is not None:
        owner = conn.execute(
            "SELECT 1 FROM comment_replies WHERE project_id = %s AND id = %s AND comment_id = %s",
            (project_id, reply_id, comment_id),
        ).fetchone()
    if owner is None:
        return
    for item in body.attachments:
        conn.execute(
            """
            INSERT INTO comment_attachments(
                id, project_id, comment_id, reply_id, uploader_user_id, uploader_display, sha256,
                filename, media_type, size_bytes, width, height, state
            )
            VALUES (%s, %s, %s, %s, NULL, 'import', %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (item.attachment_id, project_id, comment_id, reply_id, item.digest, item.filename,
             item.prepared.media_type, len(item.prepared.data), item.prepared.width, item.prepared.height,
             comment_attachments.STATE_ATTACHED),
        )


# ---------------------------------------------------------------- report


def discussion_report_zip(conn, project_id: str, comments: List[Dict], title: str) -> bytes:
    """A review discussion as ``discussion.md`` plus its attachments, zipped.

    Written for the reader outside Prism -- an ECO, a fab-house email -- so
    it is the same thread Markdown the bundle carries, with every snip beside it.
    """
    import io
    import zipfile

    ids = sorted({str(item["id"]) for body in _bodies(comments) for item in body.get("attachments") or []})
    rows = []
    if ids:
        rows = conn.execute(
            "SELECT id, sha256, media_type, filename FROM comment_attachments WHERE project_id = %s AND id = ANY(%s)",
            (project_id, ids),
        ).fetchall()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        files: Dict[str, str] = {}
        for row in rows:
            source = comment_attachments.blob_path(row["sha256"])
            if not source.is_file():
                continue
            name = f"{row['sha256']}.{comment_attachments.extension_for(row['media_type'], row['filename'])}"
            if name not in files.values():
                archive.write(source, f"{ATTACHMENTS_DIR}/{name}")
            files[row["id"]] = name
        sections = [f"# {title}", ""]
        for comment in comments:
            # Thread files live one level down in the bundle; the report is flat.
            sections.append(render_thread_markdown(comment, files).replace(f"](../{ATTACHMENTS_DIR}/", f"]({ATTACHMENTS_DIR}/"))
        archive.writestr("discussion.md", "\n".join(sections))
    return buffer.getvalue()
