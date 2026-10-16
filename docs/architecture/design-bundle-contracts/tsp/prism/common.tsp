import "@typespec/json-schema";

using TypeSpec.JsonSchema;

/**
 * Primitives shared by more than one Prism design-bundle contract. Nothing
 * here is specific to one contract. Changes follow the same rule as a frozen
 * contract: a new name or an ADR amendment, never a silent edit (see
 * conventions.md, "Ids and versions").
 *
 * Patterns use only the regex subset that ECMAScript (ajv), Python `re` and
 * Rust `regex` share: no lookaround and no backreferences.
 */
namespace Prism.Contracts.Common;

// ------------------------------------------------------------- digests, ids

/** Lowercase hexadecimal SHA-256 digest: exactly 64 characters, no prefix such as `sha256:`. */
@pattern("^[0-9a-f]{64}$")
scalar Sha256Hex extends string;

/**
 * Git object id in lowercase hexadecimal: 40 characters in a SHA-1
 * repository, 64 in a SHA-256 repository. Used for commit ids and blob ids.
 */
@pattern("^(?:[0-9a-f]{40}|[0-9a-f]{64})$")
scalar GitObjectId extends string;

/**
 * Id of a JSON document schema, `<family>.<name>.<version>`: for example
 * `prism.stackup.a0`, `prism.bundle.manifest.a2`, `prism.system_interface.v1`
 * or `kicad_monkey.design.a0`. Lowercase, dot-separated, ending in the
 * version (`a<N>` while pre-stable, `v<N>` once stable).
 */
@pattern("^[a-z][a-z0-9_]*(?:\\.[a-z][a-z0-9_]*)+\\.[av][0-9]+$")
scalar SchemaId extends string;

/**
 * Stable machine-readable code of a finding, in lowercase kebab-case, for
 * example `stale-saved-fills` or `net-mismatch`. A code never changes meaning
 * once published; a new meaning gets a new code.
 */
@pattern("^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")
scalar DiagnosticCode extends string;

// -------------------------------------------------------------------- paths

/**
 * Path of a member inside a `.prism` bundle archive: `/`-separated, relative,
 * no empty, `.` or `..` segment, no leading or trailing `/`, no backslash and
 * no `:`. The same rule as manifest a1's ArchivePath and prism-bundle's
 * `check_member_name`, without lookaround.
 */
@pattern("^(?:[^/\\\\:.][^/\\\\:]*|\\.[^/\\\\:.][^/\\\\:]*|\\.\\.[^/\\\\:]+)(?:/(?:[^/\\\\:.][^/\\\\:]*|\\.[^/\\\\:.][^/\\\\:]*|\\.\\.[^/\\\\:]+))*$")
scalar ArchivePath extends string;

/**
 * Repository-relative POSIX path, exactly as `git ls-tree` names the entry:
 * `/`-separated, case preserved, no leading `/`, no empty, `.` or `..`
 * segment, no backslash and no `:`. The same character rule as ArchivePath.
 * It is the only path type in bundle documents: a file has one spelling
 * whichever project in the repository refers to it, and a file outside the
 * project directory needs no `..`.
 */
@pattern("^(?:[^/\\\\:.][^/\\\\:]*|\\.[^/\\\\:.][^/\\\\:]*|\\.\\.[^/\\\\:]+)(?:/(?:[^/\\\\:.][^/\\\\:]*|\\.[^/\\\\:.][^/\\\\:]*|\\.\\.[^/\\\\:]+))*$")
scalar RepoPath extends string;

// -------------------------------------------------------------- KiCad ids

/**
 * KiCad object UUID in the canonical form KiCad writes (`KIID::AsString`):
 * lowercase hexadecimal, 8-4-4-4-12. Copied from the file, never generated
 * or re-cased.
 */
