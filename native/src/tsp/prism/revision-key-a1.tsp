import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * The design revision key `prism.revision_key.a1` (ADR §5) and the documents
 * around it: the effective project configuration that is hashed into the key
 * (and is the `--config` input of `prism-kicad revision-key` and
 * `prism-kicad bundle build`), the record `prism-kicad revision-key` prints,
 * and the test-vector file both reference implementations must reproduce.
 *
 * The algorithm (selection rules, path rules, canonical config bytes and the
 * hashed byte framing) is specified normatively in `revision-key.md`; the docs
 * here summarize it and point there.
 */
namespace Prism.Contracts.RevisionKeyA1;

// ------------------------------------------------------------------ shared

/** Object format of the repository, as `git rev-parse --show-object-format` prints it. */
enum RevisionKeyObjectFormat {
  /** SHA-1 repository: every object id is 40 lowercase hex characters. */
  sha1,

  /** SHA-256 repository (`git init --object-format=sha256`): every object id is 64 lowercase hex characters. */
  sha256,
}

/**
 * Kind of a source-set entry, fixed by its git tree mode and object type. The
 * hashed framing spells each kind as git does (revision-key.md, "Hashing").
 */
enum RevisionKeyEntryKind {
  /** Mode `100644`, type `blob`: a regular file. The id is its blob id; for a Git LFS file, the blob id of the committed pointer. */
  regular,

  /** Mode `100755`, type `blob`: a regular file with the executable bit. The id is its blob id. */
  executable,

  /** Mode `120000`, type `blob`: a symbolic link. The id is the blob id of the link target text, never of the file it points to. */
  symlink,

  /** Mode `160000`, type `commit`: a submodule. The id is the commit the gitlink records; the submodule's own files are not listed. */
  gitlink,
}

/**
 * Why an entry is in the source set, from its file name (revision-key.md,
 * "Selection"). Name rules are ASCII case-insensitive. Not hashed: it is
 * derived from the path and kind.
 */
enum RevisionKeySourceCategory {
  /** A `.kicad_pro` file. The configured project file is one of these; others are other projects in the repository. */
  kicadProject: "kicad-project",

  /** A `.kicad_sch` file: a root or sub-sheet of any project in the repository. */
  kicadSchematic: "kicad-schematic",

  /** A `.kicad_pcb` file. */
  kicadBoard: "kicad-board",

  /** A `.kicad_dru` custom design-rules file. */
  kicadDesignRules: "kicad-design-rules",

  /** A `.kicad_wks` drawing-sheet (worksheet) file. */
  kicadWorksheet: "kicad-worksheet",

  /** A `.kicad_jobset` file. */
  kicadJobset: "kicad-jobset",

  /** A file named `fp-lib-table` or `sym-lib-table`. */
  libraryTable: "library-table",

  /** A symbol library: `.kicad_sym`, or a legacy `.lib` or `.dcm`. */
  symbolLibrary: "symbol-library",

  /** A footprint: `.kicad_mod` (normally inside a `.pretty` directory). */
  footprint,

  /** A 3D model file by suffix: `.step`, `.stp`, `.stpz`, `.stepz`, `.step.gz`, `.stp.gz`, `.wrl`, `.wrz`, `.vrml`, `.x3d`, `.igs`, `.iges`, `.idf`, `.emn`, `.wings`. */
  model3d: "model-3d",

  /** A file named `.prism.json` (Prism project settings as committed). */
  prismSettings: "prism-settings",

  /** A symbolic link whose name matches no rule above, for example a link to a model directory. Every symlink is selected. */
  symlink,

  /** A submodule. Every gitlink is selected. */
  gitlink,
}

/** One entry of the source set: a tree entry the key hashes. */
model RevisionKeyEntry {
  /** Repository-relative path, exactly the bytes git lists (UTF-8, never Unicode-normalized or case-folded). */
  path: RepoPath;

  /** Entry kind, from the git mode and object type. */
  kind: RevisionKeyEntryKind;

  /** Blob id (regular, executable, symlink) or recorded commit id (gitlink), in the repository's object format. */
  object_id: GitObjectId;

  /** Selection rule the entry matched; not hashed. */
  category: RevisionKeySourceCategory;
}

