/**
 * The 3D tab's scene (stage 3b): the system bundle's placement (CONTRACTS
 * §8.9) as the `prism.system_scene.a0` descriptor `<prism-semantic-viewer
 * mode="system">` draws. Each occurrence is its own viewer asset (an analytic
 * board draws at one matrix); the host resolves each board's 3D bundle.
 * A body (stage 3d, §8.10) draws its part's model, and each body connector
 * draws its part's model as a child at its mating frame on the body.
 */
import type { SystemBundle, SystemDocument } from "../model/types";
import { compose, matrix, rotate, type Pose } from "../placement/poses";
import { partKey, type PartModel } from "./part-models";

export const SYSTEM_SCENE_SCHEMA = "prism.system_scene.a0";

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

export type ScenePose = Pose;

/** A board's 3D bundle as the host found it. */
export interface MemberAsset {
  status: "ready" | "building" | "missing" | "failed";
  bundleUrl: string | null;
}

export interface SceneOccurrence {
  path: string;
  label: string;
  /** A board, a body (a catalog part's model), or a connector part on a body. */
  kind: "board" | "body" | "part";
  assetId: string | null;
  /** A body's or a part's catalog model; it draws a box while loading. */
  model?: { glbKey: string; matrixMm: number[]; boundsMm: PartModel["boundsMm"] } | null;
  /** Faces of its model can be picked (a body: connectors are placed on them). */
  pickSurface?: boolean;
  /** A connector part's body: drawn at the body's current frame times `localMatrix`. */
  parent?: string;
  localMatrix?: number[];
  /** Column-major, millimetres, the system frame (+z up). */
  worldMatrix: number[];
  /** With where it comes from, in the viewer's words: its mate, its stored pose, or the default row. */
  pose: ScenePose & { source: "auto" | "manual" | "default" };
  boundsMm: { minMm: Vec3; maxMm: Vec3 } | null;
  restricted: boolean;
  /** The gizmo may move it: a free board or a mated group's root. */
  movable: boolean;
  /** Where the assembly explode slides it: away from its parent along the mate axis. */
  explode: { axis: Vec3; depth: number } | null;
}

export interface SceneAsset {
  assetId: string;
  status: MemberAsset["status"];
  bundleUrl: string | null;
  /** Null: the viewer derives it from the analytic board's mid-plane. */
  bundleToBoard: null;
}

export interface SystemSceneDescriptor {
  schema: typeof SYSTEM_SCENE_SCHEMA;
  occurrences: SceneOccurrence[];
  assets: SceneAsset[];
}

const NM_PER_MM = 1e6;
const SOURCE = { mate: "auto", stored: "manual", default: "default" } as const;

const vectorMm = (v: { xNm: number; yNm: number; zNm: number }): Vec3 => [v.xNm / NM_PER_MM, v.yNm / NM_PER_MM, v.zNm / NM_PER_MM];
const quat = (q: { x: number; y: number; z: number; w: number }): Quat => [q.x, q.y, q.z, q.w];

const IDENTITY_POSE: Pose = { translationMm: [0, 0, 0], rotation: [0, 0, 0, 1] };
const HALF = Math.SQRT1_2;
/** `Rz(k · 90°)`, x → y. */
const QUARTER: Quat[] = [[0, 0, 0, 1], [0, 0, HALF, HALF], [0, 0, 1, 0], [0, 0, -HALF, HALF]];

/** A body connector's mating frame in its body: its stored frame turned by its quarter turns (§2.7). */
export function bodyConnectorFrame(connector: SystemDocument["bodyConnectors"][number]): Pose {
  const frame: Pose = { translationMm: vectorMm(connector.frame.translation), rotation: quat(connector.frame.rotation) };
  return compose(frame, { translationMm: [0, 0, 0], rotation: QUARTER[((connector.quarterTurns % 4) + 4) % 4] });
}

/** The key a board's 3D bundle is looked up by: its project at its commit. */
export function memberKey(projectId: string, commit: string): string {
  return `${projectId}@${commit}`;
}

/** The boards whose 3D bundles the scene needs: one per project and commit. */
export function sceneMembers(document: SystemDocument): { key: string; projectId: string; commit: string }[] {
  const out = new Map<string, { key: string; projectId: string; commit: string }>();
  for (const occurrence of document.occurrences) {
    const source = occurrence.source;
    if (source.kind !== "board") continue;
    const key = memberKey(source.projectId, source.track.commit);
    out.set(key, { key, projectId: source.projectId, commit: source.track.commit });
  }
  return [...out.values()];
}

