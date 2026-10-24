// Shader feature variants (VT-01).
//
// New render features (clip plane, attribute buffers, order-independent
// transparency) change shaders, but the default view must stay byte-identical:
// even an identity change in the position path reorders float evaluation, and
// copper, mask and silkscreen 18 µm apart then trade places in the depth test.
// So a feature never edits a base shader. Each shader source carries marker
// lines at fixed hook points; `buildVariant` fills them with the active
// features' code, and with no features it only removes the markers, which
// gives back the original shader text byte for byte (renderer tests pin the
// hashes).
//
// Hooks, each a whole line `// @feature:<hook>` that appears exactly once:
//   decl       module scope, before the vertex input struct: bindings, structs, functions
//   vs-out     inside the vertex output struct: extra fields (use @location(8) and up)
//   vs-end     the last statement of the vertex shader, before `return output;`
//   fs-begin   the first statement of the fragment shader (e.g. a discard)
//   fs-return  the line before the fragment shader's final `return <expr>;`, which
//              features wrap: fsReturn(expr, ctx) → a new expression
//
// A feature is `{ name, decl?, vsOut?, vsEnd?, fsBegin?, fsReturn? }`, each
// optional hook a function of the variant context `ctx`:
//   family     main | pick | barrel | barrelPick | component | componentPick | box | boxPick
//   instanced  true for the occurrence-instanced (system) shaders
//   output     "color" or "pick" (rg32uint ids)
//   world      a WGSL expression for the vertex's scene-space position, valid at vs-end
// Hook code is inserted as written (bring your own indentation).

export const HOOKS = Object.freeze(["decl", "vs-out", "vs-end", "fs-begin", "fs-return"]);

const HOOK_KEYS = { decl: "decl", "vs-out": "vsOut", "vs-end": "vsEnd", "fs-begin": "fsBegin" };
const MARKER_LINES = /^[ \t]*\/\/ @feature:[a-z-]+\n/gm;

// The marker line for a hook, for writing shader sources.
export function hook(name) {
  if (!HOOKS.includes(name)) throw new Error(`Unknown shader hook ${name}`);
  return `// @feature:${name}\n`;
}

// The shader with every marker line removed: the original text.
export function stripHooks(source) {
  return source.replace(MARKER_LINES, "");
}

// A stable name for a feature set: sorted names joined by "+", "" for none.
export function featureKey(features) {
  return sortedFeatures(features).map((feature) => feature.name).join("+");
}

export function sortedFeatures(features = []) {
  const names = new Set();
  for (const feature of features) {
    if (!feature?.name || !/^[a-z][a-z0-9-]*$/.test(feature.name)) throw new Error(`Bad shader feature name ${feature?.name}`);
    if (names.has(feature.name)) throw new Error(`Shader feature ${feature.name} given twice`);
    names.add(feature.name);
  }
  return [...features].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// Check that a source has every hook exactly once, and that fs-return sits on
// a `return ...;` line. Throws naming the first problem.
export function checkHooks(source, label = "shader") {
  for (const name of HOOKS) {
    const count = markerMatches(source, name).length;
    if (count !== 1) throw new Error(`${label}: hook ${name} appears ${count} times, expected once`);
  }
  returnLine(source, label);
}

// Build a shader for a set of features. With none, the original text.
export function buildVariant(source, features = [], ctx = {}) {
  const ordered = sortedFeatures(features);
  if (!ordered.length) return stripHooks(source);
  const label = `${ctx.family || "shader"}${ctx.instanced ? " (instanced)" : ""}`;
  checkHooks(source, label);
  let code = source;
  for (const name of HOOKS) {
    if (name === "fs-return") {
      const { start, end, indent, expression } = returnLine(code, label);
      const wrapped = ordered.reduce((expr, feature) => (feature.fsReturn ? feature.fsReturn(expr, ctx) : expr), expression);
      code = `${code.slice(0, start)}${indent}return ${wrapped};\n${code.slice(end)}`;
      continue;
    }
    const key = HOOK_KEYS[name];
    const parts = ordered.map((feature) => feature[key]?.(ctx)).filter(Boolean);
    const [match] = markerMatches(code, name);
    const insert = parts.map((part) => (part.endsWith("\n") ? part : `${part}\n`)).join("");
    code = `${code.slice(0, match.index)}${insert}${code.slice(match.index + match[0].length)}`;
  }
  return stripHooks(code);
}

function markerMatches(source, name) {
  return [...source.matchAll(new RegExp(`^[ \\t]*// @feature:${name}\\n`, "gm"))];
}

// The fs-return marker and the `return <expr>;` line after it.
function returnLine(source, label) {
  const [match] = markerMatches(source, "fs-return");
  const after = match.index + match[0].length;
  const next = source.slice(after).match(/^([ \t]*)return (.+);\n/);
  if (!next) throw new Error(`${label}: hook fs-return is not followed by a return line`);
  return { start: match.index, end: after + next[0].length, indent: next[1], expression: next[2] };
}
