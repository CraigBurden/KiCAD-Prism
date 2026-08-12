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
import subprocess
from importlib import metadata
from pathlib import Path
from typing import Any, Mapping, Sequence

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
    load_policy_for_configuration_at_commit,
    technical_config_digest,
    technical_config_payload,
)
from app.release_studio.jobset import (
    StepTypeStatus,
    classify_output_hermetic,
    load_jobset,
)
from app.release_studio.steps import (
    DOCUMENT_STEP_SPEC,
    StepExecutionError,
    StepOutput,
    resolve_cli_path,
    resolve_cruncher_path,
    run_step_catalogue,
)
from app.services import release_studio_service as store
from app.services.job_artifact_service import JobArtifactService
from app.services.job_runtime import JobContext, JobResult

logger = logging.getLogger(__name__)

#: Identity of the code that assembles a dossier from a build's outputs.
#:
#: It feeds `toolchain_digest` and therefore `build_key`, so any change to what
#: the manifest contains or how a fingerprint is composed has to move it.  Two
#: builds sharing a `build_key` while producing different manifests is exactly
#: the reproducibility claim the key exists to make.
#: r23 -- the manifest carries projection digests rather than projection text.
GENERATOR_BUILD = "release-studio/r23"
EXECUTOR_IDENTITY_FILE = Path("/etc/prism/kicad-base-image")


class BuildError(RuntimeError):
    """A Release Studio build could not be produced."""


def executor_image() -> str:
    """The pinned OCI image digest baked into the runtime by R00a.

    A version string is not an identity: two 10.0.4 installs can differ in
    build commit, OpenCascade, FreeType, fontconfig, and the bundled KiCad
    libraries, and can produce different STEP/PDF/SVG output.

    An unreadable identity file is a hard failure rather than an empty string.
    Degrading silently would make ``toolchain_digest`` a constant on an
    unpinned host, so two builds from genuinely different KiCad installs would
    share a ``build_key`` -- which is the exact claim the key exists to make,
    quietly turned into a lie.
    """

    try:
        image = EXECUTOR_IDENTITY_FILE.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise BuildError(
            f"the pinned executor image identity is unreadable at "
            f"{EXECUTOR_IDENTITY_FILE}: {exc}. Release Studio cannot identify "
            "its toolchain, and a build key computed without it would be wrong."
        ) from exc
    if not image:
        raise BuildError(
            f"{EXECUTOR_IDENTITY_FILE} is empty; the runtime is not pinned to a "
            "KiCad image and its builds cannot be identified."
        )
    return image


def toolchain_identity(cli_version: str = "") -> tuple[dict[str, Any], str]:
    """Return the human-readable toolchain record and its hashed identity."""

    from app.release_studio.documents import RENDERER_VERSION, renderer_resource_digest

    image = executor_image()
    monkey_version = _distribution_version("kicad-monkey", "kicad_monkey")
    cruncher_version = _distribution_version("kicad-cruncher", "kicad_cruncher")
    # Fonts and the Cruncher view configuration together: both are bundled
    # resources that decide what a composed sheet contains.
    resources = renderer_resource_digest()
    record = {
        "kicad_version": cli_version or "10.0.4",
        "executor_image": image,
        "generator_build": GENERATOR_BUILD,
        "canonicalizer_registry": f"{CANONICALIZER_REGISTRY_NAME}/{CANONICALIZER_REGISTRY_VERSION}",
        "renderer": RENDERER_VERSION,
        "kicad_monkey_version": monkey_version,
        "kicad_cruncher_version": cruncher_version,
        "resource_bundle_digest": resources,
    }
    digest = sha256_canonical(
        {
            "executor_image_digest": image,
            "generator_build": GENERATOR_BUILD,
            "canonicalizer_registry_version": CANONICALIZER_REGISTRY_VERSION,
            # The renderer is part of the toolchain identity: a change that
            # alters composed sheets for unchanged input must move the build key.
            "renderer_version": RENDERER_VERSION,
            "kicad_monkey_version": monkey_version,
            # Cruncher renders the assembly views, so its version decides
            # what those released sheets look like.
            "kicad_cruncher_version": cruncher_version,
            "resource_bundle_digest": resources,
        }
    )
    return record, digest


