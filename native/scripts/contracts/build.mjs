#!/usr/bin/env node
// Build the staged contracts: compile tsp/prism/main.tsp, lint every file
// under tsp/prism against conventions.md, write the JSON Schemas into
// generated/schema/ (after clearing the Prism schemas there), and validate
// every examples/<RootModel>.example.json against generated/schema/<RootModel>.json.
// Every root schema needs an example and every example needs a root schema.
//
//   node scripts/build.mjs                  build: clear, emit, lint, validate
//   node scripts/build.mjs --check          no writes: emit to a temp dir, lint,
//                                           fail if generated/schema is stale,
//                                           validate examples
//   node scripts/build.mjs --validate-only  no compile: validate examples
//                                           against generated/schema as it is
//   --compare-typespec <node_modules>       also compile with another TypeSpec
//                                           install and require identical schemas
//   --stage <dir>                           build another staging tree (tests)
//
// Only files whose $id starts with urn:prism:schema: count as Prism schemas,
// so the same script keeps working when generated/schema is shared with the
// fork's kicad_monkey schemas after WP-F1.
//
// Exit status: 0 success, 1 a check failed, 2 usage or tool error.

import fs from "node:fs";
import path from "node:path";

import {
  STAGE_DEFAULT,
  layout,
  URN_PREFIX,
  compareSchemaDirs,
  compileWithEmit,
  compileWithOtherToolchain,
  compilerVersion,
  exampleStyleNotes,
  fail,
  formatFindings,
  lintProgram,
  listTspFiles,
  makeAjv,
  makeTempDir,
  readJsonFile,
  readSchemas,
  realpath,
  rel,
  removeDir,
  validateDocument,
} from "./lib/contracts.mjs";

const USAGE =
  "usage: node scripts/build.mjs [--check | --validate-only] [--compare-typespec <node_modules>] [--stage <dir>]";
const EXAMPLE_RE = /^([A-Za-z][A-Za-z0-9]*)\.example\.json$/;

function parseArgs(argv) {
  const args = { mode: "build", compare: undefined, stage: STAGE_DEFAULT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw fail(`${a} needs a value\n${USAGE}`);
      return v;
    };
    if (a === "--check") args.mode = args.mode === "build" ? "check" : fail(USAGE);
    else if (a === "--validate-only") args.mode = args.mode === "build" ? "validate" : fail(USAGE);
    else if (a === "--compare-typespec") args.compare = value();
    else if (a === "--stage") args.stage = path.resolve(value());
    else if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else throw fail(`unknown argument ${a}\n${USAGE}`);
  }
  if (typeof args.mode !== "string") throw args.mode;
  if (args.compare && args.mode === "validate") throw fail("--compare-typespec needs a compile; drop --validate-only");
  return args;
}

