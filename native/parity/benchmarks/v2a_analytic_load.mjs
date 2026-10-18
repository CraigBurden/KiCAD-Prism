// V2a step 1: how long the spike's analytic renderer takes to put a bundle's pack on screen.
//
//   node v2a_analytic_load.mjs <viewer root (spike worktree's kicad-prism-viewer)> <mesh bundle dir> <board.kmpack> <reps> <out.json>
//
// Each rep: a fresh page; the element mounts the mesh bundle (the spike draws the
// analytic board in place of mesh copper, so it needs one); then, timed from the
// moment the pack is requested: fetch, loadAnalyticPack (open, worker lowering,
// GPU upload), and the first frame that differs afterwards. Headless Chrome on
// this Mac's GPU; the cache is disabled, the server is loopback.
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";

const [viewerRoot, boardArg, packFile, repsArg, outFile] = process.argv.slice(2);
const harness = join(viewerRoot, "tests/browser/pixel-diff");
const { buildElement } = await import(join(harness, "build-element.mjs"));
const { launchChrome } = await import(join(harness, "chrome.mjs"));
const boardDir = existsSync(join(boardArg, "bundle.json")) ? boardArg : join(boardArg, readdirSync(boardArg).find((c) => existsSync(join(boardArg, c, "bundle.json"))));
const buildDir = mkdtempSync(join(tmpdir(), "v2a-analytic-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cwd = process.cwd();
process.chdir(viewerRoot);
buildElement("worktree", join(buildDir, "candidate.js"));
process.chdir(cwd);
copyFileSync(join(viewerRoot, "viewer/vendor/prism-kicad-wasm/prism_kicad_analytic_bg.wasm"), join(buildDir, "prism-kicad-analytic.wasm"));

const roots = new Map([["harness", harness], ["builds", buildDir], ["bundle", boardDir]]);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".wasm": "application/wasm" };
const server = await new Promise((done) => {
  const s = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "");
    if (path === "pack/board.kmpack") {
      response.writeHead(200, { "content-type": "application/octet-stream", "cache-control": "no-store" });
      return void response.end(readFileSync(packFile));
    }
    const prefix = [...roots.keys()].find((key) => path.startsWith(`${key}/`));
    if (!prefix) return void response.writeHead(404).end();
    const root = roots.get(prefix);
    const file = resolve(root, path.slice(prefix.length + 1));
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return void response.writeHead(404).end();
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(readFileSync(file));
  });
  s.listen(0, "127.0.0.1", () => done({ origin: `http://127.0.0.1:${s.address().port}`, close: () => s.close() }));
});

const chrome = await launchChrome({ headless: true });
const runs = [];
try {
  for (let rep = 0; rep < Number(repsArg); rep += 1) {
    const page = await chrome.newPage({ width: 1280, height: 800, deviceScaleFactor: 1 });
    try {
      await page.goto(`${server.origin}/harness/harness.html?build=candidate`);
      for (let i = 0; i < 300 && !(await page.evaluate("window.__vtElementLoaded === true")); i += 1) await sleep(100);
      await page.evaluate(`window.__vtProbe.mount("/bundle/bundle.json", { width: 1280, height: 800 })`);
      await sleep(1500);
      const result = await page.evaluate(`(async () => {
        const frameHash = () => window.__vtProbe.frameStatus().hash;
        const before = frameHash();
        const t0 = performance.now();
        const bytes = await (await fetch("/pack/board.kmpack")).arrayBuffer();
        const fetched = performance.now();
        const stats = await window.__vtProbe.element.loadAnalyticPack(bytes, { wasm: "/builds/prism-kicad-analytic.wasm" });
        const attached = performance.now();
        let drawn = null;
        for (let i = 0; i < 600; i += 1) {
          await new Promise((r) => requestAnimationFrame(r));
          if (frameHash() !== before) { drawn = performance.now(); break; }
        }
        return JSON.stringify({ bytes: bytes.byteLength, fetchMs: +(fetched - t0).toFixed(1), attachMs: +(attached - fetched).toFixed(1),
          firstAnalyticFrameMs: drawn === null ? null : +(drawn - t0).toFixed(1), timings: stats?.timings ?? null,
          slices: stats?.slices ?? null, operations: stats?.operations ?? null });
      })()`);
      const run = JSON.parse(result);
      runs.push(run);
      console.log(`rep ${rep}: fetch ${run.fetchMs} ms, attach ${run.attachMs} ms, first analytic frame ${run.firstAnalyticFrameMs} ms`, JSON.stringify(run.timings));
      if (page.errors.length) console.log("page errors:", [...new Set(page.errors)].slice(0, 3).join(" | "));
    } finally {
      await page.close();
    }
  }
} finally {
  await chrome.close();
  server.close();
  rmSync(buildDir, { recursive: true, force: true });
  writeFileSync(outFile, `${JSON.stringify({ board: boardDir, pack: packFile, runs }, null, 1)}\n`);
}
