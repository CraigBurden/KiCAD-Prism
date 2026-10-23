// Build the <prism-semantic-viewer> element for the pixel-diff runner from one
// of three sources, without touching the served copy in frontend/public:
//   - a built file:       path ending in .js (e.g. ../frontend/public/prism-semantic-viewer.js)
//   - the working tree:   "worktree" (this checkout's viewer/src, uncommitted changes included)
//   - a git ref:          anything else (e.g. origin/dev, a1b2c3d), via `git archive`
// The esbuild flags match package.json's build:element.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const viewerRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const esbuild = join(viewerRoot, "node_modules/.bin/esbuild");

const ESBUILD_FLAGS = [
  "--bundle",
  "--minify",
  "--format=esm",
  "--platform=browser",
  "--loader:.css=text",
  "--external:node:fs",
  "--external:node:path",
];

export function buildElement(spec, outFile) {
  mkdirSync(dirname(outFile), { recursive: true });
  if (spec.endsWith(".js")) {
    copyFileSync(resolve(spec), outFile);
    return { spec, source: resolve(spec) };
  }
  if (!existsSync(esbuild)) throw new Error(`esbuild not found at ${esbuild}; run npm ci in kicad-prism-viewer`);
  if (spec === "worktree") {
    esbuildElement(viewerRoot, outFile);
    return { spec, source: "worktree", commit: git(["rev-parse", "--short", "HEAD"]), dirty: git(["status", "--porcelain", "viewer/src"]) !== "" };
  }
  const commit = git(["rev-parse", "--short", `${spec}^{commit}`]);
  const scratch = mkdtempSync(join(tmpdir(), "vt-element-"));
  try {
    const prefix = git(["rev-parse", "--show-prefix"]); // kicad-prism-viewer/ inside the Prism repo
    const top = git(["rev-parse", "--show-toplevel"]);
    const archive = execFileSync("git", ["archive", "--format=tar", commit, `${prefix}viewer`], { cwd: top, maxBuffer: 1 << 30 });
    execFileSync("tar", ["-x", "-C", scratch], { input: archive });
    const root = join(scratch, prefix);
    symlinkSync(join(viewerRoot, "node_modules"), join(root, "node_modules"));
    esbuildElement(root, outFile);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return { spec, source: "git", commit };
}

function esbuildElement(root, outFile) {
  execFileSync(esbuild, ["viewer/src/element-entry.js", ...ESBUILD_FLAGS, `--outfile=${outFile}`, "--log-level=warning", "--log-override:empty-import-meta=silent"], {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
  });
  // The analytic board's lowering worker and WASM are served beside the
  // element, as frontend/public serves them (sync-served-element.mjs).
  const beside = dirname(outFile);
  if (existsSync(join(root, "viewer/src/analytic-lower-worker.js"))) {
    execFileSync(esbuild, ["viewer/src/analytic-lower-worker.js", ...ESBUILD_FLAGS, `--outfile=${join(beside, "prism-semantic-viewer-lower.js")}`, "--log-level=warning", "--log-override:empty-import-meta=silent"], {
      cwd: root,
      stdio: ["ignore", "inherit", "inherit"],
    });
  }
  const wasm = join(root, "viewer/vendor/prism-kicad-wasm/prism_kicad_analytic_bg.wasm");
  if (existsSync(wasm)) copyFileSync(wasm, join(beside, "prism-kicad-analytic.wasm"));
}

function git(args) {
  return execFileSync("git", args, { cwd: viewerRoot, encoding: "utf8" }).trim();
}
