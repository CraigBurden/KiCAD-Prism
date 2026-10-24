// Shared machinery for check-contract.mjs and build.mjs: compile TypeSpec
// with emit into a temporary directory, lint the conventions in
// conventions.md, and validate JSON documents against the emitted schemas.
//
// Node 24 ESM. Runs offline against the node_modules beside this directory.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as tsp from "@typespec/compiler";
import { SyntaxKind } from "@typespec/compiler/ast";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const STAGE_DEFAULT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * Where a contract root keeps its parts. In `native/` (after WP-F1) the
 * TypeSpec is in src/tsp/prism, the examples and docs in contracts/prism and
 * the JSON Schemas in contracts/generated/schema, shared with the fork's. A
 * self-contained tree (tsp/prism, examples, generated/schema side by side),
 * as the W0 staging directory and the scripts' own tests use, still works.
 */
export function layout(stage) {
  if (fs.existsSync(path.join(stage, "src", "tsp", "prism"))) {
    return {
      tsp: path.join(stage, "src", "tsp", "prism"),
      examples: path.join(stage, "contracts", "prism", "examples"),
      generated: path.join(stage, "contracts", "generated", "schema"),
    };
  }
  return {
    tsp: path.join(stage, "tsp", "prism"),
    examples: path.join(stage, "examples"),
    generated: path.join(stage, "generated", "schema"),
  };
}
export const URN_PREFIX = "urn:prism:schema:";
export const COMMON_NAMESPACE = "Prism.Contracts.Common";
export const CONTRACT_NAMESPACE_PREFIX = "Prism.Contracts.";

