#!/usr/bin/env node
// Fails when a bundle's inlined wasm (Emscripten SINGLE_FILE, raw-byte or base64) no longer compiles.
//
// esbuild writes the module's binary string as a template literal holding raw
// tab, space and newline bytes, so any text normalisation of a built bundle
// (trailing-whitespace stripping, line-ending conversion) silently corrupts
// it. The viewer then logs "wasm triangulation unavailable" and falls back to
// JS earcut. Run on every published bundle that inlines wasm.
//
//   node scripts/check-embedded-wasm.mjs frontend/public/ecad-viewer.js ...

import fs from "node:fs";

const CALL = /function [\w$]+\(\)\{return [\w$]+\((["'`])/g;

function literalEnd(source, start, quote) {
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === "\\") i++;
    else if (source[i] === quote) return i;
  }
  return -1;
}

function decode(text) {
  // Emscripten's binaryDecode: one byte per UTF-16 code unit.
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    bytes[i] = ~c >> 8 & c;
  }
  return bytes;
}

function embeddedModules(source) {
  const found = [];
  for (const match of source.matchAll(CALL)) {
    const start = match.index + match[0].length - 1;
    const end = literalEnd(source, start, match[1]);
    if (end < 0) continue;
    let text;
    try {
      text = new Function(`return ${source.slice(start, end + 1)}`)();
    } catch {
      continue;
    }
    if (typeof text !== "string") continue;
    if (text.startsWith("\0asm")) found.push(decode(text));
    // SINGLE_FILE_BINARY_ENCODE=0 (ecad-viewer since krishna-swaroop/ecad-viewer#69): base64.
    else if (text.startsWith("AGFzbQ")) found.push(new Uint8Array(Buffer.from(text, "base64")));
  }
  return found;
}

let failed = false;
for (const file of process.argv.slice(2)) {
  const source = fs.readFileSync(file, "utf8");
  const modules = embeddedModules(source);
  if (source.includes("findWasmBinary") && modules.length === 0) {
    console.error(`${file}: inlines wasm, but no module could be read back`);
    failed = true;
  }
  for (const bytes of modules) {
    try {
      new WebAssembly.Module(bytes);
      console.log(`${file}: embedded wasm OK (${bytes.length} bytes)`);
    } catch (error) {
      console.error(`${file}: embedded wasm is corrupt: ${error.message}`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
