import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * ecad-viewer's comparison input, `prism.kicad_project_diff_v1`, embedded as
 * `projectDiff` in `DesignCompareResultA1` (amendment C2r §2 item 2).
 *
 * This is a **mirror contract**: it types the document ecad-viewer reads today
 * (`frontend/src/components/design-comparison/types.ts:280-338`, passed with
 * `diffFormat: "prism"`, `frontend/src/types/ecad-viewer.d.ts:360-380`), which
 * is modeled on KiCad's native PROJECT_DIFF. Its names, value encoding and
 * `null`s are ecad-viewer's, not this repository's conventions; a change here
 * is an ecad-viewer change. Today `document_diff_service.build_project_diff`
 * writes it; under C2r, `prism-kicad compare` does.
 *
 * The file has no root: the document is never written on its own.
 */
namespace Prism.Contracts.KicadProjectDiffV1;

/** What a native change does to its object, in ecad-viewer's vocabulary. */
enum KiCadProjectDiffChangeKind {
  /** The object exists only in the comparison revision. */
  added,

  /** The object exists only in the reference revision. */
  removed,

  /** The object exists in both revisions and differs. */
  modified,

  /** Two objects claim the same identity (ecad-viewer's native-KiCad input; Prism never writes it). */
  collision,

  /** One revision repeats a UUID (ecad-viewer's native-KiCad input; Prism never writes it). */
  duplicateUuid: "duplicate_uuid",
}

/** The revision pane a native change is painted in. */
enum KiCadProjectDiffSourceSide {
  /** The base (old) revision. */
  reference,

  /** The head (new) revision. */
  comparison,
}

/** The KiCad file type of one document of the diff. */
enum KiCadProjectDiffDocType {
  /** A schematic sheet. */
  kicadSch: "kicad_sch",

  /** The board. */
  kicadPcb: "kicad_pcb",
}

/** The encoding of one property value, after KiCad's PROJECT_DIFF. */
enum KiCadProjectDiffValueType {
  /** No value: the property does not exist on this side. `v` is `null`. */
  `null`,

  /** A flag. */
  bool,

  /** An integer. */
  int,

  /** A real number. */
  double,

  /** A text, or any other value written as its text. */
  string,
}

/** A property value: a text, a number or a flag. */
union KiCadProjectDiffScalar {
  /** A text. */
  text: string,

  /** A number. */
  number: float64,

  /** A flag. */
  flag: boolean,
}

/** One side's value of a property: its encoding and the value. */
model KiCadProjectDiffValue {
  /** How `v` is encoded. */
  type: KiCadProjectDiffValueType;

  /** The value; `null` exactly when `type` is `null` (ecad-viewer's encoding). */
  v?: KiCadProjectDiffScalar | null;

  /** A display label ecad-viewer shows instead of `v`. Absent when `v` is shown as is. */
  label?: string;
}

/** One property that differs between the two revisions of a native change. */
model KiCadProjectDiffProperty {
  /** The property's display name, for example `Position` or `Net`. */
  name: string;

  /** The reference revision's value. */
  before: KiCadProjectDiffValue;

  /** The comparison revision's value. */
  after: KiCadProjectDiffValue;
}

/**
 * One changed KiCad object ecad-viewer resolves against its own parsed scene
 * and highlights. ecad-viewer measures the geometry itself, so `bbox` is
 * absent in Prism's output.
 */
model KiCadProjectDiffItemChange {
  /** The object's native identity: its KIID path, or its UUID when it has no path. */
  id: string;

  /** KiCad's C++ type name of the object, for example `SCH_SYMBOL`, `PCB_TRACK` or `ZONE`; `EDA_ITEM` when no specific type applies. */
  typeName: string;

  /** What the change does to the object. */
  kind: KiCadProjectDiffChangeKind;

  /** The revision pane the object is painted in. */
  sourceSide?: KiCadProjectDiffSourceSide;

  /** The properties that differ, sorted by `name` in code point order. Empty for a child change. */
  properties: KiCadProjectDiffProperty[];

  /** Bounds `[x0, y0, x1, y1]`, in that order, in KiCad document millimetres. Absent in Prism's output; native KiCad diffs carry it. */
  @minItems(4)
  @maxItems(4)
  bbox?: float64[];

  /** The reference designator, or the net name for a net-level change. Absent when the change has neither. */
  refdes?: string;

  /** True when the reference pane keeps the object visible although the change belongs to the comparison. Absent means false. */
  retainReference?: true;

  /** Further objects of the same review item in this document, in review order. Empty when there are none. */
  children: KiCadProjectDiffItemChange[];
}

/** One KiCad document's native changes. */
model KiCadProjectDiffDocument {
  /** The document's path, relative to the project directory (amendment C2 D1). */
  path: string;

  /** The document's file type. */
  docType: KiCadProjectDiffDocType;

  /** The document's native changes, in review order. */
  changes: KiCadProjectDiffItemChange[];
}

/** The project part of the diff. */
model KiCadProjectDiffProject {
  /** One entry per document with at least one change, sorted by `path` in code point order. */
  documents: KiCadProjectDiffDocument[];
}

/** Where one review item's native changes sit in one document. */
model KiCadProjectDiffNavigationDocument {
  /** The document's path, as in `KiCadProjectDiffDocument.path`. */
  documentPath: string;

  /** The first native change id of the review item in this document. */
  changeId: string;

  /** Every native change id of the review item in this document, in review order. */
  changeIds: string[];
}

/** Where one review item's native changes sit: its first document, and every document when there is more than one. */
model KiCadProjectDiffNavigation {
  /** The first document's path. */
  documentPath: string;

  /** The first native change id in the first document. */
  changeId: string;

  /** Every native change id in the first document, in review order. */
  changeIds?: string[];

  /** One entry per document, in review order. Absent when the review item touches one document. */
  documents?: KiCadProjectDiffNavigationDocument[];
}

/** A review item no native object could be found for. */
model KiCadProjectDiffDiagnostic {
  /** The review item's id (`DesignCompareChange.id`). */
  changeId: string;

  /** Why, in ecad-viewer's vocabulary, for example `missing-source-id`. */
  reason: string;
}

/** ecad-viewer's comparison input. */
model KiCadProjectDiffBundleV1 {
  /** Document schema id, in ecad-viewer's spelling. */
  schema: "prism.kicad_project_diff_v1";

  /** Who produced the diff: `prism-semantic` for Prism. */
  provider: "prism-semantic";

  /** The native changes, per document. */
  project: KiCadProjectDiffProject;

  /** Keys are review item ids (`DesignCompareChange.id`); each maps to the native changes ecad-viewer selects for it. */
  navigation: Record<KiCadProjectDiffNavigation>;

  /** Review items that resolved to no native object, in review order. Empty when there are none. */
  diagnostics: KiCadProjectDiffDiagnostic[];
}
