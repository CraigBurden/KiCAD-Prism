"""In-memory stand-ins for the Release Studio publish seams (records and forges)."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.services.forge_publish_service import ForgePublishError, ForgeTarget

GITHUB_TARGET = ForgeTarget(
    kind="github",
    name="GitHub",
    host="github.com",
    owner_repo="org/board",
    api_root="https://api.github.com",
    token_configured=True,
    token_hint="",
)


class FakeRecords:
    """The release rows ``ReleasePublisher`` reads and writes, kept in dicts."""

    def __init__(
        self,
        *,
        builds: Sequence[Mapping[str, Any]] = (),
        candidates: Sequence[Mapping[str, Any]] = (),
        artifacts: Mapping[str, Path] | None = None,
        evidence: Sequence[Mapping[str, Any]] = (),
        members: Sequence[Mapping[str, Any]] = (),
        models: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    ) -> None:
        self.builds = {str(row["id"]): dict(row) for row in builds}
        self.candidates = {str(row["id"]): dict(row) for row in candidates}
        self.artifacts = dict(artifacts or {})
        self.evidence = [dict(row) for row in evidence]
        self.members = [dict(row) for row in members]
        self.models = {key: [dict(row) for row in rows] for key, rows in (models or {}).items()}
        self.decisions: list[dict[str, Any]] = []
        self.published: dict[str, dict[str, Any]] = {}
        self.record_failure: Exception | None = None

    def get_build(self, build_id: str) -> dict[str, Any] | None:
        row = self.builds.get(build_id)
        return dict(row) if row else None

    def get_candidate(self, candidate_id: str) -> dict[str, Any] | None:
        row = self.candidates.get(candidate_id)
        return dict(row) if row else None

    def model_inputs(self, candidate_id: str) -> list[dict[str, Any]]:
        return [dict(row) for row in self.models.get(candidate_id, ())]

    def get_artifact(self, artifact_id: str) -> dict[str, Any] | None:
        path = self.artifacts.get(artifact_id)
        if path is None:
            return None
        return {
            "object_path": str(path),
            "digest": hashlib.sha256(Path(path).read_bytes()).hexdigest(),
        }

    def build_members(self, build_id: str) -> list[dict[str, Any]]:
        return list(self.members)

    def build_evidence(self, build_id: str) -> list[dict[str, Any]]:
        return list(self.evidence)

    def build_fingerprints(self, build_id: str) -> dict[str, Any]:
        return {}

    def latest_review_decision(self, build_id: str, slot: str) -> dict[str, Any] | None:
        rows = [row for row in self.decisions if row["build_id"] == build_id and row["slot"] == slot]
        return dict(rows[-1]) if rows else None

    def get_publish_record(self, build_id: str) -> dict[str, Any] | None:
        row = self.published.get(build_id)
        return dict(row) if row else None

    def record_review_decision(self, **fields: Any) -> dict[str, Any]:
        self.decisions.append(dict(fields))
        return dict(fields)

    def record_publish(self, **fields: Any) -> dict[str, Any]:
        if self.record_failure is not None:
            failure, self.record_failure = self.record_failure, None
            raise failure
        row = {"id": f"pub-{len(self.published) + 1}", **fields}
        self.published[str(fields["build_id"])] = row
        return dict(row)

    def approve(self, build_id: str, digest: str) -> None:
        """Designer and QA approvals for the dossier digest."""

        for slot, actor in (("designer", "designer@example.com"), ("qa", "qa@example.com")):
            self.decisions.append(
                {
                    "build_id": build_id,
                    "slot": slot,
                    "decision": "approved",
                    "dossier_digest": digest,
                    "actor": actor,
                }
            )


class FakeForge:
    """One repository's Releases: a Release per tag, the tags it ever made."""

    def __init__(self, target: ForgeTarget = GITHUB_TARGET) -> None:
        self.target = target
        self.releases_by_tag: dict[str, dict[str, Any]] = {}
        self.tags: set[str] = set()
        self.calls: list[str] = []

    def __call__(self, repo_url: str | None) -> "FakeForge":
        """Stand-in for ``forge_publish.forge_for``."""

        return self

    def releases(self, *, limit: int = 10) -> list[dict[str, str]]:
        self.calls.append("releases")
        return [
            {"tag": tag, "url": release["url"]}
            for tag, release in list(self.releases_by_tag.items())[:limit]
        ]

    def tag_exists(self, tag: str) -> bool:
        self.calls.append("tag_exists")
        return tag in self.tags

    def create_release(
        self,
        *,
        commit_sha: str,
        tag: str,
        notes: str,
        assets: Sequence[tuple[str, bytes]],
        new_tag: bool = False,
    ) -> dict[str, str]:
        self.calls.append("create_release")
        if tag in self.releases_by_tag:
            raise ForgePublishError(
                "GitHub rejected the release (422): Validation Failed: already_exists",
                status_code=409,
            )
        url = f"https://github.com/{self.target.owner_repo}/releases/tag/{tag}"
        self.tags.add(tag)
        self.releases_by_tag[tag] = {
            "commit_sha": commit_sha,
            "notes": notes,
            "assets": [name for name, _payload in assets],
            "url": url,
        }
        return {"url": url, "tag": tag, "forge": self.target.kind}

    def remove_release(self, tag: str, *, with_tag: bool = False) -> None:
        self.calls.append("remove_release")
        self.releases_by_tag.pop(tag, None)
        if with_tag:
            self.tags.discard(tag)

