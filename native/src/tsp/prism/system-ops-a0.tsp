import "@typespec/json-schema";
import "./common.tsp";
import "./system-v2.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;
using Prism.Contracts.SystemV2;

/**
 * System Builder v2 operations (`prism.system.ops.a0`, ADR System Builder v2
 * §3.2): the only way a `prism.system.v2` document changes. A request's
 * operations are validated and applied in order as one transaction that
 * produces one new document version. The API and `window.prismSystemBuilder`
 * send the same requests. Ids are always chosen by the caller and never
 * reused within a document. Cascades, validation and undo are in
 * `docs/system-builder/CONTRACTS.md` §3.
 *
 * Unfrozen until System Builder v2's stage 5, like the document.
 *
 * This file is generated from a table by a script; keep its shape regular.
 */
namespace Prism.Contracts.SystemOpsA0;

// ------------------------------------------------------- collection ops

/** Adds a sheet; its id must be new to the document. */
model SystemOpAddSheet {
  /** The operation. */
  kind: "add-sheet";

  /** The new object. */
  sheet: SystemSheet;
}

/** Replaces a sheet as a whole; the id names the one replaced. */
model SystemOpReplaceSheet {
  /** The operation. */
  kind: "replace-sheet";

  /** The object as it should be. */
  sheet: SystemSheet;
}

/** Removes a sheet, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveSheet {
  /** The operation. */
  kind: "remove-sheet";

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds an occurrence; its id must be new to the document. */
model SystemOpAddOccurrence {
  /** The operation. */
  kind: "add-occurrence";

  /** The new object. */
  occurrence: SystemOccurrence;
}

/** Replaces an occurrence as a whole; the id names the one replaced. */
model SystemOpReplaceOccurrence {
  /** The operation. */
  kind: "replace-occurrence";

  /** The object as it should be. */
  occurrence: SystemOccurrence;
}

/** Removes an occurrence, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveOccurrence {
  /** The operation. */
  kind: "remove-occurrence";

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds an occurrence-level sub-port; its id must be new to the document. */
model SystemOpAddSubPort {
  /** The operation. */
  kind: "add-sub-port";

  /** The new object. */
  subPort: SystemSubPort;
}

/** Replaces an occurrence-level sub-port as a whole; the id names the one replaced. */
model SystemOpReplaceSubPort {
  /** The operation. */
  kind: "replace-sub-port";

  /** The object as it should be. */
  subPort: SystemSubPort;
}

/** Removes an occurrence-level sub-port, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveSubPort {
  /** The operation. */
  kind: "remove-sub-port";

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a body connector; its id must be new to the document. */
model SystemOpAddBodyConnector {
  /** The operation. */
  kind: "add-body-connector";

  /** The new object. */
  bodyConnector: SystemBodyConnector;
}

/** Replaces a body connector as a whole; the id names the one replaced. */
model SystemOpReplaceBodyConnector {
  /** The operation. */
  kind: "replace-body-connector";

  /** The object as it should be. */
  bodyConnector: SystemBodyConnector;
}

/** Removes a body connector, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveBodyConnector {
  /** The operation. */
  kind: "remove-body-connector";

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a B2B mate; its id must be new to the document. */
model SystemOpAddMate {
  /** The operation. */
  kind: "add-mate";

  /** The new object. */
  mate: SystemMate;
}

/** Replaces a B2B mate as a whole; the id names the one replaced. */
model SystemOpReplaceMate {
  /** The operation. */
  kind: "replace-mate";

  /** The object as it should be. */
  mate: SystemMate;
}

/** Removes a B2B mate, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveMate {
  /** The operation. */
  kind: "remove-mate";

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a harness block with its contents; its id must be new to the document. */
model SystemOpAddHarness {
  /** The operation. */
  kind: "add-harness";

  /** The new object. */
  harness: SystemHarness;
}