/** `<stem>-<version>.tsp`, stem in kebab-case, version a<N> or v<N>. */
export const CONTRACT_FILE_RE = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-([av](?:0|[1-9][0-9]*))\.tsp$/;
/** `prism.<name>.<version>`, name in dot/underscore-separated lowercase. */
export const SCHEMA_ID_RE = /^prism\.([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*)\.([av](?:0|[1-9][0-9]*))$/;

/** TypeSpec standard scalars a contract may use; everything else is rejected. */
const ALLOWED_STD_SCALARS = new Set([
  "string",
  "boolean",
  "safeint",
  "int32",
  "int16",
  "int8",
  "uint32",
  "uint16",
  "uint8",
  "float64",
  "url",
]);
const STD_SCALAR_ADVICE = {
  int64: "the emitter writes int64 as a JSON string; use safeint (or int32)",
  uint64: "the emitter writes uint64 as a JSON string; use safeint with @minValue(0), or Count/ByteCount",
  integer: "unbounded; use safeint or int32",
  numeric: "unbounded; use float64 or safeint",
  float: "use float64",
  float32: "use float64",
  decimal: "use float64, or integer nanometres for lengths",
  decimal128: "use float64",
  utcDateTime: "members carry no wall-clock time (conventions.md, Determinism)",
  offsetDateTime: "members carry no wall-clock time (conventions.md, Determinism)",
  plainDate: "members carry no wall-clock time (conventions.md, Determinism)",
  plainTime: "members carry no wall-clock time (conventions.md, Determinism)",
  duration: "use an integer millisecond field suffixed Ms/_ms",
  bytes: "binary data does not belong in a JSON member",
};

// --------------------------------------------------------------- utilities

export function fail(message) {
  const error = new Error(message);
  error.isUsage = true;
  return error;
}

export function realpath(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

export function isInside(child, parent) {
  const rel = path.relative(realpath(parent), realpath(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** A fresh directory under the OS temp dir; refuses to create one inside `stage`. */
export function makeTempDir(stage, label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `prism-contracts-${label}-`));
  if (isInside(dir, stage)) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw fail(`temporary directory ${dir} would be inside ${stage}; set TMPDIR outside the repository`);
  }
  return dir;
}

export function removeDir(dir) {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
}

export function pascal(name) {
  return name
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

export function compilerVersion() {
  const entry = fileURLToPath(import.meta.resolve("@typespec/compiler"));
  let dir = path.dirname(entry);
  while (dir !== path.dirname(dir)) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      const json = JSON.parse(fs.readFileSync(pkg, "utf8"));
      if (json.name === "@typespec/compiler") return json.version;
    }
    dir = path.dirname(dir);
  }
  return "unknown";
}

export function rel(stage, p) {
  const r = path.relative(stage, p);
  return r && !r.startsWith("..") ? r : p;
}

// ------------------------------------------------------------- compilation

/**
 * Compile `entry` with the stage's tspconfig.yaml, emitting JSON Schema into
 * `emitDir`. Returns { program, diagnostics: string[] }.
 */
export async function compileWithEmit(stage, entry, emitDir) {
  const configPath = path.join(stage, "tspconfig.yaml");
  if (!fs.existsSync(configPath)) throw fail(`missing ${configPath}`);
  const [options, configDiagnostics] = await tsp.resolveCompilerOptions(tsp.NodeHost, {
    entrypoint: entry,
    configPath,
    cwd: stage,
  });
  const emitterOptions = { ...(options.options?.["@typespec/json-schema"] ?? {}) };
  emitterOptions["emitter-output-dir"] = emitDir;
  options.options = { ...(options.options ?? {}), "@typespec/json-schema": emitterOptions };
  options.outputDir = emitDir;
  options.noEmit = false;
  const program = await tsp.compile(tsp.NodeHost, entry, options);
  const diagnostics = [...configDiagnostics, ...program.diagnostics].map((d) =>
    tsp.formatDiagnostic(d, { pretty: false }),
  );
  return { program, diagnostics };
}

/**
 * Compile the same entry with another TypeSpec installation (for example the
 * fork's 1.14.0 node_modules) in a throwaway copy of tsp/ and tspconfig.yaml,
 * in a child process. Returns { ok, version, output, emitDir }.
 */
export function compileWithOtherToolchain(stage, entry, modulesDir, workDir) {
  const modules = path.resolve(modulesDir);
  const cli = path.join(modules, "@typespec", "compiler", "cmd", "tsp.js");
  if (!fs.existsSync(cli)) throw fail(`--compare-typespec: no @typespec/compiler in ${modules}`);
  const version = JSON.parse(
    fs.readFileSync(path.join(modules, "@typespec", "compiler", "package.json"), "utf8"),
  ).version;
  // Contract files import only siblings, so a copy of the entry's directory
  // beside a node_modules link to the other toolchain is a complete project.
  const project = path.join(workDir, "project");
  const sources = path.join(project, "tsp", "prism");
  fs.mkdirSync(sources, { recursive: true });
  fs.cpSync(path.dirname(entry), sources, { recursive: true });
  fs.copyFileSync(path.join(stage, "tspconfig.yaml"), path.join(project, "tspconfig.yaml"));
  fs.symlinkSync(modules, path.join(project, "node_modules"), "dir");
  const emitDir = path.join(workDir, "schema");
  const entryCopy = path.join(sources, path.basename(entry));
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "compile",
      entryCopy,
      "--config",
      path.join(project, "tspconfig.yaml"),
      "--option",
      `@typespec/json-schema.emitter-output-dir=${emitDir}`,
    ],
    { cwd: project, encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.split(project).join("<copy>");
  return { ok: result.status === 0, version, output, emitDir };
}

/** Compare two emitted schema directories byte for byte. Returns a list of differences. */
export function compareSchemaDirs(expectedDir, actualDir, labels = ["primary", "other"]) {
  const list = (dir) =>
    fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  const a = list(expectedDir);
  const b = list(actualDir);
  const differences = [];
  for (const f of a) if (!b.includes(f)) differences.push(`${f}: emitted by ${labels[0]} only`);
  for (const f of b) if (!a.includes(f)) differences.push(`${f}: emitted by ${labels[1]} only`);
  for (const f of a.filter((x) => b.includes(x))) {
    const left = fs.readFileSync(path.join(expectedDir, f), "utf8");
    const right = fs.readFileSync(path.join(actualDir, f), "utf8");
    if (left !== right) {
      const l = left.split("\n");
      const r = right.split("\n");
      let i = 0;
      while (i < Math.max(l.length, r.length) && l[i] === r[i]) i++;
      differences.push(
        `${f}: differs from line ${i + 1}: ${labels[0]} ${JSON.stringify(l[i] ?? "<eof>")} vs ${labels[1]} ${JSON.stringify(r[i] ?? "<eof>")}`,
      );
    }
  }
  return differences;
}

// ---------------------------------------------------------------- schemas

/** Read every emitted schema in `dir`: [{ file, model, id, schemaConst, json }]. */
export function readSchemas(dir, { prismOnly = false } = {}) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(dir, file);
    let json;
    try {
      json = JSON.parse(fs.readFileSync(full, "utf8"));
    } catch (error) {
      throw fail(`${full} is not valid JSON: ${error.message}`);
    }
    const id = typeof json.$id === "string" ? json.$id : "";
    if (prismOnly && !id.startsWith(URN_PREFIX)) continue;
    out.push({
      file,
      path: full,
      model: file.slice(0, -".json".length),
      id,
      schemaConst: json?.properties?.schema?.const,
      json,
    });
  }
  return out;
}

