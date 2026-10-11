"""Every documented configuration variable reaches the application containers.

`--env-file` only fills `${...}` placeholders in a Compose file. A variable
reaches a container only when the service forwards it, so a hand-written
`environment:` list silently dropped every setting nobody remembered to add
(the Git host allowlist among them). These tests render the real Compose
configuration and check every `Settings` field and every `.env.example` key
arrives in each service that runs backend code.
"""

from __future__ import annotations

import ast
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
# `Settings` (config.py) and the field groups it inherits.
CONFIG_MODULES = (
    REPO / "backend" / "app" / "core" / "config.py",
    REPO / "backend" / "app" / "core" / "pipeline_config.py",
)
APP_SERVICES = ("backend", "catalog-worker", "prism-worker")
SOURCE_STACKS = (
    ("docker-compose.yml",),
    ("docker-compose.yml", "docker-compose.proxy.yml"),
    ("docker-compose.yml", "docker-compose.local-kicad-monkey.yml"),
)
_KEY = re.compile(r"^#?\s*([A-Z][A-Z0-9_]*)=")


def settings_env_names() -> set[str]:
    """Environment names `Settings` reads: field names, or their alias."""
    names: set[str] = set()
    for module in CONFIG_MODULES:
        tree = ast.parse(module.read_text(encoding="utf-8"))
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name.endswith("Settings"):
                names |= _field_names(node)
    return names


def _field_names(settings: ast.ClassDef) -> set[str]:
    names: set[str] = set()
    for node in settings.body:
        if not isinstance(node, ast.AnnAssign) or not isinstance(node.target, ast.Name):
            continue
        name = node.target.id
        if isinstance(node.value, ast.Call):
            for keyword in node.value.keywords:
                if keyword.arg in {"alias", "validation_alias"} and isinstance(keyword.value, ast.Constant):
                    name = str(keyword.value.value)
        if name.isupper():
            names.add(name)
    return names


def example_keys(path: Path) -> set[str]:
    """Keys documented in an env example, including commented-out optional ones."""
    keys: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        match = _KEY.match(line.strip())
        if match:
            keys.add(match.group(1))
    return keys


def render(files: tuple[str, ...], env_file: Path, cwd: Path, extra_env: dict[str, str]) -> dict:
    command = ["docker", "compose", "--env-file", str(env_file)]
    for name in files:
        command += ["-f", name]
    command += ["config", "--format", "json"]
    environment = {**os.environ, "PRISM_ENV_FILE": str(env_file), **extra_env}
    result = subprocess.run(
        command, cwd=cwd, env=environment, capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise AssertionError(f"{' '.join(command)} failed:\n{result.stderr}")
    return json.loads(result.stdout)


def _compose_available() -> bool:
    if shutil.which("docker") is None:
        return False
    probe = subprocess.run(
        ["docker", "compose", "version"], capture_output=True, text=True, check=False
    )
    return probe.returncode == 0


@unittest.skipUnless(_compose_available(), "docker compose is required to render Compose files")
class ComposeEnvForwardingTests(unittest.TestCase):
    def _env_file(self, example: Path, names: set[str]) -> Path:
        """The example file verbatim, plus every other name set to a harmless value."""
        handle = tempfile.NamedTemporaryFile(
            "w", suffix=".env", delete=False, encoding="utf-8"
        )
        self.addCleanup(os.unlink, handle.name)
        with handle:
            handle.write(example.read_text(encoding="utf-8"))
            handle.write("\n")
            documented = {
                line.split("=", 1)[0]
                for line in example.read_text(encoding="utf-8").splitlines()
                if re.match(r"^[A-Z][A-Z0-9_]*=", line)
            }
            for name in sorted(names - documented):
                handle.write(f"{name}=1\n")
        return Path(handle.name)

    def _assert_forwarded(self, rendered: dict, names: set[str], stack: str) -> None:
        for service in APP_SERVICES:
            environment = rendered["services"][service].get("environment") or {}
            missing = sorted(names - set(environment))
            self.assertEqual(
                missing, [], f"{stack}: {service} does not receive {', '.join(missing)}"
            )

    def test_source_compose_forwards_every_setting_and_documented_key(self) -> None:
        example = REPO / ".env.example"
        names = settings_env_names() | example_keys(example)
        env_file = self._env_file(example, names)
        for files in SOURCE_STACKS:
            with self.subTest(stack=" + ".join(files)):
                rendered = render(files, env_file, REPO, {})
                self._assert_forwarded(rendered, names, " + ".join(files))

    def test_release_compose_forwards_every_setting_and_documented_key(self) -> None:
        release = REPO / "deploy" / "release"
        example = release / ".env.example"
        names = settings_env_names() | example_keys(example)
        env_file = self._env_file(example, names)
        rendered = render(
            ("compose.yml",), env_file, release, {"POSTGRES_PASSWORD": "ci-release-validation"}
        )
        self._assert_forwarded(rendered, names, "deploy/release/compose.yml")

    def test_the_named_import_allowlist_reaches_the_backend(self) -> None:
        """The concrete regression: the Git host allowlist never reached the API."""
        handle = tempfile.NamedTemporaryFile("w", suffix=".env", delete=False, encoding="utf-8")
        self.addCleanup(os.unlink, handle.name)
        with handle:
            handle.write("IMPORT_ALLOWED_HOSTS_STR=github.com\n")
        rendered = render(("docker-compose.yml",), Path(handle.name), REPO, {})
        for service in APP_SERVICES:
            self.assertEqual(
                rendered["services"][service]["environment"].get("IMPORT_ALLOWED_HOSTS_STR"),
                "github.com",
                service,
            )


class SettingsDiscoveryTests(unittest.TestCase):
    def test_aliases_replace_field_names(self) -> None:
        names = settings_env_names()
        self.assertIn("AUTH_ENABLED", names)
        self.assertNotIn("AUTH_ENABLED_OVERRIDE", names)
        self.assertIn("IMPORT_ALLOWED_HOSTS_STR", names)
        self.assertIn("PRISM_DESIGN_COMPARE_CACHE", names)  # inherited field group


if __name__ == "__main__":
    unittest.main()