/** Replaces a harness block's own fields (label, sheet); its contents change only through their own operations. */
model SystemOpReplaceHarness {
  /** The operation. */
  kind: "replace-harness";

  /** The block's own fields as they should be. */
  harness: SystemOpHarnessInfo;
}

/** Removes a harness block with its contents, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveHarness {
  /** The operation. */
  kind: "remove-harness";

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds an export; its id must be new to the document. */
model SystemOpAddExport {
  /** The operation. */
  kind: "add-export";

  /** The new object. */
  export: SystemExport;
}

/** Replaces an export as a whole; the id names the one replaced. */
model SystemOpReplaceExport {
  /** The operation. */
  kind: "replace-export";

  /** The object as it should be. */
  export: SystemExport;
}

/** Removes an export, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveExport {
  /** The operation. */
  kind: "remove-export";

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a waiver; its id must be new to the document. */
model SystemOpAddWaiver {
  /** The operation. */
  kind: "add-waiver";

  /** The new object. */
  waiver: SystemWaiver;
}

/** Removes a waiver, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveWaiver {
  /** The operation. */
  kind: "remove-waiver";

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a harness end; its id must be new to the document. */
model SystemOpAddEnd {
  /** The operation. */
  kind: "add-end";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  end: SystemHarnessEnd;
}

/** Replaces a harness end as a whole; the id names the one replaced. */
model SystemOpReplaceEnd {
  /** The operation. */
  kind: "replace-end";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  end: SystemHarnessEnd;
}

/** Removes a harness end, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveEnd {
  /** The operation. */
  kind: "remove-end";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a harness link; its id must be new to the document. */
model SystemOpAddLink {
  /** The operation. */
  kind: "add-link";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  link: SystemHarnessLink;
}

/** Replaces a harness link as a whole; the id names the one replaced. */
model SystemOpReplaceLink {
  /** The operation. */
  kind: "replace-link";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  link: SystemHarnessLink;
}

/** Removes a harness link, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveLink {
  /** The operation. */
  kind: "remove-link";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a wire; its id must be new to the document. */
model SystemOpAddWire {
  /** The operation. */
  kind: "add-wire";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  wire: SystemHarnessWire;
}

/** Replaces a wire as a whole; the id names the one replaced. */
model SystemOpReplaceWire {
  /** The operation. */
  kind: "replace-wire";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  wire: SystemHarnessWire;
}

/** Removes a wire, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveWire {
  /** The operation. */
  kind: "remove-wire";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a splice; its id must be new to the document. */
model SystemOpAddSplice {
  /** The operation. */
  kind: "add-splice";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  splice: SystemHarnessSplice;
}

/** Replaces a splice as a whole; the id names the one replaced. */
model SystemOpReplaceSplice {
  /** The operation. */
  kind: "replace-splice";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  splice: SystemHarnessSplice;
}

/** Removes a splice, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveSplice {
  /** The operation. */
  kind: "remove-splice";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a branch point; its id must be new to the document. */
model SystemOpAddBranchPoint {
  /** The operation. */
  kind: "add-branch-point";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  branchPoint: SystemHarnessBranchPoint;
}

/** Replaces a branch point as a whole; the id names the one replaced. */
model SystemOpReplaceBranchPoint {
  /** The operation. */
  kind: "replace-branch-point";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  branchPoint: SystemHarnessBranchPoint;
}

/** Removes a branch point, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveBranchPoint {
  /** The operation. */
  kind: "remove-branch-point";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a segment; its id must be new to the document. */
model SystemOpAddSegment {
  /** The operation. */
  kind: "add-segment";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  segment: SystemHarnessSegment;
}

/** Replaces a segment as a whole; the id names the one replaced. */
model SystemOpReplaceSegment {
  /** The operation. */
  kind: "replace-segment";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  segment: SystemHarnessSegment;
}

/** Removes a segment, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveSegment {
  /** The operation. */
  kind: "remove-segment";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a covering; its id must be new to the document. */
