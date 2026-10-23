"""Design Comparison's bundle path (ADR amendment C2r §9 step 5): `prism-kicad compare`, passed through."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.config import settings
from app.services import design_compare_bundle_path as bundle_path
from app.services import design_compare_service, fabrication_compare_service
from app.services.design_bundle import cli
from app.services.design_bundle.jobs import PreparedSources
from app.services.design_compare_benchmark import DesignCompareBenchmark
from app.services.job_runtime import PermanentJobError, RetryableJobError

BASE, HEAD = "a" * 40, "b" * 40


def result_document() -> dict[str, Any]:
    return {
        "schema": bundle_path.RESULT_SCHEMA,
        "base": {"revisionKey": "1" * 64, "bundleKey": "2" * 64, "projectFile": "p.kicad_pro"},
        "head": {"revisionKey": "3" * 64, "projectFile": "p.kicad_pro"},
        "files": {"base": [], "head": []},
        "schematic": {"changes": [{"id": "sch-added-0"}]},
        "pcb": {"changes": []},
        "bom": {"changes": []},
        "stackup": {},
        "routeMetrics": {},
        "projectDiff": {"schema": "prism.kicad_project_diff_v1"},
        "counts": {"schematic": {}, "pcb": {}, "bom": {}},
    }


def bundle_side(name: str, commit: str, archive: Path) -> bundle_path.Side:
    opened = SimpleNamespace(archive=SimpleNamespace(path=archive, member=lambda path: None))
    read = SimpleNamespace(opened=opened, extract=lambda paths: archive.parent)
    return bundle_path.Side(
        name, commit, "1" * 64, "2" * 64, {"project_file": "p.kicad_pro", "board": "p.kicad_pcb"}, read=read
    )


def source_side(name: str, commit: str, root: Path) -> bundle_path.Side:
    prepared = PreparedSources(
        src=root / "src", effective=root / "effective.json", key_record=root / "key-record.json",
        upgraded=[{"path": "p.kicad_pcb", "upgraded_from_version": 20221018}], materialized=None,  # type: ignore[arg-type]
    )
    return bundle_path.Side(
        name, commit, "3" * 64, "4" * 64, {"project_file": "p.kicad_pro", "board": "p.kicad_pcb"}, prepared=prepared
    )


class FakeStages(bundle_path.BundlePathStages):
    def __init__(self, sides: dict[str, bundle_path.Side], *, failure: Exception | None = None,
                 document: dict[str, Any] | None = None, fabrication_error: bool = False) -> None:
        self.sides = sides
        self.failure = failure
        self.document = document if document is not None else result_document()
        self.fabrication_error = fabrication_error
        self.calls: list[tuple[list[str], bool]] = []

    def side(self, inputs, name, commit, work, cancel):  # type: ignore[override]
        return self.sides[name]

    def compare(self, args, *, source_tree, cancel):  # type: ignore[override]
        self.calls.append((list(args), source_tree))
        if self.failure is not None:
            raise self.failure
        Path(args[args.index("-o") + 1]).write_text(json.dumps(self.document), encoding="utf-8")
        return cli.CliRun(argv=("prism-kicad", "compare"), exit_code=0, document={}, elapsed_ms=12, peak_rss_bytes=34)

    def fabrication(self, side, work, logs):  # type: ignore[override]
        if self.fabrication_error:
            raise RuntimeError("kicad-cli crashed")
        return {"present": False, "reason": "no board file in this revision"}


class RecordingPublisher:
    def __init__(self) -> None:
        self.partials: list[tuple[dict[str, Any], dict[str, Any]]] = []

    def publish_partial(self, result: dict[str, Any], details: dict[str, Any]) -> None:
        self.partials.append((json.loads(json.dumps(result)), details))


def inputs(include_unchanged: bool = False) -> bundle_path.ComparisonInputs:
    return bundle_path.ComparisonInputs("p1", Path("/repo"), BASE, HEAD, include_unchanged)


def run(stages: FakeStages, tmp_path: Path, **kwargs: Any) -> tuple[bundle_path.Outcome, RecordingPublisher]:
    publisher = RecordingPublisher()
    outcome = bundle_path.run_comparison(
        inputs(**kwargs), publisher, work=tmp_path, benchmark=DesignCompareBenchmark(job_id="j"), stages=stages,
    )
    return outcome, publisher


# ------------------------------------------------------------------ modes


def test_a_bundle_side_passes_its_archive_and_the_requested_key(tmp_path: Path) -> None:
    side = bundle_side("base", BASE, tmp_path / "b.prism")
    assert side.mode == "bundle"
    assert side.compare_args() == ["--base", str(tmp_path / "b.prism"), "--base-revision-key", "1" * 64]


def test_a_source_tree_side_passes_parse_inputs(tmp_path: Path) -> None:
    side = source_side("head", HEAD, tmp_path)
    assert side.mode == "source-tree"
    assert side.compare_args() == [
        "--head-src", str(tmp_path / "src" / "p.kicad_pro"),
        "--head-source-root", str(tmp_path / "src"),
        "--head-config", str(tmp_path / "effective.json"),
        "--head-revision-key", "3" * 64,
        "--head-upgraded", "p.kicad_pcb=20221018",
    ]


def test_two_bundles_compare_without_parse_limits(tmp_path: Path) -> None:
    stages = FakeStages({"base": bundle_side("base", BASE, tmp_path / "a.prism"),
                         "head": bundle_side("head", HEAD, tmp_path / "b.prism")})
    outcome, _ = run(stages, tmp_path, include_unchanged=True)
    (args, source_tree), = stages.calls
    assert args[:8] == [
        "--base", str(tmp_path / "a.prism"), "--base-revision-key", "1" * 64,
        "--head", str(tmp_path / "b.prism"), "--head-revision-key", "1" * 64,
    ]
    assert args[-1] == "--include-unchanged"
    assert source_tree is False
    assert outcome.modes == {"base": "bundle", "head": "bundle"}


def test_a_source_tree_side_compares_with_parse_limits(tmp_path: Path) -> None:
    stages = FakeStages({"base": bundle_side("base", BASE, tmp_path / "a.prism"),
                         "head": source_side("head", HEAD, tmp_path)})
    outcome, _ = run(stages, tmp_path)
    (args, source_tree), = stages.calls
    assert "--head-src" in args and "--include-unchanged" not in args
    assert source_tree is True
    assert outcome.modes == {"base": "bundle", "head": "source-tree"}


# -------------------------------------------------------------- publishing


def test_every_tab_is_published_before_fabrication(tmp_path: Path) -> None:
    stages = FakeStages({"base": bundle_side("base", BASE, tmp_path / "a"), "head": bundle_side("head", HEAD, tmp_path / "b")})
    outcome, publisher = run(stages, tmp_path)
    (partial, details), = publisher.partials
    assert partial["readiness"] == {
        "stage": "background-fabrication",
        "domains": {"schematic": "ready", "bom": "ready", "pcb": "ready", "stackup": "ready", "fabrication": "building"},
    }
    assert "fabrication" not in partial
    assert details["result_version"] == 1 and details["pipeline"] == bundle_path.PIPELINE
    assert details["modes"] == {"base": "bundle", "head": "bundle"}
    assert outcome.result["readiness"]["stage"] == "complete"
    assert outcome.result["readiness"]["domains"]["fabrication"] == "ready"
    assert outcome.result["fabrication"]["warnings"] == ["no board file in this revision"]
    # The typed result is passed through: no backend field enters base/head.
    assert outcome.result["base"] == result_document()["base"]


def test_a_fabrication_failure_marks_only_its_domain_failed(tmp_path: Path) -> None:
    stages = FakeStages({"base": bundle_side("base", BASE, tmp_path / "a"), "head": bundle_side("head", HEAD, tmp_path / "b")},
                        fabrication_error=True)
    outcome, publisher = run(stages, tmp_path)
    assert len(publisher.partials) == 1
    assert outcome.result["readiness"]["domains"]["fabrication"] == "failed"
    assert outcome.result["readiness"]["domains"]["pcb"] == "ready"
    assert "fabrication" not in outcome.result


@pytest.mark.parametrize(
    ("exit_code", "retryable", "expected"),
    [(1, True, RetryableJobError), (5, True, RetryableJobError), (3, False, PermanentJobError), (7, False, PermanentJobError)],
)
def test_compare_failures_fail_the_job_without_publishing(tmp_path: Path, exit_code: int, retryable: bool, expected: type) -> None:
    failure = cli.CliFailure("boom", exit_code=exit_code, retryable=retryable, error={"code": "generator-mismatch"})
    stages = FakeStages({"base": bundle_side("base", BASE, tmp_path / "a"), "head": bundle_side("head", HEAD, tmp_path / "b")},
                        failure=failure)
    with pytest.raises(expected) as raised:
        run(stages, tmp_path)
    assert raised.value.code == "generator-mismatch"  # type: ignore[attr-defined]


def test_a_result_of_another_schema_is_refused(tmp_path: Path) -> None:
    stages = FakeStages({"base": bundle_side("base", BASE, tmp_path / "a"), "head": bundle_side("head", HEAD, tmp_path / "b")},
                        document={"schema": "prism.semantic_comparison_v3"})
    with pytest.raises(PermanentJobError):
        run(stages, tmp_path)


def test_the_v2_manifest_has_one_sidecar_per_tab(monkeypatch: pytest.MonkeyPatch) -> None:
    prepared: list[dict[str, Any]] = []

    def prepare_json(context, payload, **kwargs):  # type: ignore[no-untyped-def]
        prepared.append({"payload": payload, **kwargs})
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        return SimpleNamespace(digest=digest, size_bytes=1, media_type="application/json")

    monkeypatch.setattr(bundle_path.job_artifacts, "prepare_json", prepare_json)
    publisher = bundle_path.Publisher(SimpleNamespace(), "key", "g" * 64)
    result = {**result_document(), "readiness": bundle_path._readiness("ready"), "fabrication": {"layers": []}}
    primary, sidecars = publisher.prepare_complete(result, {"base": "bundle", "head": "source-tree"}, base=BASE, head=HEAD)
    manifest = prepared[-1]["payload"]
    assert manifest["schema"] == "prism.design_compare_bundle_v2"
    assert set(manifest["sidecars"]) == {"core", *bundle_path.TABS, "fabrication"}
    assert manifest["base"] == BASE and manifest["head"] == HEAD
    assert manifest["revisions"]["base"] == result["base"]
    assert manifest["modes"] == {"base": "bundle", "head": "source-tree"}
    assert manifest["counts"] == result["counts"]
    assert len(sidecars) == len(manifest["sidecars"])
    assert all(entry["generator_version"] == "g" * 64 for entry in prepared)
    assert prepared[-1]["artifact_key"] == "key"


# ---------------------------------------------------------- enqueue, settle


def _enqueue_capture(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    captured: list[dict[str, Any]] = []
    monkeypatch.setattr(design_compare_service.workspace, "get_project_by_id",
                        lambda project_id: {"id": project_id, "project_file_rel": "p.kicad_pro"})
    monkeypatch.setattr(design_compare_service.JobSubject, "of_project", staticmethod(lambda row, project_id: None))
    monkeypatch.setattr(design_compare_service, "DESIGN_COMPARE",
                        SimpleNamespace(enqueue=lambda payload, **kwargs: captured.append(payload) or {"job_id": "j"}))
    return captured


def test_the_compare_pipeline_is_queued(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _enqueue_capture(monkeypatch)
    monkeypatch.setattr(design_compare_service.design_bundle_cli, "generator", lambda: SimpleNamespace(digest="d" * 64))
    monkeypatch.setattr(design_compare_service.design_bundle_cli, "binary_digest", lambda: "b" * 64)
    design_compare_service.start_design_compare_job("p1", BASE, HEAD, requested_by="me@example.com")
    monkeypatch.setattr(design_compare_service.design_bundle_cli, "generator", lambda: SimpleNamespace(digest="e" * 64))
    design_compare_service.start_design_compare_job("p1", BASE, HEAD)
    first, second = captured
    assert first["pipeline"] == bundle_path.PIPELINE and first["requested_by"] == "me@example.com"
    assert first["artifact_key"] != second["artifact_key"]  # a new generator is a new result


def test_a_new_compare_binary_is_a_new_result_with_the_same_generator(monkeypatch: pytest.MonkeyPatch) -> None:
    # A compare fix that leaves every bundle member alone keeps the generator id;
    # the comparisons cached before it must not be served after it.
    captured = _enqueue_capture(monkeypatch)
    monkeypatch.setattr(design_compare_service.design_bundle_cli, "generator", lambda: SimpleNamespace(digest="d" * 64))
    for engine in ("b" * 64, "c" * 64, "c" * 64):
        monkeypatch.setattr(design_compare_service.design_bundle_cli, "binary_digest", lambda engine=engine: engine)
        design_compare_service.start_design_compare_job("p1", BASE, HEAD)
    first, second, third = (payload["artifact_key"] for payload in captured)
    assert first != second and second == third


def test_an_ended_partial_bundle_result_settles_with_fabrication_failed(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    partial = {**result_document(), "readiness": bundle_path._readiness("building")}
    path = tmp_path / "result.json"
    path.write_text(json.dumps(partial), encoding="utf-8")
    seen: dict[str, Any] = {}

    def prepare_ended_json(document, **kwargs):  # type: ignore[no-untyped-def]
        seen["document"] = document
        return SimpleNamespace()

    monkeypatch.setattr(design_compare_service.job_artifacts, "prepare_ended_json", prepare_ended_json)
    monkeypatch.setattr(design_compare_service.design_bundle_cli, "generator", lambda: SimpleNamespace(digest="g" * 64))
    monkeypatch.setattr(design_compare_service.v3_jobs, "publish_ended_result", lambda *args, **kwargs: True)
    job = {"job_id": "j", "status": "failed", "result_metadata": {"result_version": 1}, "result_path": str(path),
           "result_digest": "x", "payload": {"artifact_key": "k"}}
    assert design_compare_service.settle_comparison_end(job) is True
    domains = seen["document"]["readiness"]["domains"]
    assert domains["fabrication"] == "failed" and domains["schematic"] == "ready"


# ----------------------------------------------------------- fabrication


def test_one_bundle_key_is_plotted_once(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    plotted: list[Path] = []

    def export_gerbers(board: Path, staging: Path) -> tuple[bool, str]:
        plotted.append(board)
        staging.mkdir(parents=True, exist_ok=True)
        (staging / "board-F_Cu.gbr").write_text("G04*", encoding="utf-8")
        return True, ""

    monkeypatch.setattr(fabrication_compare_service, "export_gerbers", export_gerbers)
    monkeypatch.setattr(fabrication_compare_service, "export_drill", lambda board, staging: (True, ""))
    monkeypatch.setattr(bundle_path, "fabrication_root", lambda: tmp_path / "fab")
    side = source_side("base", BASE, tmp_path)
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "p.kicad_pcb").write_text("(kicad_pcb)", encoding="utf-8")
    stages = bundle_path.BundlePathStages()
    first = stages.fabrication(side, tmp_path, [])
    second = stages.fabrication(side, tmp_path, [])
    assert first["present"] and second == {"present": True, "dir": first["dir"]}
    assert len(plotted) == 1
    assert Path(first["dir"]).parent.name == "4" * 64
    assert not list((tmp_path / "fab" / ("4" * 64)).glob("fabrication.staging.*"))


def test_a_side_without_a_board_has_no_fabrication(tmp_path: Path) -> None:
    side = source_side("base", BASE, tmp_path)
    side.config.pop("board")
    assert bundle_path.BundlePathStages().fabrication(side, tmp_path, []) == {
        "present": False, "reason": "no board file in this revision",
    }
