import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * `projections/occurrences.json` (`prism.occurrences.a0`): the assembly view
 * of one design revision in its default (no variant) state. It lists every
 * placed symbol at every sheet instance it occurs at, with its designator,
 * the properties written on it, its sheet-folded DNP / BOM / board / sim /
 * position-file state and its canonical BOM fields; every board footprint
 * with its assembly attributes; the join between the two by reference
 * designator; and every variant record the files hold, unresolved. The
 * semantic index (`prism.semantic_index.a1`) keeps the per-component view and
 * the resolved per-variant state; field-maps/occurrences.md states how the
 * two relate.
 */
namespace Prism.Contracts.OccurrencesA0;

/**
 * Occurrences of one design revision. Written once per bundle by stage
 * `parse`; carries no provenance (bundle.json records it).
 */
@jsonSchema
@id("urn:prism:schema:prism.occurrences:a0")
@extension("title", "Occurrences a0")
model OccurrencesA0 {
  /** Schema id of this document. */
  schema: "prism.occurrences.a0";

  /**
   * Every sheet instance of the schematic hierarchy, the root sheet first,
   * in hierarchy order: depth-first pre-order from the root sheet, the child
   * sheets of one sheet visited in the order their `(sheet …)` forms appear
   * in that sheet's file. Empty when the project has no schematic.
   */
  sheets: OccurrencesSheet[];

  /**
   * Every placed symbol (a `(symbol …)` form with a `lib_id`, outside
   * `lib_symbols`) at every sheet instance it occurs at: one entry per
   * occurrence, so a symbol in a sheet used twice appears twice. Only sheet
   * instances reached from the root count: a file no sheet reaches, or an
   * instance record whose path no sheet instance has, adds nothing. Power
   * symbols, virtual (`#`) and unannotated (`?`) references included;
   * readers filter. In hierarchy order: grouped by sheet instance in the
   * order of `sheets`, then the `(symbol …)` forms of that sheet's file in
   * file order.
   */
  symbols: OccurrencesSymbol[];

  /**
   * Every footprint of the project's board, in file order (the order of the
   * `(footprint …)` forms in the `.kicad_pcb`). Empty when the project has no
   * board.
   */
  footprints: OccurrencesFootprint[];

  /**
   * The join between symbol occurrences and footprints by reference
   * designator: one entry per distinct reference that a symbol occurrence
   * or a footprint carries. Sorted by `reference`, code point order.
   */
  references: OccurrencesReference[];

  /**
   * Variant names declared by the project's registries, unresolved: first
   * the `.kicad_pro` registry (`$.schematic.variants`) in file order, then
   * the board header `(variants …)` block in file order. Names that appear
   * only in variant records are not repeated here; they are the `name`s of
   * the `variants` arrays of `sheets`, `symbols` and `footprints`.
   */
  variantDeclarations: OccurrencesVariantDeclaration[];
}

/**
 * One sheet instance and the DNP / BOM / board / sim state it passes on to
 * everything placed in it.
 */
model OccurrencesSheet {
  /**
   * KIID path of this sheet instance, schematic form: the root sheet's UUID
   * followed by the UUID of every sheet symbol down to this one. The root
   * sheet's own entry is `/<root uuid>`. Unique within the document; the join
   * key to `prism.semantic_index.a1` `sheetInstances[].sheetInstancePath`.
   */
  sheetPath: KiidPath;

  /**
   * True when this sheet or any sheet above it on its path is marked do not
   * populate (`(dnp yes)` on the sheet symbol). False for the root sheet.
   */
  dnp: boolean;

  /**
   * True when this sheet or any sheet above it on its path is excluded from
   * the BOM (`(in_bom no)` on the sheet symbol). False for the root sheet.
   */
  excludeFromBom: boolean;

  /**
   * True when this sheet or any sheet above it on its path is excluded from
   * the board (`(on_board no)` on the sheet symbol). False for the root sheet.
   */
  excludeFromBoard: boolean;

  /**
   * True when this sheet or any sheet above it on its path is excluded from
   * simulation (`(exclude_from_sim yes)` on the sheet symbol). False for the
   * root sheet.
   */
  excludeFromSim: boolean;

  /**
   * The variant records of this sheet instance, unresolved: the `(variant …)`
   * forms of the sheet symbol's `(instances (project … (path …)))` record
   * whose path is the parent sheet instance's `sheetPath`. In file order.
   * Empty for the root sheet and for a sheet with no records. The resolved
   * per-variant state is `prism.semantic_index.a1` `assembly.variants`.
   */
  variants: OccurrencesVariantRecord[];
}