/** How many mates lie between each placed occurrence and its group's root. */
function depths(placed: Map<string, { positioningMate?: string }>, parentOf: (occurrence: string, mate: string) => string | null): Map<string, number> {
  const out = new Map<string, number>();
  const depthOf = (id: string, seen: Set<string>): number => {
    const known = out.get(id);
    if (known !== undefined) return known;
    const mate = placed.get(id)?.positioningMate;
    const parent = mate ? parentOf(id, mate) : null;
    const depth = parent && !seen.has(parent) ? depthOf(parent, seen.add(id)) + 1 : 0;
    out.set(id, depth);
    return depth;
  };
  for (const id of placed.keys()) depthOf(id, new Set());
  return out;
}

/**
 * The descriptor for a document and its bundle. `assets` holds each board's
 * 3D bundle by `memberKey`; a board without one draws as a box.
 */
export function buildSceneDescriptor(
  document: SystemDocument,
  bundle: SystemBundle | null,
  assets: ReadonlyMap<string, MemberAsset>,
  models: ReadonlyMap<string, PartModel | null> = new Map(),
): SystemSceneDescriptor {
  const placed = new Map((bundle?.placement?.occurrences ?? []).map((item) => [item.occurrence, item]));
  const placedMates = new Map((bundle?.placement?.mates ?? []).map((item) => [item.mate, item]));
  const mates = new Map(document.mates.map((mate) => [mate.id, mate]));
  const parentOf = (occurrence: string, mateId: string) => {
    const mate = mates.get(mateId);
    if (!mate) return null;
    return mate.a.occurrence === occurrence ? mate.b.occurrence : mate.a.occurrence;
  };
  const depth = depths(placed, parentOf);

  const occurrences: SceneOccurrence[] = [];
  const sceneAssets: SceneAsset[] = [];
  for (const occurrence of document.occurrences) {
    const place = placed.get(occurrence.id);
    if (!place) continue;
    const source = occurrence.source;
    const restricted = (source.kind as string) === "redacted";
    const pose: ScenePose = { translationMm: vectorMm(place.pose.translation), rotation: quat(place.pose.rotation) };
    let assetId: string | null = null;
    let model: SceneOccurrence["model"];
    if (source.kind === "body") {
      model = models.get(partKey(source)) ?? null;
    }
    if (source.kind === "board") {
      const asset = assets.get(memberKey(source.projectId, source.track.commit));
      assetId = `occurrence:${occurrence.id}`;
      sceneAssets.push({ assetId, status: asset?.status ?? "building", bundleUrl: asset?.bundleUrl ?? null, bundleToBoard: null });
    }
    occurrences.push({
      path: occurrence.id,
      label: occurrence.label,
      kind: source.kind === "body" ? "body" : "board",
      assetId,
      ...(source.kind === "body" ? { model, pickSurface: true } : {}),
      worldMatrix: matrix(pose),
      pose: { ...pose, source: SOURCE[place.source] },
      boundsMm: place.bounds ? { minMm: vectorMm(place.bounds.min), maxMm: vectorMm(place.bounds.max) } : null,
      restricted,
      movable: place.root,
      explode: explodeOf(occurrence.id, place.positioningMate, depth.get(occurrence.id) ?? 0),
    });
  }
  const bodies = new Set(occurrences.flatMap((item) => (item.kind === "body" ? [item.path] : [])));
  for (const connector of document.bodyConnectors) {
    if (!bodies.has(connector.occurrence)) continue;
    occurrences.push({
      path: `${connector.occurrence}/${connector.refdes}`,
      label: connector.refdes,
      kind: "part",
      assetId: null,
      model: models.get(partKey(connector.part)) ?? null,
      parent: connector.occurrence,
      localMatrix: matrix(bodyConnectorFrame(connector)),
      worldMatrix: matrix(IDENTITY_POSE),
      pose: { ...IDENTITY_POSE, source: "manual" },
      boundsMm: null,
      restricted: false,
      movable: false,
      explode: null,
    });
  }
  return { schema: SYSTEM_SCENE_SCHEMA, occurrences, assets: sceneAssets };

  /** The parent end's connector axis (its frame's +z) in the system frame. */
  function explodeOf(id: string, mateId: string | undefined, level: number): SceneOccurrence["explode"] {
    if (!mateId || level === 0) return null;
    const mate = mates.get(mateId);
    const frames = placedMates.get(mateId);
    if (!mate || !frames) return null;
    const parentFrame = mate.a.occurrence === id ? frames.frameB : frames.frameA;
    if (!parentFrame) return null;
    return { axis: rotate(quat(parentFrame.rotation), [0, 0, 1]), depth: level };
  }
}
