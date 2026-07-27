"""Back up and restore a Prism installation as one archive.

    python3 scripts/prism_backup.py create
    python3 scripts/prism_backup.py verify prism-backup-20260727-101500.tar.gz
    python3 scripts/prism_backup.py restore prism-backup-20260727-101500.tar.gz

A PostgreSQL dump on its own is not a restorable backup of Prism. Component
assets -- symbols, footprints, 3D models, previews and revision payloads -- live
on disk under ``data/projects/.kicad-prism/components``, and the database holds
the rows that point at them. Restore one without the other and every component
in the catalog exists with a broken reference to its files.

So the two are captured together, by default with the application stopped and
PostgreSQL still up, which is the only cheap way to get a pair that describes
one moment. ``--hot`` skips that at the cost of the guarantee.

Regenerable content is left out. Job artifacts, semantic 3D bundles, KiCad
database-library exports and validation runs all rebuild from the authoritative
data, and on a working installation they are the bulk of the bytes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prism_deploy import tui  # noqa: E402


MANIFEST_NAME = "manifest.json"
MANIFEST_SCHEMA = "prism.backup.a1"
DUMP_NAME = "postgres.dump"

# Everything here is authoritative: losing it means losing work. Paths are
# relative to the deployment directory.
COMPONENT_STORE = "data/projects/.kicad-prism/components"
PAYLOADS: tuple[tuple[str, str], ...] = (
    ("projects", "data/projects"),
    ("ssh", "data/ssh"),
)

# Regenerable, and excluded from the projects payload. Each rebuilds from the
# database plus the component store.
REGENERABLE = (
    ".kicad-prism/artifacts",
    ".kicad-prism/bundles",
    ".kicad-prism/exports",
    ".kicad-prism/validation",
    ".kicad-prism/cache",
    ".kicad-prism/tmp",
)

APPLICATION_SERVICES = ("frontend", "backend", "prism-worker", "catalog-worker")


class BackupError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_env(path: Path) -> dict[str, str]:
    """Parse a Compose ``.env``. Values are taken literally, as Compose does."""
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        values[key.strip()] = value.strip()
    return values


def is_regenerable(relative: str) -> bool:
    """Whether a path inside ``data/projects`` rebuilds from authoritative state.

    ``tarfile`` presents member names as ``./a/b``. Strip that prefix as a
    prefix, not as a character set: the store itself lives under ``.kicad-prism``
    and ``lstrip("./")`` would eat its leading dot.
    """
    normalised = relative.replace(os.sep, "/")
    if normalised.startswith("./"):
        normalised = normalised[2:]
    normalised = normalised.lstrip("/")
    return any(
        normalised == prefix or normalised.startswith(prefix + "/")
        for prefix in REGENERABLE
    )


def compose_files(root: Path, explicit: list[str] | None = None) -> list[str]:
    """Resolve the Compose files for an installation.

    Release bundles ship ``compose.yml``; source checkouts use
    ``docker-compose.yml`` plus whatever the installer generated.
    """
    if explicit:
        return list(explicit)
    if (root / "compose.yml").is_file():
        return ["compose.yml"]
    if not (root / "docker-compose.yml").is_file():
        raise BackupError(
            f"No compose.yml or docker-compose.yml in {root}. "
            "Run from the deployment directory or pass --root."
        )
    files = ["docker-compose.yml"]
    for candidate in ("docker-compose.proxy.yml", "generated/docker-compose.generated.yml"):
        if (root / candidate).is_file():
            files.append(candidate)
    return files


def env_file_for(root: Path, explicit: str | None = None) -> str:
    if explicit:
        return explicit
    for candidate in ("generated/.env", ".env"):
        if (root / candidate).is_file():
            return candidate
    raise BackupError(f"No .env found in {root}; pass --env-file.")


def build_manifest(
    *,
    created_at: str,
    root: Path,
    env: dict[str, str],
    versions: dict[str, str],
    entries: dict[str, str],
    hot: bool,
) -> dict:
    """Describe the archive well enough to refuse a bad restore later."""
    return {
        "schema": MANIFEST_SCHEMA,
        "created_at": created_at,
        "source": str(root),
        "hot": hot,
        "postgres": {
            "user": env.get("POSTGRES_USER", "kicad_prism"),
            "database": env.get("POSTGRES_DB", "kicad_prism"),
            "image": env.get("PRISM_POSTGRES_IMAGE", "postgres:17-alpine"),
        },
        "images": {
            key: value
            for key, value in env.items()
            if key.endswith("_IMAGE") and value
        },
        "versions": versions,
        "checksums": entries,
    }


def compare_versions(manifest: dict, current: dict[str, str]) -> list[str]:
    """Problems that should stop a restore, in the operator's words."""
    problems: list[str] = []
    if str(manifest.get("schema")) != MANIFEST_SCHEMA:
        problems.append(
            f"archive schema {manifest.get('schema')!r} is not {MANIFEST_SCHEMA!r}"
        )
    archived = manifest.get("versions", {}) or {}
    for name, label in (("workspace_schema", "workspace"), ("catalog_schema", "catalog")):
        archived_value = archived.get(name)
        current_value = current.get(name)
        if archived_value is None or current_value is None:
            continue
        if int(archived_value) > int(current_value):
            problems.append(
                f"the archive's {label} schema is version {archived_value}, "
                f"newer than this build's {current_value}; restoring it would "
                "downgrade the database below what wrote it"
            )
    return problems


