// Harness tube picking (System Builder 4c): a click within a few pixels of a
// tube's centre line, or inside its drawn radius, picks it. Tubes are thin and
// few, so this runs on the CPU against the projected samples; the nearest
// segment on screen wins.

/** Closest point on the screen segment a–b to p: `{t, distance}`. */
function nearestOnSegment(a, b, p) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)) : 0;
  return { t, distance: Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]) };
}

/**
 * The tube under screen point `point`, or null.
 * `tubes` are `{samplesMm (flat), radiusMm}`; `project(mm)` gives `[x, y]` in
 * the same pixels as `point` (null behind the camera); `pxPerMm(mm)` the scale
 * there. Returns `{index, sample, t, pointMm, distancePx}`: the tube, the
 * sample starting the hit span, the fraction along it, and the world point.
 */
export function pickTube(tubes, point, project, pxPerMm, slackPx = 5) {
  let best = null;
  tubes.forEach((tube, index) => {
    const s = tube.samplesMm;
    const count = Math.floor(s.length / 3);
    let previous = count ? project([s[0], s[1], s[2]]) : null;
    for (let i = 0; i + 1 < count; i += 1) {
      const at = [s[i * 3 + 3], s[i * 3 + 4], s[i * 3 + 5]];
      const next = project(at);
      if (previous && next) {
        const { t, distance } = nearestOnSegment(previous, next, point);
        const hit = [0, 1, 2].map((k) => s[i * 3 + k] + t * (at[k] - s[i * 3 + k]));
        const reach = slackPx + tube.radiusMm * pxPerMm(hit);
        if (distance <= reach && (!best || distance < best.distancePx)) {
          best = { index, sample: i, t, pointMm: hit, distancePx: distance };
        }
      }
      previous = next;
    }
  });
  return best;
}

/** Arc length along a tube's samples to (sample, t), in mm. */
export function arcTo(samplesMm, sample, t) {
  let length = 0;
  const point = (i) => [samplesMm[i * 3], samplesMm[i * 3 + 1], samplesMm[i * 3 + 2]];
  for (let i = 0; i < sample; i += 1) {
    const a = point(i);
    const b = point(i + 1);
    length += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  const a = point(sample);
  const b = point(sample + 1);
  return length + t * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}
