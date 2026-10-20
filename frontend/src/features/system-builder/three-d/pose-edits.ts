/**
 * The 3D tab's edits (stage 3b): a free board's stored pose and an
 * occurrence's positioning mate, each a `replace-occurrence` (CONTRACTS §3).
 * A mated board has no pose of its own: the bundle derives it (§8.9).
 */
import type { SystemDocument, SystemOp } from "../model/types";
import { canonicalRotation, type Pose } from "../placement/poses";

const NM_PER_MM = 1e6;

type Occurrence = SystemDocument["occurrences"][number];

function occurrenceOf(document: SystemDocument, id: string): Occurrence {
  const occurrence = document.occurrences.find((item) => item.id === id);
  if (!occurrence) throw new Error(`No occurrence ${id}`);
  return occurrence;
}

/** A pose as the document stores it: whole nanometres, a canonical unit quaternion. */
export function storedPose(pose: Pose): NonNullable<Occurrence["pose"]> {
  const [x, y, z, w] = canonicalRotation(pose.rotation);
  const [tx, ty, tz] = pose.translationMm.map((value) => Math.round(value * NM_PER_MM));
  return { translation: { xNm: tx, yNm: ty, zNm: tz }, rotation: { x, y, z, w } };
}

/** Store `pose` on an occurrence; null drops it, so it takes its default slot. */
export function poseOps(document: SystemDocument, id: string, pose: Pose | null): SystemOp[] {
  const rest = { ...occurrenceOf(document, id) };
  delete rest.pose;
  return [{ kind: "replace-occurrence", occurrence: pose ? { ...rest, pose: storedPose(pose) } : rest }];
}

/** The mates that could place an occurrence: those with an end on it. */
export function matesOf(document: SystemDocument, id: string): SystemDocument["mates"] {
  return document.mates.filter((mate) => mate.a.occurrence === id || mate.b.occurrence === id);
}

/** Choose the mate that positions an occurrence; null goes back to the automatic choice. */
export function positioningMateOps(document: SystemDocument, id: string, mate: string | null): SystemOp[] {
  const rest = { ...occurrenceOf(document, id) };
  delete rest.positioningMate;
  return [{ kind: "replace-occurrence", occurrence: mate ? { ...rest, positioningMate: mate } : rest }];
}
