"""Record a KiCad tool's runs, and replay them without the tool installed.

The recordings in ``fixtures/release-studio/cli-recordings`` describe commands
with host paths replaced by placeholders (``<fixture>``, ``<output>``). This
module reads that format and extends it: a recording made by
:class:`RecordingTool` also keeps every file a command wrote, so a replay
reproduces the files and not only the exit status.

Paths are normalized against named roots (``{"closure": ..., "staging": ...}``)
in both directions, so a recording made in one temporary directory replays
in another.

Schema 1 (hand-written, R0): ``argv`` starts with the tool name, ``stdout`` and
``stderr`` are lists of lines, no outputs. Schema 2 (recorded): ``argv``
excludes the executable, streams are strings, and ``outputs`` maps each
written path to the SHA-256 of a blob stored under ``blobs/`` beside the
recording.
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.services.kicad_tools import CancelCheck, KicadTool, ToolError, ToolResult


SCHEMA_VERSION = 2


class _Roots:
    """Bidirectional placeholder mapping, longest root first."""

    def __init__(self, roots: Mapping[str, Path]) -> None:
        self._roots = sorted(
            ((name, str(Path(path).resolve())) for name, path in roots.items()),
            key=lambda item: len(item[1]),
            reverse=True,
        )
        # Tool output names paths as given, which may be unresolved
        # (``/var/...`` for ``/private/var/...`` on macOS).
        self._spellings = sorted(
            {
                (spelling, name)
                for name, path in roots.items()
                for spelling in (str(Path(path)), str(Path(path).resolve()))
            },
            key=lambda item: len(item[0]),
            reverse=True,
        )

    def normalize_text(self, text: str) -> str:
        for spelling, name in self._spellings:
            text = text.replace(spelling, f"<{name}>")
        return text

    def normalize(self, value: str) -> str:
        resolved = value
        if value.startswith("/"):
            trailing = "/" if value.endswith("/") and len(value) > 1 else ""
            resolved = str(Path(value).resolve()) + trailing
        for name, root in self._roots:
            if resolved == root or resolved.startswith(root + "/"):
                return f"<{name}>" + resolved[len(root):]
        return value

    def expand(self, value: str) -> str:
        for name, root in self._roots:
            token = f"<{name}>"
            if value.startswith(token):
                return root + value[len(token):]
        return value

    def unrooted_path(self, value: str) -> bool:
        return value.startswith("/") and not value.startswith("<")


@dataclass
class _Command:
    argv: tuple[str, ...]
    exit_code: int
    stdout: str
    stderr: str
    outputs: dict[str, str] = field(default_factory=dict)
    used: bool = False


def _load(path: Path) -> tuple[str, str, list[_Command]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    schema = int(payload.get("schema_version") or 0)
    if schema not in (1, SCHEMA_VERSION):
        raise ValueError(f"unsupported recording schema {schema}: {path}")
    tool = payload.get("tool") or {}
    commands = []
    for entry in payload.get("commands") or ():
        argv = list(entry["argv"])
        stdout, stderr = entry.get("stdout", ""), entry.get("stderr", "")
        if schema == 1:
            argv = argv[1:]
            stdout, stderr = "\n".join(stdout), "\n".join(stderr)
        commands.append(
            _Command(
                argv=tuple(argv),
                exit_code=int(entry.get("exit_code", 0)),
                stdout=stdout,
                stderr=stderr,
                outputs=dict(entry.get("outputs") or {}),
            )
        )
    return str(tool.get("name") or ""), str(tool.get("version") or "unknown"), commands


class ReplayTool:
    """Answers each run from a recording, writing the files it recorded.

    A run with no recorded match returns exit code 127 and is listed in
    :attr:`misses`, so a test can assert the replay was complete rather than
    have a sheet degrade quietly.
    """

    def __init__(self, recording: Path, roots: Mapping[str, Path]) -> None:
        self._path = Path(recording)
        self.name, self._version, self._commands = _load(self._path)
        self._blobs = self._path.parent / "blobs"
        self._roots = _Roots(roots)
        self._lock = threading.Lock()
        self.misses: list[tuple[str, ...]] = []

    def available(self) -> bool:
        return True

    def executable(self) -> str:
        return self.name

    def version(self) -> str:
        return self._version

    def with_cancel(self, cancel: CancelCheck | None) -> "ReplayTool":
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
        normalized = tuple(self._roots.normalize(str(part)) for part in args)
        with self._lock:
            command = next(
                (c for c in self._commands if not c.used and c.argv == normalized), None
            )
            if command is None:
                self.misses.append(normalized)
                return ToolResult(127, "", f"no recorded run of {' '.join(normalized)}")
            command.used = True
        for placeholder, digest in command.outputs.items():
            target = Path(self._roots.expand(placeholder))
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((self._blobs / digest).read_bytes())
        if tee:
            print(command.stdout, end="", flush=True)
        return ToolResult(command.exit_code, command.stdout, command.stderr)


def _file_stats(paths: Sequence[Path]) -> dict[Path, tuple[int, int, int]]:
    """Each file at or under ``paths``: its modification time, size and inode."""

    stats: dict[Path, tuple[int, int, int]] = {}
    for path in paths:
        for candidate in sorted(path.rglob("*")) if path.is_dir() else [path]:
            if candidate.is_file():
                stat = candidate.stat()
                stats[candidate] = (stat.st_mtime_ns, stat.st_size, stat.st_ino)
    return stats


class RecordingTool:
    """Runs ``inner`` and records each run, with the files it wrote, for replay.

    A command's outputs are the files under the paths in its argv (and under
    its working directory, when that is rooted) that it
    created or changed, or that were written after it started; inputs are
    untouched and are not recorded. Every
    absolute path in an argv must lie under one of the roots, or the recording
    would carry a host path.
    """

    def __init__(self, inner: KicadTool, roots: Mapping[str, Path]) -> None:
        self._inner = inner
        self.name = inner.name
        self._roots = _Roots(roots)
        self._lock = threading.Lock()
        self.commands: list[dict[str, Any]] = []
        self.blobs: dict[str, bytes] = {}

    def available(self) -> bool:
        return self._inner.available()

    def executable(self) -> str:
        return self._inner.executable()

    def version(self) -> str:
        return self._inner.version()

    def with_cancel(self, cancel: CancelCheck | None) -> "RecordingTool":
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
        normalized = [self._roots.normalize(str(part)) for part in args]
        stray = [part for part in normalized if self._roots.unrooted_path(part)]
        if stray:
            raise ToolError(f"cannot record a host path: {stray[0]}")
        paths = [Path(self._roots.expand(part)) for part in normalized if part.startswith("<")]
        # A jobset names only its jobset and project files; its outputs land
        # under the working directory, so a rooted cwd is an output root too.
        rooted_cwd = self._roots.normalize(str(cwd)) if cwd is not None else ""
        if rooted_cwd.startswith("<"):
            paths.append(Path(self._roots.expand(rooted_cwd)))
        before = _file_stats(paths)
        started = time.time_ns()
        result = self._inner.run(args, timeout=timeout, cwd=cwd, env=env, tee=tee)
        outputs: dict[str, str] = {}
        for candidate, stat in _file_stats(paths).items():
            # File times come from the kernel's coarse clock, which can trail
            # time.time_ns() by a tick, so a file the run created or changed
            # counts whatever its time says.
            if before.get(candidate) == stat and stat[0] < started:
                continue
            payload = candidate.read_bytes()
            digest = hashlib.sha256(payload).hexdigest()
            with self._lock:
                self.blobs[digest] = payload
            outputs[self._roots.normalize(str(candidate))] = digest
        with self._lock:
            self.commands.append(
                {
                    "argv": normalized,
                    "exit_code": result.returncode,
                    "stdout": self._roots.normalize_text(result.stdout),
                    "stderr": self._roots.normalize_text(result.stderr),
                    "outputs": dict(sorted(outputs.items())),
                }
            )
        return result

    def write(self, recording: Path, *, fixture: str) -> None:
        """Write the recording and its blobs; commands are sorted for stable diffs."""

        recording.parent.mkdir(parents=True, exist_ok=True)
        blobs = recording.parent / "blobs"
        blobs.mkdir(exist_ok=True)
        for digest, payload in self.blobs.items():
            (blobs / digest).write_bytes(payload)
        payload = {
            "schema_version": SCHEMA_VERSION,
            "fixture": fixture,
            "tool": {"name": self.name, "version": self.version()},
            "commands": sorted(self.commands, key=lambda c: json.dumps(c["argv"])),
        }
        recording.write_text(json.dumps(payload, indent=1) + "\n", encoding="utf-8")


__all__ = ["RecordingTool", "ReplayTool", "SCHEMA_VERSION"]
