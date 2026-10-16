import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * `projections/project.json` (ADR §6, WP-P4): the project-level facts of one
 * KiCad project. One document per bundle, written at stage `parse` from the
 * `.kicad_pro`, the schematic hierarchy, the board and the project's two
 * library tables.
 *
 * It holds:
 * - the project's name, text variables and net classes (`.kicad_pro`);
 * - one header record per schematic file of the hierarchy and per board:
 *   file format version, generator, title block as written and as expanded,
 *   document properties;
 * - every path reference those files make, raw and resolved: sheet files,
 *   library-table URIs, 3D models, drawing sheets and other path-valued
 *   text. Release Studio's input closure, the components GLB cache key and
 *   the catalog import resolve references from here instead of re-reading
 *   the files.
 *
 * Every path in the document is a RepoPath, repository-relative
 * (conventions.md §8); the project directory is the directory of the
 * project's anchor, the `.kicad_pro`, which KiCad calls `${KIPRJMOD}`. A
 * reference keeps its text as written in `raw` and its resolved
 * repository path in `target`.
 *
 * Resolution is a pure function of the bundle's sources: nothing is looked
 * up in the host environment or the KiCad installation. A reference into
 * KiCad's own libraries is reported by library and relative path; whether
 * that file exists is the reader's question (it depends on the KiCad that
 * the generator id pins).
 *
 * What it does not hold, and where that lives:
 * - sheet instances (KIID paths, sheet paths): `semantic-index`
 *   `sheetInstances[]`; a `sheet-file` reference is the file-level edge of
 *   the same hierarchy (field map, "Relations");
 * - design variants of the `.kicad_pro` registry: `semantic-index`
 *   `assembly.catalog`;
 * - the per-net class name: `semantic-index` `nets[].netClass`; net-class
 *   patterns and assignments as diffable settings: `board-objects`;
 * - per-footprint model lists and transforms: `placements`
 *   `footprints[].models[]`, whose `path` is a `model-3d` reference's `raw`;
 * - board size and thickness from `kicad-cli pcb export stats`: a KiCad
 *   output (ADR §2.1), not a parsed fact.
 */
namespace Prism.Contracts.ProjectA0;

// ---------------------------------------------------------------- scalars

/**
 * A KiCad s-expression file format version, the integer of the file's
 * `(version N)` form: a date written as YYYYMMDD, for example `20241229`
 * (KiCad 9) or `20260206` (KiCad 10).
 */
@minValue(1)
scalar ProjectFileFormatVersion extends safeint;

/** Number of a title-block comment, as in `(comment N "…")`: 1 to 9. */
@minValue(1)
@maxValue(9)
scalar ProjectTitleBlockCommentNumber extends uint8;

/**
 * A path below one of KiCad's library directories: `/`-separated, relative,
 * no empty, `.` or `..` segment, no backslash and no `:`. The same
 * character rule as Common's RepoPath.
 */
@pattern("^(?:[^/\\\\:.][^/\\\\:]*|\\.[^/\\\\:.][^/\\\\:]*|\\.\\.[^/\\\\:]+)(?:/(?:[^/\\\\:.][^/\\\\:]*|\\.[^/\\\\:.][^/\\\\:]*|\\.\\.[^/\\\\:]+))*$")
scalar ProjectLibraryRelativePath extends string;

/**
 * Name of a path variable as written between `${` and `}` or `$(` and `)`:
 * ASCII letters, digits, `_` and `:`, as KiCad's expander reads them
 * (`common.cpp`, `KIwxExpandEnvVars`).
 */
@pattern("^[A-Za-z0-9_:]+$")
scalar ProjectVariableName extends string;

// ------------------------------------------------------------------ enums

/** What a project document is. */
enum ProjectDocumentKind {
  /** The root schematic: the effective configuration's root schematic, by default `<stem>.kicad_sch` beside the `.kicad_pro`. */
  rootSchematic: "root-schematic",

  /** A schematic file reached from the root schematic through `sheet-file` references, at any depth. */
  schematic,

  /** The board: the effective configuration's board, by default `<stem>.kicad_pcb` beside the `.kicad_pro`. */
  board,
}

/** Which KiCad file setting or form holds a path reference. */
enum ProjectReferenceKind {
  /** The `Sheetfile` property of a `(sheet …)` in a schematic: the file the sheet instantiates. Relative paths resolve against the directory of the schematic that holds the sheet. One entry per sheet. */
  sheetFile: "sheet-file",

