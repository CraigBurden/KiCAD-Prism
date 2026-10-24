"""Part-to-part relations in the catalog: "mates with" and 3D model alignment.

A facade beside the compatibility facade (``component_catalog_domain``), which
exposes it as ``catalog_service.part_relations``. It owns its transactions, like
that facade, over the shared revision kernel. ``connect`` opens a catalog
connection and ``initialize`` makes sure the schema exists.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, ContextManager

from app.services.catalog import mates as catalog_mates, models as catalog_models
from app.services.catalog.normalization import utc_now_iso
from app.services.catalog.revision_kernel import CatalogRevisionKernel
from app.services.catalog.runtime import CatalogRuntime


class CatalogPartRelationsFacade:
    def __init__(
        self, *, connect: Callable[[], ContextManager[Any]], initialize: Callable[[], None], runtime: CatalogRuntime,
        revision_kernel: CatalogRevisionKernel,
    ) -> None:
        self._connect = connect
        self._initialize = initialize
        self._runtime = runtime
        self._revision_kernel = revision_kernel

    # "Mates with" ---------------------------------------------------------------------

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

    def mate_pairs(self, component_ids: list[str]) -> set[tuple[str, str]]:
        self._initialize()
        with self._connect() as conn:
            return catalog_mates.pairs_among(conn, component_ids)

    # Models and alignment -------------------------------------------------------------

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
        """The STEP a converted model came from: an assembly STEP export places the source."""
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