/** An ajv 2020-12 validator holding every schema, so cross-root $refs resolve. */
export function makeAjv(schemas) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const problems = [];
  for (const s of schemas) {
    try {
      ajv.addSchema(s.json);
    } catch (error) {
      problems.push(`${s.file}: ajv rejects the schema: ${error.message}`);
    }
  }
  for (const s of schemas) {
    try {
      if (!ajv.getSchema(s.id)) problems.push(`${s.file}: no schema registered under $id ${s.id}`);
    } catch (error) {
      problems.push(`${s.file}: ajv (strict, draft 2020-12) cannot compile it: ${error.message}`);
    }
  }
  return { ajv, problems };
}

function describeAjvError(error) {
  const where = error.instancePath || "(root)";
  if (error.keyword === "not" && /\/unevaluatedProperties\/not$/.test(error.schemaPath)) {
    return `${where}: property not allowed (objects are sealed)`;
  }
  if (error.keyword === "const") return `${where}: must equal ${JSON.stringify(error.params.allowedValue)}`;
  if (error.keyword === "enum") return `${where}: must be one of ${JSON.stringify(error.params.allowedValues)}`;
  if (error.keyword === "required") return `${where}: missing required property "${error.params.missingProperty}"`;
  if (error.keyword === "pattern") return `${where}: does not match ${error.params.pattern}`;
  return `${where}: ${error.message}`;
}

/** Validate one parsed document; returns { ok, errors: string[] }. */
export function validateDocument(ajv, schema, document, maxErrors = 25) {
  const validate = ajv.getSchema(schema.id);
  if (!validate) return { ok: false, errors: [`no compiled schema for ${schema.id}`] };
  const ok = validate(document);
  if (ok) return { ok: true, errors: [] };
  const seen = new Set();
  const errors = [];
  for (const e of validate.errors ?? []) {
    const line = describeAjvError(e);
    if (seen.has(line)) continue;
    seen.add(line);
    errors.push(line);
  }
  if (errors.length > maxErrors) {
    const more = errors.length - maxErrors;
    errors.length = maxErrors;
    errors.push(`... ${more} more`);
  }
  return { ok: false, errors };
}

export function readJsonFile(p) {
  const text = fs.readFileSync(p, "utf8");
  return { text, json: JSON.parse(text) };
}