/** Number of selected entries per category. Each field is the count of entries whose `category` is the matching value. */
model RevisionKeyCounts {
  /** Entries of category `kicad-project`. */
  kicad_project: Count;

  /** Entries of category `kicad-schematic`. */
  kicad_schematic: Count;

  /** Entries of category `kicad-board`. */
  kicad_board: Count;

  /** Entries of category `kicad-design-rules`. */
  kicad_design_rules: Count;

  /** Entries of category `kicad-worksheet`. */
  kicad_worksheet: Count;

  /** Entries of category `kicad-jobset`. */
  kicad_jobset: Count;

  /** Entries of category `library-table`. */
  library_table: Count;

  /** Entries of category `symbol-library`. */
  symbol_library: Count;

  /** Entries of category `footprint`. */
  footprint: Count;

  /** Entries of category `model-3d`. */
  model_3d: Count;

  /** Entries of category `prism-settings`. */
  prism_settings: Count;

  /** Entries of category `symlink`. */
  symlink: Count;

  /** Entries of category `gitlink`. */
  gitlink: Count;

  /** All selected entries: the sum of the fields above, equal to the length of `entries`. */
  total: Count;
}

// --------------------------------------------------------- effective config

/**
 * How the board stage obtains zone fills (revision-key.md §4; cli-spec.md
 * §5.2.3). The config writes only `saved`: the default is spelled by
 * omitting the field, and an explicit `refill` is `config-invalid`.
 */
enum RevisionKeyZoneFills {
  /** Refill every zone with pcbnew's `ZONE_FILLER` (the default). Never written in a config: the absent field means it. */
  refill,

  /** Use the zone fills saved in the source board; no refill runs, and the manifest records saved-fill provenance with a warning. */
  saved,
}

/**
 * The effective project configuration: everything outside the source files
 * that changes which files are the project or how they are read. Prism
 * resolves it (stored settings over the committed `.prism.json` over
 * detection), by the same function for a commit and for a working tree; the
 * CLI only validates and hashes it. Its canonical bytes, hashed into the key,
 * are the compact JSON of exactly these fields in this order with absent
 * optional fields omitted (revision-key.md, "Canonical config bytes"). All
 * paths are repository-relative.
 */
@jsonSchema
@id("urn:prism:schema:prism.revision_key.effective_config:a1")
@extension("title", "Revision key effective config a1")
model RevisionKeyEffectiveConfigA1 {
  /** Document schema id. */
  schema: "prism.revision_key.effective_config.a1";

  /**
   * The project anchor: the resolved `.kicad_pro` (its last segment ends in
   * `.kicad_pro`, ASCII case-insensitive). Its directory is KiCad's
   * `KIPRJMOD`. Must be a blob entry of the listing.
   */
  project_file: RepoPath;

  /**
   * The root schematic the build parses (ends in `.kicad_sch`). Absent when
   * the project has none or Prism resolved none. Must be a blob entry of the
   * listing when present.
   */
  root_schematic?: RepoPath;

  /**
   * The board the build parses (ends in `.kicad_pcb`). Absent when the
   * project has none or Prism resolved none. Must be a blob entry of the
   * listing when present.
   */
  board?: RepoPath;

  /**
   * Directories whose entries are never selected: Prism's resolved
   * design-output and manufacturing-output directories, whether or not they
   * exist at this revision. Sorted by UTF-8 bytes, strictly increasing; no
   * element lies under another; none contains `project_file`,
   * `root_schematic` or `board`. Empty when nothing is excluded.
   */
  excluded_dirs: RepoPath[];

  /**
   * Zone-fill handling of the board stage, from Prism's stored project
   * setting `zoneFills`. Absent means `refill`; the only value ever written
   * is `saved`, and an explicit `refill` is `config-invalid`, so each config
   * has one spelling. Last in the canonical key order, so a config without it
   * keeps its canonical bytes.
   */
  zone_fills?: RevisionKeyZoneFills;
}

// ------------------------------------------------------------------ record

/** The key was computed from a commit's tree (`--commit`). */
model RevisionKeyCommitSource {
  /** Variant tag. */
  kind: "commit";

  /** The full commit id the given revision resolved to (`git rev-parse --verify <rev>^{commit}`). */
  commit: GitObjectId;
}

/** The key was computed from the working tree (`--worktree`): the tree `git add -A` would stage, computed without writing. */
model RevisionKeyWorktreeSource {
  /** Variant tag. */
  kind: "worktree";
}

/** Where the listing came from. The same content gives the same key either way. */
@oneOf
union RevisionKeySource {
  /** A commit. */
  commit: RevisionKeyCommitSource,

