"""A scripted :class:`app.services.kicad_tools.KicadTool` for tests."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from app.services.kicad_tools import CancelCheck, ToolResult


class FakeTool:
    """Answers each run with ``handler(args, cwd=, timeout=, env=)``.

    ``handler`` may return a :class:`ToolResult` or anything with
    ``returncode``/``stdout``/``stderr``; ``None`` means success. Every run is
    kept in :attr:`calls` so a test can assert what was asked.
    """

    def __init__(
        self,
        handler: Callable[..., Any] | None = None,
        *,
        name: str = "kicad-cli",
        version: str = "test",
    ) -> None:
        self.name = name
        self._handler = handler
        self._version = version
        self.calls: list[dict[str, Any]] = []
        self.cancel: CancelCheck | None = None

    def available(self) -> bool:
        return True

    def executable(self) -> str:
        return self.name

    def version(self) -> str:
        return self._version

    def with_cancel(self, cancel: CancelCheck | None) -> "FakeTool":
        self.cancel = cancel
        return self

    def run(
        self,
        args: Sequence[str],
        *,
        timeout: float,
        cwd: Path | str | None = None,
        env: Mapping[str, str] | None = None,
        tee: bool = False,
    ) -> ToolResult:
        call = {"args": [str(part) for part in args], "timeout": timeout, "cwd": cwd, "env": env, "tee": tee}
        self.calls.append(call)
        if self._handler is None:
            return ToolResult(0)
        result = self._handler(call["args"], cwd=cwd, timeout=timeout, env=env)
        if result is None or isinstance(result, ToolResult):
            return result or ToolResult(0)
        return ToolResult(
            int(getattr(result, "returncode", 0)),
            getattr(result, "stdout", "") or "",
            getattr(result, "stderr", "") or "",
        )
