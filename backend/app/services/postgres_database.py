from __future__ import annotations

import threading
import time
from contextlib import contextmanager
from typing import Any, Iterator

from app.core.config import settings


def postgres_dsn() -> str:
    value = settings.PRISM_DATABASE_URL.strip()
    if not value:
        raise RuntimeError("PRISM_DATABASE_URL is required")
    return value.replace("postgresql+psycopg://", "postgresql://", 1)


class PostgresDatabase:
    """Process-local PostgreSQL pool shared by Prism state services."""

    def __init__(self) -> None:
        self._pool: Any | None = None
        self._lock = threading.Lock()
        self._metrics_lock = threading.Lock()
        self._wait_count = 0
        self._wait_total_seconds = 0.0
        self._wait_max_seconds = 0.0

    def pool(self) -> Any:
        if self._pool is not None:
            return self._pool
        with self._lock:
            if self._pool is None:
                try:
                    from psycopg.rows import dict_row
                    from psycopg_pool import ConnectionPool
                except ImportError as exc:  # pragma: no cover - deployment guard
                    raise RuntimeError(
                        "PostgreSQL persistence requires psycopg and psycopg-pool"
                    ) from exc
                pool = ConnectionPool(
                    conninfo=postgres_dsn(),
                    min_size=settings.PRISM_DATABASE_POOL_MIN_SIZE,
                    max_size=settings.PRISM_DATABASE_POOL_MAX_SIZE,
                    kwargs={"row_factory": dict_row, "autocommit": False},
                    open=False,
                    name="kicad-prism-state",
                )
                pool.open(wait=True)
                self._pool = pool
        return self._pool

    @contextmanager
    def connection(self) -> Iterator[Any]:
        started = time.perf_counter()
        with self.pool().connection() as connection:
            waited = time.perf_counter() - started
            with self._metrics_lock:
                self._wait_count += 1
                self._wait_total_seconds += waited
                self._wait_max_seconds = max(self._wait_max_seconds, waited)
            yield connection

    def metrics_snapshot(self) -> dict[str, Any]:
        pool = self.pool()
        with self._metrics_lock:
            count = self._wait_count
            total = self._wait_total_seconds
            maximum = self._wait_max_seconds
        try:
            pool_stats = dict(pool.get_stats())
        except Exception:
            pool_stats = {}
        return {
            "connectionWaitCount": count,
            "connectionWaitMeanMs": (total / count * 1000) if count else 0.0,
            "connectionWaitMaxMs": maximum * 1000,
            "pool": pool_stats,
        }

    @contextmanager
    def transaction(self) -> Iterator[Any]:
        with self.connection() as connection:
            with connection.transaction():
                yield connection

    def close(self) -> None:
        with self._lock:
            if self._pool is not None:
                self._pool.close()
                self._pool = None


database = PostgresDatabase()
