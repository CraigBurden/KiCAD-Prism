"""Placement bundles for desktop KiCad: manifests, inline bundles, asset fetches.

A placement is always anchored to one representation (a symbol/footprint pair)
on a released revision. Auxiliary 3D/SPICE assets ride along with whichever
representation is selected, except 3D models embedded in the footprint: KiCad
only writes a shipped model to its remote 3D folder, nothing references it
once the footprint carries it, and every shipped asset counts against KiCad's
one download budget.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any, Callable

from app.core.config import settings
from app.core.errors import NotFound
from app.services.catalog.asset_types import AUXILIARY_ASSET_TYPES
from app.services.catalog.component_read_models import CatalogComponentReadModels
from app.services.catalog.placement_payloads import materialize_asset
from app.services.catalog.revision_kernel import CatalogRevisionKernel
from app.services.catalog.signed_urls import CatalogAssetUrlSigner
from app.services.catalog.step_quarantine import raise_if_asset_purged


NOT_PLACEABLE_MESSAGE = "Component is not placeable because it is not released or required files are missing"


class CatalogPlacement:
    """Resolve representation assets and shape them for remote placement."""

    def __init__(
        self,
        revision_kernel: CatalogRevisionKernel,
        read_models: CatalogComponentReadModels,
        signer: type[CatalogAssetUrlSigner] = CatalogAssetUrlSigner,
        compress: Callable[[bytes], bytes] | None = None,
    ) -> None:
        """``compress`` keeps each embedded model's compressed copy (``CompressedModelCopies.compress``)."""
        self._revision_kernel = revision_kernel
        self._read_models = read_models
        self._signer = signer
        self._compress = compress

    def placement_assets(
        self,
        conn: Any,
        revision_id: str,
        representation_id: str = "",
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        """Return ``(representation_row, assets)`` for the chosen or default pair."""
        if representation_id:
            row = conn.execute(
                "SELECT * FROM revision_representations WHERE id = %s AND revision_id = %s",
                (representation_id, revision_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM revision_representations WHERE revision_id = %s AND is_default = 1 LIMIT 1",
                (revision_id,),
            ).fetchone()
        if not row:
            raise ValueError("Representation was not found on this revision")
        if not row["symbol_asset_id"] or not row["footprint_asset_id"]:
            raise ValueError("Selected representation is incomplete")
        all_assets = self._revision_kernel.load_assets_for_revision(conn, revision_id)
        selected_ids = {str(row["symbol_asset_id"]), str(row["footprint_asset_id"])}
        assets = [
            asset
            for asset in all_assets
            if str(asset["asset_type"]) in AUXILIARY_ASSET_TYPES or str(asset["id"]) in selected_ids
        ]
        if len([asset for asset in assets if str(asset["id"]) in selected_ids]) != 2:
            raise ValueError("Selected representation references unavailable assets")
        return dict(row), assets

    def _placement_payloads(
        self, assets: list[dict[str, Any]], component: dict[str, Any]
    ) -> list[tuple[dict[str, Any], dict[str, Any]]]:
        """Materialize assets in order, leaving out models the footprint embeds."""
        materialized = {
            str(asset["id"]): materialize_asset(
                asset, assets, component, stamp=True, embed_models=settings.REMOTE_PROVIDER_EMBED_3D_MODELS,
                compress=self._compress,
            )
            for asset in assets
            if asset["asset_type"] != "3dmodel"
        }
        embedded = {
            model_id for asset in materialized.values() for model_id in asset.get("embedded_model_ids", [])
        }
        return [
            (
                raw_asset,
                materialized.get(str(raw_asset["id"])) or materialize_asset(raw_asset, assets, component, stamp=True),
            )
            for raw_asset in assets
            if str(raw_asset["id"]) not in embedded
        ]

    @staticmethod
    def released_revisions(conn: Any, component_id: str) -> list[dict[str, Any]]:
        """The component's revisions placement may serve, newest first: ever released and still released.

        A revision archived after release is left out; drafts never appear.
        """
        rows = conn.execute(
            """
            SELECT revision.id, revision.version, min(record.created_at) AS released_at
            FROM component_revisions revision
            JOIN component_release_records record ON record.revision_id = revision.id
            WHERE revision.component_id = %s AND revision.release_status = 'released'
            GROUP BY revision.id, revision.version
            ORDER BY revision.version DESC
            """,
            (component_id,),
        ).fetchall()
        return [
            {"revision_id": str(row["id"]), "version": int(row["version"]), "released_at": str(row["released_at"])}
            for row in rows
        ]

    def placeable_component(self, conn: Any, component_id: str, revision_id: str = "") -> dict[str, Any] | None:
        """The released component payload placement serves (issue #698, D4).

        Without ``revision_id``, the component's current released revision.
        With it, that exact revision, when it belongs to the component, was
        released and is not archived, and the component is active and still
        released; anything else, a draft above all, is a typed 404
        ``revision_not_released`` and never served. ``None`` means the
        component itself is not placeable (unknown, inactive or unreleased).
        """
        if not revision_id:
            return self._read_models.get_component(conn, component_id, include_inactive=False, released_only=True)
        component, current = self._revision_kernel.active_revision_row(conn, component_id, released=True)
        if not component or not current or not component["is_active"]:
            return None
        revision = self._revision_kernel.revision_row(conn, revision_id)
        if (
            not revision
            or str(revision["component_id"]) != str(component["id"])
            or revision_id not in {item["revision_id"] for item in self.released_revisions(conn, component_id)}
        ):
            raise NotFound("The component has no released revision with this id", code="revision_not_released")
        return self._read_models.component_payload(conn, component, revision, released_view=True)

    @staticmethod
    def _require_placeable(component: dict[str, Any]) -> None:
        if not component["place_enabled"]:
            raise ValueError(NOT_PLACEABLE_MESSAGE)

    def build_manifest(
        self,
        conn: Any,
        component: dict[str, Any],
        base_url: str,
        representation_id: str = "",
    ) -> dict[str, Any]:
        self._require_placeable(component)
        representation, assets = self.placement_assets(conn, component["revision_id"], representation_id)
        manifest_assets = []
        for raw_asset, asset in self._placement_payloads(assets, component):
            manifest_assets.append(
                {
                    "asset_type": asset["asset_type"],
                    "name": asset["name"],
                    "target_library": asset["target_library"],
                    "target_name": asset["target_name"],
                    "content_type": asset["content_type"],
                    "size_bytes": asset["size_bytes"],
                    "sha256": asset["sha256"],
                    "required": bool(raw_asset["required"]),
                    "download_url": self._signer.build_signed_asset_url(
                        asset["id"],
                        component["revision_id"],
                        base_url,
                        representation_id=str(representation["id"]),
                    ),
                }
            )
        return {
            "part_id": component["id"],
            "display_name": component["name"],
            "summary": component["summary"] or component["description"],
            "license": "Managed in KiCAD Prism",
            "representation_id": str(representation["id"]),
            "library_name": next(str(a["target_library"]) for a in assets if a["asset_type"] == "symbol"),
            "symbol_name": next(str(a["target_name"]) for a in assets if a["asset_type"] == "symbol"),
            "assets": manifest_assets,
        }

    def build_inline_bundle(
        self,
        conn: Any,
        component: dict[str, Any],
        representation_id: str = "",
    ) -> dict[str, Any]:
        self._require_placeable(component)
        representation, assets = self.placement_assets(conn, component["revision_id"], representation_id)
        bundle_entries = []
        for _, asset in self._placement_payloads(assets, component):
            bundle_entries.append(
                {
                    "type": asset["asset_type"],
                    "name": (
                        asset["name"]
                        if asset["asset_type"] == "3dmodel"
                        else asset["target_name"] or asset["name"]
                    ),
                    "compression": "NONE",
                    "content": base64.b64encode(asset["payload"]).decode("ascii"),
                    "checksum": asset["sha256"],
                }
            )
        return {
            "part_id": component["id"],
            "display_name": component["name"],
            "representation_id": str(representation["id"]),
            "library": next(str(a["target_library"]) for a in assets if a["asset_type"] == "symbol"),
            "symbol_name": next(str(a["target_name"]) for a in assets if a["asset_type"] == "symbol"),
            "compression": "NONE",
            "data": base64.b64encode(
                json.dumps(bundle_entries, separators=(",", ":")).encode("utf-8")
            ).decode("ascii"),
        }

    def asset_by_id(
        self,
        conn: Any,
        asset_id: str,
        *,
        revision_id: str = "",
        representation_id: str = "",
    ) -> dict[str, Any] | None:
        """Materialize one asset in the context of a revision and representation.

        Without an explicit revision the asset's most recently linked revision is
        used so the symbol rewrite still sees its footprint and metadata.
        """
        row = conn.execute("SELECT * FROM assets WHERE id = %s", (asset_id,)).fetchone()
        if not row:
            return None
        asset = dict(row)
        if not Path(str(asset["canonical_path"])).is_file():
            raise_if_asset_purged(conn, asset_id)
        effective_revision_id = revision_id
        if not effective_revision_id:
            link = conn.execute(
                "SELECT revision_id FROM revision_assets WHERE asset_id = %s ORDER BY updated_at DESC LIMIT 1",
                (asset_id,),
            ).fetchone()
            effective_revision_id = str(link["revision_id"]) if link else ""
        if effective_revision_id and representation_id:
            _, assets_for_revision = self.placement_assets(conn, effective_revision_id, representation_id)
        elif effective_revision_id:
            assets_for_revision = self._revision_kernel.load_assets_for_revision(conn, effective_revision_id)
        else:
            assets_for_revision = [asset]
        component = None
        if effective_revision_id:
            revision = self._revision_kernel.revision_row(conn, effective_revision_id)
            if revision:
                component_row = self._revision_kernel.component_row(conn, str(revision["component_id"]))
                if component_row:
                    component = self._read_models.component_payload(conn, component_row, revision)
        return materialize_asset(
            asset, assets_for_revision, component, stamp=True, embed_models=settings.REMOTE_PROVIDER_EMBED_3D_MODELS,
            compress=self._compress,
        )


__all__ = ["NOT_PLACEABLE_MESSAGE", "CatalogPlacement"]
