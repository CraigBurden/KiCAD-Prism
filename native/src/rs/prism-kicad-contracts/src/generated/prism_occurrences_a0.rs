/// Error types.
pub mod error {
    /// Error from a `TryFrom` or `FromStr` implementation.
    pub struct ConversionError(::std::borrow::Cow<'static, str>);
    impl ::std::error::Error for ConversionError {}
    impl ::std::fmt::Display for ConversionError {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> Result<(), ::std::fmt::Error> {
            ::std::fmt::Display::fmt(&self.0, f)
        }
    }
    impl ::std::fmt::Debug for ConversionError {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> Result<(), ::std::fmt::Error> {
            ::std::fmt::Debug::fmt(&self.0, f)
        }
    }
    impl From<&'static str> for ConversionError {
        fn from(value: &'static str) -> Self {
            Self(value.into())
        }
    }
    impl From<String> for ConversionError {
        fn from(value: String) -> Self {
            Self(value.into())
        }
    }
}
/**KiCad object UUID in the canonical form KiCad writes (`KIID::AsString`):
lowercase hexadecimal, 8-4-4-4-12. Copied from the file, never generated
or re-cased.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad object UUID in the canonical form KiCad writes (`KIID::AsString`):\nlowercase hexadecimal, 8-4-4-4-12. Copied from the file, never generated\nor re-cased.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct KiCadUuid(pub ::std::string::String);
impl ::std::ops::Deref for KiCadUuid {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<KiCadUuid> for ::std::string::String {
    fn from(value: KiCadUuid) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for KiCadUuid {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for KiCadUuid {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for KiCadUuid {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**KiCad KIID path: one or more `/<uuid>` steps, no trailing `/`. Two forms
exist and every field of this type states which one it holds: the
schematic form, which starts at the root sheet's UUID (a symbol's
`(instances (project … (path …)))` entry, plus the symbol UUID for an
occurrence); and the board form, which omits the root sheet (a footprint's
`(path …)`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad KIID path: one or more `/<uuid>` steps, no trailing `/`. Two forms\nexist and every field of this type states which one it holds: the\nschematic form, which starts at the root sheet's UUID (a symbol's\n`(instances (project … (path …)))` entry, plus the symbol UUID for an\noccurrence); and the board form, which omits the root sheet (a footprint's\n`(path …)`).",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct KiidPath(pub ::std::string::String);
impl ::std::ops::Deref for KiidPath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<KiidPath> for ::std::string::String {
    fn from(value: KiidPath) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for KiidPath {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for KiidPath {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for KiidPath {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**KiCad library identifier as written in the file: `<nickname>:<name>` for a
symbol (`Device:R`) or a footprint (`Resistor_SMD:R_0603_1608Metric`). The
nickname may be absent when the file has none.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad library identifier as written in the file: `<nickname>:<name>` for a\nsymbol (`Device:R`) or a footprint (`Resistor_SMD:R_0603_1608Metric`). The\nnickname may be absent when the file has none.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct LibId(::std::string::String);
impl ::std::ops::Deref for LibId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<LibId> for ::std::string::String {
    fn from(value: LibId) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for LibId {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for LibId {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for LibId {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for LibId {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for LibId {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
/**Occurrences of one design revision. Written once per bundle by stage
`parse`; carries no provenance (bundle.json records it).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.occurrences:a0",
///  "title": "OccurrencesA0",
///  "description": "Occurrences of one design revision. Written once per bundle by stage\n`parse`; carries no provenance (bundle.json records it).",
///  "type": "object",
///  "required": [
///    "footprints",
///    "references",
///    "schema",
///    "sheets",
///    "symbols",
///    "variantDeclarations"
///  ],
///  "properties": {
///    "footprints": {
///      "description": "Every footprint of the project's board, in file order (the order of the\n`(footprint …)` forms in the `.kicad_pcb`). Empty when the project has no\nboard.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/OccurrencesFootprint"
///      }
///    },
///    "references": {
///      "description": "The join between symbol occurrences and footprints by reference\ndesignator: one entry per distinct reference that a symbol occurrence\nor a footprint carries. Sorted by `reference`, code point order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/OccurrencesReference"
///      }
///    },
///    "schema": {
///      "description": "Schema id of this document.",
///      "type": "string",
///      "const": "prism.occurrences.a0"
///    },
///    "sheets": {
///      "description": "Every sheet instance of the schematic hierarchy, the root sheet first,\nin hierarchy order: depth-first pre-order from the root sheet, the child\nsheets of one sheet visited in the order their `(sheet …)` forms appear\nin that sheet's file. Empty when the project has no schematic.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/OccurrencesSheet"
///      }
///    },
///    "symbols": {
///      "description": "Every placed symbol (a `(symbol …)` form with a `lib_id`, outside\n`lib_symbols`) at every sheet instance it occurs at: one entry per\noccurrence, so a symbol in a sheet used twice appears twice. Only sheet\ninstances reached from the root count: a file no sheet reaches, or an\ninstance record whose path no sheet instance has, adds nothing. Power\nsymbols, virtual (`#`) and unannotated (`?`) references included;\nreaders filter. In hierarchy order: grouped by sheet instance in the\norder of `sheets`, then the `(symbol …)` forms of that sheet's file in\nfile order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/OccurrencesSymbol"
///      }
///    },
///    "variantDeclarations": {
///      "description": "Variant names declared by the project's registries, unresolved: first\nthe `.kicad_pro` registry (`$.schematic.variants`) in file order, then\nthe board header `(variants …)` block in file order. Names that appear\nonly in variant records are not repeated here; they are the `name`s of\nthe `variants` arrays of `sheets`, `symbols` and `footprints`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/OccurrencesVariantDeclaration"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct OccurrencesA0 {
    ///Schema id of this document.
    pub schema: ::std::string::String,
    /**Every sheet instance of the schematic hierarchy, the root sheet first,
    in hierarchy order: depth-first pre-order from the root sheet, the child
    sheets of one sheet visited in the order their `(sheet …)` forms appear
    in that sheet's file. Empty when the project has no schematic.*/
    pub sheets: ::std::vec::Vec<OccurrencesSheet>,
    /**Every placed symbol (a `(symbol …)` form with a `lib_id`, outside
    `lib_symbols`) at every sheet instance it occurs at: one entry per
    occurrence, so a symbol in a sheet used twice appears twice. Only sheet
    instances reached from the root count: a file no sheet reaches, or an
    instance record whose path no sheet instance has, adds nothing. Power
    symbols, virtual (`#`) and unannotated (`?`) references included;
    readers filter. In hierarchy order: grouped by sheet instance in the
    order of `sheets`, then the `(symbol …)` forms of that sheet's file in
    file order.*/
    pub symbols: ::std::vec::Vec<OccurrencesSymbol>,
    /**Every footprint of the project's board, in file order (the order of the
    `(footprint …)` forms in the `.kicad_pcb`). Empty when the project has no
    board.*/
    pub footprints: ::std::vec::Vec<OccurrencesFootprint>,
    /**The join between symbol occurrences and footprints by reference
    designator: one entry per distinct reference that a symbol occurrence
    or a footprint carries. Sorted by `reference`, code point order.*/
    pub references: ::std::vec::Vec<OccurrencesReference>,
    /**Variant names declared by the project's registries, unresolved: first
    the `.kicad_pro` registry (`$.schematic.variants`) in file order, then
    the board header `(variants …)` block in file order. Names that appear
    only in variant records are not repeated here; they are the `name`s of
    the `variants` arrays of `sheets`, `symbols` and `footprints`.*/
    #[serde(rename = "variantDeclarations")]
    pub variant_declarations: ::std::vec::Vec<OccurrencesVariantDeclaration>,
}
/**The canonical BOM fields of one symbol occurrence: Prism's fixed BOM
column set, each resolved from the occurrence's `properties` by name and
aliases. Matching normalizes a property name with Unicode full case
folding (Python `str.casefold`) and then deletes every character outside
`a-z0-9`; when two properties normalize alike, the later in file order is
used. A field is the first non-empty value among its name and aliases, in
the listed order; it is absent when none has a non-empty value. The `DNP`
and `In BOM` columns are not fields here: they are the occurrence's `dnp`
and `excludeFromBom` (`Yes` / `No`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The canonical BOM fields of one symbol occurrence: Prism's fixed BOM\ncolumn set, each resolved from the occurrence's `properties` by name and\naliases. Matching normalizes a property name with Unicode full case\nfolding (Python `str.casefold`) and then deletes every character outside\n`a-z0-9`; when two properties normalize alike, the later in file order is\nused. A field is the first non-empty value among its name and aliases, in\nthe listed order; it is absent when none has a non-empty value. The `DNP`\nand `In BOM` columns are not fields here: they are the occurrence's `dnp`\nand `excludeFromBom` (`Yes` / `No`).",
///  "type": "object",
///  "properties": {
///    "datasheet": {
///      "description": "Column `Datasheet`: names `Datasheet`, `Data Sheet`, `Datasheet URL`, `Datasheet Link`.",
///      "type": "string"
///    },
///    "description": {
///      "description": "Column `Description`: name `Description`. Never the library symbol's description.",
///      "type": "string"
///    },
///    "footprint": {
///      "description": "Column `Footprint`: the property named exactly `Footprint` if non-empty, else name `Footprint`.",
///      "type": "string"
///    },
///    "manufacturer": {
///      "description": "Column `Manufacturer`: names `Manufacturer`, `MFR`, `Mfr`.",
///      "type": "string"
///    },
///    "manufacturerPartNumber": {
///      "description": "Column `Manufacturer Part Number`: names `Manufacturer Part Number`, `MPN`, `Mfr Part`, `Mfr Part Number`.",
///      "type": "string"
///    },
///    "mass": {
///      "description": "Column `Mass (g)`: names `Mass (g)`, `Mass`, `Weight (g)`. Text as written; no unit conversion.",
///      "type": "string"
///    },
///    "powerDissipation": {
///      "description": "Column `Power Dissipation (W)`: names `Power Dissipation (W)`, `Power Dissipation`, `Pd (W)`. Text as written.",
///      "type": "string"
///    },
///    "rate": {
///      "description": "Column `Rate`: names `Rate`, `Rating`.",
///      "type": "string"
///    },
///    "rqjc": {
///      "description": "Column `RQjC (C/W)`: names `RQjC (C/W)`, `RθJC (C/W)`, `RthJC`. Text as written.",
///      "type": "string"
///    },
///    "rqjcTop": {
///      "description": "Column `RQjC_top (C/W)`: names `RQjC_top (C/W)`, `RθJC_top (C/W)`, `RthJC Top`. Text as written.",
///      "type": "string"
///    },
///    "tempMax": {
///      "description": "Column `Temp_max (C)`: names `Temp_max (C)`, `Max Temperature`, `Tj Max`. Text as written.",
///      "type": "string"
///    },
///    "tempMin": {
///      "description": "Column `Temp_min (C)`: names `Temp_min (C)`, `Min Temperature`, `Tj Min`. Text as written.",
///      "type": "string"
///    },
///    "value": {
///      "description": "Column `Value`: the property named exactly `Value` if non-empty, else name `Value`.",
///      "type": "string"
///    },
///    "vendor": {
///      "description": "Column `Vendor`: names `Vendor`, `Supplier`.",
///      "type": "string"
///    },
///    "vendorPartNumber": {
///      "description": "Column `Vendor Part Number`: names `Vendor Part Number`, `VPN`, `Supplier Part Number`, `Supplier PN`.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct OccurrencesBomFields {
    ///Column `Value`: the property named exactly `Value` if non-empty, else name `Value`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub value: ::std::option::Option<::std::string::String>,
    ///Column `Description`: name `Description`. Never the library symbol's description.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub description: ::std::option::Option<::std::string::String>,
    ///Column `Datasheet`: names `Datasheet`, `Data Sheet`, `Datasheet URL`, `Datasheet Link`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub datasheet: ::std::option::Option<::std::string::String>,
    ///Column `Manufacturer`: names `Manufacturer`, `MFR`, `Mfr`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub manufacturer: ::std::option::Option<::std::string::String>,
    ///Column `Manufacturer Part Number`: names `Manufacturer Part Number`, `MPN`, `Mfr Part`, `Mfr Part Number`.
    #[serde(
        rename = "manufacturerPartNumber",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub manufacturer_part_number: ::std::option::Option<::std::string::String>,
    ///Column `Vendor`: names `Vendor`, `Supplier`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub vendor: ::std::option::Option<::std::string::String>,
    ///Column `Vendor Part Number`: names `Vendor Part Number`, `VPN`, `Supplier Part Number`, `Supplier PN`.
    #[serde(
        rename = "vendorPartNumber",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub vendor_part_number: ::std::option::Option<::std::string::String>,
    ///Column `Footprint`: the property named exactly `Footprint` if non-empty, else name `Footprint`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub footprint: ::std::option::Option<::std::string::String>,
    ///Column `Mass (g)`: names `Mass (g)`, `Mass`, `Weight (g)`. Text as written; no unit conversion.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub mass: ::std::option::Option<::std::string::String>,
    ///Column `RQjC (C/W)`: names `RQjC (C/W)`, `RθJC (C/W)`, `RthJC`. Text as written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub rqjc: ::std::option::Option<::std::string::String>,
    ///Column `RQjC_top (C/W)`: names `RQjC_top (C/W)`, `RθJC_top (C/W)`, `RthJC Top`. Text as written.
    #[serde(
        rename = "rqjcTop",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub rqjc_top: ::std::option::Option<::std::string::String>,
    ///Column `Temp_max (C)`: names `Temp_max (C)`, `Max Temperature`, `Tj Max`. Text as written.
    #[serde(
        rename = "tempMax",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub temp_max: ::std::option::Option<::std::string::String>,
    ///Column `Temp_min (C)`: names `Temp_min (C)`, `Min Temperature`, `Tj Min`. Text as written.
    #[serde(
        rename = "tempMin",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub temp_min: ::std::option::Option<::std::string::String>,
    ///Column `Power Dissipation (W)`: names `Power Dissipation (W)`, `Power Dissipation`, `Pd (W)`. Text as written.
    #[serde(
        rename = "powerDissipation",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub power_dissipation: ::std::option::Option<::std::string::String>,
    ///Column `Rate`: names `Rate`, `Rating`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub rate: ::std::option::Option<::std::string::String>,
}
impl ::std::default::Default for OccurrencesBomFields {
    fn default() -> Self {
        Self {
            datasheet: Default::default(),
            description: Default::default(),
            footprint: Default::default(),
            manufacturer: Default::default(),
            manufacturer_part_number: Default::default(),
            mass: Default::default(),
            power_dissipation: Default::default(),
            rate: Default::default(),
            rqjc: Default::default(),
            rqjc_top: Default::default(),
            temp_max: Default::default(),
            temp_min: Default::default(),
            value: Default::default(),
            vendor: Default::default(),
            vendor_part_number: Default::default(),
        }
    }
}
/**One footprint of the board: its identity, designator and assembly
attributes as written. Placement, geometry and library link are in
`prism.placements.a1` and `prism.board_objects.a0`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One footprint of the board: its identity, designator and assembly\nattributes as written. Placement, geometry and library link are in\n`prism.placements.a1` and `prism.board_objects.a0`.",
///  "type": "object",
///  "required": [
///    "dnp",
///    "documentPath",
///    "excludeFromBom",
///    "excludeFromPosFiles",
///    "uuid",
///    "variants"
///  ],
///  "properties": {
///    "dnp": {
///      "description": "True when the footprint's `(attr …)` holds `dnp`.",
///      "type": "boolean"
///    },
///    "documentPath": {
///      "description": "The repository-relative path of the `.kicad_pcb` file the footprint is\nwritten in; `<documentPath>#<uuid>` is the footprint's ObjectRef in\n`prism.board_objects.a0`.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "excludeFromBom": {
///      "description": "True when the footprint's `(attr …)` holds `exclude_from_bom`.",
///      "type": "boolean"
///    },
///    "excludeFromPosFiles": {
///      "description": "True when the footprint's `(attr …)` holds `exclude_from_pos_files`.",
///      "type": "boolean"
///    },
///    "reference": {
///      "description": "Reference designator: the footprint's `Reference` property. Absent when\nempty.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "uuid": {
///      "description": "UUID of the `(footprint …)` form, as written: its `(uuid …)`. Unique\nwithin the document.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "variants": {
///      "description": "The footprint's `(variant …)` records, unresolved, in file order. Empty when it has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/OccurrencesVariantRecord"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct OccurrencesFootprint {
    /**UUID of the `(footprint …)` form, as written: its `(uuid …)`. Unique
    within the document.*/
    pub uuid: KiCadUuid,
    /**The repository-relative path of the `.kicad_pcb` file the footprint is
    written in; `<documentPath>#<uuid>` is the footprint's ObjectRef in
    `prism.board_objects.a0`.*/
    #[serde(rename = "documentPath")]
    pub document_path: RepoPath,
    /**Reference designator: the footprint's `Reference` property. Absent when
    empty.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reference: ::std::option::Option<Refdes>,
    ///True when the footprint's `(attr …)` holds `dnp`.
    pub dnp: bool,
    ///True when the footprint's `(attr …)` holds `exclude_from_bom`.
    #[serde(rename = "excludeFromBom")]
    pub exclude_from_bom: bool,
    ///True when the footprint's `(attr …)` holds `exclude_from_pos_files`.
    #[serde(rename = "excludeFromPosFiles")]
    pub exclude_from_pos_files: bool,
    ///The footprint's `(variant …)` records, unresolved, in file order. Empty when it has none.
    pub variants: ::std::vec::Vec<OccurrencesVariantRecord>,
}
///The symbol occurrences and footprints that share one reference designator.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The symbol occurrences and footprints that share one reference designator.",
///  "type": "object",
///  "required": [
///    "footprints",
///    "reference",
///    "symbols"
///  ],
///  "properties": {
///    "footprints": {
///      "description": "`uuid` of every footprint whose `reference` this is, in the order of\n`footprints` (board file order). Several for alternate footprints that\nshare a designator; empty for a schematic-only reference.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/KiCadUuid"
///      }
///    },
///    "reference": {
///      "description": "The reference designator, exactly as on the symbol occurrences and footprints.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "symbols": {
///      "description": "`kiidPath` of every symbol occurrence whose `reference` this is, in the\norder of `symbols` (hierarchy order). Several for a multi-unit part, a\nreference collision or an unannotated reference; empty for a board-only\nreference.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/KiidPath"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct OccurrencesReference {
    ///The reference designator, exactly as on the symbol occurrences and footprints.
    pub reference: Refdes,
    /**`kiidPath` of every symbol occurrence whose `reference` this is, in the
    order of `symbols` (hierarchy order). Several for a multi-unit part, a
    reference collision or an unannotated reference; empty for a board-only
    reference.*/
    pub symbols: ::std::vec::Vec<KiidPath>,
    /**`uuid` of every footprint whose `reference` this is, in the order of
    `footprints` (board file order). Several for alternate footprints that
    share a designator; empty for a schematic-only reference.*/
    pub footprints: ::std::vec::Vec<KiCadUuid>,
}
/**One sheet instance and the DNP / BOM / board / sim state it passes on to
everything placed in it.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One sheet instance and the DNP / BOM / board / sim state it passes on to\neverything placed in it.",
///  "type": "object",
///  "required": [
///    "dnp",
///    "excludeFromBoard",
///    "excludeFromBom",
///    "excludeFromSim",
///    "sheetPath",
///    "variants"
///  ],
///  "properties": {
///    "dnp": {
///      "description": "True when this sheet or any sheet above it on its path is marked do not\npopulate (`(dnp yes)` on the sheet symbol). False for the root sheet.",
///      "type": "boolean"
///    },
///    "excludeFromBoard": {
///      "description": "True when this sheet or any sheet above it on its path is excluded from\nthe board (`(on_board no)` on the sheet symbol). False for the root sheet.",
///      "type": "boolean"
///    },
///    "excludeFromBom": {
///      "description": "True when this sheet or any sheet above it on its path is excluded from\nthe BOM (`(in_bom no)` on the sheet symbol). False for the root sheet.",
///      "type": "boolean"
///    },
///    "excludeFromSim": {
///      "description": "True when this sheet or any sheet above it on its path is excluded from\nsimulation (`(exclude_from_sim yes)` on the sheet symbol). False for the\nroot sheet.",
///      "type": "boolean"
///    },
///    "sheetPath": {
///      "description": "KIID path of this sheet instance, schematic form: the root sheet's UUID\nfollowed by the UUID of every sheet symbol down to this one. The root\nsheet's own entry is `/<root uuid>`. Unique within the document; the join\nkey to `prism.semantic_index.a1` `sheetInstances[].sheetInstancePath`.",
///      "$ref": "#/$defs/KiidPath"
///    },
///    "variants": {
///      "description": "The variant records of this sheet instance, unresolved: the `(variant …)`\nforms of the sheet symbol's `(instances (project … (path …)))` record\nwhose path is the parent sheet instance's `sheetPath`. In file order.\nEmpty for the root sheet and for a sheet with no records. The resolved\nper-variant state is `prism.semantic_index.a1` `assembly.variants`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/OccurrencesVariantRecord"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct OccurrencesSheet {
    /**KIID path of this sheet instance, schematic form: the root sheet's UUID
    followed by the UUID of every sheet symbol down to this one. The root
    sheet's own entry is `/<root uuid>`. Unique within the document; the join
    key to `prism.semantic_index.a1` `sheetInstances[].sheetInstancePath`.*/
    #[serde(rename = "sheetPath")]
    pub sheet_path: KiidPath,
    /**True when this sheet or any sheet above it on its path is marked do not
    populate (`(dnp yes)` on the sheet symbol). False for the root sheet.*/
    pub dnp: bool,
    /**True when this sheet or any sheet above it on its path is excluded from
    the BOM (`(in_bom no)` on the sheet symbol). False for the root sheet.*/
    #[serde(rename = "excludeFromBom")]
    pub exclude_from_bom: bool,
    /**True when this sheet or any sheet above it on its path is excluded from
    the board (`(on_board no)` on the sheet symbol). False for the root sheet.*/
    #[serde(rename = "excludeFromBoard")]
    pub exclude_from_board: bool,
    /**True when this sheet or any sheet above it on its path is excluded from
    simulation (`(exclude_from_sim yes)` on the sheet symbol). False for the
    root sheet.*/
    #[serde(rename = "excludeFromSim")]
    pub exclude_from_sim: bool,
    /**The variant records of this sheet instance, unresolved: the `(variant …)`
    forms of the sheet symbol's `(instances (project … (path …)))` record
    whose path is the parent sheet instance's `sheetPath`. In file order.
    Empty for the root sheet and for a sheet with no records. The resolved
    per-variant state is `prism.semantic_index.a1` `assembly.variants`.*/
    pub variants: ::std::vec::Vec<OccurrencesVariantRecord>,
}
/**One placed symbol at one sheet instance: what KiCad's BOM, netlist and
annotation see as one symbol occurrence.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One placed symbol at one sheet instance: what KiCad's BOM, netlist and\nannotation see as one symbol occurrence.",
///  "type": "object",
///  "required": [
///    "bomFields",
///    "dnp",
///    "documentPath",
///    "excludeFromBoard",
///    "excludeFromBom",
///    "excludeFromPosFiles",
///    "excludeFromSim",
///    "instanceMatched",
///    "kiidPath",
///    "libId",
///    "properties",
///    "sheetPath",
///    "symbolUuid",
///    "unit",
///    "variants"
///  ],
///  "properties": {
///    "bomFields": {
///      "description": "The canonical BOM fields of this occurrence, resolved from `properties`.",
///      "$ref": "#/$defs/OccurrencesBomFields"
///    },
///    "dnp": {
///      "description": "Effective do-not-populate state in the default design: the symbol's own\n`(dnp yes)`, or `dnp` of its sheet (`sheets[]` where `sheetPath`\nmatches), which already folds every sheet above it.",
///      "type": "boolean"
///    },
///    "documentPath": {
///      "description": "The repository-relative path of the `.kicad_sch` file the `(symbol …)`\nform is written in. A reused sheet file holds one form for all its\noccurrences, so several occurrences share a `documentPath` and\n`symbolUuid`; `<documentPath>#<symbolUuid>` is the symbol's ObjectRef in\n`prism.board_objects.a0`.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "excludeFromBoard": {
///      "description": "Effective exclude-from-board state in the default design: the symbol's\nown `(on_board no)`, or `excludeFromBoard` of its sheet.",
///      "type": "boolean"
///    },
///    "excludeFromBom": {
///      "description": "Effective exclude-from-BOM state in the default design: the symbol's own\n`(in_bom no)`, or `excludeFromBom` of its sheet.",
///      "type": "boolean"
///    },
///    "excludeFromPosFiles": {
///      "description": "Effective exclude-from-position-files state in the default design: the\nsymbol's own `(in_pos_files no)`. Sheets never contribute to it.",
///      "type": "boolean"
///    },
///    "excludeFromSim": {
///      "description": "Effective exclude-from-simulation state in the default design: the\nsymbol's own `(exclude_from_sim yes)`, or `excludeFromSim` of its sheet.",
///      "type": "boolean"
///    },
///    "instanceMatched": {
///      "description": "True when the symbol's `(instances …)` block holds a `(path …)` record\nequal to `sheetPath`; `reference`, `unit` and `variants` then come from\nit. When several match, the record under the `(project …)` named after\nthe `.kicad_pro` stem wins, else the first in file order. False when\nnone matches: `reference` falls back to the `Reference` property, `unit`\nto the form's own `(unit …)`, and `variants` is empty.",
///      "type": "boolean"
///    },
///    "kiidPath": {
///      "description": "KIID path of this occurrence, schematic form: `sheetPath` followed by\n`/<symbolUuid>`. Unique within the document. Today's occurrence id\n(semantic index `assembly` keys) and System Builder `portKey`.",
///      "$ref": "#/$defs/KiidPath"
///    },
///    "libId": {
///      "description": "Library identifier of the symbol, the form's `lib_id` as written.",
///      "$ref": "#/$defs/LibId"
///    },
///    "properties": {
///      "description": "Every `(property \"<name>\" \"<value>\")` written on the placed symbol, as\nwritten and unescaped, before any variant: keys are the property names\n(`Reference`, `Value`, `Footprint`, `Datasheet`, `Description`, custom\nfields), values their text, possibly empty. When a name repeats, the\nlast in file order wins. The `Reference` property is the form's text and\nmay differ from `reference` in a reused sheet. Keys in code point order.",
///      "$ref": "#/$defs/RecordString"
///    },
///    "reference": {
///      "description": "Reference designator of this occurrence: the `reference` of the matched\ninstance record when `instanceMatched` is true, otherwise the symbol's\n`Reference` property. Absent when neither supplies a non-empty value.\nNot annotation-checked: may start with `#` or end with `?`.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "sheetPath": {
///      "description": "KIID path, schematic form, of the sheet instance this occurrence is\nplaced in: equal to one `sheets[].sheetPath`.",
///      "$ref": "#/$defs/KiidPath"
///    },
///    "symbolUuid": {
///      "description": "UUID of the `(symbol …)` form, as written.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "unit": {
///      "description": "Unit number of this occurrence (1 = unit A), from the matched instance record or the form's `(unit …)`.",
///      "type": "integer",
///      "maximum": 2147483647.0,
///      "minimum": 1.0
///    },
///    "variants": {
///      "description": "The variant records of the matched instance record, unresolved, in file\norder. Empty when `instanceMatched` is false or the record has none. The\nresolved per-variant state is `prism.semantic_index.a1`\n`assembly.variants`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/OccurrencesVariantRecord"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct OccurrencesSymbol {
    /**KIID path of this occurrence, schematic form: `sheetPath` followed by
    `/<symbolUuid>`. Unique within the document. Today's occurrence id
    (semantic index `assembly` keys) and System Builder `portKey`.*/
    #[serde(rename = "kiidPath")]
    pub kiid_path: KiidPath,
    /**KIID path, schematic form, of the sheet instance this occurrence is
    placed in: equal to one `sheets[].sheetPath`.*/
    #[serde(rename = "sheetPath")]
    pub sheet_path: KiidPath,
    ///UUID of the `(symbol …)` form, as written.
    #[serde(rename = "symbolUuid")]
    pub symbol_uuid: KiCadUuid,
    /**The repository-relative path of the `.kicad_sch` file the `(symbol …)`
    form is written in. A reused sheet file holds one form for all its
    occurrences, so several occurrences share a `documentPath` and
    `symbolUuid`; `<documentPath>#<symbolUuid>` is the symbol's ObjectRef in
    `prism.board_objects.a0`.*/
    #[serde(rename = "documentPath")]
    pub document_path: RepoPath,
    ///Library identifier of the symbol, the form's `lib_id` as written.
    #[serde(rename = "libId")]
    pub lib_id: LibId,
    /**Reference designator of this occurrence: the `reference` of the matched
    instance record when `instanceMatched` is true, otherwise the symbol's
    `Reference` property. Absent when neither supplies a non-empty value.
    Not annotation-checked: may start with `#` or end with `?`.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reference: ::std::option::Option<Refdes>,
    /**True when the symbol's `(instances …)` block holds a `(path …)` record
    equal to `sheetPath`; `reference`, `unit` and `variants` then come from
    it. When several match, the record under the `(project …)` named after
    the `.kicad_pro` stem wins, else the first in file order. False when
    none matches: `reference` falls back to the `Reference` property, `unit`
    to the form's own `(unit …)`, and `variants` is empty.*/
    #[serde(rename = "instanceMatched")]
    pub instance_matched: bool,
    ///Unit number of this occurrence (1 = unit A), from the matched instance record or the form's `(unit …)`.
    pub unit: ::std::num::NonZeroU64,
    /**Effective do-not-populate state in the default design: the symbol's own
    `(dnp yes)`, or `dnp` of its sheet (`sheets[]` where `sheetPath`
    matches), which already folds every sheet above it.*/
    pub dnp: bool,
    /**Effective exclude-from-BOM state in the default design: the symbol's own
    `(in_bom no)`, or `excludeFromBom` of its sheet.*/
    #[serde(rename = "excludeFromBom")]
    pub exclude_from_bom: bool,
    /**Effective exclude-from-board state in the default design: the symbol's
    own `(on_board no)`, or `excludeFromBoard` of its sheet.*/
    #[serde(rename = "excludeFromBoard")]
    pub exclude_from_board: bool,
    /**Effective exclude-from-simulation state in the default design: the
    symbol's own `(exclude_from_sim yes)`, or `excludeFromSim` of its sheet.*/
    #[serde(rename = "excludeFromSim")]
    pub exclude_from_sim: bool,
    /**Effective exclude-from-position-files state in the default design: the
    symbol's own `(in_pos_files no)`. Sheets never contribute to it.*/
    #[serde(rename = "excludeFromPosFiles")]
    pub exclude_from_pos_files: bool,
    /**Every `(property "<name>" "<value>")` written on the placed symbol, as
    written and unescaped, before any variant: keys are the property names
    (`Reference`, `Value`, `Footprint`, `Datasheet`, `Description`, custom
    fields), values their text, possibly empty. When a name repeats, the
    last in file order wins. The `Reference` property is the form's text and
    may differ from `reference` in a reused sheet. Keys in code point order.*/
    pub properties: RecordString,
    ///The canonical BOM fields of this occurrence, resolved from `properties`.
    #[serde(rename = "bomFields")]
    pub bom_fields: OccurrencesBomFields,
    /**The variant records of the matched instance record, unresolved, in file
    order. Empty when `instanceMatched` is false or the record has none. The
    resolved per-variant state is `prism.semantic_index.a1`
    `assembly.variants`.*/
    pub variants: ::std::vec::Vec<OccurrencesVariantRecord>,
}
///One variant name declared by a project registry.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One variant name declared by a project registry.",
///  "type": "object",
///  "required": [
///    "name",
///    "source"
///  ],
///  "properties": {
///    "description": {
///      "description": "Description as written. Absent when the declaration has none or an empty\none: no `description` key, JSON null or `\"\"` in the project registry; no\n`(description …)` or `(description \"\")` in the board header.",
///      "type": "string"
///    },
///    "name": {
///      "description": "Variant name as written. The project registry contributes every entry\nthat is an object with a non-empty string `name`, KiCad's `< Default >`\nincluded.",
///      "type": "string",
///      "minLength": 1
///    },
///    "source": {
///      "description": "The registry that declares it.",
///      "$ref": "#/$defs/OccurrencesVariantSource"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct OccurrencesVariantDeclaration {
    ///The registry that declares it.
    pub source: OccurrencesVariantSource,
    /**Variant name as written. The project registry contributes every entry
    that is an object with a non-empty string `name`, KiCad's `< Default >`
    included.*/
    pub name: OccurrencesVariantDeclarationName,
    /**Description as written. Absent when the declaration has none or an empty
    one: no `description` key, JSON null or `""` in the project registry; no
    `(description …)` or `(description "")` in the board header.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub description: ::std::option::Option<::std::string::String>,
}
/**Variant name as written. The project registry contributes every entry
that is an object with a non-empty string `name`, KiCad's `< Default >`
included.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Variant name as written. The project registry contributes every entry\nthat is an object with a non-empty string `name`, KiCad's `< Default >`\nincluded.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct OccurrencesVariantDeclarationName(::std::string::String);
impl ::std::ops::Deref for OccurrencesVariantDeclarationName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<OccurrencesVariantDeclarationName> for ::std::string::String {
    fn from(value: OccurrencesVariantDeclarationName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for OccurrencesVariantDeclarationName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for OccurrencesVariantDeclarationName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for OccurrencesVariantDeclarationName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for OccurrencesVariantDeclarationName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for OccurrencesVariantDeclarationName {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
/**One `(variant …)` record of a sheet instance, symbol instance or
footprint, unresolved: an override that applies only when that variant is
selected. Every flag is absent when the record does not set it (the base
value applies). A reader selecting a variant takes the first record whose
`name` matches: exactly for sheets and symbols, ignoring case for
footprints. Resolving needs the holder's own attributes, which this
document does not carry; the resolved state is `prism.semantic_index.a1`
`assembly`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One `(variant …)` record of a sheet instance, symbol instance or\nfootprint, unresolved: an override that applies only when that variant is\nselected. Every flag is absent when the record does not set it (the base\nvalue applies). A reader selecting a variant takes the first record whose\n`name` matches: exactly for sheets and symbols, ignoring case for\nfootprints. Resolving needs the holder's own attributes, which this\ndocument does not carry; the resolved state is `prism.semantic_index.a1`\n`assembly`.",
///  "type": "object",
///  "required": [
///    "fields",
///    "name"
///  ],
///  "properties": {
///    "dnp": {
///      "description": "Do-not-populate override: `(dnp yes|no)`.",
///      "type": "boolean"
///    },
///    "excludeFromBoard": {
///      "description": "Exclude-from-board override, from `(on_board yes|no)` (`on_board no` is true here). Sheets and symbols only.",
///      "type": "boolean"
///    },
///    "excludeFromBom": {
///      "description": "Exclude-from-BOM override. Footprints: `(exclude_from_bom yes|no)`.\nSheets and symbols: from `(in_bom …)`, read by the version of the\n`.kicad_sch` the record is written in: from `20260306` the token is\npositive (`in_bom yes` is false here); before it the token holds the\nexcluded flag (`in_bom yes` is true here).",
///      "type": "boolean"
///    },
///    "excludeFromPosFiles": {
///      "description": "Exclude-from-position-files override. Symbols: from `(in_pos_files …)`\n(`in_pos_files no` is true here). Footprints: from\n`(exclude_from_pos_files yes|no)`. Never on sheets.",
///      "type": "boolean"
///    },
///    "excludeFromSim": {
///      "description": "Exclude-from-simulation override, from `(exclude_from_sim yes|no)`. Sheets and symbols only.",
///      "type": "boolean"
///    },
///    "fields": {
///      "description": "Field overrides, `(field (name \"<name>\") (value \"<value>\"))`: keys are\nthe field names as written, values the override text as written; an\nempty value is an override to empty. When a name repeats, the last in\nfile order wins. Keys in code point order.",
///      "$ref": "#/$defs/RecordString"
///    },
///    "name": {
///      "description": "Variant name as written.",
///      "type": "string",
///      "minLength": 1
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct OccurrencesVariantRecord {
    ///Variant name as written.
    pub name: OccurrencesVariantRecordName,
    ///Do-not-populate override: `(dnp yes|no)`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub dnp: ::std::option::Option<bool>,
    /**Exclude-from-BOM override. Footprints: `(exclude_from_bom yes|no)`.
    Sheets and symbols: from `(in_bom …)`, read by the version of the
    `.kicad_sch` the record is written in: from `20260306` the token is
    positive (`in_bom yes` is false here); before it the token holds the
    excluded flag (`in_bom yes` is true here).*/
    #[serde(
        rename = "excludeFromBom",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub exclude_from_bom: ::std::option::Option<bool>,
    ///Exclude-from-board override, from `(on_board yes|no)` (`on_board no` is true here). Sheets and symbols only.
    #[serde(
        rename = "excludeFromBoard",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub exclude_from_board: ::std::option::Option<bool>,
    ///Exclude-from-simulation override, from `(exclude_from_sim yes|no)`. Sheets and symbols only.
    #[serde(
        rename = "excludeFromSim",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub exclude_from_sim: ::std::option::Option<bool>,
    /**Exclude-from-position-files override. Symbols: from `(in_pos_files …)`
    (`in_pos_files no` is true here). Footprints: from
    `(exclude_from_pos_files yes|no)`. Never on sheets.*/
    #[serde(
        rename = "excludeFromPosFiles",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub exclude_from_pos_files: ::std::option::Option<bool>,
    /**Field overrides, `(field (name "<name>") (value "<value>"))`: keys are
    the field names as written, values the override text as written; an
    empty value is an override to empty. When a name repeats, the last in
    file order wins. Keys in code point order.*/
    pub fields: RecordString,
}
///Variant name as written.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Variant name as written.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct OccurrencesVariantRecordName(::std::string::String);
impl ::std::ops::Deref for OccurrencesVariantRecordName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<OccurrencesVariantRecordName> for ::std::string::String {
    fn from(value: OccurrencesVariantRecordName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for OccurrencesVariantRecordName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for OccurrencesVariantRecordName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for OccurrencesVariantRecordName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for OccurrencesVariantRecordName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for OccurrencesVariantRecordName {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
///Where a variant declaration is written.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Where a variant declaration is written.",
///  "type": "string",
///  "enum": [
///    "project",
///    "pcb"
///  ]
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize,
    ::serde::Serialize,
    Clone,
    Copy,
    Debug,
    Eq,
    Hash,
    Ord,
    PartialEq,
    PartialOrd,
)]
pub enum OccurrencesVariantSource {
    #[serde(rename = "project")]
    Project,
    #[serde(rename = "pcb")]
    Pcb,
}
impl ::std::fmt::Display for OccurrencesVariantSource {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Project => f.write_str("project"),
            Self::Pcb => f.write_str("pcb"),
        }
    }
}
impl ::std::str::FromStr for OccurrencesVariantSource {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "project" => Ok(Self::Project),
            "pcb" => Ok(Self::Pcb),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for OccurrencesVariantSource {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for OccurrencesVariantSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for OccurrencesVariantSource {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///`RecordString`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "type": "string"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordString(
    pub ::std::collections::BTreeMap<::std::string::String, ::std::string::String>,
);
impl ::std::ops::Deref for RecordString {
    type Target = ::std::collections::BTreeMap<::std::string::String, ::std::string::String>;
    fn deref(&self) -> &::std::collections::BTreeMap<::std::string::String, ::std::string::String> {
        &self.0
    }
}
impl ::std::convert::From<RecordString>
    for ::std::collections::BTreeMap<::std::string::String, ::std::string::String>
{
    fn from(value: RecordString) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<::std::collections::BTreeMap<::std::string::String, ::std::string::String>>
    for RecordString
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, ::std::string::String>,
    ) -> Self {
        Self(value)
    }
}
/**Reference designator as KiCad resolves it for one symbol instance or
footprint, for example `R1`, `U3`, `#PWR01` or `R?`. Always a string. A
contract states whether it includes virtual (`#`) and unannotated (`?`)
references.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Reference designator as KiCad resolves it for one symbol instance or\nfootprint, for example `R1`, `U3`, `#PWR01` or `R?`. Always a string. A\ncontract states whether it includes virtual (`#`) and unannotated (`?`)\nreferences.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct Refdes(::std::string::String);
impl ::std::ops::Deref for Refdes {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<Refdes> for ::std::string::String {
    fn from(value: Refdes) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for Refdes {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for Refdes {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for Refdes {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for Refdes {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for Refdes {
    fn deserialize<D>(deserializer: D) -> ::std::result::Result<Self, D::Error>
    where
        D: ::serde::Deserializer<'de>,
    {
        ::std::string::String::deserialize(deserializer)?
            .parse()
            .map_err(|e: self::error::ConversionError| {
                <D::Error as ::serde::de::Error>::custom(e.to_string())
            })
    }
}
/**Repository-relative POSIX path, exactly as `git ls-tree` names the entry:
`/`-separated, case preserved, no leading `/`, no empty, `.` or `..`
segment, no backslash and no `:`. The same character rule as ArchivePath.
It is the only path type in bundle documents: a file has one spelling
whichever project in the repository refers to it, and a file outside the
project directory needs no `..`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Repository-relative POSIX path, exactly as `git ls-tree` names the entry:\n`/`-separated, case preserved, no leading `/`, no empty, `.` or `..`\nsegment, no backslash and no `:`. The same character rule as ArchivePath.\nIt is the only path type in bundle documents: a file has one spelling\nwhichever project in the repository refers to it, and a file outside the\nproject directory needs no `..`.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct RepoPath(pub ::std::string::String);
impl ::std::ops::Deref for RepoPath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<RepoPath> for ::std::string::String {
    fn from(value: RepoPath) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for RepoPath {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for RepoPath {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for RepoPath {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
