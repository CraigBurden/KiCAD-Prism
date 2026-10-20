import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * Catalog parts a system build reads (System Builder v2 stages 3d and 4a): each
 * body occurrence's part, each body connector's part and each harness part, with the
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

/** A harness part's role (CONTRACTS.md §16.1). */
enum SystemPartsHarnessRole {
  /** Takes contacts in cavities and mates with a board connector. */
  housing,

  /** Crimped or soldered onto a wire, seated in a housing's cavity. */
  contact,

  /** A jacketed multi-conductor cable. */
  cable,

  /** A sleeve over a bundle segment. */
  sleeve,

  /** Heat-shrink tubing over a bundle segment. */
  `heat-shrink`,

  /** Tape wrapped over a bundle segment. */
  tape,

  /** Zip ties along a bundle segment. */
  `zip-ties`,

  /** A printed wire label. */
  label,

  /** A heat-shrink marker. */
  marker,
}

/** A part's harness attributes (§16.2); absent values were blank or unparseable. */
model SystemPartsHarness {
  /** The role. */
  role: SystemPartsHarnessRole;

  /** A housing's cavity count. */
  @minValue(1)
  cavities?: int32;

  /** The contact family a housing takes or a contact belongs to. */
  contactFamily?: string;

  /** A contact's thinnest gauge, AWG as written. */
  gaugeMinAwg?: string;

  /** A contact's thickest gauge, AWG as written. */
  gaugeMaxAwg?: string;

  /** A cable's conductor count, a drain counting as one. */
  @minValue(1)
  conductors?: int32;

  /** A cable has a shield. */
  shielded?: boolean;

  /** A cable's outer diameter, mm. */
  @minValueExclusive(0)
  odMm?: float64;

  /** The smallest bundle diameter a covering fits, mm. */
  @minValueExclusive(0)
  diameterMinMm?: float64;

  /** The largest bundle diameter a covering fits, mm. */
  @minValueExclusive(0)
  diameterMaxMm?: float64;

  /** Heat-shrink: expanded over recovered. */
  @minValueExclusive(0)
  shrinkRatio?: float64;
}

/** A part a housing mates with. */
model SystemPartsMate {
  /** The catalog component. */
  componentId: SystemPartsCatalogId;

  /** Its current revision's MPN, when it has one. */
  mpn?: string;
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

  /** Its harness attributes, when it has a harness role (§16.2). */
  harness?: SystemPartsHarness;

  /** A housing's mating parts (**mates with**), sorted by MPN (case-folded) then component id. */
  matesWith?: SystemPartsMate[];
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
