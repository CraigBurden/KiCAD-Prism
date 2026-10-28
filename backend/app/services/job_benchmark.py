"""Queue latency and job write-rate metrics for load benchmarks.

Runs on the caller's connection (search_path already set to the workspace
schema); reads only, never artifact payloads.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def benchmark_snapshot(conn: Any, *, since: datetime) -> dict[str, Any]:
    """Aggregate queue and write-rate metrics without reading artifact payloads."""

    summary = conn.execute(
        """
        SELECT
          COUNT(*) AS job_count,
          COUNT(*) FILTER (
            WHERE status IN ('queued', 'running', 'retry_wait', 'cancel_requested')
          ) AS active_jobs,
          percentile_cont(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (started_at - created_at)) * 1000
          ) FILTER (WHERE started_at IS NOT NULL) AS claim_p50_ms,
          percentile_cont(0.95) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (started_at - created_at)) * 1000
          ) FILTER (WHERE started_at IS NOT NULL) AS claim_p95_ms,
          MAX(
            EXTRACT(EPOCH FROM (started_at - created_at)) * 1000
          ) FILTER (WHERE started_at IS NOT NULL) AS claim_max_ms
        FROM ws_jobs
        WHERE created_at >= %s
        """,
        (since,),
    ).fetchone()
    kinds = conn.execute(
        """
        SELECT kind, status, COUNT(*) AS count
        FROM ws_jobs
        WHERE created_at >= %s
        GROUP BY kind, status
        ORDER BY kind, status
        """,
        (since,),
    ).fetchall()
    write_rates = conn.execute(
        """
        WITH rates AS (
          SELECT event.job_id,
            COUNT(*)::DOUBLE PRECISION
              / GREATEST(
                  EXTRACT(EPOCH FROM (MAX(event.created_at) - MIN(event.created_at))),
                  1
                ) AS updates_per_second
          FROM ws_job_events event
          JOIN ws_jobs job ON job.id = event.job_id
          WHERE job.created_at >= %s
          GROUP BY event.job_id
        )
        SELECT
          COALESCE(MAX(updates_per_second), 0) AS max_rate,
          COALESCE(
            percentile_cont(0.95) WITHIN GROUP (ORDER BY updates_per_second),
            0
          ) AS p95_rate
        FROM rates
        """,
        (since,),
    ).fetchone()

    def number(value: Any) -> float:
        return float(value) if value is not None else 0.0

    return {
        "since": since.astimezone(timezone.utc).isoformat(),
        "jobCount": int(summary.get("job_count") or 0),
        "activeJobs": int(summary.get("active_jobs") or 0),
        "claimLatencyMs": {
            "p50": number(summary.get("claim_p50_ms")),
            "p95": number(summary.get("claim_p95_ms")),
            "max": number(summary.get("claim_max_ms")),
        },
        "jobUpdateRatePerSecond": {
            "p95": number(write_rates.get("p95_rate")),
            "max": number(write_rates.get("max_rate")),
        },
        "byKindStatus": [
            {
                "kind": str(row["kind"]),
                "status": str(row["status"]),
                "count": int(row["count"]),
            }
            for row in kinds
        ],
    }
