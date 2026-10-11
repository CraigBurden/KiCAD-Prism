"""Issue and reply marker recovery scans (TR-18, D2/C5).

Complete paginated scans never rely on label filters or search indexing.
Outcomes follow D2: found, not_found (complete empty scan), ambiguous
(multiple proven matches) and incomplete (error mid-page — quarantine clock
does not advance).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Mapping, Optional, Sequence

from app.services.trackers.contracts import Destination, RemoteComment
from app.services.trackers.errors import ProviderError
from app.services.trackers.markers import MarkerValidation, ParsedMarker, build_marker, extract_markers, validate_marker

@dataclass(frozen=True)
class RecoveryCandidate:
    """One bot-listed issue as recovery sees it, whatever forge it came from.

    Each issue adapter lists its own forge's issues in this shape
    (``recovery_issue_pages``), so the scan and its marker validation stay shared.
    """

    external_id: str
    body: str
    author_id: str
    number: int | None = None
    url: str | None = None


IssuePage = tuple[Sequence[RecoveryCandidate], Optional[str]]
IssuePageFetcher = Callable[[Optional[str]], IssuePage]
CommentPage = tuple[Sequence[RemoteComment], Optional[str]]
CommentPageFetcher = Callable[[Optional[str]], CommentPage]
AuditFn = Callable[[str, Mapping[str, Any]], None]

QUARANTINE_MINUTES = (1, 5, 15, 60)
RECOVERY_SINCE_SLOP = timedelta(minutes=10)


class RecoveryKind(str, Enum):
    FOUND = "found"
    NOT_FOUND = "not_found"
    AMBIGUOUS = "ambiguous"
    INCOMPLETE = "incomplete"


@dataclass(frozen=True)
class RecoveryMatch:
    external_id: str
    url: str | None = None
    number: int | None = None


@dataclass
class RecoveryOutcome:
    kind: RecoveryKind
    match: RecoveryMatch | None = None
    rejected: list[MarkerValidation] = field(default_factory=list)
    audit: list[dict[str, Any]] = field(default_factory=list)


def recovery_since(sent_at: datetime | None) -> str | None:
    """Lower bound for issue listing: sent_at minus the accepted D2 slop."""

    if sent_at is None:
        return None
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=timezone.utc)
    return (sent_at.astimezone(timezone.utc) - RECOVERY_SINCE_SLOP).strftime("%Y-%m-%dT%H:%M:%SZ")


def quarantine_delay_minutes(attempt_index: int) -> int:
    """D2 re-scan schedule: 1, 5, 15, 60 min then hourly."""

    if attempt_index < 0:
        attempt_index = 0
    if attempt_index < len(QUARANTINE_MINUTES):
        return QUARANTINE_MINUTES[attempt_index]
    return 60


def next_quarantine_at(attempt_index: int, *, now: datetime | None = None) -> datetime:
    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    delay = quarantine_delay_minutes(attempt_index)
    return moment + timedelta(minutes=delay)


def _audit_rejection(
    outcome: RecoveryOutcome,
    validation: MarkerValidation,
    *,
    external_id: str,
    audit: AuditFn | None,
    connector_id: str,
) -> None:
    outcome.rejected.append(validation)
    detail = {
        "reason": validation.reason,
        "externalId": external_id,
        "opId": validation.marker.op_id,
        "connectorId": validation.marker.connector_id,
        "containerId": validation.marker.container_id,
    }
    outcome.audit.append(detail)
    if audit is not None:
        audit("recovery_marker_rejected", detail)


def scan_issue_pages(
    fetch_page: IssuePageFetcher,
    *,
    marker_text: str,
    connector_id: str,
    container_id: str,
    op_id: str,
    comment_id: str,
    bot_user_id: str,
    audit: AuditFn | None = None,
) -> RecoveryOutcome:
    """Paginate all bot-authored issues and validate marker matches (D2)."""

    outcome = RecoveryOutcome(kind=RecoveryKind.NOT_FOUND)
    matches: list[RecoveryMatch] = []
    cursor: Optional[str] = None
    while True:
        try:
            items, cursor = fetch_page(cursor)
        except ProviderError:
            return RecoveryOutcome(kind=RecoveryKind.INCOMPLETE)
        for item in items:
            body = item.body or ""
            if marker_text not in body:
                continue
            for parsed in extract_markers(body):
                validation = validate_marker(
                    parsed,
                    connector_id=connector_id,
                    container_id=container_id,
                    op_id=op_id,
                    comment_id=comment_id,
                    author_user_id=item.author_id,
                    bot_user_id=bot_user_id,
                )
                if not validation.accepted:
                    _audit_rejection(
                        outcome,
                        validation,
                        external_id=item.external_id,
                        audit=audit,
                        connector_id=connector_id,
                    )
                    continue
                matches.append(RecoveryMatch(external_id=item.external_id, url=item.url, number=item.number))
        if not cursor:
            break
    if len(matches) == 1:
        return RecoveryOutcome(kind=RecoveryKind.FOUND, match=matches[0], rejected=outcome.rejected, audit=outcome.audit)
    if len(matches) > 1:
        return RecoveryOutcome(
            kind=RecoveryKind.AMBIGUOUS,
            rejected=outcome.rejected,
            audit=[*outcome.audit, {"reason": "multiple_matches", "count": len(matches)}],
        )
    return outcome


def scan_comment_pages(
    fetch_page: CommentPageFetcher,
    *,
    marker_text: str,
    connector_id: str,
    container_id: str,
    op_id: str,
    reply_id: str,
    bot_user_id: str,
    audit: AuditFn | None = None,
) -> RecoveryOutcome:
    """Paginate all issue comments and validate reply marker matches."""

    outcome = RecoveryOutcome(kind=RecoveryKind.NOT_FOUND)
    matches: list[RecoveryMatch] = []
    cursor: Optional[str] = None
    while True:
        try:
            items, cursor = fetch_page(cursor)
        except ProviderError:
            return RecoveryOutcome(kind=RecoveryKind.INCOMPLETE)
        for comment in items:
            body = comment.body or ""
            if marker_text not in body:
                continue
            for parsed in extract_markers(body):
                validation = validate_marker(
                    parsed,
                    connector_id=connector_id,
                    container_id=container_id,
                    op_id=op_id,
                    reply_id=reply_id,
                    author_user_id=comment.author.id,
                    bot_user_id=bot_user_id,
                )
                if not validation.accepted:
                    _audit_rejection(
                        outcome,
                        validation,
                        external_id=comment.externalCommentId,
                        audit=audit,
                        connector_id=connector_id,
                    )
                    continue
                # The comment's own id: ``externalId`` on a comment names its
                # issue, and recovery confirms the reply by this value.
                matches.append(
                    RecoveryMatch(
                        external_id=comment.externalCommentId,
                        url=comment.url,
                    )
                )
        if not cursor:
            break
    if len(matches) == 1:
        return RecoveryOutcome(kind=RecoveryKind.FOUND, match=matches[0], rejected=outcome.rejected, audit=outcome.audit)
    if len(matches) > 1:
        return RecoveryOutcome(
            kind=RecoveryKind.AMBIGUOUS,
            rejected=outcome.rejected,
            audit=[*outcome.audit, {"reason": "multiple_matches", "count": len(matches)}],
        )
    return outcome


def recover_create_issue(
    op: Mapping[str, Any],
    *,
    dest: Destination,
    comment_id: str,
    fetch_page: IssuePageFetcher,
    bot_user_id: str,
    audit: AuditFn | None = None,
) -> RecoveryOutcome:
    """Recovery scan for a ``create_issue`` op."""

    marker_text = build_marker(
        connector_id=dest.connectorId,
        container_id=dest.remoteContainerId,
        comment_id=comment_id,
        op_id=str(op.get("id") or ""),
    )
    return scan_issue_pages(
        fetch_page,
        marker_text=marker_text,
        connector_id=dest.connectorId,
        container_id=dest.remoteContainerId,
        op_id=str(op.get("id") or ""),
        comment_id=comment_id,
        bot_user_id=bot_user_id,
        audit=audit,
    )


def recover_add_comment(
    op: Mapping[str, Any],
    *,
    dest: Destination,
    reply_id: str,
    fetch_page: CommentPageFetcher,
    bot_user_id: str,
    audit: AuditFn | None = None,
) -> RecoveryOutcome:
    """Recovery scan for an ``add_comment`` op."""

    marker_text = build_marker(
        connector_id=dest.connectorId,
        container_id=dest.remoteContainerId,
        reply_id=reply_id,
        op_id=str(op.get("id") or ""),
    )
    return scan_comment_pages(
        fetch_page,
        marker_text=marker_text,
        connector_id=dest.connectorId,
        container_id=dest.remoteContainerId,
        op_id=str(op.get("id") or ""),
        reply_id=reply_id,
        bot_user_id=bot_user_id,
        audit=audit,
    )


def recover_op(
    op: Mapping[str, Any],
    *,
    dest: Destination,
    comment_id: str,
    reply_id: str | None,
    issue_fetch_page: IssuePageFetcher,
    comment_fetch_page: CommentPageFetcher | None,
    bot_user_id: str,
    audit: AuditFn | None = None,
) -> RecoveryOutcome:
    """Dispatch recovery by op kind."""

    kind = str(op.get("op") or "")
    if kind == "create_issue":
        return recover_create_issue(
            op,
            dest=dest,
            comment_id=comment_id,
            fetch_page=issue_fetch_page,
            bot_user_id=bot_user_id,
            audit=audit,
        )
    if kind == "add_comment":
        if comment_fetch_page is None or not reply_id:
            return RecoveryOutcome(kind=RecoveryKind.INCOMPLETE)
        return recover_add_comment(
            op,
            dest=dest,
            reply_id=reply_id,
            fetch_page=comment_fetch_page,
            bot_user_id=bot_user_id,
            audit=audit,
        )
    return RecoveryOutcome(kind=RecoveryKind.NOT_FOUND)



def make_comment_page_fetcher(adapter: Any, dest: Destination, issue: str) -> CommentPageFetcher:
    """Pages of an issue's comments, walked through any comment adapter's ``list_comments``."""

    def fetch(cursor: Optional[str]) -> CommentPage:
        page_cursor = None
        if cursor:
            from app.services.trackers.contracts import PageCursor

            page_cursor = PageCursor(value=cursor, exhausted=False)
        comments, next_cursor = adapter.list_comments(dest, issue, page_cursor)
        next_url = None
        if next_cursor and not next_cursor.exhausted and next_cursor.value:
            next_url = next_cursor.value
        return comments, next_url

    return fetch
