import type { FabricationSource } from "./types";

/** The fabrication package of a Release Studio build. */
export function buildSource(projectId: string, buildId: string): FabricationSource {
    const base =
        `/api/projects/${encodeURIComponent(projectId)}/release-studio`
        + `/builds/${encodeURIComponent(buildId)}/fabrication-view`;
    return {
        key: `build:${projectId}:${buildId}`,
        viewUrl: base,
        layerUrl: (layerId) => `${base}/layers/${encodeURIComponent(layerId)}.svg`,
        placementUrl: `${base.replace(/\/fabrication-view$/, "")}/placement`,
    };
}

export type OutputType = "design" | "manufacturing";

/**
 * Gerber and drill files committed in a project's output folders.
 *
 * `folder` is relative to the output folder ("" is the whole output folder).
 * Its files and those in its subfolders, `PACKAGE_DEPTH` levels down, are one
 * package: CAM exports keep drill files, positions and the BOM in folders of
 * their own.
 */
export function outputsSource(
    projectId: string,
    type: OutputType,
    folder: string,
    commit?: string | null,
): FabricationSource {
    const root = `/api/projects/${encodeURIComponent(projectId)}/fabrication-view`;
    const query = new URLSearchParams({ type, folder });
    if (commit) query.set("commit", commit);
    return {
        key: `outputs:${projectId}:${type}:${folder}:${commit ?? ""}`,
        viewUrl: `${root}?${query}`,
        layerUrl: (layerId) => `${root}/layers/${encodeURIComponent(layerId)}.svg?${query}`,
        placementUrl: `/api/projects/${encodeURIComponent(projectId)}/placement?${query}`,
    };
}

/** How many folder levels below an opened folder its package reaches (the backend's `_MAX_DEPTH`). */
export const PACKAGE_DEPTH = 3;

/**
 * Gerber (`.gbr`, Protel `.gtl`/`.gm1`/..., inner `.g1`) or drill file by name.
 * The job file is metadata, and a drill map is a drawing with a legend; neither
 * is a layer.
 */
const LAYER_NAME = /\.(gbr|gtl|gbl|gts|gbs|gto|gbo|gtp|gbp|gta|gba|gm\d|gko|g\d+|drl|xln)$/i;
const DRILL_MAP_NAME = /(drl|drill)[-_]?map/i;

export function isLayerName(name: string): boolean {
    return LAYER_NAME.test(name) && !/\.gbrjob$/i.test(name) && !DRILL_MAP_NAME.test(name);
}

interface PackageNode {
    name: string;
    isDir: boolean;
    children: readonly PackageNode[];
}

/**
 * Whether a folder with these entries opens as a package: a layer file within
 * `PACKAGE_DEPTH` levels. Hidden (dot) entries are skipped, as the backend skips them.
 */
export function holdsLayers(entries: readonly PackageNode[], depth: number = PACKAGE_DEPTH): boolean {
    return entries.some((entry) =>
        entry.name.startsWith(".")
            ? false
            : entry.isDir
              ? depth > 0 && holdsLayers(entry.children, depth - 1)
              : isLayerName(entry.name),
    );
}

/** Gerber and drill files a build keeps, which the viewer draws. */
export function isFabricationMember(path: string): boolean {
    return path.startsWith("fabrication/gerbers/") || path.startsWith("fabrication/drill/");
}

/** A layer file the viewer draws. The Gerber job file is metadata and stays text. */
export function isLayerFile(path: string): boolean {
    return isFabricationMember(path) && !path.endsWith(".gbrjob");
}

export function memberFileName(path: string): string {
    return path.slice(path.lastIndexOf("/") + 1);
}
