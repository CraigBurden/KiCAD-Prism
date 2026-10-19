import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * The stdout document of `prism-kicad system build`
 * (`docs/system-builder/CONTRACTS.md` §8.8).
 */
namespace Prism.Contracts.CliSystemA0;

/** How many of each section the written system bundle holds. */
model CliSystemCounts {
  /** Occurrences read from their design bundles. */
  ready_occurrences: Count;

  /** Board occurrences whose design bundle is not built yet. */
  pending_occurrences: Count;

  /** System nets. */
  nets: Count;

  /** B2B mappings. */
  mates: Count;

  /** Harness link wirings. */
  links: Count;

  /** Sub-port suggestions. */
  suggestions: Count;

  /** Findings of severity error that no waiver covers. */
  errors: Count;

  /** Findings of severity warning that no waiver covers. */
  warnings: Count;
}

/** stdout of `system build` (exit 0), written after `-o` holds the `SystemBundleA0`. */
@jsonSchema
@id("urn:prism:schema:prism.cli.system_result:a0")
@extension("title", "prism-kicad system build result a0")
model CliSystemResultA0 {
  /** Document schema id. */
  schema: "prism.cli.system_result.a0";

  /** The system bundle key (`docs/system-builder/CONTRACTS.md` §8.1). */
  system_bundle_key: Sha256Hex;

  /** SHA-256 of the input document's canonical JSON. */
  document_sha256: Sha256Hex;

  /** The written bundle's section counts. */
  counts: CliSystemCounts;
}
