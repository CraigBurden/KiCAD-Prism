// The harness part of a `prism.system_scene.a0` descriptor (System Builder 4c,
// CONTRACTS §16.6): the host sends ready polylines, handles and flags in world
// mm, and the viewer only shapes them for the GPU (tube-mesh.js) and the SVG
// overlay. No route maths lives here.

/** A harness segment's default colour: amber. */
export const DEFAULT_HARNESS_COLOR = [0.96, 0.62, 0.04, 1];
/** A selected segment's tint/halo: sky blue. */
export const SELECTED_HARNESS_COLOR = [0.22, 0.74, 0.97, 1];
/** A drag preview draws translucent. */
export const PREVIEW_ALPHA = 0.45;

const HANDLE_KINDS = new Set(["waypoint", "branch-point", "auto"]);
const FLAG_KINDS = new Set(["bend", "clearance"]);

const list = (value) => (Array.isArray(value) ? value : []);
const finite = (value) => Number.isFinite(value);
const point3 = (value) => Boolean(value && value.length >= 3 && finite(value[0]) && finite(value[1]) && finite(value[2]));
const rgba = (value) => (Array.isArray(value) && value.length >= 3
  ? [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0, value.length > 3 ? Math.max(0, Math.min(1, Number(value[3]))) : 1]
  : [...DEFAULT_HARNESS_COLOR]);

/**
 * Every drawable segment of `harnesses` as a tube: `{harness, id, samplesMm,
 * radiusMm, color, selected, preview}`. A segment needs at least two samples
 * and a positive radius; malformed ones are left out.
 */
export function harnessTubes(harnesses) {
  const tubes = [];
  for (const entry of list(harnesses)) {
    const harness = entry?.harness;
    if (typeof harness !== "string") continue;
    for (const segment of list(entry.segments)) {
      const samplesMm = segment?.samplesMm;
      if (!Array.isArray(samplesMm) || samplesMm.length < 6 || samplesMm.length % 3 !== 0) continue;
      if (!samplesMm.every(finite)) continue;
      const radiusMm = Number(segment.radiusMm);
      if (!(radiusMm > 0)) continue;
      tubes.push({
        harness,
        id: String(segment.id ?? tubes.length),
        samplesMm: [...samplesMm],
        radiusMm,
        color: rgba(segment.color),
        selected: Boolean(segment.selected),
        preview: Boolean(segment.preview),
      });
    }
  }
  return tubes;
}

/**
 * The overlay's handles and flags, in world mm: `{handles: [...], flags: [...]}`.
 * Unknown handle kinds fall back to a waypoint; unknown flags are dropped.
 */
export function harnessOverlayItems(harnesses) {
  const handles = [];
  const flags = [];
  for (const entry of list(harnesses)) {
    const harness = entry?.harness;
    if (typeof harness !== "string") continue;
    for (const handle of list(entry.handles)) {
      if (!point3(handle?.positionMm)) continue;
      handles.push({
        harness,
        id: String(handle.id ?? `${harness}:handle:${handles.length}`),
        kind: HANDLE_KINDS.has(handle.kind) ? handle.kind : "waypoint",
        positionMm: handle.positionMm.slice(0, 3).map(Number),
        selected: Boolean(handle.selected),
      });
    }
    for (const flag of list(entry.flags)) {
      if (!point3(flag?.atMm) || !FLAG_KINDS.has(flag.kind)) continue;
      flags.push({
        harness,
        id: String(flag.id ?? `${harness}:flag:${flags.length}`),
        kind: flag.kind,
        atMm: flag.atMm.slice(0, 3).map(Number),
        label: String(flag.label ?? ""),
      });
    }
  }
  return { handles, flags };
}

/** A stable signature of what the harness rendering needs; upload only when it changes. */
export function harnessSignature(showHarnesses, harnesses) {
  return JSON.stringify([Boolean(showHarnesses), list(harnesses)]);
}