/** Style notes for a committed example: canonical formatting and size. */
export function exampleStyleNotes(text, json) {
  const notes = [];
  const canonical = `${JSON.stringify(json, null, 2)}\n`;
  if (text !== canonical) notes.push("not in canonical form (JSON.stringify(doc, null, 2) plus one trailing LF)");
  const lines = canonical.split("\n").length - 1;
  if (lines > 300) notes.push(`${lines} lines; aim for under ~300`);
  return notes;
}

// ------------------------------------------------------------------- lint

/**
 * Applications of the TypeSpec.JsonSchema decorator `name` (for example
 * "@id") on `type`, as arrays of JS argument values. Matched by the
 * decorator's declaration, not its JS function name, which a library may wrap.
 */
function decoratorApps(type, name) {
  return (type.decorators ?? [])
    .filter((d) => {
      const def = d.definition;
      if (def) return def.name === name && def.namespace && tsp.getNamespaceFullName(def.namespace) === "TypeSpec.JsonSchema";
      return d.decorator?.name === `$${name.slice(1)}`;
    })
    .map((d) => d.args.map((a) => (a.jsValue !== undefined ? a.jsValue : a.value?.value)));
}

function decoratorArgs(type, name) {
  return decoratorApps(type, name)[0];
}

export function isRoot(type) {
  return type.kind === "Model" && decoratorArgs(type, "@jsonSchema") !== undefined;
}

function nsName(type) {
  return type.namespace ? tsp.getNamespaceFullName(type.namespace) : "";
}

function stdScalarOf(scalar) {
  let current = scalar;
  while (current && nsName(current) !== "TypeSpec") current = current.baseScalar;
  return current;
}

function commonScalarFamily(scalar) {
  for (let current = scalar; current; current = current.baseScalar) {
    if (nsName(current) === COMMON_NAMESPACE) {
      if (current.name === "Nanometres") return "Nm";
      if (current.name === "Degrees") return "Deg";
    }
  }
  return undefined;
}

function isArrayModel(program, type) {
  return type.kind === "Model" && tsp.isArrayModelType(program, type);
}

function isRecordModel(program, type) {
  return type.kind === "Model" && tsp.isRecordModelType(program, type);
}

function nonNullVariants(union) {
  return [...union.variants.values()].map((v) => v.type).filter((t) => !tsp.isNullType(t));
}

/** The type a field holds once null, arrays and map values are peeled off. */
function elementType(program, type) {
  let current = type;
  for (;;) {
    if (current.kind === "Union") {
      const rest = nonNullVariants(current);
      if (rest.length !== 1) return current;
      current = rest[0];
    } else if (isArrayModel(program, current) || isRecordModel(program, current)) {
      current = current.indexer.value;
    } else {
      return current;
    }
  }
}

function location(type) {
  try {
    const loc = tsp.getSourceLocation(type);
    if (!loc?.file) return undefined;
    const { line } = loc.file.getLineAndCharacterOfPosition(loc.pos);
    return { file: loc.file.path, line: line + 1 };
  } catch {
    return undefined;
  }
}

/**
 * Lint the conventions over every type declared in `files` (absolute paths).
 * Returns [{ file, line, rule, message }].
 */
