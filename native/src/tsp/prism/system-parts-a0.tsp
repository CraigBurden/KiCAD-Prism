import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * Catalog parts a system build reads (System Builder v2 stage 3d, ADR §2.1,
 * §2.6): each body occurrence's part and each body connector's part, with the
 * symbol and footprint files staged beside this file and the part's 3D model
 * bounds. `prism.system_parts.a0` is the input of
 * `prism-kicad system build --parts`; the rules are in
 * `docs/system-builder/CONTRACTS.md` §8.10.
 *
 * Unfrozen until System Builder v2's stage 5, like the system document.
 */
namespace Prism.Contracts.SystemPartsA0;

// ----------------------------------------------------------------- scalars

/** Prism catalog component or revision id, as the catalog issues it. */
@pattern("^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")
scalar SystemPartsCatalogId extends string;

/** A part reference exactly as the document spells it: `componentId`, or `componentId@revisionId`. */
@pattern("^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}(@[A-Za-z0-9][A-Za-z0-9_.:-]{0,127})?$")
scalar SystemPartsRef extends string;

/** A staged file's path relative to the parts file's directory; the build refuses `..` segments. */
@pattern("^[A-Za-z0-9_][A-Za-z0-9_./-]{0,254}$")
scalar SystemPartsPath extends string;

// ------------------------------------------------------------------ models

/** A staged KiCad symbol library and the symbol in it. */
model SystemPartsSymbol {
  /** The `.kicad_sym` file. */
  path: SystemPartsPath;

  /** The library file's SHA-256. */
  sha256: Sha256Hex;

  /** The symbol's name in the library. */
  @minLength(1)
  name: string;
}

/** A staged KiCad footprint. */
model SystemPartsFootprint {
  /** The `.kicad_mod` file. */
  path: SystemPartsPath;

  /** The file's SHA-256. */
  sha256: Sha256Hex;
}

/** A point in the part's frame, in nanometres. */
model SystemPartsVectorNm {
  /** X. */
  xNm: Nanometres;

  /** Y. */
  yNm: Nanometres;

  /** Z. */
  zNm: Nanometres;
}

/** The part's converted 3D model. */
model SystemPartsModel {
  /** The converted GLB's cache key (`/api/catalog/models/<key>.glb`). */
  @minLength(1)
  glbKey: string;

  /** The STEP file's SHA-256. */
  stepSha256: Sha256Hex;

  /** The model's box in the part's frame, its alignment applied. */
  boundsMin: SystemPartsVectorNm;

  /** The opposite corner. */
  boundsMax: SystemPartsVectorNm;
}

/** One part as the document references it. */
model SystemPartsEntry {
  /** The reference as the document spells it. */
  ref: SystemPartsRef;

  /** The catalog component. */
  componentId: SystemPartsCatalogId;

  /** The revision the reference resolved to. */
  revisionId: SystemPartsCatalogId;

  /** The part's display name (its value). */
  name: string;

  /** The manufacturer part number, when known. */
  mpn?: string;

  /** Its symbol, when it has one. */
  symbol?: SystemPartsSymbol;

  /** Its footprint, when it has one. */
  footprint?: SystemPartsFootprint;

  /** Its 3D model, when one is converted. */
  `model`?: SystemPartsModel;
}

/**
 * The parts a system document references, by the reference it uses: the
 * input of `prism-kicad system build --parts` (CONTRACTS.md §8.10).
 */
@jsonSchema
@id("urn:prism:schema:prism.system_parts:a0")
@extension("title", "System parts a0")
model SystemPartsA0 {
  /** Schema id. */
  schema: "prism.system_parts.a0";

  /** The parts, sorted by `ref` in code point order; a reference the catalog cannot resolve is left out. */
  parts: SystemPartsEntry[];
}
