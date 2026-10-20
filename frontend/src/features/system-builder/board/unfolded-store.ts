/**
 * Which connectors a user unfolded, per system and board (CONTRACTS §14.1:
 * per user and per system, kept with the open tabs, not in the document).
 * Browser storage is a convenience: it may be unavailable, and then nothing
 * is remembered.
 */
const key = (systemId: string, occurrence: string) => `prism.system-builder.unfolded.${systemId}.${occurrence}`;

export function readUnfolded(systemId: string, occurrence: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key(systemId, occurrence));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeUnfolded(systemId: string, occurrence: string, unfolded: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(key(systemId, occurrence), JSON.stringify([...unfolded].sort()));
  } catch {
    // Storage unavailable: the choice lasts until the page closes.
  }
}
