"""Authenticated JSON calls to one forge, shared by every issue and comment adapter.

``TrackerHttp`` owns transport policy (allowlist, TLS, timeouts, status
classification). This module adds the three things each adapter used to copy:
which credential headers go on a call, checking the JSON shape a call returned,
and turning a classified read failure into the typed read outcome the runtime
reasons about (uncertain absence, confirmed gone, moved, forbidden).
"""

from __future__ import annotations

from typing import Any, Callable, Mapping

from app.services.trackers.contracts import ForbiddenRead, GoneConfirmed, Moved, UncertainAbsence
from app.services.trackers.errors import ProviderError
from app.services.trackers.http import ForgeHttpResponse, TrackerHttp


class ForgeClient:
    """One forge's credential headers over the shared tracker transport."""

    def __init__(
        self,
        http: TrackerHttp,
        headers: Callable[[], Mapping[str, str]],
        *,
        forge: str,
        noun: str,
    ) -> None:
        self.http = http
        self._headers = headers
        self.forge = forge
        self.noun = noun

    def headers(self) -> dict[str, str]:
        return dict(self._headers())

    def request(
        self,
        method: str,
        url: str,
        *,
        json_body: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        etag: str | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> ForgeHttpResponse:
        """One call; 2xx/304 come back, everything else raises a classified ``ProviderError``."""

        response = self.http.request(
            method,
            url,
            headers=dict(headers) if headers is not None else self.headers(),
            json_body=json_body,
            params=params,
            etag=etag,
        )
        return self.http.outcome(response)

    def json_object(self, response: ForgeHttpResponse) -> dict[str, Any]:
        payload = response.json() if response.content else {}
        if not isinstance(payload, dict):
            raise ProviderError("transient", f"{self.forge} returned a non-object {self.noun} payload.")
        return payload

    def json_list(self, response: ForgeHttpResponse) -> list[Any]:
        payload = response.json() if response.content else []
        if not isinstance(payload, list):
            raise ProviderError("transient", f"{self.forge} {self.noun} listing was not a complete page.")
        return payload


def read_outcome(exc: ProviderError, *, allow_moved: bool = True) -> Any:
    """The typed read outcome for a failed GET, or re-raise when it is not a read outcome.

    Comments have no ``Moved`` read: a moved comment is reported with its issue.
    """

    if exc.class_ == "not_found_uncertain":
        return UncertainAbsence(status=exc.status or 404)
    if exc.class_ == "gone_confirmed":
        return GoneConfirmed(status=exc.status or 410)
    if allow_moved and exc.class_ == "moved":
        return Moved(new_ref=exc.new_ref or "", new_container_id=None)
    if exc.class_ == "forbidden":
        return ForbiddenRead(status=exc.status or 403)
    raise exc


__all__ = ["ForgeClient", "read_outcome"]
