"""Snapshots (§9.1), publishing (P2 §7), the ICD and report (§9.2) and snapshot diffs."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Mapping, Optional

from app.services.systems import (
    hierarchy, icd, redaction, visibility, manifest as manifest_io, renames as renames_module, report as report_io,
)
from app.services.systems.loaded import LoadedSystem
from app.services.systems.manifest_schema import digests as manifest_digests
from app.services.systems.service_base import Caller, Result, _iso, logger
from app.services.systems.service_rendering import rename_doc
from app.services.systems.store import Conflict, Forbidden, Invalid, NotFound, StaleVersion, SystemStore, new_id


class SnapshotsMixin:
    # ------------------------------------------------------------------
    # Snapshots

    @staticmethod
    def _snapshot_meta(row: Mapping[str, Any]) -> dict:
        return {"id": row["id"], "name": row["name"], "note": row["note"], "createdBy": row["created_by"],
                "createdAt": _iso(row["created_at"]), "digest": row["digest"],
                "connectivityDigest": row.get("connectivity_digest"),
                "manifestSchema": row.get("manifest_schema"),
                "openReviewCount": int(row["open_review_count"]), "rendererVersion": row["renderer_version"],
                "findingCounts": {"error": row.get("error_count") or 0, "warning": row.get("warning_count") or 0},
                "exportCount": row.get("export_count") or 0,
                "git": _git_status(row.get("git"))}

    def create_snapshot(self, caller: Caller, system_id: str, version: int, name: str, note: str) -> Result:
        """Freeze the unredacted document and manifest at ``version`` (§9.1, P2 §9.4).

        The version is not bumped. ``digest`` is the manifest's full digest;
        the rendered ``document`` stays beside it as the evidence the ICD and
        diffs read.
        """

        # SB2-94: build from one consistent read of ``version`` without the system lock, so editors
        # are not queued behind the build; then lock only to check nothing changed and store it.
        with self._tx(consistent=True) as store:
            loaded = self._load(store, system_id, caller)
            if int(loaded.version) != int(version):
                raise StaleVersion(int(loaded.version), system_id)
            built = self._build(loaded)
            # The read keys (SB2-98) describe the live system, not what a snapshot freezes.
            document = json.loads(json.dumps({k: v for k, v in built.items() if k not in ("sceneKey", "netsKey")},
                                             default=_iso))
            snapshot_id = new_id("ssn_")
            manifest = manifest_io.build(
                store, system_id, created_by=caller.actor,
                created_at=datetime.now(timezone.utc).replace(microsecond=0),
                snapshot={"id": snapshot_id, "name": name.strip(), "note": note},
                catalog_refs=self._catalog_refs(store, system_id),
            )
            digests = manifest_digests(manifest)
            git = self._snapshot_git(store, system_id, caller)
        with self._tx() as store:
            with store.mutation(system_id, expected_version=version, actor=caller.actor, bump=False) as change:
                row = store.create_snapshot(
                    change, name=name, note=note, document=document, digest=digests["full"],
                    open_review_count=document["openReviewCount"], renderer_version=icd.RENDERER_VERSION,
                    snapshot_id=snapshot_id, manifest=manifest.model_dump(mode="json", by_alias=True),
                    connectivity_digest=digests["connectivity"], git=git,
                )
        if git is not None:
            self._git_quietly(self._git_enqueue_commit, system_id, row["id"], requested_by=caller.email)
        return Result(self._snapshot_meta(row), system_id, change.version)

    def list_snapshots(self, caller: Caller, system_id: str) -> list[dict]:
        with self._tx() as store:
            system = self._system(store, system_id, caller)
            rows = store.list_snapshots(system_id)
        publications = self._publications(system.get("catalogComponentId"))
        return [{**self._snapshot_meta(row), "publication": publications.get(row["id"])} for row in rows]

    def _snapshot(self, store: SystemStore, system_id: str, snapshot_id: str, caller: Caller) -> tuple[dict, dict]:
        """A snapshot's metadata and its document, redacted for ``caller``."""

        row = store.get_snapshot(system_id, snapshot_id)
        restricted = self._restricted_in(store, row["document"], caller)
        return self._snapshot_meta(row), redaction.redact_document(row["document"], restricted)

    def snapshot_manifest(self, caller: Caller, system_id: str, snapshot_id: str) -> dict:
        """``GET …/snapshots/{sid}/manifest`` (P2 §11).

        A manifest is an exchange artifact, so it is served whole or not at
        all: a reader who cannot see every board in it gets 403.
        """

        with self._tx() as store:
            self._system(store, system_id, caller)
            row = store.get_snapshot(system_id, snapshot_id)
            if row["manifest"] is None:
                raise NotFound("This snapshot predates manifests")
            if self._restricted_in(store, row["document"], caller):
                raise Forbidden("the manifest contains boards you cannot see")
            return row["manifest"]

    def get_snapshot(self, caller: Caller, system_id: str, snapshot_id: str) -> dict:
        with self._tx() as store:
            self._system(store, system_id, caller)
            meta, document = self._snapshot(store, system_id, snapshot_id, caller)
        return {**meta, "document": document}

    # ------------------------------------------------------------------
    # Publishing (P2 §7)

    def _publications(self, component_id: Optional[str]) -> dict[str, dict]:
        """snapshotId -> the catalog revision it was published as. Best effort: never breaks a read."""
        if not component_id:
            return {}
        try:
            revisions = self._catalog().system_revisions(component_id)
        except Exception:  # the catalog is a separate service; a listing must not fail on it
            logger.exception("Could not read catalog revisions of %s", component_id)
            return {}
        return {
            str(r["sourceRef"].get("snapshotId")): {"componentId": component_id, "revisionId": r["revisionId"],
                                                   "version": r["version"], "releaseStatus": r["releaseStatus"],
                                                   "commit": (r["sourceRef"].get("git") or {}).get("commit")}
            for r in revisions if r["sourceRef"].get("snapshotId")
        }

    def _hierarchy_facts(self, system_id: str, manifest: Mapping[str, Any]) -> dict:
        """``hierarchyValid`` and ``children`` for an assembly's release gates, from its snapshot."""
        children = [{"componentId": i["catalog"]["componentId"], "revisionId": i["catalog"]["revisionId"]}
                    for i in manifest["instances"] if i["kind"] != "board"]
        with self._tx() as store:
            try:
                hierarchy.resolve(system_id, manifest["instances"], self._child_loader(store))
                valid = True
            except hierarchy.HierarchyError:
                valid = False
        return {"hierarchyValid": valid, "children": children}

    def publish_snapshot(
        self, caller: Caller, system_id: str, snapshot_id: str, *, ipn: Optional[str], name: Optional[str],
        description: Optional[str], manufacturer: Optional[str],
    ) -> tuple[bool, dict]:
        """Publish a snapshot as a catalog ``assembly`` revision. Returns ``(created, publication)``.

        Idempotent per snapshot. The catalog revision is written before the
        system binding, both under the system lock; a crash in between is
        repaired by the next publish, which finds the orphan by system ID.
        """

        from app.core.roles import CATALOG_WRITE_ROLES

        if caller.role not in CATALOG_WRITE_ROLES:
            raise Forbidden("publishing needs catalog write access")
        with self._tx() as store:
            self._system(store, system_id, caller)
            row = store.get_snapshot(system_id, snapshot_id)
            if row["manifest"] is None:
                raise Invalid("this snapshot predates manifests; take a new snapshot to publish")
            if self._restricted_in(store, row["document"], caller):
                raise Forbidden("the snapshot contains boards you cannot see")
            git = self._publication_git(store, system_id, row.get("git"))
        interface = self.export_interface(caller, system_id, snapshot_id)
        if not interface["exports"]:
            raise Invalid("publishing needs at least one export")
        unresolved = [e["name"] for e in interface["exports"] if not e["resolved"]]
        if unresolved:
            raise Invalid(f"these exports do not resolve at the snapshot: {', '.join(unresolved)}")
        source_ref = {
            "kind": "system_snapshot", "systemId": system_id, "snapshotId": snapshot_id,
            "snapshotName": row["name"], "fullDigest": row["digest"],
            "connectivityDigest": row["connectivity_digest"], "openReviewCount": int(row["open_review_count"]),
            **self._hierarchy_facts(system_id, row["manifest"]),
            **({"git": git} if git else {}),
        }
        catalog = self._catalog()
        with self._tx() as store:
            system = self._system(store, system_id, caller)
            with store.mutation(system_id, expected_version=None, actor=caller.actor, bump=False) as change:
                bound = store.get_system(system_id).get("catalog_component_id") or catalog.find_system_component(system_id)
                created = False
                if bound:
                    existing = next((r for r in catalog.system_revisions(bound)
                                     if r["sourceRef"].get("snapshotId") == snapshot_id), None)
                    if existing is None:
                        out = catalog.add_system_revision(bound, interface=interface, source_ref=source_ref,
                                                          actor=caller.email, change_summary=f"Publish {row['name']}")
                        revision_id, created = out["revisionId"], True
                    else:
                        revision_id = existing["revisionId"]
                    component_id = bound
                else:
                    if not (ipn or "").strip():
                        raise Invalid("the first publish needs an IPN")
                    try:
                        out = catalog.create_system_item(
                            kind="assembly", ipn=ipn or "", name=(name or system["name"]).strip(),
                            description=(description or system["description"] or system["name"]).strip(),
                            manufacturer=(manufacturer or "In-house").strip(), datasheet_url=f"/systems/{system_id}",
                            interface=interface, source_ref=source_ref, actor=caller.email,
                            change_summary=f"Publish {row['name']}",
                        )
                    except ValueError as error:
                        raise Conflict(str(error)) from None
                    component_id, revision_id, created = out["componentId"], out["revisionId"], True
                store.bind_catalog_component(change, component_id)
                if created:
                    change.audit("snapshot_published", {"snapshotId": snapshot_id, "name": row["name"],
                                                        "componentId": component_id, "revisionId": revision_id})
        publication = self._publications(component_id).get(snapshot_id) or {
            "componentId": component_id, "revisionId": revision_id, "version": None, "releaseStatus": None,
            "commit": (git or {}).get("commit")}
        return created, publication

    # ------------------------------------------------------------------
    # ICD, report and diff

    def _icd_source(
        self, caller: Caller, system_id: str, snapshot_id: Optional[str]
    ) -> tuple[dict, str, Optional[int], dict]:
        """``(redacted document, source label, live version or None, canvas positions)`` for an ICD."""

        with self._tx() as store:
            system = self._system(store, system_id, caller)
            if snapshot_id is not None:
                meta, document = self._snapshot(store, system_id, snapshot_id, caller)
                # The canvas as frozen in the snapshot's manifest; older snapshots have none (default layout).
                manifest = store.get_snapshot(system_id, snapshot_id).get("manifest") or {}
                return document, meta["name"], None, (manifest.get("layout") or {}).get("positions") or {}
            loaded = LoadedSystem(store, system, self)
            document = self._for_reader(loaded, caller, self._build(loaded))
            positions = store.get_layout(system_id)
        return document, "live", system["version"], positions

    def icd(
        self, caller: Caller, system_id: str, fmt: str, snapshot_id: Optional[str] = None, depth: str = "own",
    ) -> tuple[str, str, Optional[int]]:
        """``(content, system name, live version or None)``; ``fmt`` is ``csv`` or ``html`` (§9.4, §9.5).

        ``depth="all"`` (P2 §10) adds every subsystem level's own links, from its pinned snapshot.
        """

        document, source, version, positions = self._icd_source(caller, system_id, snapshot_id)
        levels = self._icd_levels(caller, system_id, snapshot_id) if depth == "all" else None
        if fmt == "csv":
            content = icd.render_csv(document, levels)
        else:
            generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
            content = icd.render_html(document, source=source, generated_at=generated, levels=levels, positions=positions)
        return content, document["system"]["name"], version

    def report(self, caller: Caller, system_id: str, fmt: str) -> tuple[Any, str, int]:
        """SB2-107 (P2 §8.6): ``(content, system name, version)``; the live open reviews and
        findings as ``xlsx`` bytes or ``csv`` text, redacted for the reader like the trays."""

        with self._tx(consistent=True) as store:
            loaded = self._load(store, system_id, caller)
            system = loaded.system
            built = self._build(loaded)
            restricted = loaded.restricted(caller)
            reviews = [self._review_doc(store, review, review["instance_id"] in restricted, restricted)
                       for review in store.list_reviews(system_id, status="open")]
            links = store.drift_links(system_id)
            renames = [rename_doc(r, len(renames_module.covered(links, r["instance_id"], r["net"])))
                       for r in store.list_renames(system_id, ("open", "applied"))]
            document = self._for_reader(loaded, caller, {**built, "renames": renames})
        generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        parts = report_io.sections(document, reviews, version=system["version"], generated_at=generated,
                                   renames=document["renames"])
        content = report_io.render_xlsx(parts) if fmt == "xlsx" else report_io.render_csv(parts)
        return content, document["system"]["name"], system["version"]

    def _icd_levels(self, caller: Caller, system_id: str, snapshot_id: Optional[str]) -> list[dict]:
        """Each visible subsystem level, redacted for the reader (§5.4), in tree order."""
        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            if snapshot_id is None:
                tree = loaded.tree
            else:
                manifest = store.get_snapshot_manifest(system_id, snapshot_id)
                if not manifest:
                    return []
                try:
                    tree = hierarchy.resolve(system_id, manifest["instances"], self._child_loader(store))
                except hierarchy.HierarchyError as error:
                    raise Invalid(str(error)) from None
            projects = {o.project_id for o in tree.boards if o.project_id}
            access = visibility.project_access(store.conn, projects, caller.role)
            hidden_systems = visibility.hidden_systems(store.conn, caller.role,
                                                       {o.child_system_id for o in tree.occurrences if o.child_system_id})
        restricted_paths = {o.path for o in tree.boards if not access.get(o.project_id, {}).get("visible", False)}
        levels, hidden_prefixes = [], []
        for occurrence in sorted(tree.occurrences, key=lambda o: (o.depth, o.path)):
            if occurrence.child is None or any(occurrence.path.startswith(p + "/") for p in hidden_prefixes):
                continue
            if occurrence.child_system_id in hidden_systems:
                hidden_prefixes.append(occurrence.path)
                continue
            child = occurrence.child
            levels.append({
                "displayPath": occurrence.display_path, "snapshotName": child.name,
                "links": child.links, "labels": {i["id"]: i["label"] for i in child.instances},
                "restricted": {i["id"] for i in child.instances if f"{occurrence.path}/{i['id']}" in restricted_paths},
            })
        return levels

    def diff_snapshot(self, caller: Caller, system_id: str, snapshot_id: str, against: str) -> dict:
        """``GET …/snapshots/{sid}/diff?against=live|<sid>``: what changed since the snapshot.

        Both sides are redacted with the union of their restricted boards, so a
        comparison cannot reveal a restricted side by difference.
        """

        with self._tx() as store:
            loaded = self._load(store, system_id, caller)
            before = store.get_snapshot(system_id, snapshot_id)["document"]
            if against == "live":
                after = json.loads(json.dumps(self._build(loaded), default=_iso))
                restricted = loaded.restricted(caller)
            else:
                try:
                    after = store.get_snapshot(system_id, against)["document"]
                except NotFound:
                    raise NotFound("Snapshot not found") from None
                restricted = self._restricted_in(store, after, caller)
            restricted |= self._restricted_in(store, before, caller)
        return {"snapshotId": snapshot_id, "against": against,
                **icd.diff(redaction.redact_document(before, restricted),
                           redaction.redact_document(after, restricted))}


def _git_status(git: Optional[Mapping[str, Any]]) -> Optional[dict]:
    """A snapshot's commit status (§21.2), without the author it was queued with."""
    return None if git is None else {k: v for k, v in git.items() if k != "author"}
