"""Pending is 202 and failed is 422, the same for every design-data route (ADR §8)."""

from __future__ import annotations

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.services.design_bundle.errors import (
    DesignDataFailed,
    DesignDataPending,
    install_handlers,
)


def _client(raise_error) -> TestClient:
    app = FastAPI()
    install_handlers(app)

    @app.get("/design")
    def design():
        raise_error()

    return TestClient(app, raise_server_exceptions=False)


class DesignDataStateTests(unittest.TestCase):
    def test_pending_is_202_with_the_members_and_a_retry_hint(self) -> None:
        response = _client(lambda: _raise(DesignDataPending(["projections/project.json"], "building"))).get(
            "/design"
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.headers["retry-after"], "3")
        self.assertEqual(
            response.json(),
            {
                "status": "pending",
                "members": ["projections/project.json"],
                "retryAfterSeconds": 3,
            },
        )

    def test_failed_is_422_with_the_finding(self) -> None:
        response = _client(lambda: _raise(DesignDataFailed(["projections/project.json"], "parse failed"))).get(
            "/design"
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json(),
            {
                "status": "failed",
                "members": ["projections/project.json"],
                "detail": "parse failed",
            },
        )


def _raise(error: Exception) -> None:
    raise error


if __name__ == "__main__":
    unittest.main()