/**
 * One placed symbol at one sheet instance: what KiCad's BOM, netlist and
 * annotation see as one symbol occurrence.
 */
model OccurrencesSymbol {
  /**
   * KIID path of this occurrence, schematic form: `sheetPath` followed by
   * `/<symbolUuid>`. Unique within the document. Today's occurrence id
   * (semantic index `assembly` keys) and System Builder `portKey`.
   */
  kiidPath: KiidPath;

  /**
   * KIID path, schematic form, of the sheet instance this occurrence is
   * placed in: equal to one `sheets[].sheetPath`.
   */
  sheetPath: KiidPath;

  /** UUID of the `(symbol …)` form, as written. */
  symbolUuid: KiCadUuid;

  /**
   * The repository-relative path of the `.kicad_sch` file the `(symbol …)`
   * form is written in. A reused sheet file holds one form for all its
   * occurrences, so several occurrences share a `documentPath` and
   * `symbolUuid`; `<documentPath>#<symbolUuid>` is the symbol's ObjectRef in
   * `prism.board_objects.a0`.
   */
  documentPath: RepoPath;

  /** Library identifier of the symbol, the form's `lib_id` as written. */
  libId: LibId;

  /**
   * Reference designator of this occurrence: the `reference` of the matched
   * instance record when `instanceMatched` is true, otherwise the symbol's
   * `Reference` property. Absent when neither supplies a non-empty value.
   * Not annotation-checked: may start with `#` or end with `?`.
   */
  reference?: Refdes;

  /**
   * True when the symbol's `(instances …)` block holds a `(path …)` record
   * equal to `sheetPath`; `reference`, `unit` and `variants` then come from
   * it. When several match, the record under the `(project …)` named after
   * the `.kicad_pro` stem wins, else the first in file order. False when
   * none matches: `reference` falls back to the `Reference` property, `unit`
   * to the form's own `(unit …)`, and `variants` is empty.
   */
  instanceMatched: boolean;

  /** Unit number of this occurrence (1 = unit A), from the matched instance record or the form's `(unit …)`. */
  @minValue(1)
  unit: int32;

  /**
   * Effective do-not-populate state in the default design: the symbol's own
   * `(dnp yes)`, or `dnp` of its sheet (`sheets[]` where `sheetPath`
   * matches), which already folds every sheet above it.
   */
  dnp: boolean;

  /**
   * Effective exclude-from-BOM state in the default design: the symbol's own
   * `(in_bom no)`, or `excludeFromBom` of its sheet.
   */
  excludeFromBom: boolean;

  /**
   * Effective exclude-from-board state in the default design: the symbol's
   * own `(on_board no)`, or `excludeFromBoard` of its sheet.
   */
  excludeFromBoard: boolean;

  /**
   * Effective exclude-from-simulation state in the default design: the
   * symbol's own `(exclude_from_sim yes)`, or `excludeFromSim` of its sheet.
   */
  excludeFromSim: boolean;

  /**
   * Effective exclude-from-position-files state in the default design: the
   * symbol's own `(in_pos_files no)`. Sheets never contribute to it.
   */
  excludeFromPosFiles: boolean;

  /**
   * Every `(property "<name>" "<value>")` written on the placed symbol, as
   * written and unescaped, before any variant: keys are the property names
   * (`Reference`, `Value`, `Footprint`, `Datasheet`, `Description`, custom
   * fields), values their text, possibly empty. When a name repeats, the
   * last in file order wins. The `Reference` property is the form's text and
   * may differ from `reference` in a reused sheet. Keys in code point order.
   */
  properties: Record<string>;

  /** The canonical BOM fields of this occurrence, resolved from `properties`. */
  bomFields: OccurrencesBomFields;

  /**
   * The variant records of the matched instance record, unresolved, in file
   * order. Empty when `instanceMatched` is false or the record has none. The
   * resolved per-variant state is `prism.semantic_index.a1`
   * `assembly.variants`.
   */
  variants: OccurrencesVariantRecord[];
}