export function lintProgram(program, files, { stage }) {
  const targets = new Map(files.map((f) => [realpath(f), f]));
  const findings = [];
  const add = (type, rule, message, fallbackFile) => {
    const loc = type ? location(type) : undefined;
    findings.push({
      file: rel(stage, loc ? targets.get(realpath(loc.file)) ?? loc.file : fallbackFile),
      line: loc?.line ?? 0,
      rule,
      message,
    });
  };
  const declaredIn = (type) => {
    const loc = location(type);
    if (!loc) return undefined;
    const key = realpath(loc.file);
    return targets.has(key) ? key : undefined;
  };

  // Collect declarations per file.
  const perFile = new Map([...targets.keys()].map((k) => [k, { namespaces: new Set(), types: [], props: [] }]));
  const record = (type, bucket) => {
    if (tsp.isTemplateInstance?.(type)) return;
    const key = declaredIn(type);
    if (key) perFile.get(key)[bucket].push(type);
  };
  tsp.navigateProgram(program, {
    namespace: (n) => {
      const key = declaredIn(n);
      if (key) perFile.get(key).namespaces.add(n);
    },
    model: (m) => record(m, "types"),
    scalar: (s) => record(s, "types"),
    enum: (e) => record(e, "types"),
    union: (u) => record(u, "types"),
    interface: (i) => record(i, "types"),
    operation: (o) => record(o, "types"),
    modelProperty: (p) => record(p, "props"),
  });

  const roots = [];
  for (const [key, original] of targets) {
    const base = path.basename(original);
    const decl = perFile.get(key);
    const script = program.sourceFiles.get(key) ?? [...program.sourceFiles.values()].find((s) => realpath(s.file.path) === key);
    if (!script) {
      findings.push({ file: rel(stage, original), line: 0, rule: "file-not-compiled", message: "file is not part of the compiled program" });
      continue;
    }
    const imports = script.statements
      .filter((s) => s.kind === SyntaxKind.ImportStatement)
      .map((s) => s.path.value);

    // File naming, imports and namespace.
    let expectedNamespace;
    let stem;
    let version;
    if (base === "main.tsp") {
      if (decl.types.length || decl.props.length) {
        findings.push({ file: rel(stage, original), line: 0, rule: "main-declares", message: "main.tsp only imports; declare types in a contract file" });
      }
      continue;
    } else if (base === "common.tsp") {
      expectedNamespace = COMMON_NAMESPACE;
      if (!imports.includes("@typespec/json-schema")) {
        findings.push({ file: rel(stage, original), line: 1, rule: "imports", message: 'common.tsp must import "@typespec/json-schema"' });
      }
    } else {
      const m = CONTRACT_FILE_RE.exec(base);
      if (!m) {
        findings.push({ file: rel(stage, original), line: 0, rule: "file-name", message: `contract files are named <name>-<version>.tsp in kebab-case with version a<N> or v<N>; got ${base}` });
        continue;
      }
      [, stem, version] = m;
      expectedNamespace = `${CONTRACT_NAMESPACE_PREFIX}${pascal(stem)}${version.toUpperCase()}`;
      for (const required of ["@typespec/json-schema", "./common.tsp"]) {
        if (!imports.includes(required)) {
          findings.push({ file: rel(stage, original), line: 1, rule: "imports", message: `import "${required}" in this file so it compiles standalone` });
        }
      }
    }
    for (const n of decl.namespaces) {
      const full = tsp.getNamespaceFullName(n);
      if (decoratorArgs(n, "@jsonSchema") !== undefined) {
        add(n, "namespace-json-schema", `@jsonSchema on namespace ${full} would emit every type as a root; put it on root models only`);
      }
      if (full !== expectedNamespace && !expectedNamespace.startsWith(`${full}.`)) {
        add(n, "namespace", `declares namespace ${full}; this file's namespace is ${expectedNamespace}`);
      }
    }

    // Declarations.
    const snake = [];
    const camel = [];
    for (const type of decl.types) {
      const ns = nsName(type);
      if (type.kind === "Interface" || type.kind === "Operation") {
        add(type, "no-operations", `${type.kind.toLowerCase()} ${type.name}: contracts describe JSON documents only`);
        continue;
      }
      if (type.kind === "Model" && !type.name) {
        add(type, "anonymous-model", "inline object type; declare a named, documented model instead");
        continue;
      }
      if (type.kind === "Union" && !type.name) continue; // inline unions are checked on their property
      if (ns !== expectedNamespace) {
        add(type, "namespace", `${type.name} is in namespace ${ns || "(global)"}; this file's namespace is ${expectedNamespace}`);
      }
      if (!tsp.getDoc(program, type)) add(type, "doc", `${type.kind.toLowerCase()} ${type.name} has no doc comment`);
      if (type.kind === "Enum") {
        for (const member of type.members.values()) {
          if (!tsp.getDoc(program, member)) add(member, "doc", `enum member ${type.name}.${member.name} has no doc comment`);
        }
      }
      if (type.kind === "Union") {
        lintNamedUnion(program, type, add);
      }
      if (type.kind === "Scalar") {
        const std = stdScalarOf(type);
        if (std && !ALLOWED_STD_SCALARS.has(std.name)) {
          add(type, "scalar", `scalar ${type.name} extends ${std.name}: ${STD_SCALAR_ADVICE[std.name] ?? "not an allowed base scalar"}`);
        }
      }
      if (type.kind !== "Model" && decoratorArgs(type, "@jsonSchema") !== undefined) {
        add(type, "root-kind", `@jsonSchema on ${type.kind.toLowerCase()} ${type.name}: only models are roots`);
      }
      if (isRoot(type)) {
        roots.push(type);
        lintRoot(type, { stem, version, base, add });
      }
    }
    for (const prop of decl.props) {
      lintProperty(program, prop, add);
      if (prop.name.includes("_")) snake.push(prop);
      else if (/[A-Z]/.test(prop.name)) camel.push(prop);
    }
    if (snake.length && camel.length) {
      add(
        camel[0],
        "naming-family",
        `mixes snake_case (${snake[0].model?.name}.${snake[0].name}) and camelCase (${camel[0].model?.name}.${camel[0].name}) field names; one family per file (conventions.md, Field naming)`,
      );
    }
  }

  // Root names are file names in generated/schema: unique across the program.
  const byName = new Map();
  for (const root of roots) {
    const prior = byName.get(root.name);
    if (prior && prior !== root) add(root, "root-unique", `root model name ${root.name} is declared twice; generated/schema has one file per root`);
    byName.set(root.name, root);
  }
  // $defs keys are simple type names: two different types with one name in
  // the same root silently collapse into one definition.
  for (const root of roots) {
    for (const [name, types] of reachableNamedTypes(program, root)) {
      if (types.length > 1) {
        add(root, "defs-collision", `root ${root.name} reaches ${types.length} different types named ${name}; rename one (the emitter would merge them in $defs)`);
      }
    }
  }
  return { findings, roots };
}

