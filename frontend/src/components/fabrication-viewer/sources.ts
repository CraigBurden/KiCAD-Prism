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
 * `folder` is relative to the output folder, and only its direct files are read.
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

/**
 * Gerber (`.gbr`, Protel `.gtl`/`.gm1`/..., inner `.g1`) or drill file by name.
 * The job file is metadata and is not a layer.
 */
const LAYER_NAME = /\.(gbr|gtl|gbl|gts|gbs|gto|gbo|gtp|gbp|gta|gba|gm\d|gko|g\d+|drl|xln)$/i;

export function isLayerName(name: string): boolean {
    return LAYER_NAME.test(name) && !/\.gbrjob$/i.test(name);
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