@pattern("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
scalar KiCadUuid extends string;

/**
 * KiCad KIID path: one or more `/<uuid>` steps, no trailing `/`. Two forms
 * exist and every field of this type states which one it holds: the
 * schematic form, which starts at the root sheet's UUID (a symbol's
 * `(instances (project … (path …)))` entry, plus the symbol UUID for an
 * occurrence); and the board form, which omits the root sheet (a footprint's
 * `(path …)`).
 */
@pattern("^(?:/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})+$")
scalar KiidPath extends string;

/**
 * Reference to one object in one KiCad document: `<documentPath>#<uuid>`,
 * where `documentPath` is the RepoPath of the `.kicad_sch` or `.kicad_pcb`
 * and `uuid` the object's KiCadUuid. Split at the last `#`. Unique across
 * every project in the repository, including projects that share a
 * directory.
 * A reused sheet file holds one object for all its instances, so an
 * ObjectRef names the object in the file, not an occurrence; occurrences
 * are named by KiidPath.
 */
@pattern("^(?:[^/\\\\:.][^/\\\\:]*|\\.[^/\\\\:.][^/\\\\:]*|\\.\\.[^/\\\\:]+)(?:/(?:[^/\\\\:.][^/\\\\:]*|\\.[^/\\\\:.][^/\\\\:]*|\\.\\.[^/\\\\:]+))*#[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
scalar ObjectRef extends string;

/**
 * KiCad canonical layer name as the board file's `(layers …)` table spells
 * it, for example `F.Cu`, `In1.Cu`, `B.Mask`, `Edge.Cuts` or `User.1`. Never
 * the user-assigned layer name, which a contract carries in a separate
 * optional field. Never a wildcard set such as `*.Cu` or `F&B.Cu`.
 */
@minLength(1)
scalar LayerName extends string;

/**
 * Reference designator as KiCad resolves it for one symbol instance or
 * footprint, for example `R1`, `U3`, `#PWR01` or `R?`. Always a string. A
 * contract states whether it includes virtual (`#`) and unannotated (`?`)
 * references.
 */
@minLength(1)
scalar Refdes extends string;

/**
 * Pad or pin number as written in the file, always a string (`1`, `A1`,
 * `EP`). Empty for a pad KiCad leaves unnumbered, such as a mechanical
 * non-plated hole.
 */
scalar PadNumber extends string;

/**
 * KiCad full net name as KiCad resolves it, including the sheet path prefix
 * of a local net (`/Power/VBUS`), a global name (`GND`) or a generated name
 * (`Net-(R1-Pad2)`, `unconnected-(U1-PA0-Pad3)`). "No net" is expressed by
 * omitting the field, never by an empty name.
 */
@minLength(1)
scalar NetName extends string;

/**
 * KiCad library identifier as written in the file: `<nickname>:<name>` for a
 * symbol (`Device:R`) or a footprint (`Resistor_SMD:R_0603_1608Metric`). The
 * nickname may be absent when the file has none.
 */
@minLength(1)
scalar LibId extends string;

// ---------------------------------------------------------- units, counts

/**
 * Length or coordinate in integer nanometres, KiCad's internal board unit.
 * Converted from the file's decimal millimetres as KiCad's own parser does:
 * the double product value_mm * 1e6, rounded half away from zero. A single
 * coordinate or dimension fits KiCad's 32-bit range; sums (for example a
 * net's total track length) may not, hence a safe integer (|n| < 2^53).
 */
scalar Nanometres extends safeint;

/** A Nanometres value that is never negative: a thickness, width, diameter or length. */
@minValue(0)
scalar NonNegativeNanometres extends Nanometres;

/**
 * Angle in degrees. In new documents it is as written in the KiCad file:
 * not normalized, not rounded. A parity document may round it as today's
 * output does, and its field says so. A positive angle is a counter-clockwise rotation as KiCad shows
 * it on the front side. Each field states the frame its angle is in.
 */
scalar Degrees extends float64;

/** A count of things: a non-negative safe integer. */
@minValue(0)
scalar Count extends safeint;

/** A size in bytes: a non-negative safe integer. */
@minValue(0)
scalar ByteCount extends safeint;

// ------------------------------------------------------------ small models

/** Board side of a footprint, pad or graphic. */
enum Side {
  /** KiCad's front (`F.*` layers): the top of the board. */
  front,

  /** KiCad's back (`B.*` layers): the bottom; a footprint here is flipped. */
  back,
}

/**
 * A point in nanometres in KiCad's board frame: +x to the right, +y down, as
 * in the file and never flipped. The field holding the point states whether
 * it is board-absolute or footprint-local. For camelCase (projection)
 * documents only.
 */
model PointNm {
  /** X coordinate in nanometres, +x to the right. */
  xNm: Nanometres;

  /** Y coordinate in nanometres, +y down. */
  yNm: Nanometres;
}

/**
 * A finding with a stable code and a human-readable message. Whether it is a
 * warning or an error is given by the array that holds it. Field names are
 * the same in snake_case and camelCase documents.
 */
model Warning {
  /** Stable code that tools and tests match on. */
  code: DiagnosticCode;

  /** One-sentence explanation for people; its wording may change between versions. */
  @minLength(1)
  message: string;
}
