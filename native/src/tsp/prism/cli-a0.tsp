import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * JSON documents of the `prism-kicad` command-line tool (cli-spec.md). The
 * family is `prism.cli`, not `kicad_cli`, so nothing is confused with KiCad's
 * own `kicad-cli`.
 *
 * Every command writes exactly one document to stdout (a result, a report,
 * CliProjectAbsentA0 or CliErrorA0, as cli-spec.md §3 assigns them to exit
 * codes) and zero or more
 * CliDiagnosticA0 lines to stderr. Field names are snake_case (bundle
 * machinery, conventions.md §5). No document carries a host path, a
 * wall-clock time or a measured duration: files are named by the path they
 * have as bundle members, so the same inputs give byte-identical stdout.
 */
namespace Prism.Contracts.CliA0;

// ------------------------------------------------------------------ scalars

/**
 * A release version of three dot-separated decimal numbers without leading
 * zeros, for example `0.1.0` (SemVer), `2026.9.7` (the fork's CalVer) or
 * `10.0.6` (KiCad, as `kicad-cli version` prints it). Printable ASCII only,
 * which keeps the generator id's canonical form unambiguous (cli-spec.md §5.1).
 */
@pattern("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$")
scalar CliReleaseVersion extends string;

/** A one-based line or column number. */
@minValue(1)
scalar CliOneBased extends safeint;

/**
 * A JSON Pointer (RFC 6901) into a JSON file: empty for the whole document,
 * otherwise `/`-separated reference tokens with `~0` for `~` and `~1` for `/`.
 */
@pattern("^(/([^~/]|~[01])*)*$")
scalar CliJsonPointer extends string;

/** A duration in integer milliseconds (conventions.md §6, CLI limits). */
@minValue(0)
scalar CliMilliseconds extends safeint;

// -------------------------------------------------------------------- enums

/** How serious a stderr diagnostic is. */
enum CliSeverity {
  /** Progress or a note; the command is unaffected. */
  info,

  /** A finding the command records and continues past, for example a manifest warning. */
  warning,

  /** A finding that makes the command fail, or the stage it belongs to fail. */
  error,
}

/**
 * Why a command failed. Each category has exactly one exit code
 * (cli-spec.md §4); a caller may switch on either.
 */
enum CliErrorCategory {
  /** Exit 1: a defect in prism-kicad itself (a panic or a broken invariant). */
  internal,

  /** Exit 2: the arguments are wrong: unknown command or option, missing or repeated value, conflicting options. */
  usage,

  /** Exit 3: an input file named by an argument cannot be used: missing, not a regular file, not the expected format, or an input bundle that fails verification. */
  input,

  /** Exit 4: a resource limit was exceeded, including the memory cap. The limit is named in `limit`. */
  resourceLimit: "resource-limit",

  /** Exit 5: the command ran past its wall-clock timeout (`timeout-ms`). */
  timeout,

  /** Exit 6: an output could not be written: the output directory is missing or unwritable, the disk is full, or stdout failed. */
  outputIo: "output-io",

  /** Exit 7: the inputs are individually valid but do not fit together: wrong stage order, generator, revision key, KiCad version or a missing member. */
  precondition,
}

/**
 * A stage of `bundle build`, in the order the stages run (ADR §4.4). The
 * same three stages are recorded in the bundle manifest.
 */
enum CliBuildStage {
  /** One parse of the sources: `sources/**`, `design.json` and every `projections/*.json`. */
  parse,

  /** The board and its materialization: `refilled/<board file name>` and `materialization/board.kmpack`, or only the materialization of the saved board when the config has `zone_fills: "saved"` (cli-spec.md §5.2.3). */
  board,

  /** The component bodies exported by KiCad: `viewer/models/components.glb`. */
  models,
}

/** The state of one stage in a bundle. */
enum CliStageStatus {
  /** Not run yet. The only status that is not final; for a stored bundle a stage only moves from `pending` to a final status (bundle-format.md §3.3). */
  pending,

  /** Ran to the end and wrote every member that applies to the project. */
  complete,

  /** Ran to the end, but the producer of at least one member failed on the design's content; `failed_members` lists each such member and the others are in the bundle. */
  partial,

  /** Stopped on an error in the design's content, given in `error`. None of the stage's members are in the bundle, except the source members of stage `parse`. */
  failed,

  /** Will never run for this bundle; `skip_reason` says why. */
  skipped,
}

/** Why a stage is skipped. */
enum CliSkipReason {
  /** The effective configuration names no board (`board` absent), so there is nothing to refill, materialize or export. */
  noBoard: "no-board",

