// Harness tubes (System Builder 4c, CONTRACTS §16.6): the CPU side.
//
// The host sends ready polylines (world mm); this module packs them for the GPU.
// The GPU builds the mesh (tube-renderer.js): a compute pass gives every sample
// a rotation-minimising frame by the double-reflection method (Wang et al.
// 2008), one invocation per segment walking its samples, and a second pass
// writes the rings. This module packs the tubes into the buffers those passes
// read, builds the index buffer (it depends only on sample counts), and keeps a
// CPU reference of the frames and rings for the tests to check the WGSL against.

export const RING_SEGMENTS = 12;
const MM = 0.001; // descriptor millimetres → renderer metres

/** Vertices of one tube: a ring per sample, then the two cap centres. */
export function tubeVertexCount(sampleCount) {
  return sampleCount * RING_SEGMENTS + 2;
}

/**
 * Pack `tubes` (`{samplesMm, radiusMm}`, samples flat in mm) for the GPU.
 * Returns `samples` (vec4 per sample, metres), `segments` (8 words per tube:
 * start, count, vertexStart, colour index, radius as float bits, padding),
 * `indices` and the totals. Tubes with fewer than two samples are skipped;
 * `kept` lists the input indices that were packed, in order (colour index i).
 */
export function packTubes(tubes) {
  const kept = [];
  let sampleTotal = 0;
  let vertexTotal = 0;
  let indexTotal = 0;
  for (let i = 0; i < tubes.length; i += 1) {
    const count = Math.floor(tubes[i].samplesMm.length / 3);
    if (count < 2) continue;
    kept.push(i);
    sampleTotal += count;
    vertexTotal += tubeVertexCount(count);
    indexTotal += (count - 1) * RING_SEGMENTS * 6 + 2 * RING_SEGMENTS * 3;
  }
  const samples = new Float32Array(Math.max(sampleTotal, 1) * 4);
  const segmentWords = new ArrayBuffer(Math.max(kept.length, 1) * 32);
  const segmentU32 = new Uint32Array(segmentWords);
  const segmentF32 = new Float32Array(segmentWords);
  const indices = new Uint32Array(Math.max(indexTotal, 3));
  let sampleAt = 0;
  let vertexAt = 0;
  let indexAt = 0;
  kept.forEach((tubeIndex, slot) => {
    const tube = tubes[tubeIndex];
    const count = Math.floor(tube.samplesMm.length / 3);
    for (let s = 0; s < count; s += 1) {
      samples[(sampleAt + s) * 4] = tube.samplesMm[s * 3] * MM;
      samples[(sampleAt + s) * 4 + 1] = tube.samplesMm[s * 3 + 1] * MM;
      samples[(sampleAt + s) * 4 + 2] = tube.samplesMm[s * 3 + 2] * MM;
    }
    segmentU32[slot * 8] = sampleAt;
    segmentU32[slot * 8 + 1] = count;
    segmentU32[slot * 8 + 2] = vertexAt;
    segmentU32[slot * 8 + 3] = slot;
    segmentF32[slot * 8 + 4] = tube.radiusMm * MM;
    const ring = (s, j) => vertexAt + s * RING_SEGMENTS + (j % RING_SEGMENTS);
    for (let s = 0; s + 1 < count; s += 1) {
      for (let j = 0; j < RING_SEGMENTS; j += 1) {
        indices.set([ring(s, j), ring(s + 1, j), ring(s + 1, j + 1), ring(s, j), ring(s + 1, j + 1), ring(s, j + 1)], indexAt);
        indexAt += 6;
      }
    }
    const startCap = vertexAt + count * RING_SEGMENTS;
    for (let j = 0; j < RING_SEGMENTS; j += 1) {
      indices.set([startCap, ring(0, j + 1), ring(0, j)], indexAt);
      indices.set([startCap + 1, ring(count - 1, j), ring(count - 1, j + 1)], indexAt + 3);
      indexAt += 6;
    }
    sampleAt += count;
    vertexAt += tubeVertexCount(count);
  });
  return { samples, segments: segmentU32, indices, kept, sampleCount: sampleTotal, vertexCount: vertexTotal, indexCount: indexTotal };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const normalize = (a) => {
  const length = Math.hypot(a[0], a[1], a[2]);
  return length > 1e-12 ? scale(a, 1 / length) : [0, 0, 1];
};

/** Unit tangents: central differences inside, one-sided at the ends (the WGSL does the same). */
export function tangents(points) {
  const n = points.length;
  return points.map((_, i) => normalize(sub(points[Math.min(i + 1, n - 1)], points[Math.max(i - 1, 0)])));
}

/** A unit vector perpendicular to `t`: crossed with the axis it is least aligned with. */
export function perpendicularTo(t) {
  const ax = Math.abs(t[0]);
  const ay = Math.abs(t[1]);
  const az = Math.abs(t[2]);
  const axis = ax <= ay && ax <= az ? [1, 0, 0] : ay <= az ? [0, 1, 0] : [0, 0, 1];
  return normalize(cross(t, axis));
}

/** Rotation-minimising normals along `points` by double reflection (Wang et al. 2008). */
export function rmfNormals(points) {
  const t = tangents(points);
  const normals = [perpendicularTo(t[0])];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const v1 = sub(points[i + 1], points[i]);
    const c1 = dot(v1, v1);
    const r = normals[i];
    if (c1 < 1e-24) {
      normals.push(r);
      continue;
    }
    const rL = sub(r, scale(v1, (2 / c1) * dot(v1, r)));
    const tL = sub(t[i], scale(v1, (2 / c1) * dot(v1, t[i])));
    const v2 = sub(t[i + 1], tL);
    const c2 = dot(v2, v2);
    normals.push(normalize(c2 < 1e-24 ? rL : sub(rL, scale(v2, (2 / c2) * dot(v2, rL)))));
  }
  return normals;
}

/** One tube's vertices `{position, normal}` as the GPU writes them (rings, then the two cap centres). */
export function tubeVertices(points, radius) {
  const t = tangents(points);
  const r = rmfNormals(points);
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    const b = cross(t[i], r[i]);
    for (let j = 0; j < RING_SEGMENTS; j += 1) {
      const angle = (2 * Math.PI * j) / RING_SEGMENTS;
      const normal = [0, 1, 2].map((k) => Math.cos(angle) * r[i][k] + Math.sin(angle) * b[k]);
      out.push({ position: [0, 1, 2].map((k) => points[i][k] + radius * normal[k]), normal });
    }
  }
  out.push({ position: [...points[0]], normal: scale(t[0], -1) });
  out.push({ position: [...points[points.length - 1]], normal: t[points.length - 1] });
  return out;
}
