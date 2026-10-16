"""The real application mounts every API router and boots every subsystem."""

from __future__ import annotations

import importlib
import os
import pkgutil
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import APIRouter
from fastapi.routing import APIRoute, APIWebSocketRoute

import app.api
from app.core.config import settings

APP = Path(__file__).resolve().parents[1] / "app"


def _endpoints(routes) -> set:
    found = set()
    for route in routes:
        if isinstance(route, (APIRoute, APIWebSocketRoute)):
            found.add(route.endpoint)
        elif (included := getattr(route, "original_router", None)) is not None:
            # FastAPI 0.141 keeps an included router as one lazy entry.
            found |= _endpoints(included.routes)
    return found


class AppWiringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with patch.dict(os.environ, {"AUTH_ENABLED": "false"}), patch.object(
            settings, "AUTH_ENABLED_OVERRIDE", False
        ):
            from app.main import app
        cls.mounted = _endpoints(app.routes)

    def test_every_api_router_is_mounted(self) -> None:
        unmounted = []
        for info in pkgutil.iter_modules(app.api.__path__):
            module = importlib.import_module(f"app.api.{info.name}")
            for name, value in vars(module).items():
                if isinstance(value, APIRouter):
                    for endpoint in _endpoints(value.routes) - self.mounted:
                        unmounted.append(f"app.api.{info.name}.{name}: {endpoint.__name__}")
        self.assertEqual(unmounted, [])

    def test_web_and_worker_startup_boot_schemas_jobs_and_trackers(self) -> None:
        # Both entry points run against a database at startup, so the calls are
        # checked in source rather than by booting them here.
        main = (APP / "main.py").read_text(encoding="utf-8")
        runner = (APP / "job_runner.py").read_text(encoding="utf-8")
        self.assertIn("bring_every_schema_to_head()", main)
        self.assertIn("initialize_tracker_composition()", main)
        self.assertIn("load_builtin_job_handlers()", runner)
        self.assertIn("initialize_tracker_composition()", runner)


if __name__ == "__main__":
    unittest.main()
