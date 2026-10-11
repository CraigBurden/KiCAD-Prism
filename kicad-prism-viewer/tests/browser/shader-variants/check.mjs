#!/usr/bin/env node
// VT-01 browser check: with shader features on, every draw pipeline family
// (main, mark, blend, mask, mask over copper, pick, barrel, barrel pick,
// component, component pick, box, box pick; one-board and instanced) compiles
// and validates on a real WebGPU device, through the renderer's own code path.
// The Node tests prove the WGSL text; only a GPU proves WGSL accepts it.
//
//   node tests/browser/shader-variants/check.mjs [--headed]
//
// Exit code 0 when every pipeline set is created with no validation error and
// no shader compilation message.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChrome } from "../pixel-diff/chrome.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const viewerRoot = resolve(here, "../../..");
const scratch = mkdtempSync(join(tmpdir(), "vt-shader-check-"));
const bundle = join(scratch, "page.js");
execFileSync(join(viewerRoot, "node_modules/.bin/esbuild"), [join(here, "page.js"), "--bundle", "--format=esm", `--outfile=${bundle}`, "--log-level=warning"], { stdio: "inherit" });

const server = createServer((request, response) => {
  if (request.url.startsWith("/page.js")) return void response.writeHead(200, { "content-type": "text/javascript" }).end(readFileSync(bundle));
  response.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><canvas id="c" width="64" height="64"></canvas><script type="module" src="/page.js"></script>');
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const chrome = await launchChrome({ headless: !process.argv.includes("--headed") });
let failed = true;
try {
  const page = await chrome.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  for (let waited = 0; !(await page.evaluate("Boolean(window.__vtShaderCheck)")); waited += 200) {
    if (waited > 30000) throw new Error(`check page did not load: ${page.errors.join(" | ")}`);
    await new Promise((wait) => setTimeout(wait, 200));
  }
  const result = await page.evaluate("window.__vtShaderCheck.run()");
  for (const row of result.rows) console.log(`${row.ok ? "ok  " : "FAIL"} ${row.set.padEnd(34)} ${row.pipelines} pipelines${row.errors.length ? `\n     ${row.errors.join("\n     ")}` : ""}`);
  const compileMessages = page.errors.filter((text) => /shader compilation|error \d+:\d+/i.test(text));
  for (const message of compileMessages) console.log(`     ${message}`);
  failed = !result.rows.every((row) => row.ok) || compileMessages.length > 0;
  console.log(failed ? "FAIL" : `PASS — ${result.rows.length} pipeline sets on ${result.adapter}`);
  await page.close();
} catch (error) {
  console.error(error);
} finally {
  await chrome.close();
  server.close();
  rmSync(scratch, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
