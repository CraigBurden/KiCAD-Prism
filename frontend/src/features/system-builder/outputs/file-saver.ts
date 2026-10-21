/**
 * Saving outputs in the browser (CONTRACTS §16.7, §17): hand bytes the caller
 * already fetched to a download, and name the document export the way the
 * backend names its repository files.
 */

/** Hand an already-fetched file to the browser as a download. */
export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

/** Save a value as pretty-printed JSON. */
export function saveJson(value: unknown, filename: string): void {
  saveBlob(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), filename);
}

/** A system name as a lower-case kebab-case filename component, as the backend's `git_link.slug` does. */
export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "system";
}
