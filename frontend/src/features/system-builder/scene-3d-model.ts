import type { SystemScene, SystemSceneOccurrence } from "@/types/system";

/** Occurrences the 3D view draws: boards, and restricted child systems (one box). */
export function drawnOccurrences(scene: SystemScene): SystemSceneOccurrence[] {
  return scene.occurrences.filter((occurrence) => occurrence.kind === "board" || occurrence.restricted);
}

/** The drawn boards whose geometry can load (not restricted, with an asset), in scene order. */
export function drawnBoards(scene: SystemScene): SystemSceneOccurrence[] {
  return drawnOccurrences(scene).filter((occurrence) => occurrence.kind === "board" && !occurrence.restricted && occurrence.assetId);
}

export interface SceneSummary {
  boards: number;
  restricted: SystemSceneOccurrence[];
  building: SystemSceneOccurrence[];
  missing: SystemSceneOccurrence[];
  failed: { occurrence: SystemSceneOccurrence; error: string | null }[];
  /** No box known yet (no PCB, or its interface is still being extracted): not drawn. */
  unplaced: SystemSceneOccurrence[];
}

/** What the descriptor says about each drawn occurrence, for the notices above the view. */
export function summarizeScene(scene: SystemScene): SceneSummary {
  const assets = new Map(scene.assets.map((asset) => [asset.assetId, asset]));
  const summary: SceneSummary = { boards: 0, restricted: [], building: [], missing: [], failed: [], unplaced: [] };
  for (const occurrence of drawnOccurrences(scene)) {
    summary.boards += 1;
    if (!occurrence.boundsMm) summary.unplaced.push(occurrence);
    if (occurrence.restricted) {
      summary.restricted.push(occurrence);
      continue;
    }
    const asset = occurrence.assetId ? assets.get(occurrence.assetId) : undefined;
    if (!asset || asset.status === "missing") summary.missing.push(occurrence);
    else if (asset.status === "failed") summary.failed.push({ occurrence, error: asset.error });
    else if (asset.status === "building" || !asset.bundleToBoard) summary.building.push(occurrence);
  }
  return summary;
}

/** Re-read the scene while bundles build, boxes are still being extracted or pinned models convert; otherwise stop. */
export function scenePollDelay(scene: SystemScene | null): number | null {
  if (!scene) return null;
  const summary = summarizeScene(scene);
  return summary.building.length || summary.unplaced.length || scene.modelsConverting ? 5000 : null;
}

export function webgpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator && Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
}

export function names(occurrences: SystemSceneOccurrence[], limit = 3): string {
  const shown = occurrences.slice(0, limit).map((occurrence) => occurrence.displayPath);
  return occurrences.length > limit ? `${shown.join(", ")} and ${occurrences.length - limit} more` : shown.join(", ");
}

/**
 * The notice for a board whose 3D view failed: the server's reason, then how to retry,
 * unless the reason already says so (SB2-91), without a doubled full stop.
 */
export function failedNotice(displayPath: string, reason: string | null | undefined): string {
  const why = (reason ?? "").trim().replace(/\.+$/, "");
  const head = `The 3D view of ${displayPath} failed${why ? `: ${why}` : ""}.`;
  return /regenerate/i.test(why) ? head : `${head} Regenerate it from the board's 3D tab.`;
}
