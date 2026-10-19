import "@typespec/json-schema";
import "./common.tsp";
import "./system-v2.tsp";
import "./system-bundle-a0.tsp";
import "./board-sub-ports-a0.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * A published system's frozen payload (`prism.system_entry.a0`, System
 * Builder v2 stage 1c): the document, the board-level sub-ports it names and
 * its system bundle at one snapshot, and the interface its exports make. It is
 * a `system` catalog revision's `system_entry` asset, so the revision manifest
 * covers it, and the input `prism-kicad system build --entry` reads for an
 * occurrence that places the entry. The rules are in
 * `docs/system-builder/CONTRACTS.md` §11–§12.
 *
 * Unfrozen until System Builder v2's stage 5, like the system document.
 */
namespace Prism.Contracts.SystemEntryA0;

/** Where the payload was published from. */
model SystemEntrySource {
  /** The system's id in the workspace it was published from. */
  @minLength(1)
  @maxLength(128)
  systemId: string;

  /** The document version published. */
  @minValue(1)
  version: int32;

  /** The snapshot holding that version. */
  @minLength(1)
  @maxLength(128)
  snapshotId: string;

  /** The key of `bundle`. */
  systemBundleKey: Sha256Hex;
}

/** One pin of an exported connector or sub-port. */
model SystemEntryInterfacePin {
  /** The pad on the export's site. */
  pad: PadNumber;

  /** The interface name: the export's `pinNames`, else the board's pin name, else the pad. */
  @minLength(1)
  name: string;

  /** The system net the pin is on. */
  net: Prism.Contracts.SystemBundleA0.SystemBundleNetId;

  /** That net's name; absent when the net has none. */
  signal?: string;
}

/** One export as the interface shows it. */
model SystemEntryInterfaceExport {
  /** The export's id: what an endpoint on the placed entry names as its connector. */
  id: Prism.Contracts.SystemV2.SystemObjectId;

  /** The export's name. */
  name: Prism.Contracts.SystemV2.SystemLabel;

  /** The occurrence of its site. */
  occurrence: Prism.Contracts.SystemV2.SystemObjectId;

  /** The connector of its site. */
  connector: Refdes;

  /** The sub-port of its site, when the export is one. */
  subPort?: Prism.Contracts.SystemV2.SystemSubPortRef;

  /** Its pins in the site's order: the sub-port's, else natural pad order. */
  pins: SystemEntryInterfacePin[];
}

/** The interface a published system offers. */
model SystemEntryInterface {
  /** The exports, sorted by `id` in code point order. */
  exports: SystemEntryInterfaceExport[];
}

/** A published system's frozen payload. */
@jsonSchema
@id("urn:prism:schema:prism.system_entry:a0")
@extension("title", "System entry a0")
model SystemEntryA0 {
  /** Schema id. */
  schema: "prism.system_entry.a0";

  /** Where it was published from. */
  source: SystemEntrySource;

  /** The document at `source.version`. */
  document: Prism.Contracts.SystemV2.SystemV2;

  /** The board-level sub-ports the document names, as they were. */
  boardSubPorts: Prism.Contracts.BoardSubPortsA0.BoardSubPortsA0;

  /** The system bundle built from exactly these. */
  bundle: Prism.Contracts.SystemBundleA0.SystemBundleA0;

  /** The interface its exports make. */
  `interface`: SystemEntryInterface;
}