  /** The stage before it did not allow it to run: stage `parse` is `failed` (for `board`), or stage `board` is not `complete` (for `models`). Takes precedence over `no-board`. */
  earlierStageFailed: "earlier-stage-failed",
}

/** Outcome of `bundle verify`. */
enum CliVerifyStatus {
  /** Every check passed; `findings` is empty. */
  valid,

  /** At least one check failed; `findings` lists them. */
  invalid,
}

/** A command that can find the project absent at a revision (CliProjectAbsentA0). */
enum CliProjectAbsentCommand {
  /** `revision-key`: the listing has no entry at the project file. */
  revisionKey: "revision-key",

  /** `bundle build --stage parse`: nothing is at `<project.kicad_pro>` under the source root. */
  bundleBuild: "bundle build",
}

/**
 * A command-line argument a diagnostic or error is about, named as the usage
 * text names it: an option by its long name without the leading `--`, a
 * positional argument by its placeholder. Used instead of echoing the
 * argument's value, which may be a host path.
 */
enum CliArgument {
  /** The command word itself (`bundle build`, `version`, ...). */
  command,

  /** `<project.kicad_pro>` of `bundle build --stage parse`. */
  projectFile: "project-file",

  /** `<bundle>` of `bundle verify` and `bundle extract`. */
  bundle,

  /** A `<member>` of `bundle extract`. */
  member,

  /** `<repo>` of `revision-key`. */
  repo,

  /** `-o`/`--output`. */
  output,

  /** `--in`. */
  in,

  /** `--stage`. */
  stage,

  /** `--source-root`. */
  sourceRoot: "source-root",

  /** `--refilled-board`; required by stage `board` in refill mode and refused with `zone_fills: "saved"` (`zone-fills-mismatch`). */
  refilledBoard: "refilled-board",

  /** `--refill-tool`; given exactly when `--refilled-board` is. */
  refillTool: "refill-tool",

  /** `--models-glb`. */
  modelsGlb: "models-glb",

  /** `--models-tool`. */
  modelsTool: "models-tool",

  /** `--revision-key`. */
  revisionKey: "revision-key",

  /** `--key-record` of `bundle build --stage parse`. */
  keyRecord: "key-record",

  /** An `--upgraded` of `bundle build --stage parse`: a source the backend upgraded from an older KiCad file format (cli-spec.md §9.4). */
  upgraded,

  /** `--config`. */
  config,

  /** `--commit` of `revision-key`. */
  commit,

  /** `--worktree` of `revision-key`. */
  worktree,

  /** `--project` of `revision-key`. */
  project,

  /** `--limit`. */
  limit,

  /** `--threads`. */
  threads,

  /** `--quiet`. */
  quiet,
}

/**
 * A resource limit (cli-spec.md §7.2). The suffix gives the unit: `-bytes` is
 * bytes, `-ms` is milliseconds, anything else is a count. Every limit can be
 * set with `--limit <name>=<value>`, up to its hard bound. Hitting one is
 * never recorded in a bundle: limits are configuration, not part of the
 * bundle key.
 */
enum CliLimitName {
  /** Most files in the selected source set. */
  maxSourceFiles: "max-source-files",

  /** Largest single source file; also applies to `--refilled-board`. */
  maxSourceFileBytes: "max-source-file-bytes",

  /** Largest sum of the selected source files' sizes. */
  maxTotalSourceBytes: "max-total-source-bytes",

  /** Longest repository or archive path in UTF-8 bytes (bundle-format.md §5; each segment is at most 255 bytes regardless). */
  maxPathBytes: "max-path-bytes",

  /** Deepest s-expression list nesting in one KiCad file, the root list at depth 0. */
  maxSexprDepth: "max-sexpr-depth",

  /** Most s-expression nodes (lists plus atoms) in one KiCad file. */
  maxSexprNodes: "max-sexpr-nodes",

  /** Longest decoded quoted string in one KiCad file. */
  maxSexprStringBytes: "max-sexpr-string-bytes",

  /** Deepest JSON nesting in `.kicad_pro`, `--config` or `bundle.json`. */
  maxJsonDepth: "max-json-depth",

  /** Most JSON values in `.kicad_pro`, `--config` or `bundle.json`. Other JSON members being verified are bounded by `max-member-bytes` instead: a large board's `design.json` can exceed 8M values. */
  maxJsonNodes: "max-json-nodes",