  /** The `(uri …)` of one `(lib …)` row of the project's `fp-lib-table`. One entry per row. */
  footprintLibrary: "footprint-library",

  /** The `(uri …)` of one `(lib …)` row of the project's `sym-lib-table`. One entry per row. */
  symbolLibrary: "symbol-library",

  /** The path of a footprint's `(model …)` in the board. One entry per distinct path text (and, for an embedded target, per footprint whose own embedded files hold it). */
  model3d: "model-3d",

  /** The `.kicad_pro` drawing-sheet setting `schematic.page_layout_descr_file` or `pcbnew.page_layout_descr_file`, when not empty. */
  drawingSheet: "drawing-sheet",

  /**
   * Any other string in a scanned file that names a file through a path
   * variable, by Release Studio's rule (`closure_references.py:25-58`), for
   * example a `Datasheet` or `Sim.Library` property `${KIPRJMOD}/…`. One
   * entry per distinct (field, path text) in a file.
   */
  textPath: "text-path",
}

/** Which directory a relative or `${KIPRJMOD}` path was joined to. */
enum ProjectPathBase {
  /** The path began with `${KIPRJMOD}` or `$(KIPRJMOD)` (directly or through a text variable): the project directory, the anchor's directory. */
  projectVariable: "project-variable",

  /** A relative path without a leading variable, joined to the project directory, the anchor's directory (models, library URIs, drawing sheets, text paths). */
  projectDirectory: "project-directory",

  /** A relative path without a leading variable, joined to the directory of the file holding the reference (sheet files only, as KiCad loads sub-sheets). */
  documentDirectory: "document-directory",
}

/**
 * One of KiCad's own library directories, which the KiCad installation
 * defines through predefined path variables (`env_vars.cpp`). `<N>` is one
 * or more ASCII digits, any version.
 */
enum ProjectKiCadLibrary {
  /** `KICAD<N>_3DMODEL_DIR`, or the deprecated `KISYS3DMOD`: the stock 3D model library. */
  model3d: "model-3d",

  /** `KICAD<N>_SYMBOL_DIR`, or the deprecated `KICAD_SYMBOL_DIR`: the stock symbol libraries. */
  symbol,

  /** `KICAD<N>_FOOTPRINT_DIR`, or the deprecated `KISYSMOD`: the stock footprint libraries. */
  footprint,

  /** `KICAD<N>_TEMPLATE_DIR`, or the deprecated `KICAD_PTEMPLATES`: the stock project templates. */
  template,

  /** `KICAD<N>_3RD_PARTY`: the plugin and content manager's install directory. */
  thirdParty: "third-party",

  /** `KICAD_USER_TEMPLATE_DIR`: the user's project templates. */
  userTemplate: "user-template",
}

/** The `(type …)` of a `(file …)` in an `(embedded_files …)` form, spelled as KiCad writes it. */
enum ProjectEmbeddedFileType {
  /** `model`: a 3D model. */
  modelFile: "model",

  /** `worksheet`: a drawing sheet. */
  worksheet,

  /** `datasheet`: a datasheet. */
  datasheet,

  /** `font`: a font. */
  font,

  /** `other`, a missing `(type …)`, or a token outside this list. */
  other,
}

/** Why a reference could not be resolved from the sources alone. */
enum ProjectUnresolvedReason {
  /** A variable that is not `PROJECTNAME`, a project text variable, `KIPRJMOD` or a KiCad library variable: KiCad would take it from the host environment or the user's path settings. `variable` names it. */
  undefinedVariable: "undefined-variable",

  /** A variable whose value depends on the time or the checkout (`CURRENT_DATE`, `CURRENT_TIME_HH_MM_SS`, `CURRENT_TIME_LOCALE`, `VCSHASH`, `VCSSHORTHASH`). `variable` names it. */
  nondeterministicVariable: "nondeterministic-variable",

  /** `KIPRJMOD` or a KiCad library variable that does not start the expanded path. `variable` names it. */
  misplacedVariable: "misplaced-variable",

  /** The text still holds a variable after 8 expansion rounds (a loop between text variables). */
  variableLoop: "variable-loop",

  /** A URI (`<scheme>://…`), or `kicad-embed://` where the kind cannot be embedded (sheet files, library URIs, text paths). */
  uri,

  /** A home-relative path (`~` or `~/…`). */
  homeRelative: "home-relative",

  /** A `:<alias>:<path>` form whose alias is not a KiCad library variable (a KiCad 5 3D search-path alias). */
  searchPathAlias: "alias",