def _distribution_version(distribution: str, module_name: str) -> str:
    """Resolve a packaged tool identity without depending on host paths."""

    try:
        return metadata.version(distribution)
    except metadata.PackageNotFoundError:
        try:
            module = __import__(module_name)
        except ImportError:
            return "unavailable"
        return str(getattr(module, "__version__", "unversioned"))


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

    loaded_configs: dict[str, dict[str, Any]] = {}
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
        loaded_configs[config_key] = config
        store.upsert_configuration(
            project_id=project_id,
            config_key=config_key,
            title=str(config.get("title") or config_key),
            board_rel=str(config.get("board") or ""),
            schematic_rel=str(config.get("schematic") or ""),
            jobset_rel=str(config.get("jobset") or ""),
            default_variant=str(config.get("default_variant") or ""),
        )
    from app.release_studio.documents.fonts import DEFAULT_TYPOGRAPHY

    rows = store.list_configurations(project_id)
    for row in rows:
        loaded = loaded_configs.get(str(row.get("config_key") or ""))
        if loaded is not None:
            row["typography"] = loaded.get("typography", DEFAULT_TYPOGRAPHY)
            row["document_number"] = loaded.get("document_number", "")
            row["revision"] = loaded.get("revision", "")
            row["fields"] = loaded.get("fields", {})
            row["notes"] = loaded.get("notes", {})
    return rows