  /** Largest `--config` file. */
  maxConfigBytes: "max-config-bytes",

  /** Largest `--models-glb` file. */
  maxModelsGlbBytes: "max-models-glb-bytes",

  /** Most operations the materializer may emit for one board. */
  maxMaterializationOperations: "max-materialization-operations",

  /** Largest uncompressed archive member, written or read. */
  maxMemberBytes: "max-member-bytes",

  /** Largest archive file, written or read. */
  maxArchiveBytes: "max-archive-bytes",

  /** Most members in one archive, `bundle.json` included. */
  maxArchiveMembers: "max-archive-members",

  /** Largest sum of uncompressed member sizes in one archive. */
  maxTotalUnpackedBytes: "max-total-unpacked-bytes",

  /** Highest uncompressed-to-compressed size ratio of one member larger than 1 MiB, rounded down. */
  maxCompressionRatio: "max-compression-ratio",

  /** Most stderr diagnostic lines one invocation writes before `diagnostics-truncated`. */
  maxDiagnosticLines: "max-diagnostic-lines",

  /** Most findings one `bundle verify` report lists before `findings-truncated`. */
  maxFindings: "max-findings",

  /** Most heap memory the process may hold at once. */
  maxMemoryBytes: "max-memory-bytes",

  /** Wall-clock time one invocation may run, from process start. */
  timeoutMs: "timeout-ms",
}

/**
 * The source-upgrade procedure the backend runs before stage `parse`
 * (cli-spec.md §9.4). Pinned in the generator id because its output is the
 * bytes of upgraded source members.
 */
enum CliUpgradeProcedure {
  /** Boards: `pcbnew.KIID.SeedGenerator(0x50524953)`, then `pcbnew.LoadBoard` and `pcbnew.SaveBoard` on a scratch copy beside its `.kicad_pro`, keeping only the `.kicad_pcb`. Schematics: `kicad-cli sch upgrade`. Only files whose `(version …)` is older than the KiCad's format are upgraded. */
  kicadSeededUpgradeA0: "kicad-seeded-upgrade-a0",
}

/**
 * The zone-refill procedure the backend runs before stage `board`
 * (cli-spec.md §9.2). Pinned in the generator id because its output is a
 * bundle member.
 */
enum CliRefillProcedure {
  /** `pcbnew.ZONE_FILLER(board).Fill(board.Zones())` then `pcbnew.SaveBoard`, on a scratch copy of the board beside its `.kicad_pro` and `.kicad_dru`, run by KiCad's Python. */
  pcbnewZoneFillerA0: "pcbnew-zone-filler-a0",
}

/**
 * The component-model export the backend runs before stage `models`
 * (cli-spec.md §9.3). Pinned in the generator id because its output is a
 * bundle member.
 */
enum CliModelsProcedure {
  /** `kicad-cli pcb export glb --force --no-board-body --output <dir>/components.glb <board>` on the source board. */
  kicadCliGlbA0: "kicad-cli-glb-a0",
}

// ------------------------------------------------------------- small models

/**
 * Where a finding is. Every field is optional; a field is present only when
 * it is known. The field names are single words so the model can move to
 * common.tsp unchanged and serve camelCase documents too.
 */
model CliLocation {
  /**
   * The file, named by the path it has as a bundle member, whether or not a
   * bundle has been written yet: `sources/<RepoPath>` for a source file,
   * `refilled/<board file name>` for the `--refilled-board` input (refill mode only),
   * `viewer/models/components.glb` for the `--models-glb` input,
   * the member path itself for a member of an existing bundle. Absent when the finding
   * is about an argument file that is not a member (`--config`) or about no
   * file at all.
   */
  path?: ArchivePath;

  /** One-based line of the finding in a text file. */
  line?: CliOneBased;

  /** One-based column, counted in Unicode scalar values, on `line`. */
  column?: CliOneBased;

  /** Zero-based byte offset of the finding from the start of the file. */
  offset?: ByteCount;

  /** JSON Pointer to the value in a JSON file (a `.kicad_pro`, `--config`, or a JSON member). */
  pointer?: CliJsonPointer;

  /** UUID of the KiCad object the finding is about, as written in the file. */
  uuid?: KiCadUuid;
}

/** A size limit that was hit: a limit whose name ends in `-bytes`. */
model CliByteLimitHit {
  /** Variant tag: the limit is a size in bytes. */
  kind: "bytes";

  /** Which limit. */
  name: CliLimitName;

  /** The limit's value for this invocation, its default or the `--limit` override. */
  limit_bytes: ByteCount;

  /** The size that exceeded it, when the input's size was known before reading it (a file or a declared member size). Absent when the work stopped at the limit without knowing the total, and always for `max-memory-bytes`. */
  observed_bytes?: ByteCount;
}