  /** A `kicad-embed://<name>` whose name no embedded file of the lookup order holds. */
  embeddedMissing: "embedded-missing",

  /** A KiCad-library path that climbs above the library directory (`${KICAD9_3DMODEL_DIR}/../…`). */
  outsideLibraryRoot: "outside-library-root",

  /** The path normalizes to its base directory itself, for example `${KIPRJMOD}` alone. */
  emptyPath: "empty-path",

  /** The normalized relative path holds a `:`, which no RepoPath or source path can hold, so no source can match it. */
  unrepresentablePath: "unrepresentable-path",
}

// --------------------------------------------------------------- targets

/** The reference resolves to a path inside the repository. */
model ProjectRepositoryTarget {
  /** Variant tag. */
  kind: "repository";

  /**
   * The target's repository-relative path: the base directory's repository
   * path joined with the reference and normalized lexically (`.` dropped,
   * each `..` cancels the segment before it). Its bundle member is
   * `sources/<path>`.
   */
  path: RepoPath;

  /** The directory the path was joined to. */
  base: ProjectPathBase;

  /**
   * True when the revision key's source set, as K materializes it, holds
   * the target: the file `path`, or, for a directory target such as a
   * `.pretty` footprint library, at least one file below it. Such a target
   * is read by the build and so is a member `sources/<path>` (the closure,
   * bundle-format.md §2.2). False means the file
   * is missing from the commit, or present but outside the revision key's
   * source set (for example under an excluded directory, or a file type the
   * source set does not select).
   */
  inSources: boolean;
}

/** The reference climbs above the repository root: KiCad would read a file the commit does not hold. */
model ProjectOutsideRepositoryTarget {
  /** Variant tag. */
  kind: "outside-repository";

  /**
   * The target relative to the repository root, normalized lexically: one or
   * more leading `..` segments, then the rest. Not a RepoPath, since it
   * names no file of the repository.
   */
  @minLength(1)
  path: string;

  /** The directory the path was joined to. */
  base: ProjectPathBase;
}

/** The reference is an absolute path after expansion (`/…`, or a drive letter such as `C:/…`). */
model ProjectAbsoluteTarget {
  /** Variant tag. */
  kind: "absolute";

  /** The expanded path with every `\` replaced by `/` and normalized lexically, as the source file states it; never a path of the build host. */
  @minLength(1)
  path: string;
}

/** The reference starts with one of KiCad's library variables, or names one as a `:<alias>:` form. */
model ProjectKiCadLibraryTarget {
  /** Variant tag. */
  kind: "kicad-library";

  /** The library variable as written, for example `KICAD9_3DMODEL_DIR` or `KISYS3DMOD`. A KiCad of another major version substitutes its own directory when this one is not set in its environment (`common.cpp`, `KIwxExpandEnvVars`); readers apply that rule, this document does not. */
  variable: ProjectVariableName;

  /** Which library directory the variable names. */
  library: ProjectKiCadLibrary;

  /** The rest of the path below that directory, normalized lexically, for example `Resistor_SMD.3dshapes/R_0603_1608Metric.step`. */
  relativePath: ProjectLibraryRelativePath;
}

/** The reference is `kicad-embed://<name>` and an embedded file of the lookup order holds that name. */
model ProjectEmbeddedTarget {
  /** Variant tag. */
  kind: "embedded";

  /** The embedded file's name, the text after `kicad-embed://`, equal to its `(name …)`. */
  @minLength(1)
  name: string;

  /** The repository-relative path of the document whose `(embedded_files …)` form holds it: the board, or the root schematic for the schematic drawing sheet. */
  documentPath: RepoPath;

  /** UUID of the footprint whose own `(embedded_files …)` holds it. Absent when the document-level form holds it. A model is looked up in its footprint's embedded files first, then in the board's. */
  footprintUuid?: KiCadUuid;

  /** The embedded file's `(type …)`. */
  fileType: ProjectEmbeddedFileType;
}

/** The reference cannot be resolved from the sources alone. */
model ProjectUnresolvedTarget {
  /** Variant tag. */
  kind: "unresolved";

  /** Why. */
  reason: ProjectUnresolvedReason;

  /**
   * The variable concerned. Present exactly when `reason` is
   * `undefined-variable` or `nondeterministic-variable` (the first such
   * reference, in text order, of the expansion round that stopped), or
   * `misplaced-variable` (the variable of the first marker, in text order,
   * that does not start the text).
   */
  variable?: ProjectVariableName;
}