model SystemOpAddCovering {
  /** The operation. */
  kind: "add-covering";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  covering: SystemHarnessCovering;
}

/** Replaces a covering as a whole; the id names the one replaced. */
model SystemOpReplaceCovering {
  /** The operation. */
  kind: "replace-covering";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  covering: SystemHarnessCovering;
}

/** Removes a covering, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveCovering {
  /** The operation. */
  kind: "remove-covering";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a cable; its id must be new to the document. */
model SystemOpAddCable {
  /** The operation. */
  kind: "add-cable";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  cable: SystemHarnessCable;
}

/** Replaces a cable as a whole; the id names the one replaced. */
model SystemOpReplaceCable {
  /** The operation. */
  kind: "replace-cable";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  cable: SystemHarnessCable;
}

/** Removes a cable, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveCable {
  /** The operation. */
  kind: "remove-cable";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a loose end; its id must be new to the document. */
model SystemOpAddLooseEnd {
  /** The operation. */
  kind: "add-loose-end";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  looseEnd: SystemHarnessLooseEnd;
}

/** Replaces a loose end as a whole; the id names the one replaced. */
model SystemOpReplaceLooseEnd {
  /** The operation. */
  kind: "replace-loose-end";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  looseEnd: SystemHarnessLooseEnd;
}

/** Removes a loose end, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveLooseEnd {
  /** The operation. */
  kind: "remove-loose-end";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a marker; its id must be new to the document. */
model SystemOpAddMarker {
  /** The operation. */
  kind: "add-marker";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  marker: SystemHarnessMarker;
}

/** Replaces a marker as a whole; the id names the one replaced. */
model SystemOpReplaceMarker {
  /** The operation. */
  kind: "replace-marker";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  marker: SystemHarnessMarker;
}

/** Removes a marker, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveMarker {
  /** The operation. */
  kind: "remove-marker";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

/** Adds a waypoint; its id must be new to the document. */
model SystemOpAddWaypoint {
  /** The operation. */
  kind: "add-waypoint";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The new object. */
  waypoint: SystemHarnessWaypoint;
}

/** Replaces a waypoint as a whole; the id names the one replaced. */
model SystemOpReplaceWaypoint {
  /** The operation. */
  kind: "replace-waypoint";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The object as it should be. */
  waypoint: SystemHarnessWaypoint;
}

/** Removes a waypoint, with what depends on it (CONTRACTS.md §3.2). */
model SystemOpRemoveWaypoint {
  /** The operation. */
  kind: "remove-waypoint";

  /** The harness block it is in. */
  harness: SystemObjectId;

  /** The id of the object removed. */
  id: SystemObjectId;
}

// --------------------------------------------------------- semantic ops

/** A name and description change. */
model SystemOpSetSystemInfo {
  /** The operation. */
  kind: "set-system-info";

  /** The new name; absent leaves it. */
  name?: SystemLabel;

  /** The new description; absent leaves it, null clears it. */
  description?: SystemDescription | null;
}

/** Draws a harness wire between two endpoints: adds ends for connectors that have none in the block, then the link. */
model SystemOpConnectHarness {
  /** The operation. */
  kind: "connect-harness";

  /** The harness block; absent uses the block either connector already belongs to, or creates one with `newHarness`. */
  harness?: SystemObjectId;

  /** The id and label of the block to create when no block applies; absent when one does. */
  newHarness?: SystemOpNewHarness;

  /** Ids for ends the operation adds, keyed by the side that needs one: the keys are `a` and `b`. */
  newEnds: Record<SystemObjectId>;

  /** The new link. */
  link: SystemHarnessLink;
}

/** Dismisses a bundle sub-port suggestion. */
model SystemOpDismissSuggestion {
  /** The operation. */
  kind: "dismiss-suggestion";

  /** The suggestion dismissed. */
  suggestion: SystemDismissedSuggestion;
}

