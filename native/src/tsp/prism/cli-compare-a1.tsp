import "@typespec/json-schema";
import "./common.tsp";
import "./design-compare-a1.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;
using Prism.Contracts.DesignCompareA1;

/**
 * The stdout document of `prism-kicad compare` (cli-spec.md §5.6). It left
 * `cli-a0.tsp` at a1, when `prism.compare.object_delta.a0` was removed and its
 * object diff counts gave way to the result's per-tab counts (ADR amendment
 * C2r §4).
 */
namespace Prism.Contracts.CliCompareA1;

/** One side of a `compare` (cli-spec.md §5.6). */
model CliCompareSide {
  /** The side's revision key, from `--<side>-revision-key` in both modes (ADR amendment K2 §3.6). */
  revision_key: Sha256Hex;

  /** The bundle key of the side's bundle (cli-spec.md §5.1.4), computed from its manifest's revision key and generator id. Absent for a source tree. */
  bundle_key?: Sha256Hex;

  /** How many objects the side's `projections/board-objects.json` holds, review-only objects included: today's `objects`. */
  objects: Count;
}

/**
 * stdout of `compare` (exit 0), written after `-o` holds the
 * `DesignCompareResultA1` document (cli-spec.md §5.6). a1 replaced a0's object
 * diff counts with the result's per-tab counts when `prism.compare.object_delta.a0`
 * was removed (ADR amendment C2r §4).
 */
@jsonSchema
@id("urn:prism:schema:prism.cli.compare_result:a1")
@extension("title", "prism-kicad compare result a1")
model CliCompareResultA1 {
  /** Document schema id. */
  schema: "prism.cli.compare_result.a1";

  /** The `--base` side. */
  base: CliCompareSide;

  /** The `--head` side. */
  head: CliCompareSide;

  /** The result's change counts per tab: its `counts`. */
  counts: DesignCompareCounts;
}