/** Where a path reference leads. The variant is chosen by `kind`. */
@oneOf
union ProjectPathTarget {
  /** Inside the repository. */
  repository: ProjectRepositoryTarget,

  /** Above the repository root. */
  outsideRepository: ProjectOutsideRepositoryTarget,

  /** An absolute path. */
  absolute: ProjectAbsoluteTarget,

  /** Below a KiCad library directory. */
  kicadLibrary: ProjectKiCadLibraryTarget,

  /** An embedded file. */
  embedded: ProjectEmbeddedTarget,

  /** Not resolvable from the sources. */
  unresolved: ProjectUnresolvedTarget,
}

// ------------------------------------------------------------- references

/**
 * One path reference: the text as written, the variables its expansion
 * used, and where it leads. The resolution algorithm is normative in
 * `field-maps/project.md`, "Resolution"; in short: variables are expanded
 * (`PROJECTNAME` and the project's text variables first, then `KIPRJMOD`
 * and KiCad's library variables, up to 8 rounds), `\` becomes `/`, and the
 * result is classified by its form.
 */
model ProjectPathReference {
  /** Which setting or form holds the reference. */
  kind: ProjectReferenceKind;

  /** The repository-relative path of the file that holds the reference: the `.kicad_pro`, a schematic of the hierarchy, the board, a library table, or a drawing-sheet file. */
  documentPath: RepoPath;

  /** UUID of the `(sheet …)` that holds the reference. Present exactly when `kind` is `sheet-file`; it equals the `sheetSymbolUuid` of the semantic index's `sheetInstances[]` that the sheet places. */
  sheetUuid?: KiCadUuid;

  /** The sheet's first `Sheetname` (or `Sheet name`) property as written. Present exactly when `kind` is `sheet-file` and that property has non-empty text. */
  @minLength(1)
  sheetName?: string;

  /** The library nickname, the row's `(name …)`. Present exactly when `kind` is `footprint-library` or `symbol-library`; unique within its table. */
  @minLength(1)
  libraryName?: string;

  /**
   * Where in the file the text sits. Present exactly when `kind` is
   * `drawing-sheet` or `text-path`. In the `.kicad_pro`, the RFC 6901 JSON
   * Pointer of the value (`/schematic/page_layout_descr_file`). In an
   * s-expression file, the property name when the text is the value of a
   * `(property "<name>" …)` form, otherwise the head token of the list the
   * text is an element of (`descr`).
   */
  @minLength(1)
  field?: string;

  /** The reference exactly as written, after s-expression or JSON string unescaping, `${KIPRJMOD}` and other variables unexpanded; never empty. Its resolved repository path, if any, is `target.path`. */
  @minLength(1)
  raw: string;

  /** Names of the variables the expansion substituted, in any round, sorted in code point order, without repeats. Empty when the text holds none. */
  variables: ProjectVariableName[];

  /** Where the reference leads. */
  target: ProjectPathTarget;
}

// --------------------------------------------------------------- documents

/** One numbered comment of a title block. */
model ProjectTitleBlockComment {
  /** The comment's number. */
  number: ProjectTitleBlockCommentNumber;

  /** The comment's text; never empty. */
  @minLength(1)
  text: string;
}

/**
 * A `(title_block …)` form. Each field is present exactly when the form has
 * it with non-empty text; an empty string is treated as absent (KiCad writes
 * no empty title-block fields). This is the fork's `KiCadTitleBlock`, whose
 * empty strings stand for absent fields.
 */
model ProjectTitleBlock {
  /** `(title "…")`, KiCad's `${TITLE}`. */
  @minLength(1)
  title?: string;

  /** `(date "…")`, KiCad's `${ISSUE_DATE}`, as written (not parsed as a date). */
  @minLength(1)
  date?: string;

  /** `(rev "…")`, KiCad's `${REVISION}`. */
  @minLength(1)
  rev?: string;

  /** `(company "…")`, KiCad's `${COMPANY}`. */
  @minLength(1)
  company?: string;

  /** The `(comment N "…")` forms with N from 1 to 9 and non-empty text, sorted by `number` in numeric order; when a number repeats, the last form in the file wins. Empty when there are none. */
  comments: ProjectTitleBlockComment[];
}

