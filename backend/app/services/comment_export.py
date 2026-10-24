"""One place that turns stored comment bodies into every outward format.

Bodies are stored either as ``plain`` text or as Markdown whose images and
files point at ``attachment:<id>``. Nothing outside Prism can resolve that
scheme, so every export -- the ``.comments/`` bundle, tracker issues and
replies, review reports -- goes through the renderers here instead of
reading ``comment["content"]`` directly.
"""

from __future__ import annotations

import html
import re
from typing import Callable, Dict, Mapping, Optional

from app.services.comment_attachments import CONTENT_FORMAT_MARKDOWN

#: ``[text](attachment:<id> "title")`` or ``![alt](attachment:<id>)``.
_TARGET = re.compile(r'(?P<bang>!?)\[(?P<label>[^\]]*)\]\(attachment:(?P<id>[0-9a-f]{32})(?P<title>\s+"[^"]*")?\)')
_LINK = re.compile(r'(?<!!)\[(?P<label>[^\]]*)\]\((?P<href>[^)\s]+)(?:\s+"[^"]*")?\)')
_EMPHASIS = re.compile(r"(\*\*|__|~~|\*|_)(?=\S)(.+?)(?<=\S)\1")
_INLINE_CODE = re.compile(r"`([^`]*)`")
_ESCAPE = re.compile(r"\\([\\`*_{}\[\]()#+\-.!>|~])")

AttachmentMeta = Mapping[str, object]


def is_markdown(content_format: Optional[str]) -> bool:
    return (content_format or "plain") == CONTENT_FORMAT_MARKDOWN


def rewrite_attachment_targets(
    content: str,
    target_for: Callable[[str, bool], Optional[str]],
    *,
    missing: Optional[Callable[[str, str, bool], str]] = None,
) -> str:
    """Replace each ``attachment:<id>`` target with ``target_for(id, is_image)``.

    When ``target_for`` returns ``None`` the reference is unresolvable in the
    destination; ``missing(id, label, is_image)`` supplies replacement text,
    defaulting to the label so the reader still sees what was attached.
    """

    def replace(match: re.Match) -> str:
        is_image = bool(match.group("bang"))
        target = target_for(match.group("id"), is_image)
        label = match.group("label")
        if target is None:
            if missing is not None:
                return missing(match.group("id"), label, is_image)
            return f"[{'image' if is_image else 'file'}: {label}]" if label else ""
        return f"{match.group('bang')}[{label}]({target}{match.group('title') or ''})"

    return _TARGET.sub(replace, content)


def to_plain(
    content: str,
    content_format: Optional[str],
    attachments: Optional[Mapping[str, AttachmentMeta]] = None,
) -> str:
    """Readable text for destinations with no formatting, such as CSV cells."""
    if not is_markdown(content_format):
        return content
    known = attachments or {}

    def attachment_text(match: re.Match) -> str:
        meta = known.get(match.group("id")) or {}
        name = str(meta.get("filename") or match.group("label") or "attachment")
        return f"[{'image' if match.group('bang') else 'file'}: {name}]"

    text = _TARGET.sub(attachment_text, content)
    text = _LINK.sub(lambda m: m.group("label") if m.group("label") == m.group("href")
                     else f"{m.group('label')} ({m.group('href')})", text)
    text = re.sub(r"^```[^\n]*\n?", "", text, flags=re.MULTILINE)
    text = _INLINE_CODE.sub(r"\1", text)
    for _ in range(2):  # nested emphasis, e.g. ***x***
        text = _EMPHASIS.sub(r"\2", text)
    text = re.sub(r"^(\s*)>\s?", r"\1", text, flags=re.MULTILINE)
    text = _ESCAPE.sub(r"\1", text)
    return html.unescape(text).strip()


def attachment_ids(content: str, content_format: Optional[str]) -> list[str]:
    if not is_markdown(content_format):
        return []
    return list(dict.fromkeys(match.group("id") for match in _TARGET.finditer(content)))


def attachments_by_id(comment: Mapping[str, object]) -> Dict[str, AttachmentMeta]:
    """Attachment metadata for a root and its replies, as the store decorates them."""
    found: Dict[str, AttachmentMeta] = {}
    for target in [comment, *(comment.get("replies") or [])]:  # type: ignore[list-item]
        for item in target.get("attachments") or []:  # type: ignore[union-attr]
            found[str(item["id"])] = item
    return found