function lintNamedUnion(program, union, add) {
  const variants = [...union.variants.values()];
  const types = variants.map((v) => v.type).filter((t) => !tsp.isNullType(t));
  const literals = types.filter((t) => t.kind === "String");
  if (literals.length >= 2 && literals.length === types.length) {
    add(union, "closed-set", `union ${union.name} of string literals: declare an enum (the fork's codegen maps JSON Schema enum to Rust enums)`);
    return;
  }
  const models = types.filter((t) => t.kind === "Model" && t.name && !isArrayModel(program, t) && !isRecordModel(program, t));
  if (models.length >= 2 && models.length === types.length) {
    if (decoratorArgs(union, "@oneOf") === undefined) {
      add(union, "discriminated-union", `union ${union.name} of models needs @oneOf (exactly one variant matches)`);
    }
    const kinds = new Map();
    for (const m of models) {
      const first = [...m.properties.values()][0];
      if (!first || first.name !== "kind" || first.type.kind !== "String") {
        add(m, "discriminated-union", `${m.name} is a variant of ${union.name}; its first property must be kind: "<literal>"`);
        continue;
      }
      const v = first.type.value;
      if (kinds.has(v)) add(m, "discriminated-union", `${m.name} and ${kinds.get(v)} share kind "${v}" in ${union.name}`);
      kinds.set(v, m.name);
    }
  }
  for (const v of variants) {
    if (v.type.kind !== "Model" && !tsp.isNullType(v.type) && !tsp.getDoc(program, v)) {
      add(v, "doc", `variant ${String(v.name)} of union ${union.name} has no doc comment`);
    }
  }
}

