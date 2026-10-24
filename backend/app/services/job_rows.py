"""Row encoding shared by the job queue modules.

JSON column encoding and the decoders that turn ``ws_jobs`` and
``ws_artifacts`` rows into API dictionaries.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any


def to_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def loads(value: Any, default: Any) -> Any:
    if value is None or value == "":
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(str(value))
    except (TypeError, ValueError):
        return default


def timestamp(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return str(value)


def decode_job(row: Any) -> dict[str, Any]:
    payload = dict(row)
    payload["payload"] = loads(payload.get("payload"), {})
    payload["resource_requirements"] = loads(
        payload.get("resource_requirements"), {}
    )
    payload["lock_requirements"] = loads(payload.get("lock_requirements"), [])
    payload["result_metadata"] = loads(payload.get("result_metadata"), {})
    payload["job_id"] = str(payload.pop("id"))
    for key in (
        "lease_expires_at",
        "heartbeat_at",
        "available_at",
        "cancel_requested_at",
        "started_at",
        "completed_at",
        "created_at",
        "updated_at",
    ):
        payload[key] = timestamp(payload.get(key))
    return payload


def decode_artifact(row: Any) -> dict[str, Any]:
    payload = dict(row)
    for key in ("created_at", "last_accessed_at", "invalidated_at"):
        payload[key] = timestamp(payload.get(key))
    return payload
