// Bundle URL helpers for the board viewer element (SB2-27).

export function withCacheKey(url, cacheKey) {
  if (!cacheKey) return url;
  const next = new URL(url);
  next.searchParams.set("viewer", cacheKey);
  return next.toString();
}

export function absolutizeAssetPaths(semanticGeometry, bundleUrl, bundle, cacheKey) {
  const assetBase = new URL(bundle.asset_base || "./", bundleUrl);
  const output = structuredClone(semanticGeometry || {});
  const absolutize = (value) => {
    if (!value || typeof value !== "string") return value;
    return withCacheKey(new URL(value, assetBase).toString(), cacheKey);
  };
  for (const groupName of ["assets", "semantic_gltf", "schematic_world", "schematic_vector", "schematic_scene", "bom"]) {
    const group = output[groupName];
    if (!group || typeof group !== "object") continue;
    for (const [key, value] of Object.entries(group)) group[key] = absolutize(value);
  }
  return output;
}

// A bundle is final once generation reached its last stage; its files then never change.
export function bundleIsFinal(bundle) {
  const stage = bundle?.readiness?.stage || "semantic-ready";
  return stage === "semantic-ready" && (bundle?.readiness?.progress ?? 100) >= 100;
}
