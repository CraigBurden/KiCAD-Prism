import type { CatalogComponent } from "@/types/catalog";

type PreviewPairSource = Pick<
  CatalogComponent,
  | "assets"
  | "representations"
  | "default_representation_id"
  | "effective_representation_id"
>;

export interface LibraryPreviewPairAssetIds {
  symbolAssetId?: string;
  footprintAssetId?: string;
}

/**
 * Resolve both canvases from one representation. Falling back each side
 * independently can pair a symbol from one package with a footprint from
 * another, which makes a visually successful cross-probe actively misleading.
 */
export function resolveLibraryPreviewPairAssetIds(
  component: PreviewPairSource,
): LibraryPreviewPairAssetIds {
  const requestedId =
    component.effective_representation_id ||
    component.default_representation_id;
  const representation =
    component.representations.find((entry) => entry.id === requestedId) ||
    component.representations.find((entry) => entry.is_default) ||
    [...component.representations].sort(
      (left, right) => left.display_order - right.display_order,
    )[0];

  if (representation) {
    return {
      symbolAssetId: representation.symbol?.id,
      footprintAssetId: representation.footprint?.id,
    };
  }

  return {
    symbolAssetId: component.assets.find(
      (asset) => asset.asset_type === "symbol",
    )?.id,
    footprintAssetId: component.assets.find(
      (asset) => asset.asset_type === "footprint",
    )?.id,
  };
}