/**
 * The canonical BOM fields of one symbol occurrence: Prism's fixed BOM
 * column set, each resolved from the occurrence's `properties` by name and
 * aliases. Matching normalizes a property name with Unicode full case
 * folding (Python `str.casefold`) and then deletes every character outside
 * `a-z0-9`; when two properties normalize alike, the later in file order is
 * used. A field is the first non-empty value among its name and aliases, in
 * the listed order; it is absent when none has a non-empty value. The `DNP`
 * and `In BOM` columns are not fields here: they are the occurrence's `dnp`
 * and `excludeFromBom` (`Yes` / `No`).
 */
model OccurrencesBomFields {
  /** Column `Value`: the property named exactly `Value` if non-empty, else name `Value`. */
  value?: string;

  /** Column `Description`: name `Description`. Never the library symbol's description. */
  description?: string;

  /** Column `Datasheet`: names `Datasheet`, `Data Sheet`, `Datasheet URL`, `Datasheet Link`. */
  datasheet?: string;

  /** Column `Manufacturer`: names `Manufacturer`, `MFR`, `Mfr`. */
  manufacturer?: string;

  /** Column `Manufacturer Part Number`: names `Manufacturer Part Number`, `MPN`, `Mfr Part`, `Mfr Part Number`. */
  manufacturerPartNumber?: string;

  /** Column `Vendor`: names `Vendor`, `Supplier`. */
  vendor?: string;

  /** Column `Vendor Part Number`: names `Vendor Part Number`, `VPN`, `Supplier Part Number`, `Supplier PN`. */
  vendorPartNumber?: string;

  /** Column `Footprint`: the property named exactly `Footprint` if non-empty, else name `Footprint`. */
  footprint?: string;

  /** Column `Mass (g)`: names `Mass (g)`, `Mass`, `Weight (g)`. Text as written; no unit conversion. */
  mass?: string;

  /** Column `RQjC (C/W)`: names `RQjC (C/W)`, `RθJC (C/W)`, `RthJC`. Text as written. */
  rqjc?: string;

  /** Column `RQjC_top (C/W)`: names `RQjC_top (C/W)`, `RθJC_top (C/W)`, `RthJC Top`. Text as written. */
  rqjcTop?: string;

  /** Column `Temp_max (C)`: names `Temp_max (C)`, `Max Temperature`, `Tj Max`. Text as written. */
  tempMax?: string;

  /** Column `Temp_min (C)`: names `Temp_min (C)`, `Min Temperature`, `Tj Min`. Text as written. */
  tempMin?: string;

  /** Column `Power Dissipation (W)`: names `Power Dissipation (W)`, `Power Dissipation`, `Pd (W)`. Text as written. */
  powerDissipation?: string;

  /** Column `Rate`: names `Rate`, `Rating`. */
  rate?: string;
}

/**
 * One footprint of the board: its identity, designator and assembly
 * attributes as written. Placement, geometry and library link are in
 * `prism.placements.a1` and `prism.board_objects.a0`.
 */