/** A time limit that was hit: `timeout-ms`. */
model CliTimeLimitHit {
  /** Variant tag: the limit is a duration. */
  kind: "time";

  /** Which limit. */
  name: CliLimitName;

  /** The limit's value for this invocation. No elapsed time is reported: documents carry no measured durations. */
  limit_ms: CliMilliseconds;
}

/** A count limit that was hit: a limit whose name ends neither in `-bytes` nor in `-ms`. */
model CliCountLimitHit {
  /** Variant tag: the limit is a count. */
  kind: "count";

  /** Which limit. */
  name: CliLimitName;

  /** The limit's value for this invocation, its default or the `--limit` override. */
  limit_count: Count;

  /** The count that exceeded it, when it was known before stopping (for example the number of selected source files). Absent otherwise. */
  observed_count?: Count;
}

/**
 * The limit a resource-limit or timeout error, or a diagnostic, hit. The
 * variant follows the limit name's unit suffix.
 */
@oneOf
union CliLimitHit {
  /** A size limit. */
  bytes: CliByteLimitHit,

  /** The wall-clock limit. */
  time: CliTimeLimitHit,

  /** A count limit. */
  count: CliCountLimitHit,
}

/** A finding with a stable code, a message for people and an optional location. */
model CliFinding {
  /** Stable code (cli-spec.md §8) that tools and tests match on. */
  code: DiagnosticCode;

  /** One-sentence explanation for people. It never contains a host path; its wording may change between versions. */
  @minLength(1)
  message: string;

  /** Where the finding is, when known. */
  location?: CliLocation;
}

/** A member a stage could not write, and why. */
model CliMemberFailure {
  /** The member's archive path, for example `projections/system-interface.json`. */
  path: ArchivePath;

  /** Stable code (cli-spec.md §8), for example `projection-failed`. */
  code: DiagnosticCode;

  /** One-sentence explanation for people. It never contains a host path. */
  @minLength(1)
  message: string;
}

/**
 * The state of one build stage: the status, error, skip reason and failed
 * members of the stage's record in the bundle manifest, copied verbatim. The
 * manifest's other per-stage fields (warnings, fill check, cross-check) are
 * not repeated.
 */
model CliStageState {
  /** The stage. */
  stage: CliBuildStage;

  /** Its state. */
  status: CliStageStatus;

  /** The content error that failed the stage. Present exactly when `status` is `failed`. */
  error?: CliFinding;

  /** Why the stage will never run. Present exactly when `status` is `skipped`. */
  skip_reason?: CliSkipReason;

  /** The members the stage could not write, sorted by `path` in code point order. Non-empty exactly when `status` is `partial`. */
  failed_members: CliMemberFailure[];
}

/** One archive member and its digest. */
model CliMemberDigest {
  /** The member's archive path. */
  path: ArchivePath;

  /** Its uncompressed size in bytes. */
  bytes: ByteCount;

  /** SHA-256 of its uncompressed bytes. */
  sha256: Sha256Hex;
}

/** One member the generator writes with a schema, and that schema's id. */
model CliVersionMemberSchema {
  /** The member's archive path, for example `projections/stackup.json`. */
  path: ArchivePath;

  /** The schema id the member's content follows, for example `prism.stackup.a0`. */
  schema: SchemaId;
}

// --------------------------------------------------------------------- roots

/** KiCad's current `(version N)` per source format, declared in code point order. */
model CliKicadFileFormats {
  /** `.kicad_pcb`, for example `20260206`. */
  @minValue(20000000)
  @maxValue(99991231)
  board: safeint;

  /** `.kicad_sch`, for example `20260306`. */
  @minValue(20000000)
  @maxValue(99991231)
  schematic: safeint;
}

/**
 * The generator id: the stdout of `prism-kicad version`. It states everything
 * that decides the bytes of a bundle besides the sources (ADR §5), and is
 * bumped explicitly, never derived from binary or source bytes.
 *
 * Fields are declared in canonical order: `schema` first, then the other keys
 * in code point order, which is also the order inside every nested object.
 * The canonical bytes (cli-spec.md §5.1) are that compact serialization; the
 * generator digest and the bundle key are SHA-256 over them.
 */
