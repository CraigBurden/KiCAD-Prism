import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * The JLCPCB vendor configuration (`prism.vendor.jlcpcb.config.a0`,
 * ADR amendment C3 §3.3): the input of `prism-kicad vendor run jlcpcb --config`.
 *
 * It is **a config file that mirrors an existing file**, so every field keeps
 * the file's spelling (`conventions.md` §5, the config-file exemption): the
 * keys are snake_case exactly as
 * `backend/app/release_studio/vendors/jlcpcb.config.jsonc` writes them (Cruncher
 * 2026.9.7's `bom_pnp_model.py`
 * `BomPnpConfig`). Only `schema` changes, from `kicad_cruncher.bom.config.a0`
 * to `prism.vendor.jlcpcb.config.a0`.
 *
 * Field-by-field sources are in `field-maps/release-studio-tools.md`.
 */
namespace Prism.Contracts.VendorJlcpcbA0;

// -------------------------------------------------------------------- enums

/** How the vendor run selects variants. */
enum VendorJlcpcbVariantMode {
  /** Only the no-variant base output. */
  base,

  /** The base output and every named variant. */
  all,

  /** Only the variants named in `variants.names`. */
  named,
}

/** One BOM artifact kind the config lists. */
enum VendorJlcpcbBomOutput {
  /** The normalized raw BOM as JSON. */
  rawJson: "raw-json",

  /** The legacy BOM as JSON. */
  legacyJson: "legacy-json",

  /** The grouped BOM as JSON. */
  groupedJson: "grouped-json",

  /** The grouped BOM as CSV. */
  groupedCsv: "grouped-csv",

  /** The grouped BOM as XLSX. */
  groupedXlsx: "grouped-xlsx",

  /** The JLCPCB BOM as CSV. */
  jlcCsv: "jlc-csv",

  /** The JLCPCB BOM as XLSX. */
  jlcXlsx: "jlc-xlsx",
}

/** One pick-and-place artifact kind the config lists. */
enum VendorJlcpcbPnpOutput {
  /** The placement table as JSON. */
  json,

  /** The placement table as CSV. */
  csv,

  /** The placement table as XLSX. */
  xlsx,

  /** The JLCPCB CPL as CSV. */
  jlcCpl: "jlc-cpl",

  /** The JLCPCB CPL as XLSX. */
  jlcCplXlsx: "jlc-cpl-xlsx",
}

/** The coordinate unit of the placement output. The JLCPCB CPL requires `mm`. */
enum VendorJlcpcbPnpUnits {
  /** Millimetres. */
  mm,

  /** Thousandths of an inch. */
  mils,
}

// ------------------------------------------------------------------- models

/** Variant selection used when no `--variant` is given (`variants`). */
model VendorJlcpcbVariants {
  /** How variants are selected. */
  mode: VendorJlcpcbVariantMode;

  /**
   * The variant names used when `mode` is `named`, in file order. Empty when
   * `mode` is not `named`.
   */
  names: string[];

  /** Include the no-variant base output when `mode` is `all` or `named`. */
  include_base: boolean;
}

/** BOM source, grouping, DNP and output settings (`bom`). */
model VendorJlcpcbBom {
  /**
   * The BOM artifact kinds to emit, in file order. Each listed kind is written
   * from one load of the design.
   */
  outputs: VendorJlcpcbBomOutput[];

  /**
   * The canonical fields that must match before components collapse into one
   * grouped BOM line, in file order (`value`, `footprint`).
   */
  group_fields: string[];

  /** Keep do-not-populate components in normalized/grouped BOM outputs. */
  include_dnp: boolean;

  /** Keep fitted and DNP components on separate grouped lines when the group fields match. */
  split_dnp: boolean;
}

/** Placement output settings (`pnp`). */
model VendorJlcpcbPnp {
  /** The placement artifact kinds to emit, in file order. */
  outputs: VendorJlcpcbPnpOutput[];

  /** The placement coordinate unit. */
  units: VendorJlcpcbPnpUnits;
}

// --------------------------------------------------------------------- root

/**
 * The JLCPCB vendor configuration `prism-kicad vendor run jlcpcb --config`
 * reads (`jlcpcb.config.jsonc` with `schema` replaced).
 */
@jsonSchema
@id("urn:prism:schema:prism.vendor.jlcpcb.config:a0")
@extension("title", "Prism JLCPCB vendor config a0")
model VendorJlcpcbConfigA0 {
  /** Document schema id. */
  schema: "prism.vendor.jlcpcb.config.a0";

  /** Variant selection. */
  variants: VendorJlcpcbVariants;

  /** BOM settings. */
  bom: VendorJlcpcbBom;

  /** Placement settings. */
  pnp: VendorJlcpcbPnp;
}
