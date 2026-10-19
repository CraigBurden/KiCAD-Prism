import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * Board-level sub-ports (System Builder v2 stage 1c, ADR §2.3): a board's
 * published pin groups, stored against the project and connector and shared
 * by every system that places the board. `prism.board_sub_ports.a0` is the set
 * a system's document names, as `prism-kicad system build --board-sub-ports`
 * reads it and a snapshot keeps it. The rules, and the HTTP API's record, are
 * in `docs/system-builder/CONTRACTS.md` §10.
 *
 * Unfrozen until System Builder v2's stage 5, like the system document.
 */
namespace Prism.Contracts.BoardSubPortsA0;

// ----------------------------------------------------------------- scalars

/** A board-level sub-port's id: unique across the workspace, never reused. */
@pattern("^[a-z][a-z0-9_-]{0,63}$")
scalar BoardSubPortId extends string;

/** Prism project id: `prj_` and 12 lowercase hexadecimal digits. */
@pattern("^prj_[0-9a-f]{12}$")
scalar BoardSubPortProjectId extends string;

/** A sub-port's name: 1 to 64 characters, unique among a connector's live sub-ports. */
@minLength(1)
@maxLength(64)
scalar BoardSubPortName extends string;

/** A pad number in a sub-port: never the empty pad of an unnumbered hole. */
@minLength(1)
scalar BoardSubPortPad extends PadNumber;

// ------------------------------------------------------------------ models

/** One definition as a system bundle build reads it. */
model BoardSubPortsEntry {
  /** Its id. */
  id: BoardSubPortId;

  /** The project it belongs to. */
  projectId: BoardSubPortProjectId;

  /** The connector it groups pins of. */
  connector: Refdes;

  /** Its name. */
  name: BoardSubPortName;

  /** Pad numbers in the user's order. */
  @minItems(1)
  pins: BoardSubPortPad[];

  /** Its current version. */
  @minValue(1)
  version: int32;

  /** Whether it was deleted; a deleted one gives its endpoints no pins. */
  deleted: boolean;

  /**
   * The pins at each earlier version an endpoint of the document names, so a
   * change of pins can be told from a rename. Sorted by `version`, ascending.
   */
  previous: BoardSubPortsPreviousPins[];
}

/** A board-level sub-port's pins at an earlier version. */
model BoardSubPortsPreviousPins {
  /** The version. */
  @minValue(1)
  version: int32;

  /** Its pads, in order. */
  @minItems(1)
  pins: BoardSubPortPad[];
}

/**
 * The board-level sub-ports a system document names, deleted ones included:
 * the input of `prism-kicad system build --board-sub-ports`, and the copy a
 * snapshot keeps (CONTRACTS.md §10.5).
 */
@jsonSchema
@id("urn:prism:schema:prism.board_sub_ports:a0")
@extension("title", "Board sub-ports a0")
model BoardSubPortsA0 {
  /** Schema id. */
  schema: "prism.board_sub_ports.a0";

  /** The definitions, sorted by `id` in code point order. */
  subPorts: BoardSubPortsEntry[];
}
