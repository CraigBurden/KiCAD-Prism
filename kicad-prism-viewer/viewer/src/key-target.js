/**
 * The viewer listens for keys on the whole window, so it shares them with the
 * host page. These helpers decide when a key is not the viewer's to take.
 */

/** The element a key event was typed into, looking through shadow roots. */
function keyTarget(event) {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  return path[0] ?? event.target ?? null;
}

/** True when the key was typed into a text field, text area, select, or editable element. */
export function isTypingTarget(event) {
  const target = keyTarget(event);
  if (!target || typeof target !== "object") return false;
  const tag = typeof target.tagName === "string" ? target.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable === true;
}

/** Cmd/Ctrl combinations belong to the browser and the OS (Cmd+Space, Cmd+R, Cmd+F). */
export function hasCommandModifier(event) {
  return Boolean(event.metaKey || event.ctrlKey);
}