function lintRoot(model, { stem, version, base, add }) {
  if (!stem) {
    add(model, "root-file", `root ${model.name} must live in a <name>-<version>.tsp contract file, not ${base}`);
    return;
  }
  const props = [...model.properties.values()];
  const first = props[0];
  if (!first || first.name !== "schema" || first.type.kind !== "String") {
    add(model, "root-envelope", `root ${model.name}: the first property must be schema: "prism.<name>.<version>" (a string literal)`);
    return;
  }
  const schemaId = first.type.value;
  const m = SCHEMA_ID_RE.exec(schemaId);
  if (!m) {
    add(first, "root-envelope", `schema "${schemaId}" is not prism.<name>.<version>`);
    return;
  }
  const [, name, schemaVersion] = m;
  if (schemaVersion !== version) {
    add(first, "root-version", `schema "${schemaId}" has version ${schemaVersion}; the file ${base} has version ${version}`);
  }
  const kebab = name.replace(/[._]/g, "-");
  if (kebab !== stem && !kebab.startsWith(`${stem}-`)) {
    add(first, "root-file", `schema "${schemaId}" does not belong in ${base}: its name in kebab-case (${kebab}) must equal or start with ${stem}`);
  }
  const expectedName = `${pascal(name)}${schemaVersion.toUpperCase()}`;
  if (model.name !== expectedName) {
    add(model, "root-name", `root for "${schemaId}" must be named ${expectedName}, not ${model.name}`);
  }
  const expectedId = `${URN_PREFIX}prism.${name}:${schemaVersion}`;
  const id = decoratorArgs(model, "@id")?.[0];
  if (id !== expectedId) {
    add(model, "root-id", `root ${model.name} needs @id("${expectedId}")${id ? `, not "${id}"` : ""}`);
  }
  const titles = decoratorApps(model, "@extension").filter((args) => args[0] === "title");
  if (titles.length !== 1 || typeof titles[0][1] !== "string" || !titles[0][1]) {
    add(model, "root-title", `root ${model.name} needs @extension("title", "<Human name> ${schemaVersion}")`);
  }
}