# ---------------------------------------------------------------------------
# Docker plumbing
# ---------------------------------------------------------------------------


def compose_command(root: Path, files: list[str], env_file: str) -> list[str]:
    command = ["docker", "compose", "--env-file", env_file]
    for name in files:
        command += ["-f", name]
    return command


def run(command: list[str], root: Path, *, capture: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        cwd=root,
        check=False,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def present_application_services(compose: list[str], root: Path) -> list[str]:
    """Application services this deployment actually defines.

    Deployment schemes differ in what they run, and a backup must not fail
    because a service it wanted to pause is not part of this installation.
    """
    result = run(compose + ["config", "--services"], root, capture=True)
    if result.returncode != 0:
        return list(APPLICATION_SERVICES)
    defined = set(result.stdout.decode("utf-8", "replace").split())
    return [service for service in APPLICATION_SERVICES if service in defined]


def schema_versions(compose: list[str], root: Path, env: dict[str, str]) -> dict[str, str]:
    """Read both migration ledgers straight from PostgreSQL."""
    user = env.get("POSTGRES_USER", "kicad_prism")
    database = env.get("POSTGRES_DB", "kicad_prism")
    query = (
        "SELECT "
        "COALESCE((SELECT max(version)::text FROM workspace.ws_schema_migrations), '0') "
        "|| ' ' || "
        "COALESCE((SELECT max(version)::text FROM catalog.catalog_schema_versions), '0')"
    )
    result = run(
        compose + ["exec", "-T", "postgres", "psql", "-U", user, "-d", database, "-tAc", query],
        root,
        capture=True,
    )
    if result.returncode != 0:
        return {}
    parts = result.stdout.decode("utf-8", "replace").strip().split()
    if len(parts) != 2:
        return {}
    return {"workspace_schema": parts[0], "catalog_schema": parts[1]}


def dump_database(compose: list[str], root: Path, env: dict[str, str], target: Path) -> None:
    user = env.get("POSTGRES_USER", "kicad_prism")
    database = env.get("POSTGRES_DB", "kicad_prism")
    with target.open("wb") as handle:
        result = subprocess.run(
            compose + ["exec", "-T", "postgres", "pg_dump", "-U", user, "-d", database, "-Fc"],
            cwd=root,
            stdout=handle,
            stderr=subprocess.PIPE,
            check=False,
        )
    if result.returncode != 0:
        raise BackupError(
            "pg_dump failed: " + result.stderr.decode("utf-8", "replace").strip()
        )
    if target.stat().st_size == 0:
        raise BackupError("pg_dump produced an empty file; refusing to call this a backup.")


def extract_all(handle: tarfile.TarFile, target: Path) -> None:
    """Extract with the member sanitising filter where the runtime has one.

    Python 3.14 rejects unfiltered extraction outright. Older runtimes have no
    ``filter`` argument at all, and operators run this on whatever host they
    have, so ask for the safe behaviour and fall back rather than refuse.
    """
    try:
        handle.extractall(target, filter="data")
    except TypeError:
        handle.extractall(target)


def archive_directory(source: Path, target: Path, *, prune_regenerable: bool) -> None:
    def keep(info: tarfile.TarInfo) -> tarfile.TarInfo | None:
        if prune_regenerable and is_regenerable(info.name):
            return None
        return info

    with tarfile.open(target, "w:gz") as archive:
        archive.add(source, arcname=".", filter=keep)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def create(args: argparse.Namespace) -> int:
    root: Path = args.root.resolve()
    env_file = env_file_for(root, args.env_file)
    files = compose_files(root, args.compose_file)
    compose = compose_command(root, files, env_file)
    env = read_env(root / env_file)

    created_at = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = args.output or root / f"prism-backup-{created_at}.tar.gz"

    tui.banner("Prism backup", str(output.name))
    tui.info(f"Deployment  {root}")
    tui.info(f"Compose     {' '.join(files)}")
    tui.info(f"Environment {env_file}")
    tui.write()

    services = present_application_services(compose, root)
    stopped: list[str] = []
    if args.hot:
        tui.warn("Hot backup: the database and the files may not describe one moment.")
    elif not services:
        tui.warn("No application services found; capturing without pausing anything.")
    else:
        tui.note("Stopping the application so the dump and the files agree")
        tui.hint("PostgreSQL stays up. Use --hot to skip, without the guarantee.")
        if run(compose + ["stop", *services], root).returncode != 0:
            raise BackupError("Could not stop the application services.")
        stopped = services

    try:
        with tempfile.TemporaryDirectory() as staging_name:
            staging = Path(staging_name)
            tui.write()
            tui.note("Dumping PostgreSQL")
            dump_database(compose, root, env, staging / DUMP_NAME)
            tui.ok(f"{DUMP_NAME}", f"{(staging / DUMP_NAME).stat().st_size / 1e6:.1f} MB")

            for name, relative in PAYLOADS:
                source = root / relative
                if not source.is_dir():
                    tui.warn(f"{relative} is missing; nothing archived for it.")
                    continue
                target = staging / f"{name}.tar.gz"
                archive_directory(source, target, prune_regenerable=(name == "projects"))
                tui.ok(f"{name}.tar.gz", f"{target.stat().st_size / 1e6:.1f} MB from {relative}")

            shutil.copy2(root / env_file, staging / "env")
            tui.ok("env", env_file)

            versions = schema_versions(compose, root, env)
            if versions:
                tui.ok(
                    "schema ledgers",
                    f"workspace {versions['workspace_schema']}, catalog {versions['catalog_schema']}",
                )
            else:
                tui.warn("Could not read the schema ledgers; the manifest will not pin them.")

            entries = {
                path.name: sha256_file(path)
                for path in sorted(staging.iterdir())
                if path.is_file()
            }
            manifest = build_manifest(
                created_at=created_at,
                root=root,
                env=env,
                versions=versions,
                entries=entries,
                hot=bool(args.hot),
            )
            (staging / MANIFEST_NAME).write_text(
                json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
            )

            with tarfile.open(output, "w:gz") as archive:
                for path in sorted(staging.iterdir()):
                    archive.add(path, arcname=path.name)
    finally:
        if stopped:
            tui.write()
            tui.note("Restarting the application")
            run(compose + ["start", *stopped], root)

    tui.write()
    tui.ok(f"Wrote {output}", f"{output.stat().st_size / 1e6:.1f} MB")
    tui.info("Store it off this host, encrypted: it contains repositories, tokens")
    tui.info("and SSH private keys.")
    tui.write()
    tui.hint(f"Check it now:  python3 scripts/prism_backup.py verify {output.name}")
    return 0


def load_manifest(archive: Path) -> dict:
    with tarfile.open(archive, "r:gz") as handle:
        member = handle.extractfile(MANIFEST_NAME)
        if member is None:
            raise BackupError(f"{archive} has no {MANIFEST_NAME}; it is not a Prism backup.")
        return json.loads(member.read().decode("utf-8"))


def verify(args: argparse.Namespace) -> int:
    archive: Path = args.archive.resolve()
    manifest = load_manifest(archive)

    tui.banner("Verify backup", archive.name)
    tui.panel(
        "Archive",
        [
            ("Created", manifest.get("created_at", "unknown")),
            ("Source", manifest.get("source", "unknown")),
            ("Database", manifest.get("postgres", {}).get("database", "unknown")),
            ("Consistency", "hot (services running)" if manifest.get("hot") else "quiesced"),
        ],
    )

    failures = 0
    with tempfile.TemporaryDirectory() as staging_name:
        staging = Path(staging_name)
        with tarfile.open(archive, "r:gz") as handle:
            extract_all(handle, staging)
        for name, expected in sorted((manifest.get("checksums") or {}).items()):
            path = staging / name
            if not path.is_file():
                tui.fail(name, "missing from the archive")
                failures += 1
                continue
            actual = sha256_file(path)
            if actual != expected:
                tui.fail(name, "checksum does not match the manifest")
                failures += 1
            else:
                tui.ok(name, f"{path.stat().st_size / 1e6:.1f} MB")

    tui.write()
    if failures:
        tui.fail(f"{failures} problem(s). Do not rely on this archive.")
        return 1
    tui.ok("Archive is intact")
    if manifest.get("hot"):
        tui.warn("Taken hot, so the database and files may disagree at the margins.")
    return 0


def restore(args: argparse.Namespace) -> int:
    root: Path = args.root.resolve()
    archive: Path = args.archive.resolve()
    env_file = env_file_for(root, args.env_file)
    files = compose_files(root, args.compose_file)
    compose = compose_command(root, files, env_file)
    env = read_env(root / env_file)
    manifest = load_manifest(archive)

    tui.banner("Restore backup", archive.name)
    tui.info(f"Into        {root}")
    tui.info(f"Taken       {manifest.get('created_at', 'unknown')}")
    tui.write()

    current = schema_versions(compose, root, env)
    problems = compare_versions(manifest, current)
    if problems:
        for problem in problems:
            tui.fail(problem)
        tui.write()
        tui.info("Restore this archive with the release that produced it.")
        return 1

    tui.warn("This replaces the database, project storage and SSH keys in place.")
    tui.info("Everything currently in this deployment is discarded.")
    tui.write()
    if not args.yes and not tui.confirm("Proceed?", default=False):
        tui.warn("Cancelled. Nothing changed.")
        return 130

    with tempfile.TemporaryDirectory() as staging_name:
        staging = Path(staging_name)
        with tarfile.open(archive, "r:gz") as handle:
            extract_all(handle, staging)

        tui.write()
        tui.note("Stopping the application")
        services = present_application_services(compose, root)
        if services:
            run(compose + ["stop", *services], root)
        run(compose + ["up", "-d", "postgres"], root)

        for name, relative in PAYLOADS:
            payload = staging / f"{name}.tar.gz"
            if not payload.is_file():
                continue
            destination = root / relative
            if destination.is_dir():
                shutil.rmtree(destination)
            destination.mkdir(parents=True, exist_ok=True)
            with tarfile.open(payload, "r:gz") as handle:
                extract_all(handle, destination)
            tui.ok(relative)

        user = env.get("POSTGRES_USER", "kicad_prism")
        database = env.get("POSTGRES_DB", "kicad_prism")
        tui.note("Restoring PostgreSQL")
        with (staging / DUMP_NAME).open("rb") as handle:
            result = subprocess.run(
                compose
                + [
                    "exec", "-T", "postgres",
                    "pg_restore", "-U", user, "-d", database, "--clean", "--if-exists",
                ],
                cwd=root,
                stdin=handle,
                check=False,
            )
        if result.returncode != 0:
            tui.fail("pg_restore reported errors.", "Inspect the output above before starting.")
            return result.returncode
        tui.ok("database restored")

    tui.write()
    tui.note("Starting the application")
    tui.info("Schema migrations run at startup; watch the backend log.")
    run(compose + ["up", "-d", "--wait"], root)
    tui.write()
    tui.ok("Restore complete")
    tui.info("Verify: login, a project, the catalog, and one 3D view.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="prism-backup", description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="deployment directory")
    parser.add_argument("--env-file", help="environment file, relative to --root")
    parser.add_argument("--compose-file", action="append", help="repeatable, relative to --root")
    sub = parser.add_subparsers(dest="command", required=True)

    creator = sub.add_parser("create", help="write a backup archive")
    creator.add_argument("--output", type=Path, help="archive path")
    creator.add_argument(
        "--hot",
        action="store_true",
        help="do not stop the application first (faster, no consistency guarantee)",
    )
    creator.set_defaults(handler=create)

    verifier = sub.add_parser("verify", help="check an archive against its manifest")
    verifier.add_argument("archive", type=Path)
    verifier.set_defaults(handler=verify)

    restorer = sub.add_parser("restore", help="restore an archive into this deployment")
    restorer.add_argument("archive", type=Path)
    restorer.add_argument("--yes", action="store_true", help="do not ask for confirmation")
    restorer.set_defaults(handler=restore)

    args = parser.parse_args(argv)
    try:
        return int(args.handler(args))
    except BackupError as error:
        tui.write()
        tui.fail(str(error))
        return 1
    except tui.Abort:
        tui.write()
        tui.warn("Cancelled.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