def policy_document_for_candidate(
    project_id: str,
    candidate: Mapping[str, Any],
) -> dict[str, Any] | None:
    """Return the candidate's immutable Git-owned policy snapshot.

    Candidates produced before snapshot persistence retain an exact-commit
    compatibility path. New candidates do not depend on a mutable checkout at
    evaluation time.
    """

    if candidate.get("policy_snapshot_captured"):
        document = candidate.get("policy_document")
        return dict(document) if isinstance(document, Mapping) else None

    from app.services import workspace_service

    row = workspace_service.workspace.get_project_by_id(project_id)
    if not row:
        raise BuildError("project not found")
    project_path = Path(str(row["path"] if "path" in row else row.get("clone_path") or ""))
    repo_root = project_path
    for _ in range(6):
        if (repo_root / ".git").exists():
            break
        repo_root = repo_root.parent
    config = load_configuration_at_commit(
        repo_root,
        str(candidate.get("commit_sha") or "HEAD"),
        str(candidate.get("config_key") or "default"),
    )
    return load_policy_for_configuration_at_commit(
        repo_root,
        str(candidate.get("commit_sha") or "HEAD"),
        config,
    )


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
    policy_document = load_policy_for_configuration_at_commit(
        repo_root,
        commit_sha,
        config,
    )

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
    # References no build step reads -- 3D models -- are reported rather than
    # counted against hermeticity, so they cannot block a release whose outputs
    # do not depend on them.
    advisory = closure.advisory_reasons()
    if advisory:
        logger.info(
            "Release Studio closure carries %d advisory reference(s)", len(advisory)
        )
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
        policy_snapshot_captured=True,
        policy_document=policy_document,
        created_by=created_by,
    )
    candidate["_closure_root"] = str(closure_root)
    candidate["_config"] = config
    candidate["_advisory_reasons"] = advisory
    candidate["project_relpath"] = project_relpath
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
    cruncher_path: str | None = None,
    repo_root: Path | None = None,
) -> dict[str, Any]:
    """Run the catalogue, assemble the dossier, and publish it under the fence.

    ``repo_root`` is the source repository.  The closure is materialized from
    Git objects and has no ``.git`` of its own, so anything that needs commit
    metadata -- the date a sheet states -- has to ask the repository.
    """

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
        context.progress(stage="documents", message="Composing documentation", percent=70)
        outputs, document_warnings, projections = _with_documents(
            outputs,
            closure_root=closure_root,
            config=config,
            candidate=candidate,
            output_root=output_root,
            cli_path=cli_path,
            cruncher_path=cruncher_path,
            staging=context.staging_dir,
            repo_root=repo_root,
            project_relpath=str(candidate.get("project_relpath") or "") or None,
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
            config_fragments=technical_config_payload(config),
            projections=projections,
            archive_mtime=_commit_timestamp(
                repo_root, str(candidate.get("commit_sha") or "")
            ),
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
            projections=projections,
            warnings=[
                *(
                    f"closure: {reason}"
                    for reason in candidate.get("_advisory_reasons") or ()
                ),
                *document_warnings,
            ],
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


def _with_documents(
    outputs: Sequence[StepOutput],
    *,
    closure_root: Path,
    config: Mapping[str, Any],
    candidate: Mapping[str, Any],
    output_root: Path,
    cli_path: str | None,
    staging: Path,
    cruncher_path: str | None = None,
    repo_root: Path | None = None,
    project_relpath: str | None = None,
) -> tuple[list[StepOutput], list[str], dict[str, Any]]:
    """Compose the Stage 2 sheets and append them as a member-producing step.

    The Documentation Engine is a member producer: it adds files under the
    ``documentation`` domain and changes nothing else.  A failure here degrades
    the document set rather than the build -- the manufacturing outputs are
    already produced and are what the release is fundamentally about.

    Every degradation is returned so it can be recorded on the build row.  A
    log line is not enough: this runs in a job subprocess, so a document set
    that silently vanished looked exactly like one that was never configured.
    """

    warnings: list[str] = []
    projections: dict[str, Any] = {}

    from app.release_studio.documents import compose
    from app.release_studio.documents.fonts import DEFAULT_TYPOGRAPHY
    from app.release_studio.projections import (
        load_board_model,
        project_board_stats_file,
        project_stackup,
        project_variants,
    )
    from app.release_studio.semantic import semantic_scope_projections
    from app.services import semantic_index_service

    board_rel = str(config.get("board") or "")
    board = closure_root / board_rel if board_rel else None

    def _project(label: str, fn, default):
        """Run one projection; a failure costs that table, not the sheet set."""

        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Release Studio projection %s unavailable: %s", label, exc)
            warnings.append(f"documentation: the {label} projection is unavailable ({exc})")
            return default

    try:
        stats_file = output_root / "fabrication/board-stats.json"
        stats = (
            _project("board_stats", lambda: project_board_stats_file(stats_file), {})
            if stats_file.is_file()
            else {}
        )

        stackup: dict[str, Any] = {}
        variants: dict[str, Any] = {}
        if board is not None and board.is_file():
            # One parse for both projections.  On a 35 MB board this is over two
            # minutes of work, and doing it twice for the same file was the
            # single largest avoidable cost in a build.
            model = _project("board model", lambda: load_board_model(board), (None, None))
            stackup = _project("stackup", lambda: project_stackup(board, model=model), {})
            if stackup.get("source") == "kicad_monkey.fallback":
                warnings.append(
                    "documentation: stackup used the kicad_monkey targeted fallback "
                    f"({stackup.get('fallback_reason') or 'typed model rejected the board'})"
                )
            # Schematic variants live in the *project* file, not the schematic:
            # `schematic_settings.cpp:266` reads them from `.kicad_pro`.
            project_file = board.with_suffix(".kicad_pro")
            # Only a *typed* model can answer the variant question; the targeted
            # stackup fallback has no footprints, so that case re-parses.
            parsed, fallback_reason = model
            variants = _project(
                "variants",
                lambda: project_variants(
                    board,
                    project_file if project_file.is_file() else None,
                    pcb=None if fallback_reason else parsed,
                ),
                {},
            )

        placements = _placements(output_root / "assembly/positions.csv")
        projections = {
            "board_stats": stats,
            "stackup": stackup,
            "variants": variants,
            "placements": placements,
        }

        project_file = board.with_suffix(".kicad_pro") if board is not None else None
        if project_file is not None and project_file.is_file():
            semantic_index = _project(
                "semantic index",
                lambda: semantic_index_service.build_semantic_index(
                    project_file,
                    source_revision_key=(
                        semantic_index_service.source_revision_key_for_project_file(project_file)
                    ),
                    commit=str(candidate.get("commit_sha") or "") or None,
                ),
                {},
            )
            if semantic_index:
                projections["semantic"] = semantic_scope_projections(semantic_index)

        # The cover lists the members produced so far; it cannot list itself.
        existing = dossier_module.build_members(list(outputs))
        member_rows = [
            {
                "path": member.path,
                "canonicalizer": member.canonicalizer,
                "released_digest": member.released_digest,
            }
            for member in existing
        ]

        revision_history = _revision_history(
            repo_root,
            commit_sha=str(candidate.get("commit_sha") or "") or None,
            relative_path=project_relpath or str(candidate.get("project_relpath") or ""),
        )

        document_set = compose(
            context={
                "title": str(config.get("title") or config.get("document_number") or "RELEASE"),
                "document_number": str(config.get("document_number") or ""),
                "revision": str(config.get("revision") or ""),
                "commit_sha": str(candidate.get("commit_sha") or ""),
                "variant": str(candidate.get("variant") or ""),
                "commit_date": _commit_date(
                    repo_root or closure_root, str(candidate.get("commit_sha") or "")
                ),
            },
            stats=stats,
            stackup=stackup,
            variants=variants,
            placements=placements,
            members=member_rows,
            board=board if board and board.is_file() else None,
            cli_path=cli_path,
            cruncher_path=cruncher_path,
            workdir=staging / "artwork",
            notes=config.get("notes") or {},
            fields=config.get("fields") or {},
            typography=str(config.get("typography") or DEFAULT_TYPOGRAPHY),
            revision_history=revision_history,
        )
    except Exception as exc:  # noqa: BLE001
        # `exception` not `warning`: without the traceback a vanished document
        # set looks identical to one that was never configured.
        logger.exception("Documentation Engine produced no sheets")
        warnings.append(f"documentation: no sheets were composed ({exc})")
        return list(outputs), warnings, projections

    for warning in document_set.warnings:
        logger.warning("Documentation Engine: %s", warning)
        warnings.append(f"documentation: {warning}")

    written: list[Path] = []
    for relative, payload in sorted(document_set.files().items()):
        target = output_root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        written.append(target)

    if not written:
        warnings.append("documentation: the engine composed no sheets")
        return list(outputs), warnings, projections

    return [
        *outputs,
        StepOutput(
            step_id=DOCUMENT_STEP_SPEC.step_id,
            step_type=DOCUMENT_STEP_SPEC.step_type,
            normalized_argv=("prism", "compose", "documents"),
            returncode=0,
            files=tuple(written),
            root=output_root,
            spec=DOCUMENT_STEP_SPEC,
        ),
    ], warnings, projections


def _placements(positions_csv: Path) -> list[dict[str, Any]]:
    """Read side information out of the position file, if one was produced."""

    if not positions_csv.is_file():
        return []
    import csv

    rows: list[dict[str, Any]] = []
    try:
        text = positions_csv.read_text(encoding="utf-8", errors="replace")
        for row in csv.DictReader(text.splitlines()):
            side = (row.get("Side") or row.get("side") or "").strip().lower()
            rows.append({"side": side, "ref": (row.get("Ref") or row.get("ref") or "").strip()})
    except Exception:  # noqa: BLE001 - the sheet degrades to a zero count
        return []
    return rows


def _commit_date(repo_root: Path, commit: str) -> str:
    """The commit's author date -- a property of the revision, not of the render."""

    if not commit:
        return ""
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "show", "-s", "--format=%as", commit],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return ""
    return (result.stdout or "").strip() if result.returncode == 0 else ""


