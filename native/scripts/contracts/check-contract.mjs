#!/usr/bin/env node
// Check one contract file: compile it (with its imports) and emit JSON Schema
// into a fresh temporary directory outside the repository, fail on any
// diagnostic, lint it against conventions.md, then validate each given JSON
// document against the named root model's emitted schema with ajv (draft
// 2020-12, strict, ajv-formats).
//
//   node scripts/check-contract.mjs <file.tsp>
//        [--json <doc.json> [--model <RootModel>]]...
//        [--compare-typespec <node_modules dir>] [--keep]
//
// --model may be omitted when the document's "schema" field names a root of
// the file. --compare-typespec also compiles with another TypeSpec install
// (for example the fork's 1.14.0 node_modules) and requires byte-identical
// schemas. --keep keeps the temporary directory and prints its path.
//
// Exit status: 0 all checks passed, 1 a check failed, 2 usage or tool error.

import fs from "node:fs";
import path from "node:path";

import {
  STAGE_DEFAULT,
  layout,
  compareSchemaDirs,
  compileWithEmit,
  compileWithOtherToolchain,
  compilerVersion,
  exampleStyleNotes,
  fail,
  formatFindings,
  isInside,
  lintProgram,
  makeAjv,
  makeTempDir,
  readJsonFile,
  readSchemas,
  rel,
  removeDir,
  validateDocument,
} from "./lib/contracts.mjs";

const USAGE =
  "usage: node scripts/check-contract.mjs <file.tsp> [--json <doc.json> [--model <RootModel>]]... [--compare-typespec <node_modules>] [--keep]";

function parseArgs(argv) {
  const args = { file: undefined, documents: [], compare: undefined, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw fail(`${a} needs a value\n${USAGE}`);
      return v;
    };
    if (a === "--json") args.documents.push({ path: path.resolve(value()), model: undefined });
    else if (a === "--model") {
      const last = args.documents.at(-1);
      if (!last || last.model !== undefined) throw fail(`--model must follow its --json\n${USAGE}`);
      last.model = value();
    } else if (a === "--compare-typespec") args.compare = value();
    else if (a === "--keep") args.keep = true;
    else if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (a.startsWith("--")) throw fail(`unknown option ${a}\n${USAGE}`);
    else if (!args.file) args.file = path.resolve(a);
    else throw fail(`one .tsp file per run\n${USAGE}`);
  }
  if (!args.file) throw fail(USAGE);
  if (!args.file.endsWith(".tsp")) throw fail(`${args.file} is not a .tsp file`);
  if (!fs.existsSync(args.file)) throw fail(`${args.file} does not exist`);
  for (const d of args.documents) if (!fs.existsSync(d.path)) throw fail(`${d.path} does not exist`);
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stage = STAGE_DEFAULT;
  const shown = rel(stage, args.file);
  const tmp = makeTempDir(stage, "check");
  let failed = 0;
  const line = (label, status, detail = "") =>
    console.log(`  ${label.padEnd(30, ".")} ${status}${detail ? ` ${detail}` : ""}`);
  try {
    console.log(`check-contract ${shown} (TypeSpec ${compilerVersion()}, Node ${process.version})`);
    if (!isInside(args.file, layout(stage).tsp)) {
      console.log(`  note: ${shown} is outside tsp/prism; compiled with the staging dir's tspconfig.yaml`);
    }

    // 1. Compile with emit into the temporary directory.
    const emitDir = path.join(tmp, "schema");
    const { program, diagnostics } = await compileWithEmit(stage, args.file, emitDir);
    if (diagnostics.length) {
      line("compile", "FAIL", `${diagnostics.length} diagnostic(s)`);
      for (const d of diagnostics) console.log(`      ${d}`);
      console.log("RESULT: FAIL");
      return 1;
    }
    const schemas = readSchemas(emitDir);
    line("compile", "ok", `${schemas.length} root schema(s)${schemas.length ? `: ${schemas.map((s) => s.model).join(", ")}` : ""}`);

    // 2. Lint the conventions for the declarations in this file.
    const { findings } = lintProgram(program, [args.file], { stage });
    if (findings.length) {
      line("conventions", "FAIL", `${findings.length} finding(s)`);
      for (const f of formatFindings(findings)) console.log(`      ${f}`);
      failed++;
    } else {
      line("conventions", "ok");
    }

    // 3. Every emitted schema compiles under ajv strict.
    const { ajv, problems } = makeAjv(schemas);
    if (problems.length) {
      line("ajv strict (draft 2020-12)", "FAIL");
      for (const p of problems) console.log(`      ${p}`);
      failed++;
    } else if (schemas.length) {
      line("ajv strict (draft 2020-12)", "ok");
    }

    // 4. Optional: the same file under another TypeSpec install.
    if (args.compare) {
      const other = compileWithOtherToolchain(stage, args.file, args.compare, path.join(tmp, "other"));
      if (!other.ok) {
        line(`TypeSpec ${other.version} compile`, "FAIL");
        for (const l of other.output.trim().split("\n")) console.log(`      ${l}`);
        failed++;
      } else {
        const differences = compareSchemaDirs(emitDir, other.emitDir, [compilerVersion(), other.version]);
        if (differences.length) {
          line(`TypeSpec ${other.version} output`, "FAIL", "schemas differ");
          for (const d of differences) console.log(`      ${d}`);
          failed++;
        } else {
          line(`TypeSpec ${other.version} output`, "ok", "byte-identical");
        }
      }
    }

    // 5. Validate the documents.
    const examplesDir = layout(stage).examples;
    for (const doc of args.documents) {
      const shownDoc = rel(stage, doc.path);
      let parsed;
      try {
        parsed = readJsonFile(doc.path);
      } catch (error) {
        console.log(`  FAIL ${shownDoc}: not JSON: ${error.message}`);
        failed++;
        continue;
      }
      let model = doc.model;
      if (!model) {
        const match = schemas.find((s) => s.schemaConst !== undefined && s.schemaConst === parsed.json?.schema);
        if (!match) {
          console.log(`  FAIL ${shownDoc}: no --model given and its "schema" (${JSON.stringify(parsed.json?.schema)}) names no root of ${shown}`);
          failed++;
          continue;
        }
        model = match.model;
      }
      const schema = schemas.find((s) => s.model === model);
      if (!schema) {
        console.log(`  FAIL ${shownDoc}: ${shown} has no root model ${model} (roots: ${schemas.map((s) => s.model).join(", ") || "none"})`);
        failed++;
        continue;
      }
      const result = validateDocument(ajv, schema, parsed.json);
      if (result.ok) {
        console.log(`  PASS ${shownDoc} (${model})`);
      } else {
        console.log(`  FAIL ${shownDoc} (${model})`);
        for (const e of result.errors) console.log(`      ${e}`);
        failed++;
      }
      if (isInside(doc.path, examplesDir)) {
        const expected = `${model}.example.json`;
        if (path.basename(doc.path) !== expected) {
          console.log(`      note: examples are named <RootModel>.example.json; expected ${expected}`);
        }
        for (const n of exampleStyleNotes(parsed.text, parsed.json)) console.log(`      note: ${n}`);
      }
    }

    console.log(failed ? `RESULT: FAIL (${failed} check(s) failed)` : "RESULT: PASS");
    return failed ? 1 : 0;
  } finally {
    if (args.keep) console.log(`kept ${tmp}`);
    else removeDir(tmp);
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error.isUsage ? error.message : error.stack ?? String(error));
    process.exit(2);
  },
);
