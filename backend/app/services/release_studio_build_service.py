"""Orchestration for one Release Studio build (R11).

This is the seam where the technical modules meet: closure → steps → dossier →
persistence.  It owns no digest logic of its own; every digest comes from the
module that defines it, so there is exactly one implementation of each.

The job handler runs under the fenced ``JobContext``, which is what makes the
publication protocol crash-safe: artifacts are written into the fence's staging
directory, promoted to content-addressed objects, and only then committed to
PostgreSQL with the fence re-validated.
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import Any, Mapping

from app.release_studio import dossier as dossier_module
from app.release_studio.canonical import (
    CANONICALIZER_REGISTRY_NAME,
    CANONICALIZER_REGISTRY_VERSION,
    sha256_canonical,
)
from app.release_studio.closure import materialize_input_closure
from app.release_studio.config import (
    list_configuration_keys,
    load_configuration_at_commit,
    load_configuration_from_checkout,
    technical_config_digest,
)
from app.release_studio.jobset import (
    StepTypeStatus,
    classify_output_hermetic,
    load_jobset,
)
from app.release_studio.steps import StepExecutionError, resolve_cli_path, run_step_catalogue
from app.services import release_studio_service as store
from app.services.job_artifact_service import JobArtifactService
from app.services.job_runtime import JobContext, JobResult

logger = logging.getLogger(__name__)

GENERATOR_BUILD = "release-studio/r11"
EXECUTOR_IDENTITY_FILE = Path("/etc/prism/kicad-base-image")


class BuildError(RuntimeError):
    """A Release Studio build could not be produced."""


def executor_image() -> str:
    """The pinned OCI image digest baked into the runtime by R00a.

    A version string is not an identity: two 10.0.4 installs can differ in
    build commit, OpenCascade, FreeType, fontconfig, and the bundled KiCad
    libraries, and can produce different STEP/PDF/SVG output.
    """

    try:
        return EXECUTOR_IDENTITY_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def toolchain_identity(cli_version: str = "") -> tuple[dict[str, Any], str]:
    """Return the human-readable toolchain record and its hashed identity."""

    image = executor_image()
    record = {
        "kicad_version": cli_version or "10.0.4",
        "executor_image": image,
        "generator_build": GENERATOR_BUILD,
        "canonicalizer_registry": f"{CANONICALIZER_REGISTRY_NAME}/{CANONICALIZER_REGISTRY_VERSION}",
    }
    digest = sha256_canonical(
        {
            "executor_image_digest": image,
            "generator_build": GENERATOR_BUILD,
            "canonicalizer_registry_version": CANONICALIZER_REGISTRY_VERSION,
        }
    )
    return record, digest


def sync_configurations(project_id: str) -> list[dict[str, Any]]:
    """Reconcile the project's committed configurations into the registry.

    A release configuration is authored in Git under
    ``.prism/release-studio/configurations/*.yaml``; ``ws_release_configurations``
    is a queryable registry of what the working tree currently declares, not a
    second source of truth.  Reconciling on read is what lets a designer commit
    a configuration and immediately see it in the UI, and it keeps the two from
    drifting without a separate sync step to remember.

    A configuration that no longer parses is skipped rather than failing the
    listing: one bad file must not hide the others.
    """

    from app.services.design_compare_service import _repo_paths

    try:
        _repo, _relative, checkout = _repo_paths(project_id)
    except Exception:  # noqa: BLE001 - an unregistered project simply has none
        return store.list_configurations(project_id)

    for config_key in list_configuration_keys(checkout):
        try:
            config = load_configuration_from_checkout(checkout, config_key)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "release studio configuration %s/%s did not load: %s",
                project_id,
                config_key,
                exc,
            )
            continue
        store.upsert_configuration(
            project_id=project_id,
            config_key=config_key,
            title=str(config.get("title") or config_key),
            board_rel=str(config.get("board") or ""),
            schematic_rel=str(config.get("schematic") or ""),
            jobset_rel=str(config.get("jobset") or ""),
            default_variant=str(config.get("default_variant") or ""),
        )
    return store.list_configurations(project_id)


def prepare_candidate(
    *,
    project_id: str,
    repository_id: str,
    repo_root: Path,
    commit_sha: str,
    config_key: str,
    variant: str,
    workspace_root: Path,
    created_by: str = "",
    project_relpath: str = ".",
) -> dict[str, Any]:
    """Materialize the closure and register (or reuse) a candidate.

    Idempotent on ``build_key``: asking twice for the same commit, variant,
    configuration and toolchain returns the same candidate rather than a
    duplicate.
    """

    config = load_configuration_at_commit(repo_root, commit_sha, config_key)
    config_digest = technical_config_digest(config)

    closure_root = workspace_root / "closure"
    if closure_root.exists():
        shutil.rmtree(closure_root)
    closure = materialize_input_closure(
        repo_root,
        commit_sha,
        closure_root,
        relative_path=project_relpath,
    )

    hermetic, reasons = _hermeticity(closure_root, config)
    # A reference the closure could resolve into neither itself nor the pinned
    # toolchain is a hermeticity finding, not a materialization failure.
    closure_reasons = closure.non_hermetic_reasons()
    if closure_reasons:
        hermetic = False
        reasons = [*reasons, *closure_reasons]
    _toolchain, toolchain_digest = toolchain_identity()

    candidate = store.create_candidate(
        project_id=project_id,
        repository_id=repository_id,
        config_key=config_key,
        commit_sha=closure.commit_sha,
        variant=variant or str(config.get("default_variant") or ""),
        technical_config_digest=config_digest,
        input_closure_digest=closure.input_closure_digest,
        toolchain_digest=toolchain_digest,
        generator_build=GENERATOR_BUILD,
        hermetic=hermetic,
        non_hermetic_reasons=reasons,
        closure_inputs=_closure_rows(closure),
        created_by=created_by,
    )
    candidate["_closure_root"] = str(closure_root)
    candidate["_config"] = config
    return candidate


def _hermeticity(closure_root: Path, config: Mapping[str, Any]) -> tuple[bool, list[str]]:
    """Classify the selected jobset output, when the configuration names one.

    Without a jobset the build runs the fixed step catalogue, whose types are
    all hermetic by construction; the closure itself has already refused any
    input that resolves outside it.
    """

    jobset_rel = str(config.get("jobset") or "").strip()
    if not jobset_rel:
        return True, []
    jobset_path = closure_root / jobset_rel
    if not jobset_path.is_file():
        return False, [f"jobset not present in the closure: {jobset_rel}"]
    try:
        model = load_jobset(jobset_path)
    except Exception as exc:  # noqa: BLE001 - an unparseable jobset fails closed
        return False, [f"jobset could not be parsed: {exc}"]

    # Hermeticity is judged over each output's *selected* closure, never over
    # jobset presence: the reference jobset carries a `special_execute` job that
    # none of its outputs reference, and that must not taint the build.
    reasons: list[str] = []
    hermetic = True
    for output in model.outputs:
        try:
            closure = classify_output_hermetic(model, output.id)
        except Exception as exc:  # noqa: BLE001
            hermetic = False
            reasons.append(f"output {output.id} could not be classified: {exc}")
            continue
        if closure.status is not StepTypeStatus.HERMETIC:
            hermetic = False
        reasons.extend(str(reason) for reason in closure.non_hermetic_reasons)
        reasons.extend(str(reason) for reason in closure.unsupported_reasons)
    return hermetic, reasons


def _closure_rows(closure) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in closure.repository_inputs:
        rows.append(
            {
                "kind": "repository",
                "path": item.path,
                "git_object_id": item.git_object_id,
                "mode": item.mode,
                "object_type": item.type,
                "materialized_digest": item.materialized_digest,
            }
        )
    for item in closure.submodule_inputs:
        rows.append(
            {
                "kind": "submodule",
                "path": item.path,
                "git_object_id": item.gitlink_sha,
                "materialized_digest": item.resolved_tree_digest,
                "details": {"recursive": item.recursive},
            }
        )
    for item in closure.lfs_inputs:
        rows.append(
            {
                "kind": "lfs",
                "path": item.path,
                "git_object_id": item.pointer_blob_sha,
                "lfs_oid": item.lfs_oid,
                "materialized_digest": item.materialized_digest,
            }
        )
    for item in closure.toolchain_resources:
        rows.append(
            {"kind": "toolchain", "path": item.name, "materialized_digest": item.digest}
        )
    for item in closure.env_bindings:
        rows.append({"kind": "env", "path": item.name, "details": {"value": item.value}})
    return rows


def execute_build(
    context: JobContext,
    *,
    candidate: Mapping[str, Any],
    closure_root: Path,
    config: Mapping[str, Any],
    artifacts: JobArtifactService | None = None,
    cli_path: str | None = None,
) -> dict[str, Any]:
    """Run the catalogue, assemble the dossier, and publish it under the fence."""

    artifact_service = artifacts or JobArtifactService()
    build = store.start_build(
        candidate["id"], job_id=context.job_id, fence=context.fence
    )
    try:
        output_root = context.staging_dir / "outputs"
        output_root.mkdir(parents=True, exist_ok=True)
        outputs = run_step_catalogue(
            closure_root=closure_root,
            board_rel=str(config.get("board") or ""),
            schematic_rel=str(config.get("schematic") or "") or None,
            output_root=output_root,
            variant=str(candidate.get("variant") or ""),
            cli_path=cli_path,
            progress=lambda **kwargs: context.progress(**kwargs),
        )
        context.progress(stage="package", message="Canonicalizing and packaging", percent=75)

        toolchain, toolchain_digest = toolchain_identity()
        assembled = dossier_module.assemble(
            outputs=outputs,
            commit_sha=str(candidate["commit_sha"]),
            variant=str(candidate.get("variant") or ""),
            config_key=str(candidate["config_key"]),
            technical_config_digest=str(candidate["technical_config_digest"]),
            input_closure_digest=str(candidate["input_closure_digest"]),
            toolchain=toolchain,
            toolchain_digest=toolchain_digest,
            build_key=str(candidate["build_key"]),
            config_fragments={
                key: config.get(key)
                for key in ("board", "schematic", "jobset", "default_variant")
                if config.get(key) is not None
            },
        )

        dossier_artifact = _publish(
            artifact_service, context, assembled.dossier_bytes,
            name="dossier.tar.gz", kind="release_dossier",
            artifact_key=f"release-dossier:{candidate['build_key']}",
        )
        evidence_artifact = _publish(
            artifact_service, context, assembled.evidence_bytes,
            name="build-evidence.tar.gz", kind="release_build_evidence",
            artifact_key=f"release-evidence:{candidate['build_key']}",
        )

        # Register the artifact rows before the build row: `ws_release_builds`
        # references them ON DELETE RESTRICT, and the registration re-validates
        # the fence, so a stale worker's artifact can never become the record.
        context.progress(stage="record", message="Recording the build", percent=92)
        artifact_ids = context.service.register_fenced_artifacts(
            context.job_id,
            context.worker_id,
            context.fence,
            (dossier_artifact.__dict__, evidence_artifact.__dict__),
        )
        if artifact_ids is None:
            raise BuildError(
                "the build's fence is no longer authoritative; artifacts were "
                "not registered"
            )
        completed = store.complete_build(
            build_id=build["id"],
            dossier=assembled,
            toolchain=toolchain,
            dossier_artifact_id=artifact_ids[0],
            evidence_artifact_id=artifact_ids[1],
            fence=context.fence,
            actor=str(context.payload.get("author") or ""),
        )
        return {
            "build": completed,
            "dossier": assembled,
            "artifacts": (dossier_artifact, evidence_artifact),
        }
    except StepExecutionError as exc:
        store.fail_build(build["id"], error_code="step_failed", error_message=str(exc))
        raise BuildError(str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - the build row must not stay running
        store.fail_build(build["id"], error_code="build_failed", error_message=str(exc))
        raise


def _publish(
    artifacts: JobArtifactService,
    context: JobContext,
    payload: bytes,
    *,
    name: str,
    kind: str,
    artifact_key: str,
):
    staged = context.staging_dir / name
    staged.write_bytes(payload)
    return artifacts.prepare_file(
        context,
        staged,
        kind=kind,
        artifact_key=artifact_key,
        media_type="application/gzip",
        generator_version=GENERATOR_BUILD,
    )


def run_release_studio_build_job(context: JobContext) -> JobResult:
    """Job handler: ``release_studio_build``."""

    from app.services import project_service, workspace_service

    payload = context.payload
    project_id = str(payload["project_id"])
    config_key = str(payload.get("config_key") or "default")
    variant = str(payload.get("variant") or "")
    commit_sha = str(payload.get("commit_sha") or "HEAD")
    author = str(payload.get("author") or "anonymous")

    row = workspace_service.workspace.get_project_by_id(project_id)
    if not row:
        raise BuildError("project not found")
    project_path = Path(str(row["path"] if "path" in row else row.get("clone_path") or ""))
    repository_id = str(row.get("repo_id") or "")
    relative_path = str(row.get("relative_path") or ".")
    repo_root = project_path
    for _ in range(6):
        if (repo_root / ".git").exists():
            break
        repo_root = repo_root.parent

    context.progress(stage="closure", message="Materializing the input closure", percent=5)
    candidate = prepare_candidate(
        project_id=project_id,
        repository_id=repository_id,
        repo_root=repo_root,
        commit_sha=commit_sha,
        config_key=config_key,
        variant=variant,
        workspace_root=context.staging_dir,
        created_by=author,
        project_relpath=relative_path,
    )

    result = execute_build(
        context,
        candidate=candidate,
        closure_root=Path(candidate["_closure_root"]),
        config=candidate["_config"],
        cli_path=_cli_path_or_none(),
    )
    build = result["build"]
    return JobResult(
        message="Release Studio build completed",
        details={
            "project_id": project_id,
            "config_key": config_key,
            "candidate_id": candidate["id"],
            "build_id": build["id"],
            "manifest_digest": build["manifest_digest"],
            "dossier_digest": build["dossier_digest"],
        },
        artifact=result["artifacts"][0],
        sidecar_artifacts=(result["artifacts"][1],),
    )


def _cli_path_or_none() -> str | None:
    try:
        return resolve_cli_path()
    except StepExecutionError:
        return None


__all__ = [
    "GENERATOR_BUILD",
    "BuildError",
    "execute_build",
    "executor_image",
    "prepare_candidate",
    "run_release_studio_build_job",
    "toolchain_identity",
]
