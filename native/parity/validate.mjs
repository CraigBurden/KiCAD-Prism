// Validate goldens (or bundle members) against the frozen contracts.
//
//   node parity/validate.mjs [--quiet] <file-or-directory>...      (from native/, Node 24.22.0)
//
// Every JSON file whose top-level `schema` equals a contract root's `schema`
// const is validated with ajv 2020-12 (strict), with every schema of
// contracts/generated/schema registered, as scripts/contracts/ does. It needs
// only `ajv` (in native/package-lock.json through TypeSpec); ajv-formats is
// added when installed (no contract schema uses `format`).
// Other JSON (capture.json, sidecars, divergence files) is skipped and counted.
// Exit status: 0 all valid, 1 any invalid, 2 usage or tool error.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const NATIVE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_DIR = path.join(NATIVE, "contracts", "generated", "schema");

function walk(target, out) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target).sort()) walk(path.join(target, name), out);
  } else if (target.endsWith(".json")) {
    out.push(target);
  }
}

function readSchemas(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      return { file, model: file.slice(0, -5), id: json.$id, schemaConst: json?.properties?.schema?.const, json };
    });
}

async function makeAjv(schemas) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  try {
    const { default: addFormats } = await import("ajv-formats");
    addFormats(ajv);
  } catch {
    // not installed: no contract schema uses `format`
  }
  const problems = [];
  for (const s of schemas) {
    try {
      ajv.addSchema(s.json);
    } catch (error) {
      problems.push(`${s.file}: ajv rejects the schema: ${error.message}`);
    }
  }
  return { ajv, problems };
}

function describe(error) {
  const where = error.instancePath || "(root)";
  if (error.keyword === "not" && /\/unevaluatedProperties\/not$/.test(error.schemaPath)) {
    return `${where}: property not allowed (objects are sealed)`;
  }
  if (error.keyword === "const") return `${where}: must equal ${JSON.stringify(error.params.allowedValue)}`;
  if (error.keyword === "enum") return `${where}: must be one of ${JSON.stringify(error.params.allowedValues)}`;
  if (error.keyword === "required") return `${where}: missing required property "${error.params.missingProperty}"`;
  return `${where}: ${error.message}`;
}

function validateDocument(ajv, schema, document, maxErrors = 25) {
  const validate = ajv.getSchema(schema.id);
  if (!validate) return { ok: false, errors: [`no compiled schema for ${schema.id}`] };
  if (validate(document)) return { ok: true, errors: [] };
  const errors = [...new Set((validate.errors ?? []).map(describe))];
  if (errors.length > maxErrors) errors.splice(maxErrors, errors.length - maxErrors, `... ${errors.length - maxErrors} more`);
  return { ok: false, errors };
}

async function main(argv) {
  const quiet = argv.includes("--quiet");
  const targets = argv.filter((a) => a !== "--quiet");
  if (targets.length === 0) {
    console.error("usage: node parity/validate.mjs [--quiet] <file-or-directory>...");
    return 2;
  }
  const schemas = readSchemas(SCHEMA_DIR);
  const { ajv, problems } = await makeAjv(schemas);
  if (problems.length) {
    for (const p of problems) console.error(p);
    return 2;
  }
  const byConst = new Map(schemas.filter((s) => typeof s.schemaConst === "string").map((s) => [s.schemaConst, s]));
  const files = [];
  for (const t of targets) walk(path.resolve(t), files);
  let valid = 0;
  let invalid = 0;
  let skipped = 0;
  for (const file of files) {
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      console.log(`FAIL ${file}: not JSON: ${error.message}`);
      invalid++;
      continue;
    }
    const schema = doc && typeof doc === "object" && !Array.isArray(doc) ? byConst.get(doc.schema) : undefined;
    if (!schema) {
      skipped++;
      continue;
    }
    const result = validateDocument(ajv, schema, doc);
    if (result.ok) {
      valid++;
      if (!quiet) console.log(`PASS ${path.relative(process.cwd(), file)} (${schema.model})`);
    } else {
      invalid++;
      console.log(`FAIL ${path.relative(process.cwd(), file)} (${schema.model})`);
      for (const e of result.errors) console.log(`    ${e}`);
    }
  }
  console.log(`validate: ${valid} valid, ${invalid} invalid, ${skipped} skipped (no contract schema)`);
  return invalid ? 1 : 0;
}

process.exitCode = await main(process.argv.slice(2));