  /** The working tree. */
  worktree: RevisionKeyWorktreeSource,
}

/**
 * Output of `prism-kicad revision-key`: the key with everything needed to
 * recompute and audit it. Printed on stdout as one compact JSON document
 * followed by LF (conventions.md §13).
 */
@jsonSchema
@id("urn:prism:schema:prism.revision_key.record:a1")
@extension("title", "Revision key record a1")
model RevisionKeyRecordA1 {
  /** Document schema id. */
  schema: "prism.revision_key.record.a1";

  /** The design revision key: lowercase hex SHA-256 of the a1 preimage (revision-key.md, "Hashing"). Never truncated. */
  revision_key: Sha256Hex;

  /** Object format of the repository; hashed into the key. */
  object_format: RevisionKeyObjectFormat;

  /** Commit or working tree. Not hashed. */
  source: RevisionKeySource;

  /** The effective configuration that was hashed, after validation; the default one when `--config` was not given. */
  config: RevisionKeyEffectiveConfigA1;

  /** Lowercase hex SHA-256 of the canonical config bytes; the commit index's config column. */
  config_digest: Sha256Hex;

  /** The source set, sorted by `path` in code point order (UTF-8 byte order); the order they are hashed in. Always holds the project file. */
  @minItems(1)
  entries: RevisionKeyEntry[];

  /** Per-category counts of `entries`. */
  counts: RevisionKeyCounts;

  /** Non-fatal findings (for example `lfs-filter-unavailable`), sorted by `code`, then `message`, in code point order. Empty when there are none. */
  warnings: Warning[];
}

// ----------------------------------------------------------------- vectors

/** Name of a test vector: lowercase kebab-case, unique within its array. */
@pattern("^[a-z0-9]+(?:-[a-z0-9]+)*$")
scalar RevisionKeyVectorName extends string;

/** A git tree mode as `git ls-tree` prints it: six octal digits. */
@pattern("^[0-7]{6}$")
scalar RevisionKeyListingMode extends string;

/** Lowercase hexadecimal bytes, two characters per byte. */
@pattern("^(?:[0-9a-f]{2})+$")
scalar RevisionKeyHex extends string;

/** Object type column of a `git ls-tree` record. */
enum RevisionKeyListingType {
  /** A file or symlink. */
  blob,

  /** A gitlink (submodule). */
  commit,

  /** A tree; never printed by `ls-tree -r` without `-t`, and an `unsupported-entry` error if it appears. */
  tree,
}

/** One record of `git ls-tree -r -z --full-tree <commit>`: `<mode> SP <type> SP <object> TAB <path> NUL`. */
model RevisionKeyListingEntry {
  /** Mode column. */
  mode: RevisionKeyListingMode;

  /** Type column. */
  type: RevisionKeyListingType;

  /** Object column. */
  object_id: GitObjectId;

  /** Path column: the raw path bytes decoded as UTF-8. Not necessarily a RepoPath (an `unrepresentable-path` vector holds one that is not). */
  @minLength(1)
  path: string;
}

/** Errors of the pure selection and hashing layers; each ends the whole computation. Every one but `project-absent` is a failure. */
enum RevisionKeyErrorCode {
  /** The effective config breaks a rule of revision-key.md, "Validation". */
  configInvalid: "config-invalid",

  /** The project is absent at this revision: `project_file` is not a selected entry of kind regular, executable or symlink. It ends the selection, but it is an outcome, not a failure: the CLI reports it with the same code as `CliProjectAbsentA0`, exit 10 (revision-key.md §11; conventions.md §8). */
  projectAbsent: "project-absent",

  /** `root_schematic` or `board` is not a blob entry of the listing. */
  configPathMissing: "config-path-missing",

  /** A selected path is not valid UTF-8 or not a RepoPath (for example it contains `:` or `\`). */
  unrepresentablePath: "unrepresentable-path",

  /** A listing record has a mode and type other than the four kinds. */
  unsupportedEntry: "unsupported-entry",

  /** The listing is malformed: a duplicate path, or an object id of the wrong format. */
  invalidListing: "invalid-listing",
}

/** Expected result of a selection vector that succeeds. */
model RevisionKeySelectedOutcome {
  /** Variant tag. */
  kind: "selected";

  /** The selected entries, sorted by `path` in code point order (UTF-8 byte order). */
  entries: RevisionKeyEntry[];

  /** Per-category counts of `entries`. */
  counts: RevisionKeyCounts;

  /** The canonical config bytes as text (revision-key.md, "Canonical config bytes"). */
  @minLength(1)
  config_canonical: string;

  /** SHA-256 of the canonical config bytes. */
  config_digest: Sha256Hex;

  /** The expected revision key. */
  revision_key: Sha256Hex;
}