/** Brings back a dismissed suggestion. */
model SystemOpRestoreSuggestion {
  /** The operation. */
  kind: "restore-suggestion";

  /** The suggestion restored. */
  suggestion: SystemDismissedSuggestion;
}

/** Places an object's symbol in the schematic. */
model SystemOpSetLayout {
  /** The operation. */
  kind: "set-layout";

  /** The object's id. */
  item: SystemObjectId;

  /** Where it goes. */
  placement: SystemSchematicPlacement;
}

/** Drops an object's schematic placement. */
model SystemOpRemoveLayout {
  /** The operation. */
  kind: "remove-layout";

  /** The object's id. */
  item: SystemObjectId;
}

/** Moves a followed board to a newer commit of its branch; issued by the system job. */
model SystemOpAdvanceOccurrence {
  /** The operation. */
  kind: "advance-occurrence";

  /** The occurrence. */
  occurrence: SystemObjectId;

  /** The commit it advances to. */
  commit: GitObjectId;
}

/** Marks a followed board's changes as reviewed: `reviewedCommit` becomes `commit`. */
model SystemOpAcknowledgeChanges {
  /** The operation. */
  kind: "acknowledge-changes";

  /** The occurrence. */
  occurrence: SystemObjectId;
}

/** Promotes an occurrence-level sub-port to a new board-level one and repoints its endpoints (CONTRACTS.md §10.5). */
model SystemOpPromoteSubPort {
  /** The operation. */
  kind: "promote-sub-port";

  /** The occurrence-level sub-port. */
  subPort: SystemObjectId;

  /** The new board-level sub-port's id, chosen by the caller. */
  boardSubPort: SystemObjectId;
}

/** Accepts a board-level sub-port's current definition: sets `version` on every endpoint naming it. */
model SystemOpAcknowledgeSubPort {
  /** The operation. */
  kind: "acknowledge-sub-port";

  /** The board-level sub-port. */
  subPort: SystemObjectId;

  /** The version accepted. */
  @minValue(1) version: int32;
}

/** Replaces the whole document with one read from the system's Git link; only the import route issues it (CONTRACTS.md §13.3). */
model SystemOpImportDocument {
  /** The operation. */
  kind: "import-document";

  /** The document imported. */
  document: Prism.Contracts.SystemV2.SystemV2;
}

/** A harness block's own fields, without its contents. */
model SystemOpHarnessInfo {
  /** The block's id. */
  id: SystemObjectId;

  /** Its label. */
  label: SystemLabel;

  /** The sheet its block is drawn on; absent means the root sheet. */
  sheet?: SystemObjectId;
}

/** The block `connect-harness` creates. */
model SystemOpNewHarness {
  /** The new block's id. */
  id: SystemObjectId;

  /** Its label. */
  label: SystemLabel;
}

/** One operation. */
@oneOf
union SystemOp {
  /** Adds a sheet; its id must be new to the document. */
  addSheet: SystemOpAddSheet,

  /** Replaces a sheet as a whole; the id names the one replaced. */
  replaceSheet: SystemOpReplaceSheet,

  /** Removes a sheet, with what depends on it (CONTRACTS.md §3.2). */
  removeSheet: SystemOpRemoveSheet,

  /** Adds an occurrence; its id must be new to the document. */
  addOccurrence: SystemOpAddOccurrence,

  /** Replaces an occurrence as a whole; the id names the one replaced. */
  replaceOccurrence: SystemOpReplaceOccurrence,

  /** Removes an occurrence, with what depends on it (CONTRACTS.md §3.2). */
  removeOccurrence: SystemOpRemoveOccurrence,

  /** Adds an occurrence-level sub-port; its id must be new to the document. */
  addSubPort: SystemOpAddSubPort,

  /** Replaces an occurrence-level sub-port as a whole; the id names the one replaced. */
  replaceSubPort: SystemOpReplaceSubPort,

  /** Removes an occurrence-level sub-port, with what depends on it (CONTRACTS.md §3.2). */
  removeSubPort: SystemOpRemoveSubPort,