@jsonSchema
@id("urn:prism:schema:prism.cli.version:a0")
@extension("title", "prism-kicad version a0")
model CliVersionA0 {
  /** Document schema id. */
  schema: "prism.cli.version.a0";

  /**
   * Version of the `prism-kicad-cli` crate. Bumped whenever any member's
   * bytes or any recorded stage outcome could change for the same inputs:
   * the core, a projection producer, the manifest or archive writer, or the
   * GLB canonicalization (cli-spec.md §5.1.2).
   */
  crate_version: CliReleaseVersion;

  /** Version of the parser core crate (`ENGINE_VERSION`, the fork's `kicad-monkey-core`, `prism-kicad-core` after WP-F2). */
  engine_version: CliReleaseVersion;

  /**
   * The current file formats of `kicad_version`: the `(version N)` KiCad
   * writes. Sources older than them are upgraded before stage `parse`
   * (cli-spec.md §9.4), and the parser reads only these formats, so they
   * decide every parsed member's bytes. Raised with `kicad_version`.
   */
  kicad_file_formats: CliKicadFileFormats;

  /**
   * KiCad version of the KiCad-produced members (the refilled board and
   * `components.glb`), exactly as `kicad-cli version` prints it. It also
   * pins KiCad's stock 3D model library. `--refill-tool` and
   * `--models-tool` must have its major.minor; patch releases are tolerated.
   */
  kicad_version: CliReleaseVersion;

  /**
   * Every member this generator writes with a schema (`bundle.json`,
   * `design.json`, the materialization and every projection) and its schema
   * id, sorted by `path` in code point order.
   */
  @minItems(1)
  member_schemas: CliVersionMemberSchema[];

  /** The procedure the backend must use to produce `--models-glb`. */
  models_procedure: CliModelsProcedure;

  /** Format version of the packed materialization encoding (`PACK_FORMAT_VERSION` of the materialization-pack crate), which the materialization schema id does not pin. */
  pack_format_version: uint16;

  /** The procedure the backend must use to produce `--refilled-board`. */
  refill_procedure: CliRefillProcedure;

  /** The procedure the backend must use to upgrade sources older than `kicad_version`'s file format before stage `parse` (cli-spec.md §9.4). */
  upgrade_procedure: CliUpgradeProcedure;
}

/**
 * One stderr line. stderr is JSON Lines: every line is one compact
 * CliDiagnosticA0 followed by LF, in the order the findings happen. It is a
 * log for people and the job log; callers never take control decisions from
 * it, only from the exit code and stdout.
 */
@jsonSchema
@id("urn:prism:schema:prism.cli.diagnostic:a0")
@extension("title", "prism-kicad diagnostic a0")
model CliDiagnosticA0 {
  /** Document schema id. */
  schema: "prism.cli.diagnostic.a0";

  /** How serious the finding is. */
  severity: CliSeverity;

  /** Stable code (cli-spec.md §8). */
  code: DiagnosticCode;

  /** One-sentence explanation for people, at most 4096 bytes. It never contains a host path. */
  @minLength(1)
  message: string;

  /** The `bundle build` stage the finding belongs to. Absent for other commands and for findings outside a stage (argument parsing). */
  stage?: CliBuildStage;

  /** The command-line argument the finding is about, when it is about one. */
  argument?: CliArgument;

  /** Where the finding is, when known. */
  location?: CliLocation;

  /** The limit that was hit, for `limit-exceeded` and `diagnostics-truncated`. */
  limit?: CliLimitHit;
}

/**
 * stdout of a command that failed with exit code 1 to 7 (cli-spec.md §4).
 * When it is written, the command wrote nothing else: `-o` is unchanged.
 */
@jsonSchema
@id("urn:prism:schema:prism.cli.error:a0")
@extension("title", "prism-kicad error a0")
model CliErrorA0 {
  /** Document schema id. */
  schema: "prism.cli.error.a0";

  /** Why the command failed; equivalent to the exit code. */
  category: CliErrorCategory;

  /** Stable code (cli-spec.md §8). */
  code: DiagnosticCode;

  /** One-sentence explanation for people, at most 4096 bytes. It never contains a host path. */
  @minLength(1)
  message: string;

  /** The `bundle build` stage that was running. Absent for other commands and for failures before a stage starts. */
  stage?: CliBuildStage;

  /** The command-line argument the failure is about, when it is about one. */
  argument?: CliArgument;

  /** Where the failure is, when known. */
  location?: CliLocation;

  /** The limit that was hit. Present exactly when `category` is `resource-limit` or `timeout`. */
  limit?: CliLimitHit;
}

