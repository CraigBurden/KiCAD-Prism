"""The design-data states a consumer's request can answer with (ADR §8, §9.7 R1).

A ready bundle is a :class:`~app.services.design_bundle.consumer.BundleRead`.
When it is not ready the request does not fall back to a legacy reader: it
raises one of these two typed answers, which the API renders the same way for
every route:

- :class:`DesignDataPending` -- the members are still being built; the
  ``design_bundle`` job was queued. HTTP 202 with ``status: "pending"`` and a
  ``Retry-After`` header.
- :class:`DesignDataFailed` -- the build ended failed, or a member failed.
  HTTP 422 with ``status: "failed"`` and the finding or message.

The classes live in their own module, free of app imports, so ``app.main`` can
register the one exception handler without importing the bundle job runtime.
"""

from __future__ import annotations

from typing import Iterable

#: Seconds the browser waits before retrying a pending design-data read.
RETRY_AFTER_SECONDS = 3

#: The response header that says a bundle served HEAD while the checkout holds
#: uncommitted changes in the files the bundle reads.
WORKING_TREE_HEADER = "X-Prism-Working-Tree"
WORKING_TREE_DIRTY = "dirty"


class DesignDataPending(Exception):
    """The design data for this revision is still being prepared."""

    def __init__(self, members: Iterable[str], job_state: str = "queued") -> None:
        self.members = tuple(members)
        self.job_state = job_state
        super().__init__(f"design data is {job_state}: {', '.join(self.members) or 'the bundle'}")

    def body(self) -> dict[str, object]:
        return {
            "status": "pending",
            "members": list(self.members),
            "retryAfterSeconds": RETRY_AFTER_SECONDS,
        }

    def headers(self) -> dict[str, str]:
        return {"Retry-After": str(RETRY_AFTER_SECONDS)}


class DesignDataFailed(Exception):
    """The design data for this revision could not be built."""

    def __init__(self, members: Iterable[str], detail: str) -> None:
        self.members = tuple(members)
        self.detail = detail or "the design bundle build failed"
        super().__init__(self.detail)

    def body(self) -> dict[str, object]:
        return {"status": "failed", "members": list(self.members), "detail": self.detail}


def install_handlers(app: object) -> None:
    """Register the two handlers every route in scope shares (``app.main`` calls this once).

    Pending is 202 with ``Retry-After``; failed is 422 with the finding or
    message. Both bodies carry the members that caused the answer.
    """

    from fastapi.responses import JSONResponse

    async def pending(_request: object, error: DesignDataPending) -> JSONResponse:
        return JSONResponse(status_code=202, content=error.body(), headers=error.headers())

    async def failed(_request: object, error: DesignDataFailed) -> JSONResponse:
        return JSONResponse(status_code=422, content=error.body())

    app.add_exception_handler(DesignDataPending, pending)  # type: ignore[attr-defined]
    app.add_exception_handler(DesignDataFailed, failed)  # type: ignore[attr-defined]


__all__ = [
    "DesignDataFailed",
    "DesignDataPending",
    "RETRY_AFTER_SECONDS",
    "WORKING_TREE_DIRTY",
    "WORKING_TREE_HEADER",
]