function lintProperty(program, prop, add) {
  const owner = prop.model?.name || "(inline)";
  const label = `${owner}.${prop.name}`;
  const doc = tsp.getDoc(program, prop) ?? "";
  if (!doc) add(prop, "doc", `field ${label} has no doc comment`);
  const validName = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(prop.name) || /^[a-z][a-zA-Z0-9]*$/.test(prop.name);
  if (!validName) add(prop, "naming", `field ${label}: names are snake_case or camelCase ASCII`);

  const issues = new Set();
  let nullable = false;
  let arrays = 0;
  let records = 0;
  const walk = (type, depth) => {
    if (depth > 8) return;
    switch (type.kind) {
      case "Scalar": {
        const std = stdScalarOf(type);
        if (std && !ALLOWED_STD_SCALARS.has(std.name)) {
          issues.add(`uses ${std.name}: ${STD_SCALAR_ADVICE[std.name] ?? "not an allowed scalar"}`);
        }
        return;
      }
      case "Intrinsic":
        if (tsp.isNullType(type)) {
          nullable = true;
        } else {
          issues.add(`uses ${type.name}; give the field a concrete type`);
        }
        return;
      case "Union": {
        if (!type.name) {
          const rest = nonNullVariants(type);
          const literals = rest.filter((t) => t.kind === "String");
          if (literals.length >= 2 && literals.length === rest.length) {
            issues.add("inline union of string literals: declare a documented enum");
          }
          const models = rest.filter((t) => t.kind === "Model" && !isArrayModel(program, t) && !isRecordModel(program, t));
          if (models.length >= 2) issues.add("inline union of models: declare a named union with @oneOf");
        }
        for (const v of type.variants.values()) walk(v.type, depth + 1);
        return;
      }
      case "Model":
        if (isArrayModel(program, type)) {
          arrays++;
          walk(type.indexer.value, depth + 1);
        } else if (isRecordModel(program, type)) {
          records++;
          walk(type.indexer.value, depth + 1);
        } else if (!type.name) {
          issues.add("inline object type: declare a named, documented model");
        }
        return;
      default:
        return;
    }
  };
  walk(prop.type, 0);
  for (const issue of issues) add(prop, "field-type", `field ${label} ${issue}`);
  if (nullable && !/\bnull\b/i.test(doc)) add(prop, "nullable-doc", `field ${label} can be null; its doc must say what null means`);
  if (arrays && !/\b(order|ordered|sorted)\b/i.test(doc)) add(prop, "array-order", `field ${label} is an array; its doc must state the order (conventions.md, Ordering)`);
  if (records && !/\bkeys?\b/i.test(doc)) add(prop, "record-keys", `field ${label} is a map; its doc must say what the keys are`);

  const element = elementType(program, prop.type);
  const family = element.kind === "Scalar" ? commonScalarFamily(element) : undefined;
  const isPoint = element.kind === "Model" && element.name === "PointNm" && nsName(element) === COMMON_NAMESPACE;
  const nmSuffix = /(Nm|_nm)$/.test(prop.name);
  const degSuffix = /(Deg|_deg)$/.test(prop.name);
  if (family === "Nm" && !nmSuffix) add(prop, "units", `field ${label} holds nanometres; suffix its name with Nm (camelCase) or _nm (snake_case)`);
  if (family === "Deg" && !degSuffix) add(prop, "units", `field ${label} holds degrees; suffix its name with Deg (camelCase) or _deg (snake_case)`);
  if (nmSuffix && family !== "Nm" && !isPoint) add(prop, "units", `field ${label} is named in nanometres but is not a Common Nanometres type`);
  if (degSuffix && family !== "Deg") add(prop, "units", `field ${label} is named in degrees but is not Common.Degrees`);
}

/** Named types a root's schema can reach, keyed by name: Map<name, Type[]> (distinct types). */
export function reachableNamedTypes(program, root) {
  const seen = new Set();
  const byName = new Map();
  const note = (type) => {
    if (!type.name || typeof type.name !== "string") return;
    if (tsp.isTemplateInstance?.(type)) return;
    const list = byName.get(type.name) ?? [];
    if (!list.includes(type)) list.push(type);
    byName.set(type.name, list);
  };
  const visit = (type) => {
    if (!type || seen.has(type)) return;
    seen.add(type);
    switch (type.kind) {
      case "Model":
        if (type !== root && isRoot(type)) return; // referenced by $id, not copied into $defs
        if (isArrayModel(program, type) || isRecordModel(program, type)) {
          if (type.name && !tsp.isTemplateInstance?.(type)) note(type);
          visit(type.indexer.value);
          return;
        }
        if (type !== root) note(type);
        if (type.baseModel) visit(type.baseModel);
        for (const p of type.properties.values()) visit(p.type);
        return;
      case "Union":
        note(type);
        for (const v of type.variants.values()) visit(v.type);
        return;
      case "Enum":
        note(type);
        return;
      case "Scalar":
        if (nsName(type) === "TypeSpec") return;
        note(type);
        if (type.baseScalar) visit(type.baseScalar);
        return;
      case "Tuple":
        for (const v of type.values) visit(v);
        return;
      default:
        return;
    }
  };
  visit(root);
  return byName;
}

export function formatFindings(findings) {
  return findings
    .slice()
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule))
    .map((f) => `${f.file}:${f.line} [${f.rule}] ${f.message}`);
}

/** Every .tsp under tsp/prism, recursively, as absolute paths. */
export function listTspFiles(stage) {
  const root = layout(stage).tsp;
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsp")) out.push(full);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out.sort();
}