def _revision_history(
    repo_root: Path | None,
    *,
    commit_sha: str | None = None,
    relative_path: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Git tags for the cover revision-history table.

    Uses the same tag listing the project Releases UI uses.  Failures degrade
    to an empty list so a cover still composes without Git metadata.
    """

    if repo_root is None or not Path(repo_root).exists():
        return []
    try:
        from app.services.git_service import get_releases, get_releases_filtered

        rel = (relative_path or "").strip().strip("./")
        if rel and rel not in {".", ""}:
            page = get_releases_filtered(
                str(repo_root),
                rel,
                commit_sha or None,
                limit,
                0,
                False,
            )
        else:
            page = get_releases(
                str(repo_root),
                commit_sha or None,
                limit,
                0,
                False,
            )
    except Exception:  # noqa: BLE001 - cover degrades without history
        logger.warning("Revision history unavailable for documentation cover", exc_info=True)
        return []
    if isinstance(page, dict):
        releases = page.get("releases") or []
    else:
        releases = page or []
    return [item for item in releases if isinstance(item, Mapping)]


def _commit_timestamp(repo_root: Path, commit: str) -> int:
    """Commit author time as an archive-safe epoch, or the neutral epoch."""

    if not commit:
        return 0
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "show", "-s", "--format=%at", commit],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return 0
    if result.returncode != 0:
        return 0
    try:
        return max(0, int(result.stdout.strip()))
    except ValueError:
        return 0


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
        cruncher_path=_cruncher_path_or_none(),
        repo_root=repo_root,
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


def _cruncher_path_or_none() -> str | None:
    """A missing Cruncher costs the assembly views, not the build."""

    try:
        return resolve_cruncher_path()
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
