/**
 * Bodies, body connectors and entries (stage 3d, CONTRACTS §2.7, §8.10,
 * §15.3, mockup 08): adding a catalog part as a body or a published system as
 * an entry, and placing a connector part on a body's face. A face pick (world point and normal) is carried into the body's frame
 * and becomes the connector's mating frame there, by the kept module-ports
 * convention: origin on the face, +z the outward normal, x the body's +x
 * projected onto the face (its +y when the face looks more along x).
 */
import { newId } from "../model/ids";
import type { SystemDocument, SystemOp } from "../model/types";
import { naturalCompare } from "../schematic/scene";
import { inverse } from "../placement/mate";
import { faceFrame } from "../placement/module-ports";
import { canonicalRotation, compose, rotate, type Pose } from "../placement/poses";
import { storedPose } from "./pose-edits";

type Vec3 = [number, number, number];

export interface PartChoice {
  componentId: string;
  revisionId: string;
  name: string;
}

/** A label for a new body: the part's name, made unique among the document's labels. */
export function bodyLabel(document: SystemDocument, name: string): string {
  const base = name.trim() || "Body";
  const taken = new Set(document.occurrences.map((item) => item.label));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

/** Add a catalog part as a body occurrence, pinned at its revision; it takes its slot in the default row. */
export function addBodyOps(document: SystemDocument, part: PartChoice): { ops: SystemOp[]; occurrence: string } {
  const occurrence = newId("occ");
  return {
    occurrence,
    ops: [{
      kind: "add-occurrence",
      occurrence: { id: occurrence, label: bodyLabel(document, part.name), source: { kind: "body", componentId: part.componentId, revisionId: part.revisionId } },
    }],
  };
}

/** Place a published system's revision as an entry occurrence; it takes its slot in the default row. */
export function addEntryOps(document: SystemDocument, system: PartChoice): { ops: SystemOp[]; occurrence: string } {
  const occurrence = newId("occ");
  return {
    occurrence,
    ops: [{
      kind: "add-occurrence",
      occurrence: { id: occurrence, label: bodyLabel(document, system.name || "System"), source: { kind: "entry", componentId: system.componentId, revisionId: system.revisionId } },
    }],
  };
}

/** The next free connector designator on a body: J1, J2, … */
export function nextRefdes(document: SystemDocument, body: string): string {
  const taken = new Set(document.bodyConnectors.flatMap((item) => (item.occurrence === body ? [item.refdes] : [])));
  for (let n = 1; ; n += 1) if (!taken.has(`J${n}`)) return `J${n}`;
}

/**
 * A face pick in the system frame as a mating frame in the body's frame:
 * `bodyPose` is the body's placed pose; quarter turns are stored apart.
 */
export function faceFramePose(bodyPose: Pose, pointMm: readonly number[], normal: readonly number[]): Pose {
  const local = inverse(bodyPose);
  const origin = compose(local, { translationMm: [pointMm[0], pointMm[1], pointMm[2]], rotation: [0, 0, 0, 1] }).translationMm;
  const localNormal = rotate(local.rotation, normal);
  const face = faceFrame({ originMm: origin as Vec3, normal: localNormal, quarterTurns: 0 });
  return { translationMm: face.originMm, rotation: canonicalRotation(face.rotation) };
}

/** Store a connector part on a body face. */
export function addBodyConnectorOps(
  document: SystemDocument,
  input: { body: string; refdes: string; part: PartChoice; frame: Pose; quarterTurns: number },
): SystemOp[] {
  const refdes = input.refdes.trim();
  if (!refdes) throw new Error("A connector needs a designator");
  if (document.bodyConnectors.some((item) => item.occurrence === input.body && item.refdes === refdes)) {
    throw new Error(`${refdes} is already on this body`);
  }
  return [{
    kind: "add-body-connector",
    bodyConnector: {
      id: newId("bc"),
      occurrence: input.body,
      refdes,
      part: { componentId: input.part.componentId, revisionId: input.part.revisionId },
      frame: storedPose(input.frame),
      quarterTurns: ((input.quarterTurns % 4) + 4) % 4,
    },
  }];
}

/** A body's connectors in natural designator order. */
export function bodyConnectorsOf(document: SystemDocument, body: string): SystemDocument["bodyConnectors"] {
  return document.bodyConnectors.filter((item) => item.occurrence === body).sort((a, b) => naturalCompare(a.refdes, b.refdes));
}
