"""Typed design-data answers for consumers with no legacy fallback.

A Wave 3 consumer falls back to its legacy result while a bundle fills in
(``consumer.bundle_read``). Release Studio in bundle mode does not: a build
waits for the stages it needs and never quietly parses the checkout with
Python ``kicad_monkey``. These two errors are that answer, and they are typed
so the job runtime treats them correctly.

- :class:`DesignDataPending` is retryable: the bundle job is queued (or already
  running) and the consumer should be asked again when it finishes.
- :class:`DesignDataFailed` is permanent: a stage or a required member has a
  final failed answer, and retrying the same revision cannot succeed.
"""

from __future__ import annotations

from app.services.job_runtime import PermanentJobError, RetryableJobError


class DesignDataPending(RetryableJobError):
    """The design bundle this build needs has not reached a ready stage yet."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "design-data-pending",
        retry_after_seconds: int = 15,
    ) -> None:
        super().__init__(
            message, code=code, retry_after_seconds=retry_after_seconds
        )


class DesignDataFailed(PermanentJobError):
    """A stage or member the build needs has a final failed answer."""

    def __init__(self, message: str, *, code: str = "design-data-failed") -> None:
        super().__init__(message, code=code)


__all__ = ["DesignDataFailed", "DesignDataPending"]