/**
 * stdout of `bundle build` when it wrote `-o`: exit 0 when the stage ended
 * `complete`, exit 9 when it ended `failed` or `partial`. In both cases the
 * outcome is recorded in the written bundle.
 */
@jsonSchema
@id("urn:prism:schema:prism.cli.build_result:a0")
@extension("title", "prism-kicad bundle build result a0")
model CliBuildResultA0 {
  /** Document schema id. */
  schema: "prism.cli.build_result.a0";

  /** The stage this invocation ran. */
  stage: CliBuildStage;

  /**
   * Every stage's state in the written bundle, exactly as its manifest
   * records it, in stage order: `parse`, `board`, `models`.
   */
  @minItems(3)
  @maxItems(3)
  stages: CliStageState[];

  /** Size of the written archive file in bytes. */
  archive_bytes: ByteCount;

  /** SHA-256 of the written archive file. */
  archive_sha256: Sha256Hex;

  /**
   * The members whose bytes this invocation wrote, sorted by `path` in code
   * point order: every member for stage `parse`; `bundle.json` and the
   * stage's own members for a later stage. Members copied unchanged from
   * `--in` are not listed.
   */
  @minItems(1)
  written_members: CliMemberDigest[];

  /** The warnings this stage added to the manifest, in the order the manifest lists them. */
  warnings: Warning[];
}

/** stdout of `bundle verify`: exit 0 when `status` is `valid`, exit 8 when it is `invalid`. */
@jsonSchema
@id("urn:prism:schema:prism.cli.verify_report:a0")
@extension("title", "prism-kicad bundle verify report a0")
model CliVerifyReportA0 {
  /** Document schema id. */
  schema: "prism.cli.verify_report.a0";

  /** Whether the bundle passed every check. */
  status: CliVerifyStatus;

  /** The `schema` that `bundle.json` declares, when `bundle.json` could be read and declares a well-formed schema id. */
  manifest_schema?: SchemaId;

  /** Whether the manifest's generator id equals this binary's, byte for byte in canonical form. Absent when the manifest could not be read as `prism.bundle.manifest.a2`. A bundle of another generator can be valid. */
  generator_matches?: boolean;

  /** Every stage's state as the manifest records it, in stage order (`parse`, `board`, `models`); empty when the manifest could not be read. */
  stages: CliStageState[];

  /** How many members' sizes and SHA-256 digests were checked against the manifest. */
  members_checked: Count;

  /**
   * Every failed check, sorted by `location.path` in code point order
   * (findings without a path first), then by `code`, then by `message`.
   * Empty exactly when `status` is `valid`. At most `max-findings` entries
   * plus one `findings-truncated`.
   */
  findings: CliFinding[];
}

/** stdout of `bundle extract` (exit 0). */
@jsonSchema
@id("urn:prism:schema:prism.cli.extract_result:a0")
@extension("title", "prism-kicad bundle extract result a0")
model CliExtractResultA0 {
  /** Document schema id. */
  schema: "prism.cli.extract_result.a0";

  /**
   * Every member extracted, which is every member the `<member>` arguments
   * selected, sorted by `path` in code point order. Each was written to
   * `<output>/<path>` and its size and SHA-256 checked against the manifest.
   */
  @minItems(1)
  members: CliMemberDigest[];
}

/**
 * stdout of `revision-key` and of `bundle build --stage parse` when the
 * project is absent at this revision: its anchor, the project file, is not
 * in the tree (exit 10, cli-spec.md §4). This is an outcome, not a failure
 * (conventions.md §8): the revision has no such project, so it has no
 * revision key and no bundle, nothing is retried, and consumers show "not
 * present at this revision". Nothing is written to `-o`.
 */
@jsonSchema
@id("urn:prism:schema:prism.cli.project_absent:a0")
@extension("title", "prism-kicad project absent a0")
model CliProjectAbsentA0 {
  /** Document schema id. */
  schema: "prism.cli.project_absent.a0";

  /** Stable code of the outcome (cli-spec.md §8), equivalent to exit 10. */
  code: "project-absent";

  /** The command that found the project absent. */
  command: CliProjectAbsentCommand;

  /** The absent anchor, repository-relative: `--project` of `revision-key`, or `<project.kicad_pro>` of `bundle build` relative to the source root. */
  project_file: RepoPath;

  /** The full commit id the revision resolved to, for `revision-key --commit`. Absent for `--worktree` and for `bundle build`. */
  commit?: GitObjectId;
}
