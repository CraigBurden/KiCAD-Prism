from __future__ import annotations

import threading
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
        with self.pool().connection() as connection:
            yield connection

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