model OccurrencesFootprint {
  /**
   * UUID of the `(footprint …)` form, as written: its `(uuid …)`. Unique
   * within the document.
   */
  uuid: KiCadUuid;

  /**
   * The repository-relative path of the `.kicad_pcb` file the footprint is
   * written in; `<documentPath>#<uuid>` is the footprint's ObjectRef in
   * `prism.board_objects.a0`.
   */
  documentPath: RepoPath;

  /**
   * Reference designator: the footprint's `Reference` property. Absent when
   * empty.
   */
  reference?: Refdes;

  /** True when the footprint's `(attr …)` holds `dnp`. */
  dnp: boolean;

  /** True when the footprint's `(attr …)` holds `exclude_from_bom`. */
  excludeFromBom: boolean;

  /** True when the footprint's `(attr …)` holds `exclude_from_pos_files`. */
  excludeFromPosFiles: boolean;

  /** The footprint's `(variant …)` records, unresolved, in file order. Empty when it has none. */
  variants: OccurrencesVariantRecord[];
}

/** The symbol occurrences and footprints that share one reference designator. */
model OccurrencesReference {
  /** The reference designator, exactly as on the symbol occurrences and footprints. */
  reference: Refdes;

  /**
   * `kiidPath` of every symbol occurrence whose `reference` this is, in the
   * order of `symbols` (hierarchy order). Several for a multi-unit part, a
   * reference collision or an unannotated reference; empty for a board-only
   * reference.
   */
  symbols: KiidPath[];

  /**
   * `uuid` of every footprint whose `reference` this is, in the order of
   * `footprints` (board file order). Several for alternate footprints that
   * share a designator; empty for a schematic-only reference.
   */
  footprints: KiCadUuid[];
}

/**
 * One `(variant …)` record of a sheet instance, symbol instance or
 * footprint, unresolved: an override that applies only when that variant is
 * selected. Every flag is absent when the record does not set it (the base
 * value applies). A reader selecting a variant takes the first record whose
 * `name` matches: exactly for sheets and symbols, ignoring case for
 * footprints. Resolving needs the holder's own attributes, which this
 * document does not carry; the resolved state is `prism.semantic_index.a1`
 * `assembly`.
 */
model OccurrencesVariantRecord {
  /** Variant name as written. */
  @minLength(1)
  name: string;

  /** Do-not-populate override: `(dnp yes|no)`. */
  dnp?: boolean;

  /**
   * Exclude-from-BOM override. Footprints: `(exclude_from_bom yes|no)`.
   * Sheets and symbols: from `(in_bom …)`, read by the version of the
   * `.kicad_sch` the record is written in: from `20260306` the token is
   * positive (`in_bom yes` is false here); before it the token holds the
   * excluded flag (`in_bom yes` is true here).
   */
  excludeFromBom?: boolean;

  /** Exclude-from-board override, from `(on_board yes|no)` (`on_board no` is true here). Sheets and symbols only. */
  excludeFromBoard?: boolean;

  /** Exclude-from-simulation override, from `(exclude_from_sim yes|no)`. Sheets and symbols only. */
  excludeFromSim?: boolean;

  /**
   * Exclude-from-position-files override. Symbols: from `(in_pos_files …)`
   * (`in_pos_files no` is true here). Footprints: from
   * `(exclude_from_pos_files yes|no)`. Never on sheets.
   */
  excludeFromPosFiles?: boolean;

  /**
   * Field overrides, `(field (name "<name>") (value "<value>"))`: keys are
   * the field names as written, values the override text as written; an
   * empty value is an override to empty. When a name repeats, the last in
   * file order wins. Keys in code point order.
   */
  fields: Record<string>;
}

/** Where a variant declaration is written. */
enum OccurrencesVariantSource {
  /** The `.kicad_pro` registry, `$.schematic.variants`. */
  project,

  /** The board file's header `(variants (variant (name …) (description …)) …)` block. */
  pcb,
}

/** One variant name declared by a project registry. */
model OccurrencesVariantDeclaration {
  /** The registry that declares it. */
  source: OccurrencesVariantSource;

  /**
   * Variant name as written. The project registry contributes every entry
   * that is an object with a non-empty string `name`, KiCad's `< Default >`
   * included.
   */
  @minLength(1)
  name: string;

  /**
   * Description as written. Absent when the declaration has none or an empty
   * one: no `description` key, JSON null or `""` in the project registry; no
   * `(description …)` or `(description "")` in the board header.
   */
  description?: string;
}
