"""A bundle-mode build's answers when its design bundle is not usable (C3).

The API's typed answers (``design_bundle.errors.DesignDataPending`` /
``DesignDataFailed``) render a request as HTTP 202/422. A Release Studio build
is a job, not a request, so it needs the job runtime's retry semantics instead:
a build waits for the stages it needs and never quietly parses the checkout.

- :class:`BundlePending` is retryable: the bundle job is queued (or already
  running) and the build is tried again when it finishes.
- :class:`BundleFailed` is permanent: a stage or a required member has a final
  failed answer, and retrying the same revision cannot succeed.
"""

from __future__ import annotations

from app.services.job_runtime import PermanentJobError, RetryableJobError


class BundlePending(RetryableJobError):
    """The design bundle this build needs has not reached a ready stage yet."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "design-data-pending",
        retry_after_seconds: int = 15,
    ) -> None:
        super().__init__(message, code=code, retry_after_seconds=retry_after_seconds)


class BundleFailed(PermanentJobError):
    """A stage or member the build needs has a final failed answer."""

    def __init__(self, message: str, *, code: str = "design-data-failed") -> None:
        super().__init__(message, code=code)


__all__ = ["BundleFailed", "BundlePending"]
