"""Modules, assemblies, "mates with" and model alignment in the catalog (CONTRACTS_P2 §3, §18).

A facade beside the compatibility facade (``component_catalog_domain``), which
exposes it as ``catalog_service.system_items``. It owns its transactions, like
that facade, over the shared collaborators: the component writer, the revision
kernel and the revision finalizer. ``connect`` opens a catalog connection and
``initialize`` makes sure the schema exists.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any, Callable, ContextManager

from app.services.catalog import (
    assembly_symbol, mates as catalog_mates, models as catalog_models, module_connectors, system_items,
)
from app.services.catalog.asset_files import CatalogAssetFiles
from app.services.catalog.asset_links import CatalogAssetLinks
from app.services.catalog.asset_registry import CatalogAssetRegistry
from app.services.catalog.component_writer import CatalogComponentWriter
from app.services.catalog.normalization import utc_now_iso
from app.services.catalog.revision_finalization import CatalogRevisionFinalizer
from app.services.catalog.revision_kernel import CatalogRevisionKernel
from app.services.catalog.runtime import CatalogRuntime
from app.services.catalog.workflow_policy import normalize_workflow_stage

logger = logging.getLogger("app.services.component_catalog_domain")


class CatalogSystemItemsFacade:
    def __init__(
        self, *, connect: Callable[[], ContextManager[Any]], initialize: Callable[[], None], runtime: CatalogRuntime,
        component_writer: CatalogComponentWriter, revision_kernel: CatalogRevisionKernel,
        revision_finalizer: CatalogRevisionFinalizer,
    ) -> None:
        self._connect = connect
        self._initialize = initialize
        self._runtime = runtime
        self._component_writer = component_writer
        self._revision_kernel = revision_kernel
        self._revision_finalizer = revision_finalizer

    def create_system_item(
        self, *, kind: str, ipn: str, name: str, description: str, manufacturer: str,
        datasheet_url: str, interface: dict[str, Any], source_ref: dict[str, Any],
        actor: str = "", change_summary: str = "Publish",
    ) -> dict[str, Any]:
        """Create a ``module`` or ``assembly`` component with its first revision (CONTRACTS_P2 §3)."""

        self._initialize()
        metadata = system_items.item_metadata(
            kind=kind, ipn=ipn, name=name, description=description, manufacturer=manufacturer,
            datasheet_url=datasheet_url,
        )
        with self._connect() as conn:
            component_id, revision_id = self._component_writer.upsert_metadata_row(
                conn, self._runtime, component_id=str(uuid.uuid4()), metadata=metadata,
                now=utc_now_iso(), existing_component_id=None, actor=actor, change_summary=change_summary,
                finalize_revision=False, change_kind="publish",
            )
            conn.execute("UPDATE components SET kind = %s WHERE id = %s", (kind, component_id))
            system_items.set_payload(conn, revision_id, interface=interface, source_ref=source_ref)
            if kind == system_items.KIND_ASSEMBLY:
                self._attach_assembly_symbol(conn, revision_id, ipn, interface, description)
            self._revision_finalizer.finalize_revision(
                conn, self._runtime, component_id=component_id, revision_id=revision_id,
                event_type="component.created", actor=actor,
                details={"change_kind": "publish", "change_summary": change_summary, "kind": kind},
            )
            conn.commit()
        return {"componentId": component_id, "revisionId": revision_id}

    def _attach_assembly_symbol(self, conn: Any, revision_id: str, identity: str, interface: dict[str, Any],
                                description: str) -> None:
        """D-P2-41: the published revision carries its generated multi-unit symbol (one unit per export),
        replacing the previous publish's, before the revision is sealed."""
        name = assembly_symbol.symbol_name(identity)
        text = assembly_symbol.symbol_library(name, interface, description=description)
        path = CatalogAssetFiles.write_canonical_file(
            self._runtime, CatalogAssetFiles.symbol_destination(self._runtime, assembly_symbol.LIBRARY, name),
            text.encode())
        asset = CatalogAssetRegistry.register_asset(self._runtime, conn, asset_type="symbol", canonical_path=path,
                                                    target_library=assembly_symbol.LIBRARY, target_name=name)
        CatalogAssetLinks.link_asset_to_revision(conn, revision_id, asset, required=False)
        CatalogAssetLinks.replace_others(conn, revision_id, asset)

    def system_revisions(self, component_id: str) -> list[dict[str, Any]]:
        """Every revision of a module/assembly with the snapshot it came from, oldest first."""

        self._initialize()
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT r.id, r.version, r.release_status, r.source_ref_json, c.kind
                FROM component_revisions r JOIN components c ON c.id = r.component_id
                WHERE r.component_id = %s ORDER BY r.version
                """,
                (component_id,),
            ).fetchall()
        return [{
            "revisionId": str(row["id"]), "version": int(row["version"]), "kind": str(row["kind"]),
            "releaseStatus": normalize_workflow_stage(str(row["release_status"])),
            "sourceRef": system_items.revision_payload({"source_ref_json": row["source_ref_json"]})["sourceRef"],
        } for row in rows]

    def system_revision(self, revision_id: str) -> dict[str, Any] | None:
        """One module/assembly revision with its component facts, or None."""

        self._initialize()
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT r.id, r.component_id, r.version, r.release_status, r.name, r.value,
                       r.interface_json, r.source_ref_json, c.kind, c.is_active, c.released_revision_id,
                       rel.version AS released_version, newest.version AS newest_version,
                       newest.release_status AS newest_status
                FROM component_revisions r JOIN components c ON c.id = r.component_id
                LEFT JOIN component_revisions rel ON rel.id = c.released_revision_id
                LEFT JOIN LATERAL (
                    SELECT n.version, n.release_status FROM component_revisions n
                    WHERE n.component_id = r.component_id ORDER BY n.version DESC LIMIT 1
                ) newest ON TRUE
                WHERE r.id = %s
                """,
                (revision_id,),
            ).fetchone()
        if row is None:
            return None
        payload = system_items.revision_payload(row)
        return {
            "revisionId": str(row["id"]), "componentId": str(row["component_id"]), "kind": str(row["kind"]),
            "version": int(row["version"]), "name": str(row["name"]), "identity": str(row["value"]),
            "releaseStatus": normalize_workflow_stage(str(row["release_status"])),
            "active": bool(row["is_active"]), "latestReleasedRevisionId": str(row["released_revision_id"] or "") or None,
            # SB2-122: where this revision sits in the release chain.
            "latestReleasedVersion": int(row["released_version"]) if row["released_version"] is not None else None,
            "newestVersion": int(row["newest_version"]),
            "newestReleaseStatus": normalize_workflow_stage(str(row["newest_status"])),
            "interface": payload["interface"], "sourceRef": payload["sourceRef"],
        }

    # "Mates with" (CONTRACTS_P2 §18) -------------------------------------------------

    def list_mates_with(self, component_id: str) -> list[dict[str, Any]]:
        self._initialize()
        with self._connect() as conn:
            catalog_mates.require_part(conn, component_id)
            return catalog_mates.list_mates(conn, component_id)

    def set_mate(self, component_id: str, other_id: str, *, mates: bool, actor: str = "") -> list[dict[str, Any]]:
        """Add (``mates``) or remove the pair, audited on both components' histories."""
        self._initialize()
        with self._connect() as conn:
            for part in (component_id, other_id):
                catalog_mates.require_part(conn, part)
            changed = (catalog_mates.add(conn, component_id, other_id, actor=actor, now=utc_now_iso()) if mates
                       else catalog_mates.remove(conn, component_id, other_id))
            if changed:
                for part, partner in ((component_id, other_id), (other_id, component_id)):
                    _component, revision = self._revision_kernel.active_revision_row(conn, part)
                    self._revision_kernel.append_audit_event(
                        conn, component_id=part, revision_id=str((revision or {}).get("id") or ""),
                        event_type="component.mates_with_added" if mates else "component.mates_with_removed",
                        actor=actor, details={"partner": partner})
            conn.commit()
            return catalog_mates.list_mates(conn, component_id)

    def parts_by_mpn(self, mpns: list[str]) -> dict[str, dict[str, Any]]:
        self._initialize()
        with self._connect() as conn:
            return catalog_mates.parts_by_mpn(conn, mpns)

    def part_for_block(self, component_id: str) -> dict[str, Any]:
        """A part a harness end's mating block can take: its summary, current revision and pins (§17.2)."""
        self._initialize()
        with self._connect() as conn:
            row = catalog_mates.require_part(conn, component_id)
            revision = conn.execute("SELECT current_revision_id FROM components WHERE id = %s",
                                    (component_id,)).fetchone()["current_revision_id"]
            return {**catalog_mates.summary(row), "revisionId": str(revision),
                    "pins": catalog_mates.part_pins(conn, component_id)}

    def mate_pairs(self, component_ids: list[str]) -> set[tuple[str, str]]:
        self._initialize()
        with self._connect() as conn:
            return catalog_mates.pairs_among(conn, component_ids)

    # Connector placement on modules (CONTRACTS_P2 §3.6) ----------------------------

    def module_connectors(self, component_id: str, revision_id: str | None = None) -> dict[str, Any]:
        """The connectors of the module at ``revision_id`` (a pinned revision; default: the current one)."""
        self._initialize()
        with self._connect() as conn:
            return module_connectors.list_connectors(conn, component_id, revision_id)

    def connector_geometry(self, part_id: str) -> dict[str, Any]:
        """A part as a module connector would use it: footprint geometry at the origin and its model."""
        self._initialize()
        with self._connect() as conn:
            catalog_mates.require_part(conn, part_id)
            return {"geometry": module_connectors.part_geometry(conn, part_id),
                    "model": module_connectors.part_model(conn, part_id)}

    def set_module_connector(self, component_id: str, unit_key: str, part_id: str, placement: dict[str, Any], *,
                             actor: str = "", update_part_revision: bool = False) -> dict[str, Any]:
        """Place (or move) the connector part of one unit, audited on the module's history. Moving keeps the
        part revision the placement recorded unless ``update_part_revision``."""
        self._initialize()
        with self._connect() as conn:
            result = module_connectors.set_connector(conn, component_id, unit_key, part_id, placement, actor=actor,
                                                     now=utc_now_iso(), update_part_revision=update_part_revision)
            revision = next((u["connector"]["part"]["revisionId"] for u in result["units"]
                             if u["key"] == unit_key and u["connector"]), None)
            self._audit_connector(conn, component_id, "component.module_connector_placed", actor,
                                  {"unit": unit_key, "part": part_id, "partRevision": revision})
            conn.commit()
            return result

    def remove_module_connector(self, component_id: str, unit_key: str, *, actor: str = "") -> dict[str, Any]:
        self._initialize()
        with self._connect() as conn:
            result = module_connectors.remove_connector(conn, component_id, unit_key)
            self._audit_connector(conn, component_id, "component.module_connector_removed", actor, {"unit": unit_key})
            conn.commit()
            return result

    def _audit_connector(self, conn: Any, component_id: str, event_type: str, actor: str,
                         details: dict[str, Any]) -> None:
        _component, revision = self._revision_kernel.active_revision_row(conn, component_id)
        self._revision_kernel.append_audit_event(conn, component_id=component_id,
                                                 revision_id=str((revision or {}).get("id") or ""),
                                                 event_type=event_type, actor=actor, details=details)

    # Models and alignment (CONTRACTS_P2 §18.2) --------------------------------------

    def _models_root(self) -> Path:
        return Path(self._runtime.store_root) / "models"

    def list_models(self, component_id: str, revision_id: str | None = None) -> list[dict[str, Any]]:
        """The part's STEP models at ``revision_id`` (default: the current revision) with their cached GLB
        (or None) and alignment."""
        self._initialize()
        converter = catalog_models.converter_id()
        with self._connect() as conn:
            catalog_mates.require_modelled(conn, component_id)
            assets = catalog_models.step_assets(conn, component_id, revision_id)
            keys = {a["id"]: catalog_models.glb_key(a["sha256"], converter) for a in assets}
            glbs = catalog_models.cached(conn, keys.values())
            aligned = catalog_models.alignments(conn, component_id)
        return [catalog_models.model_doc(a, glbs.get(keys[a["id"]]), aligned.get(a["id"])) for a in assets]

    def convert_models(self, component_id: str, revision_id: str | None = None) -> list[dict[str, Any]]:
        """Convert every STEP model of the part at ``revision_id`` (default: the current revision) that has
        no GLB for the current converter yet."""
        self._initialize()
        converter = catalog_models.converter_id()
        with self._connect() as conn:
            catalog_mates.require_modelled(conn, component_id)
            for asset in catalog_models.step_assets(conn, component_id, revision_id):
                key = catalog_models.glb_key(asset["sha256"], converter)
                if catalog_models.cached(conn, [key]):
                    continue
                converted = catalog_models.convert(Path(str(asset["canonical_path"])).read_bytes())
                catalog_models.store_glb(conn, self._models_root(), key=key, step_sha256=str(asset["sha256"]),
                                         converter=converter, converted=converted, now=utc_now_iso())
            conn.commit()
        return self.list_models(component_id, revision_id)

    def model_glb_path(self, key: str) -> Path | None:
        self._initialize()
        with self._connect() as conn:
            found = catalog_models.cached(conn, [key]).get(key)
        return Path(found["glb_path"]) if found else None

    def model_step_path(self, glb_key: str) -> Path | None:
        """The STEP a converted model came from (SB2-109): the system STEP export places the source."""
        self._initialize()
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT a.canonical_path FROM catalog_model_glb g JOIN assets a ON a.sha256 = g.step_sha256
                WHERE g.key = %s ORDER BY a.id LIMIT 1
                """,
                (glb_key,),
            ).fetchone()
        return Path(str(row["canonical_path"])) if row else None

    def _step_asset(self, conn: Any, component_id: str, asset_id: str) -> dict[str, Any]:
        asset = next((a for a in catalog_models.step_assets(conn, component_id) if str(a["id"]) == asset_id), None)
        if asset is None:
            raise LookupError("Model not found on this part")
        return asset

    def set_model_alignment(self, component_id: str, asset_id: str, alignment: dict[str, Any], *,
                            actor: str = "") -> list[dict[str, Any]]:
        self._initialize()
        value = catalog_models.normalized_alignment(alignment)
        with self._connect() as conn:
            catalog_mates.require_modelled(conn, component_id)
            self._step_asset(conn, component_id, asset_id)
            catalog_models.set_alignment(conn, component_id, asset_id, value, actor=actor, now=utc_now_iso())
            _component, revision = self._revision_kernel.active_revision_row(conn, component_id)
            self._revision_kernel.append_audit_event(conn, component_id=component_id, revision_id=str((revision or {}).get("id") or ""),
                                     event_type="component.model_aligned", actor=actor,
                                     details={"assetId": asset_id, **value})
            conn.commit()
        return self.list_models(component_id)

    def model_preview(self, component_id: str, asset_id: str, *, view: str, alignment: dict[str, Any] | None,
                      partner_id: str | None) -> str:
        """An SVG view of the model under ``alignment`` (the saved one when None), mated to ``partner_id``'s
        first model when given."""
        self._initialize()
        with self._connect() as conn:
            catalog_mates.require_modelled(conn, component_id)
            asset = self._step_asset(conn, component_id, asset_id)
            value = catalog_models.normalized_alignment(
                alignment if alignment is not None else catalog_models.alignments(conn, component_id).get(asset_id))
            partner = None
            if partner_id:
                catalog_mates.require_part(conn, partner_id)
                partner_assets = catalog_models.step_assets(conn, partner_id)
                if not partner_assets:
                    raise ValueError("the mating part has no STEP model")
                first = partner_assets[0]
                partner = (Path(str(first["canonical_path"])).read_bytes(), catalog_models.normalized_alignment(
                    catalog_models.alignments(conn, partner_id).get(str(first["id"]))))
        return catalog_models.preview_svg(Path(str(asset["canonical_path"])).read_bytes(), value, view, partner)

    def released_system_revision(self, component_id: str) -> dict[str, Any] | None:
        """The component's current released revision (for ``follow = latest_released``), or None."""

        self._initialize()
        with self._connect() as conn:
            row = conn.execute("SELECT released_revision_id FROM components WHERE id = %s",
                               (component_id,)).fetchone()
        revision_id = str((row or {}).get("released_revision_id") or "")
        return self.system_revision(revision_id) if revision_id else None

    def find_system_component(self, system_id: str) -> str | None:
        """An active assembly whose revisions came from ``system_id`` (recovers an unbound first publish)."""

        self._initialize()
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT c.id FROM components c JOIN component_revisions r ON r.component_id = c.id
                WHERE c.kind = 'assembly' AND c.is_active = 1
                  AND r.source_ref_json::jsonb ->> 'systemId' = %s
                ORDER BY c.created_at LIMIT 1
                """,
                (system_id,),
            ).fetchone()
        return str(row["id"]) if row else None

    def add_system_revision(
        self, component_id: str, *, interface: dict[str, Any], source_ref: dict[str, Any],
        actor: str = "", change_summary: str = "Publish",
    ) -> dict[str, Any]:
        """A new revision of a ``module``/``assembly``: metadata carried over, payload replaced."""

        self._initialize()
        with self._connect() as conn:
            kind = system_items.component_kind(conn, component_id)
            if kind not in system_items.SYSTEM_KINDS:
                raise ValueError("only module and assembly components take published revisions")
            revision = self._revision_kernel.clone_revision(
                conn, component_id, actor=actor, change_kind="publish", change_summary=change_summary,
            )
            revision_id = str(revision["id"])
            system_items.set_payload(conn, revision_id, interface=interface, source_ref=source_ref)
            if kind == system_items.KIND_ASSEMBLY:
                facts = conn.execute("SELECT value, description FROM component_revisions WHERE id = %s",
                                     (revision_id,)).fetchone()
                self._attach_assembly_symbol(conn, revision_id, str(facts["value"] or ""), interface,
                                             str(facts["description"] or ""))
            self._revision_finalizer.finalize_revision(
                conn, self._runtime, component_id=component_id, revision_id=revision_id,
                event_type="revision.created", actor=actor,
                details={"change_kind": "publish", "change_summary": change_summary},
            )
            conn.commit()
        return {"componentId": component_id, "revisionId": revision_id}

    def notify_release(self, component_id: str, release_status: str) -> None:
        """A released module/assembly revision advances the parent systems following it (CONTRACTS_P2 §7.1).

        After the commit, best effort: a queue problem never fails the release.
        """
        if release_status != "released":
            return
        try:
            with self._connect() as conn:
                row = conn.execute("SELECT kind, released_revision_id FROM components WHERE id = %s",
                                   (component_id,)).fetchone()
            if not row or str(row["kind"]) not in system_items.SYSTEM_KINDS or not row["released_revision_id"]:
                return
            from app.services.systems.child_drift import enqueue_child_check

            enqueue_child_check(component_id, str(row["released_revision_id"]))
        except Exception as error:  # noqa: BLE001 - best effort by contract; parents can rebase by hand
            logger.warning("Could not queue the system child check for %s: %s", component_id, error)