/** Expected result of a selection vector that fails. */
model RevisionKeyErrorOutcome {
  /** Variant tag. */
  kind: "error";

  /** The error every implementation must report. */
  code: RevisionKeyErrorCode;
}

/** Expected outcome of a selection vector. */
@oneOf
union RevisionKeySelectionOutcome {
  /** The computation succeeds. */
  selected: RevisionKeySelectedOutcome,

  /** The computation fails with a code. */
  error: RevisionKeyErrorOutcome,
}

/** Layer 1: from a full listing and a config to the selected entries and the key. */
model RevisionKeySelectionVector {
  /** Unique vector name. */
  name: RevisionKeyVectorName;

  /** The scratch repository the listing was printed from; vectors of one scenario share a repository at different commits. */
  @minLength(1)
  scenario: string;

  /** What the vector exercises. */
  @minLength(1)
  description: string;

  /** Object format of the repository. */
  object_format: RevisionKeyObjectFormat;

  /** The full listing, record for record in the order `git ls-tree -r -z --full-tree` printed it for a real repository. */
  listing: RevisionKeyListingEntry[];

  /** The effective config given to the computation. Schema-valid, but may break a semantic rule (an `error` outcome). */
  config: RevisionKeyEffectiveConfigA1;

  /** Expected outcome. */
  expected: RevisionKeySelectionOutcome;
}

/** Expected result of a hashing vector. */
model RevisionKeyHashingExpected {
  /** The canonical config bytes as text. */
  @minLength(1)
  config_canonical: string;

  /** SHA-256 of the canonical config bytes. */
  config_digest: Sha256Hex;

  /** The whole hashed preimage, in hex. */
  preimage_hex: RevisionKeyHex;

  /** SHA-256 of the preimage. */
  revision_key: Sha256Hex;
}

/** Layer 2: from selected entries and a config to the preimage and the key. */
model RevisionKeyHashingVector {
  /** Unique vector name. */
  name: RevisionKeyVectorName;

  /** What the vector exercises. */
  @minLength(1)
  description: string;

  /** Object format; hashed. */
  object_format: RevisionKeyObjectFormat;

  /** The effective config. */
  config: RevisionKeyEffectiveConfigA1;

  /** The entries in the order the hashing function receives them, deliberately not sorted in some vectors: the function sorts them by path bytes. `category` is ignored. */
  entries: RevisionKeyEntry[];

  /** Expected values. */
  expected: RevisionKeyHashingExpected;
}

/** How the keys of related selection vectors compare. */
enum RevisionKeyRelationKind {
  /** All named vectors have the same key. */
  sameKey: "same-key",

  /** All named vectors have pairwise different keys. */
  differentKey: "different-key",
}

/** An assertion about the keys of two or more selection vectors, stating the intent behind them. */
model RevisionKeyVectorRelation {
  /** Same or different keys. */
  relation: RevisionKeyRelationKind;

  /** Names of `selected` selection vectors, sorted in code point order. */
  @minItems(2)
  vectors: RevisionKeyVectorName[];

  /** Why the keys compare this way. */
  @minLength(1)
  reason: string;
}

/**
 * The revision-key test vectors (`revision-key-vectors.json`). Expected
 * values were computed by two independent implementations (Python and Node)
 * that agree byte for byte; WP-K's Python and WP-B's Rust references must
 * reproduce every value.
 */
@jsonSchema
@id("urn:prism:schema:prism.revision_key.vectors:a1")
@extension("title", "Revision key vectors a1")
model RevisionKeyVectorsA1 {
  /** Document schema id. */
  schema: "prism.revision_key.vectors.a1";

  /** Version of git that printed every listing, as `git --version` reports it (for example `2.55.0`). */
  @minLength(1)
  listing_git_version: string;

  /** Layer 1 vectors, sorted by `name` in code point order. */
  selection: RevisionKeySelectionVector[];

  /** Layer 2 vectors, sorted by `name` in code point order. */
  hashing: RevisionKeyHashingVector[];

  /** Key assertions over selection vectors, sorted by `relation`, then by `vectors` element by element, in code point order. */
  relations: RevisionKeyVectorRelation[];
}
