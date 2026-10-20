/**
 * Catalog parts' 3D models for the 3D tab (stage 3d): a body's model and its
 * connector parts' models, each the part's first STEP model as the catalog
 * converts it to GLB, placed into the part's frame by its alignment
 * (`backend/app/services/catalog/models.py`). The system bundle uses the same
 * model for a body's box (CONTRACTS §8.10).
 */
import { useEffect, useMemo, useState } from "react";

import { fetchJson } from "@/lib/api";

type Vec3 = [number, number, number];

export interface Alignment {
  offsetMm: Vec3;
  rotationDeg: Vec3;
  scale: number;
}

/** One part's model as the viewer draws it. */
export interface PartModel {
  glbKey: string;
  /** Column-major alignment: the model into the part's frame, mm. */
  matrixMm: number[];
  /** The model's box in the part's frame, its alignment applied. */
  boundsMm: { minMm: Vec3; maxMm: Vec3 };
}

interface ModelDoc {
  glb: { key: string; bounds: { minMm: Vec3; maxMm: Vec3 } } | null;
  alignment: Alignment;
}

const IDENTITY: Alignment = { offsetMm: [0, 0, 0], rotationDeg: [0, 0, 0], scale: 1 };

/** Column-major `T(offset) · Rz · Ry · Rx · S`, as the backend's `alignment_matrix`. */
export function alignmentMatrix(alignment: Alignment = IDENTITY): number[] {
  const [rx, ry, rz] = alignment.rotationDeg.map((value) => (value * Math.PI) / 180);
  const s = alignment.scale;
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  const r = [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
  const [tx, ty, tz] = alignment.offsetMm;
  return [
    r[0][0] * s, r[1][0] * s, r[2][0] * s, 0,
    r[0][1] * s, r[1][1] * s, r[2][1] * s, 0,
    r[0][2] * s, r[1][2] * s, r[2][2] * s, 0,
    tx, ty, tz, 1,
  ];
}

/** The box around `bounds`' eight corners after the column-major `matrix`. */
export function transformedBounds(matrix: readonly number[], bounds: { minMm: Vec3; maxMm: Vec3 }): { minMm: Vec3; maxMm: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let corner = 0; corner < 8; corner += 1) {
    const p = [0, 1, 2].map((axis) => ((corner >> axis) & 1 ? bounds.maxMm[axis] : bounds.minMm[axis]));
    for (let row = 0; row < 3; row += 1) {
      const value = matrix[row] * p[0] + matrix[4 + row] * p[1] + matrix[8 + row] * p[2] + matrix[12 + row];
      min[row] = Math.min(min[row], value);
      max[row] = Math.max(max[row], value);
    }
  }
  return { minMm: min, maxMm: max };
}

/** The part's model from its first converted STEP model, or null without one. */
export function partModel(models: readonly ModelDoc[]): PartModel | null {
  const first = models[0];
  if (!first?.glb) return null;
  const matrixMm = alignmentMatrix(first.alignment ?? IDENTITY);
  return { glbKey: first.glb.key, matrixMm, boundsMm: transformedBounds(matrixMm, first.glb.bounds) };
}

/** A part reference's key, as `--parts` keys it: `componentId`, or `componentId@revisionId`. */
export function partKey(ref: { componentId: string; revisionId?: string | null }): string {
  return ref.revisionId ? `${ref.componentId}@${ref.revisionId}` : ref.componentId;
}

/** Each part's model by `partKey`; null when it has none (or none is converted yet). */
export function usePartModels(refs: readonly { componentId: string; revisionId?: string | null }[]): ReadonlyMap<string, PartModel | null> {
  const wanted = useMemo(() => {
    const unique = new Map(refs.map((ref) => [partKey(ref), ref]));
    return [...unique.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }, [refs]);
  const wantedKey = wanted.map(([key]) => key).join(" ");
  const [models, setModels] = useState<ReadonlyMap<string, PartModel | null>>(() => new Map());

  useEffect(() => {
    let live = true;
    const ask = async ([key, ref]: (typeof wanted)[number]) => {
      const query = ref.revisionId ? `?revisionId=${encodeURIComponent(ref.revisionId)}` : "";
      const docs = await fetchJson<{ items: ModelDoc[] }>(`/api/catalog/components/${encodeURIComponent(ref.componentId)}/models${query}`, undefined, "Failed to read a part's 3D model")
        .catch(() => ({ items: [] }));
      return [key, partModel(docs.items)] as const;
    };
    void Promise.all(wanted.map(ask)).then((entries) => {
      if (live) setModels(new Map(entries));
    });
    return () => {
      live = false;
    };
    // `wantedKey` stands for `wanted`: ask again only when the parts change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey]);
  return models;
}