/** One schematic file of the hierarchy, or the board. */
model ProjectDocument {
  /** The file's repository-relative path. */
  path: RepoPath;

  /** Root schematic, other schematic, or board. */
  kind: ProjectDocumentKind;

  /** The file's `(version N)`. Absent when the form is missing or not an integer. */
  formatVersion?: ProjectFileFormatVersion;

  /** The file's `(generator …)`, quoted or bare, for example `eeschema` or `pcbnew`. Absent when the form is missing. */
  generator?: string;

  /** The file's `(generator_version "…")`, for example `9.0` (KiCad 8 and later). Absent when the form is missing. */
  generatorVersion?: string;

  /** The file's own `(title_block …)` as written. Absent when the file has none. */
  titleBlock?: ProjectTitleBlock;

  /**
   * `titleBlock` with its text variables expanded by today's rule
   * (`backend/app/services/kicad_text_variables.py`; field map,
   * "Title-block expansion"): `${NAME}` takes, from lowest to highest
   * precedence, this title block's fields (`TITLE`, `ISSUE_DATE`,
   * `REVISION`, `COMPANY`, `COMMENT1`…`COMMENT9`, the empty string for an
   * absent one), this file's `properties`, the project's `textVariables`,
   * `PROJECTNAME` and `FILENAME` (this file's name); a reference to anything
   * else (`${CURRENT_DATE}`, `${#}`) stays as written. Present exactly when
   * `titleBlock` is. It has the same fields, except that a field or comment
   * whose expansion is empty is absent.
   */
  expandedTitleBlock?: ProjectTitleBlock;

  /** The file's top-level `(property "<name>" "<value>")` forms, keyed by name; KiCad 8 and later write the project's text variables into a board this way. Keys in code point order; an empty name is skipped; when a name repeats, the last form wins. Empty for a schematic, which has no top-level properties. */
  properties: Record<string>;
}

// -------------------------------------------------------------- net classes

/**
 * One net class of the `.kicad_pro` (`net_settings.classes[]`). A value is
 * absent when the class does not state it: KiCad 9 and later then use the
 * `Default` class's value. Values are the file's millimetres converted to
 * nanometres (conventions.md §6).
 */
model ProjectNetClass {
  /** The class name, `name`. */
  @minLength(1)
  name: string;

  /** `track_width`. */
  trackWidthNm?: NonNegativeNanometres;

  /** `clearance`. */
  clearanceNm?: NonNegativeNanometres;

  /** `diff_pair_width`. */
  diffPairWidthNm?: NonNegativeNanometres;

  /** `diff_pair_gap`. */
  diffPairGapNm?: NonNegativeNanometres;

  /** `via_diameter`. */
  viaDiameterNm?: NonNegativeNanometres;

  /** `via_drill`. */
  viaDrillNm?: NonNegativeNanometres;
}

// -------------------------------------------------------------------- root

/**
 * `projections/project.json`: the project file's facts, the header of every
 * schematic file of the hierarchy and of the board, and every path
 * reference they make. Empty form: a project without a schematic or a board
 * lists only what the files it has state.
 */
@jsonSchema
@id("urn:prism:schema:prism.project:a0")
@extension("title", "Project a0")
model ProjectA0 {
  /** Document schema id. */
  schema: "prism.project.a0";

  /** The project's anchor: the repository-relative path of the `.kicad_pro`, equal to the manifest's `config.project_file`. */
  projectFile: RepoPath;

  /** KiCad's `${PROJECTNAME}`: the `.kicad_pro` file name without its last suffix. */
  @minLength(1)
  projectName: string;

  /** The `.kicad_pro` `text_variables`, keyed by variable name, keys in code point order; values as written. Empty when the file has none. */
  textVariables: Record<string>;

  /** The `.kicad_pro` net classes, in file order (`net_settings.classes[]`). Empty when the file has none. */
  netClasses: ProjectNetClass[];

  /** The root schematic, every schematic file reached from it (each once, however many sheets instantiate it), and the board, sorted by `path` in code point order. Empty when the project has neither a schematic nor a board. */
  documents: ProjectDocument[];

  /**
   * Every path reference of the scanned files, sorted by `documentPath`,
   * then `kind`, then `raw`, then `sheetUuid`, then `field`, then
   * `libraryName`, then the embedded target's `footprintUuid`, each in code
   * point order, an absent value before any present one. No two entries are
   * equal. The scanned files are the `.kicad_pro`, `documents`, the
   * project's `fp-lib-table` and `sym-lib-table`, and every drawing-sheet
   * file a `drawing-sheet` reference resolves to inside the sources.
   */
  references: ProjectPathReference[];
}