/** Delete the Prism-owned schema files in `dir`; leave anything else alone. */
function clearPrismSchemas(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const removed = [];
  for (const s of readSchemas(dir, { prismOnly: true })) {
    fs.rmSync(s.path);
    removed.push(s.file);
  }
  return removed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stage = args.stage;
  const generated = layout(stage).generated;
  const examplesDir = layout(stage).examples;
  const entry = path.join(layout(stage).tsp, "main.tsp");
  if (!fs.existsSync(entry)) throw fail(`missing ${entry}`);

  let failed = 0;
  const line = (label, status, detail = "") =>
    console.log(`  ${label.padEnd(30, ".")} ${status}${detail ? ` ${detail}` : ""}`);
  const tmp = args.mode === "validate" ? undefined : makeTempDir(stage, "build");
  try {
    console.log(
      `build (${args.mode}) ${stage} (TypeSpec ${compilerVersion()}, Node ${process.version})`,
    );
    let schemas;

    if (args.mode === "validate") {
      schemas = readSchemas(generated, { prismOnly: true });
      line("generated/schema", "read", `${schemas.length} Prism root schema(s)`);
    } else {
      if (args.mode === "build") {
        const removed = clearPrismSchemas(generated);
        line("clear generated/schema", "ok", `${removed.length} file(s) removed`);
      }
      const emitDir = path.join(tmp, "schema");
      const { program, diagnostics } = await compileWithEmit(stage, entry, emitDir);
      if (diagnostics.length) {
        line("compile tsp/prism/main.tsp", "FAIL", `${diagnostics.length} diagnostic(s)`);
        for (const d of diagnostics) console.log(`      ${d}`);
        console.log("RESULT: FAIL (nothing written)");
        return 1;
      }
      schemas = readSchemas(emitDir);
      line("compile tsp/prism/main.tsp", "ok", `${schemas.length} root schema(s)`);

      // Every file under tsp/prism is reachable from main.tsp and passes lint.
      const files = listTspFiles(stage);
      const compiled = new Set([...program.sourceFiles.keys()].map(realpath));
      const unreachable = files.filter((f) => !compiled.has(realpath(f)));
      const { findings } = lintProgram(
        program,
        files.filter((f) => !unreachable.includes(f)),
        { stage },
      );
      for (const f of unreachable) {
        findings.push({
          file: rel(stage, f),
          line: 0,
          rule: "main-imports",
          message: "not imported (directly or indirectly) by tsp/prism/main.tsp",
        });
      }
      const ids = new Map();
      for (const s of schemas) {
        if (!s.id.startsWith(URN_PREFIX)) findings.push({ file: s.file, line: 0, rule: "root-id", message: `$id ${s.id} is not a ${URN_PREFIX} id` });
        if (ids.has(s.id)) findings.push({ file: s.file, line: 0, rule: "root-id", message: `$id ${s.id} also used by ${ids.get(s.id)}` });
        ids.set(s.id, s.file);
      }
      if (findings.length) {
        line("conventions", "FAIL", `${findings.length} finding(s)`);
        for (const f of formatFindings(findings)) console.log(`      ${f}`);
        console.log("RESULT: FAIL (nothing written)");
        return 1;
      }
      line("conventions", "ok", `${files.length} file(s)`);

      if (args.mode === "build") {
        fs.mkdirSync(generated, { recursive: true });
        for (const s of schemas) fs.copyFileSync(s.path, path.join(generated, s.file));
        line("write generated/schema", "ok", `${schemas.length} file(s)`);
        schemas = readSchemas(generated, { prismOnly: true });
      } else {
        const committed = path.join(tmp, "committed");
        fs.mkdirSync(committed);
        for (const s of readSchemas(generated, { prismOnly: true })) fs.copyFileSync(s.path, path.join(committed, s.file));
        const differences = compareSchemaDirs(emitDir, committed, ["fresh build", "generated/schema"]);
        if (differences.length) {
          line("generated/schema up to date", "FAIL", "run node scripts/build.mjs");
          for (const d of differences) console.log(`      ${d}`);
          failed++;
        } else {
          line("generated/schema up to date", "ok");
        }
      }

      if (args.compare) {
        const other = compileWithOtherToolchain(stage, entry, args.compare, path.join(tmp, "other"));
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
    }

    // ajv strict accepts every schema.
    const { ajv, problems } = makeAjv(schemas);
    if (problems.length) {
      line("ajv strict (draft 2020-12)", "FAIL");
      for (const p of problems) console.log(`      ${p}`);
      failed++;
    } else {
      line("ajv strict (draft 2020-12)", "ok");
    }

    // Examples: one per root, nothing else.
    const exampleFiles = fs.existsSync(examplesDir) ? fs.readdirSync(examplesDir).sort() : [];
    const examples = new Map();
    for (const f of exampleFiles) {
      if (f === ".gitkeep") continue;
      const m = EXAMPLE_RE.exec(f);
      if (!m) {
        console.log(`      examples/${f}: unexpected file; examples are named <RootModel>.example.json`);
        failed++;
        continue;
      }
      examples.set(m[1], path.join(examplesDir, f));
    }
    const roots = new Map(schemas.map((s) => [s.model, s]));
    for (const model of roots.keys()) {
      if (!examples.has(model)) {
        console.log(`      ${model}: root schema has no examples/${model}.example.json`);
        failed++;
      }
    }
    for (const model of examples.keys()) {
      if (!roots.has(model)) {
        console.log(`      examples/${model}.example.json: no generated/schema/${model}.json`);
        failed++;
      }
    }
    let passed = 0;
    for (const [model, file] of examples) {
      const schema = roots.get(model);
      if (!schema) continue;
      let parsed;
      try {
        parsed = readJsonFile(file);
      } catch (error) {
        console.log(`  FAIL ${rel(stage, file)}: not JSON: ${error.message}`);
        failed++;
        continue;
      }
      const result = validateDocument(ajv, schema, parsed.json);
      if (result.ok) {
        passed++;
        console.log(`  PASS ${rel(stage, file)}`);
      } else {
        console.log(`  FAIL ${rel(stage, file)}`);
        for (const e of result.errors) console.log(`      ${e}`);
        failed++;
      }
      for (const n of exampleStyleNotes(parsed.text, parsed.json)) console.log(`      note: ${n}`);
    }
    line("examples", failed ? "see above" : "ok", `${passed} of ${examples.size} valid; ${roots.size} root(s), ${examples.size} example(s)`);

    console.log(failed ? `RESULT: FAIL (${failed} problem(s))` : "RESULT: PASS");
    return failed ? 1 : 0;
  } finally {
    removeDir(tmp);
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error.isUsage ? error.message : error.stack ?? String(error));
    process.exit(2);
  },
);