  /** Adds a body connector; its id must be new to the document. */
  addBodyConnector: SystemOpAddBodyConnector,

  /** Replaces a body connector as a whole; the id names the one replaced. */
  replaceBodyConnector: SystemOpReplaceBodyConnector,

  /** Removes a body connector, with what depends on it (CONTRACTS.md §3.2). */
  removeBodyConnector: SystemOpRemoveBodyConnector,

  /** Adds a B2B mate; its id must be new to the document. */
  addMate: SystemOpAddMate,

  /** Replaces a B2B mate as a whole; the id names the one replaced. */
  replaceMate: SystemOpReplaceMate,

  /** Removes a B2B mate, with what depends on it (CONTRACTS.md §3.2). */
  removeMate: SystemOpRemoveMate,

  /** Adds a harness block with its contents; its id must be new to the document. */
  addHarness: SystemOpAddHarness,

  /** Replaces a harness block's own fields (label, sheet); its contents change only through their own operations. */
  replaceHarness: SystemOpReplaceHarness,

  /** Removes a harness block with its contents, with what depends on it (CONTRACTS.md §3.2). */
  removeHarness: SystemOpRemoveHarness,

  /** Adds an export; its id must be new to the document. */
  addExport: SystemOpAddExport,

  /** Replaces an export as a whole; the id names the one replaced. */
  replaceExport: SystemOpReplaceExport,

  /** Removes an export, with what depends on it (CONTRACTS.md §3.2). */
  removeExport: SystemOpRemoveExport,

  /** Adds a waiver; its id must be new to the document. */
  addWaiver: SystemOpAddWaiver,

  /** Removes a waiver, with what depends on it (CONTRACTS.md §3.2). */
  removeWaiver: SystemOpRemoveWaiver,

  /** Adds a harness end; its id must be new to the document. */
  addEnd: SystemOpAddEnd,

  /** Replaces a harness end as a whole; the id names the one replaced. */
  replaceEnd: SystemOpReplaceEnd,

  /** Removes a harness end, with what depends on it (CONTRACTS.md §3.2). */
  removeEnd: SystemOpRemoveEnd,

  /** Adds a harness link; its id must be new to the document. */
  addLink: SystemOpAddLink,

  /** Replaces a harness link as a whole; the id names the one replaced. */
  replaceLink: SystemOpReplaceLink,

  /** Removes a harness link, with what depends on it (CONTRACTS.md §3.2). */
  removeLink: SystemOpRemoveLink,

  /** Adds a wire; its id must be new to the document. */
  addWire: SystemOpAddWire,

  /** Replaces a wire as a whole; the id names the one replaced. */
  replaceWire: SystemOpReplaceWire,

  /** Removes a wire, with what depends on it (CONTRACTS.md §3.2). */
  removeWire: SystemOpRemoveWire,

  /** Adds a splice; its id must be new to the document. */
  addSplice: SystemOpAddSplice,

  /** Replaces a splice as a whole; the id names the one replaced. */
  replaceSplice: SystemOpReplaceSplice,

  /** Removes a splice, with what depends on it (CONTRACTS.md §3.2). */
  removeSplice: SystemOpRemoveSplice,

  /** Adds a branch point; its id must be new to the document. */
  addBranchPoint: SystemOpAddBranchPoint,

  /** Replaces a branch point as a whole; the id names the one replaced. */
  replaceBranchPoint: SystemOpReplaceBranchPoint,

  /** Removes a branch point, with what depends on it (CONTRACTS.md §3.2). */
  removeBranchPoint: SystemOpRemoveBranchPoint,

  /** Adds a segment; its id must be new to the document. */
  addSegment: SystemOpAddSegment,

  /** Replaces a segment as a whole; the id names the one replaced. */
  replaceSegment: SystemOpReplaceSegment,

  /** Removes a segment, with what depends on it (CONTRACTS.md §3.2). */
  removeSegment: SystemOpRemoveSegment,

