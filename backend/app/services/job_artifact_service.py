from __future__ import annotations

import io
import json
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.services.job_runtime import JobContext, PreparedArtifact, job_state_root
from app.services.object_store import ObjectStore, ReferenceOwner


class JobArtifactService:
    """Prepare immutable content-addressed objects on the shared local volume.

    Storage and collection belong to :class:`ObjectStore`; this service adds the
    job rules: objects come only from the fenced staging directory, and
    metadata rows are reconciled against the files.
    """

    def __init__(
        self,
        root: Path | None = None,
        *,
        owners: Sequence[ReferenceOwner] | None = None,
    ) -> None:
        self.root = (root or job_state_root()).resolve()
        self.store = ObjectStore(self.root / "artifacts" / "objects" / "sha256", owners=owners)
        self.objects = self.store.root

    def prepare_json(
        self,
        context: JobContext,
        payload: Mapping[str, Any],
        *,
        kind: str,
        artifact_key: str,
        schema_version: str = "",
        generator_version: str = "",
        readiness: str = "ready",
    ) -> PreparedArtifact:
        context.check_cancelled()
        context.staging_dir.mkdir(parents=True, exist_ok=True)
        temporary = context.staging_dir / f"artifact-{uuid.uuid4().hex}.json"
        encoded = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode(
            "utf-8"
        )
        with temporary.open("wb") as handle:
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
        return self.prepare_file(
            context,
            temporary,
            kind=kind,
            artifact_key=artifact_key,
            media_type="application/json",
            schema_version=schema_version,
            generator_version=generator_version,
            readiness=readiness,
        )

    def prepare_ended_json(
        self,
        payload: Mapping[str, Any],
        *,
        kind: str,
        artifact_key: str,
        schema_version: str = "",
        generator_version: str = "",
        readiness: str = "ready",
    ) -> PreparedArtifact:
        """A JSON object for an ended job, written by its end hook (no fence,
        no staging directory: the attempt is over)."""

        encoded = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        stored = self.store.put_stream(io.BytesIO(encoded), staging_dir=self.root / "ended")
        return PreparedArtifact(
            kind=kind,
            artifact_key=artifact_key,
            digest=stored.digest,
            object_path=str(stored.path),
            size_bytes=stored.size_bytes,
            media_type="application/json",
            schema_version=schema_version,
            generator_version=generator_version,
            readiness=readiness,
        )

    def prepare_file(
        self,
        context: JobContext,
        source: Path,
        *,
        kind: str,
        artifact_key: str,
        media_type: str = "application/octet-stream",
        schema_version: str = "",
        generator_version: str = "",
        readiness: str = "ready",
        allow_cancel_requested: bool = False,
    ) -> PreparedArtifact:
        if not allow_cancel_requested:
            context.check_cancelled()
        source = source.resolve()
        try:
            source.relative_to(context.staging_dir.resolve())
        except ValueError as error:
            raise ValueError("Job artifacts must be prepared inside the fenced staging directory") from error
        stored = self.store.put_file(source)
        return PreparedArtifact(
            kind=kind,
            artifact_key=artifact_key,
            digest=stored.digest,
            object_path=str(stored.path),
            size_bytes=stored.size_bytes,
            media_type=media_type,
            schema_version=schema_version,
            generator_version=generator_version,
            readiness=readiness,
        )

    def prepare_directory(
        self,
        context: JobContext,
        source: Path,
        *,
        kind: str,
        artifact_key: str,
        schema_version: str = "",
        generator_version: str = "",
        readiness: str = "ready",
    ) -> PreparedArtifact:
        """Package a directory deterministically before immutable publication."""

        context.check_cancelled()
        source = source.resolve()
        try:
            source.relative_to(context.staging_dir.resolve())
        except ValueError as error:
            raise ValueError("Job artifacts must be prepared inside the fenced staging directory") from error
        archive_base = context.staging_dir / f"bundle-{uuid.uuid4().hex}"
        archive = Path(
            shutil.make_archive(
                str(archive_base),
                "gztar",
                root_dir=str(source.parent),
                base_dir=source.name,
            )
        )
        return self.prepare_file(
            context,
            archive,
            kind=kind,
            artifact_key=artifact_key,
            media_type="application/gzip",
            schema_version=schema_version,
            generator_version=generator_version,
            readiness=readiness,
        )

    def reconcile_registered_artifacts(
        self,
        *,
        service: Any | None = None,
        limit: int = 10000,
    ) -> dict[str, int]:
        """Invalidate ready metadata whose immutable object disappeared."""

        if service is None:
            from app.services.job_service import jobs

            service = jobs
        checked = 0
        invalidated = 0
        for artifact in service.list_ready_artifacts(limit=limit):
            checked += 1
            path = self.store.contains(str(artifact.get("object_path") or ""))
            reason = ""
            if path is None:
                reason = "object_path_outside_artifact_root"
            elif not path.is_file():
                reason = "object_missing"
            if reason and service.invalidate_artifact(str(artifact["id"]), reason=reason):
                invalidated += 1
        return {"checked": checked, "invalidated": invalidated}

    def collect_unreferenced_objects(
        self,
        *,
        owners: Sequence[ReferenceOwner] | None = None,
        grace_seconds: int = 24 * 60 * 60,
    ) -> dict[str, int]:
        """Remove old objects that no owner (jobs, catalog, ...) still pins."""

        return self.store.collect_unreferenced(grace_seconds=grace_seconds, owners=owners)

    def cleanup_stale_staging(
        self,
        *,
        service: Any | None = None,
        grace_seconds: int = 60 * 60,
    ) -> dict[str, int]:
        """Delete abandoned fenced staging directories while preserving live leases."""

        if service is None:
            from app.services.job_service import jobs

            service = jobs
        staging_root = (self.root / "staging").resolve()
        if not staging_root.is_dir():
            return {"staging_directories_removed": 0}
        active = service.active_execution_keys()
        cutoff = time.time() - max(0, int(grace_seconds))
        removed = 0
        for job_dir in list(staging_root.iterdir()):
            if not job_dir.is_dir():
                continue
            for fence_dir in list(job_dir.iterdir()):
                if not fence_dir.is_dir():
                    continue
                try:
                    fence = int(fence_dir.name)
                    modified = fence_dir.stat().st_mtime
                except (OSError, ValueError):
                    continue
                if (job_dir.name, fence) in active or modified > cutoff:
                    continue
                shutil.rmtree(fence_dir, ignore_errors=True)
                if not fence_dir.exists():
                    removed += 1
            try:
                job_dir.rmdir()
            except OSError:
                pass
        return {"staging_directories_removed": removed}


job_artifacts = JobArtifactService()