  /** Adds a covering; its id must be new to the document. */
  addCovering: SystemOpAddCovering,

  /** Replaces a covering as a whole; the id names the one replaced. */
  replaceCovering: SystemOpReplaceCovering,

  /** Removes a covering, with what depends on it (CONTRACTS.md §3.2). */
  removeCovering: SystemOpRemoveCovering,

  /** Adds a cable; its id must be new to the document. */
  addCable: SystemOpAddCable,

  /** Replaces a cable as a whole; the id names the one replaced. */
  replaceCable: SystemOpReplaceCable,

  /** Removes a cable, with what depends on it (CONTRACTS.md §3.2). */
  removeCable: SystemOpRemoveCable,

  /** Adds a loose end; its id must be new to the document. */
  addLooseEnd: SystemOpAddLooseEnd,

  /** Replaces a loose end as a whole; the id names the one replaced. */
  replaceLooseEnd: SystemOpReplaceLooseEnd,

  /** Removes a loose end, with what depends on it (CONTRACTS.md §3.2). */
  removeLooseEnd: SystemOpRemoveLooseEnd,

  /** Adds a marker; its id must be new to the document. */
  addMarker: SystemOpAddMarker,

  /** Replaces a marker as a whole; the id names the one replaced. */
  replaceMarker: SystemOpReplaceMarker,

  /** Removes a marker, with what depends on it (CONTRACTS.md §3.2). */
  removeMarker: SystemOpRemoveMarker,

  /** Adds a waypoint; its id must be new to the document. */
  addWaypoint: SystemOpAddWaypoint,

  /** Replaces a waypoint as a whole; the id names the one replaced. */
  replaceWaypoint: SystemOpReplaceWaypoint,

  /** Removes a waypoint, with what depends on it (CONTRACTS.md §3.2). */
  removeWaypoint: SystemOpRemoveWaypoint,

  /** Sets the name or description. */
  setSystemInfo: SystemOpSetSystemInfo,

  /** Draws a harness wire between two endpoints: adds ends for connectors that have none in the block, then the link. */
  connectHarness: SystemOpConnectHarness,

  /** Dismisses a bundle sub-port suggestion. */
  dismissSuggestion: SystemOpDismissSuggestion,

  /** Brings back a dismissed suggestion. */
  restoreSuggestion: SystemOpRestoreSuggestion,

  /** Places an object's symbol in the schematic. */
  setLayout: SystemOpSetLayout,

  /** Drops an object's schematic placement. */
  removeLayout: SystemOpRemoveLayout,

  /** Moves a followed board to a newer commit of its branch; issued by the system job. */
  advanceOccurrence: SystemOpAdvanceOccurrence,

  /** Marks a followed board's changes as reviewed: `reviewedCommit` becomes `commit`. */
  acknowledgeChanges: SystemOpAcknowledgeChanges,

  /** Promotes an occurrence-level sub-port to a new board-level one and repoints its endpoints (CONTRACTS.md §10.5). */
  promoteSubPort: SystemOpPromoteSubPort,

  /** Accepts a board-level sub-port's current definition: sets `version` on every endpoint naming it. */
  acknowledgeSubPort: SystemOpAcknowledgeSubPort,

  /** Replaces the whole document with one read from the system's Git link; only the import route issues it (CONTRACTS.md §13.3). */
  importDocument: SystemOpImportDocument,
}

/**
 * A request: operations applied in order, as one transaction, on the version
 * the caller read. That version travels as the HTTP `If-Match` ETag, not in
 * the body (`docs/system-builder/CONTRACTS.md` §3.1).
 */
@jsonSchema
@id("urn:prism:schema:prism.system.ops:a0")
@extension("title", "System ops a0")
model SystemOpsA0 {
  /** Schema id. */
  schema: "prism.system.ops.a0";

  /** The operations, in the order they are applied. */
  @minItems(1)
  ops: SystemOp[];
}
