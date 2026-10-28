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
/**stdout of `compare` (exit 0), written after `-o` holds the
`DesignCompareResultA1` document (cli-spec.md §5.6). a1 replaced a0's object
diff counts with the result's per-tab counts when `prism.compare.object_delta.a0`
was removed (ADR amendment C2r §4).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.compare_result:a1",
///  "title": "CliCompareResultA1",
///  "description": "stdout of `compare` (exit 0), written after `-o` holds the\n`DesignCompareResultA1` document (cli-spec.md §5.6). a1 replaced a0's object\ndiff counts with the result's per-tab counts when `prism.compare.object_delta.a0`\nwas removed (ADR amendment C2r §4).",
///  "type": "object",
///  "required": [
///    "base",
///    "counts",
///    "head",
///    "schema"
///  ],
///  "properties": {
///    "base": {
///      "description": "The `--base` side.",
///      "$ref": "#/$defs/CliCompareSide"
///    },
///    "counts": {
///      "description": "The result's change counts per tab: its `counts`.",
///      "$ref": "#/$defs/DesignCompareCounts"
///    },
///    "head": {
///      "description": "The `--head` side.",
///      "$ref": "#/$defs/CliCompareSide"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.compare_result.a1"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliCompareResultA1 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The `--base` side.
    pub base: CliCompareSide,
    ///The `--head` side.
    pub head: CliCompareSide,
    ///The result's change counts per tab: its `counts`.
    pub counts: DesignCompareCounts,
}
///One side of a `compare` (cli-spec.md §5.6).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One side of a `compare` (cli-spec.md §5.6).",
///  "type": "object",
///  "required": [
///    "objects",
///    "revision_key"
///  ],
///  "properties": {
///    "bundle_key": {
///      "description": "The bundle key of the side's bundle (cli-spec.md §5.1.4), computed from its manifest's revision key and generator id. Absent for a source tree.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "objects": {
///      "description": "How many objects the side's `projections/board-objects.json` holds, review-only objects included: today's `objects`.",
///      "$ref": "#/$defs/Count"
///    },
///    "revision_key": {
///      "description": "The side's revision key, from `--<side>-revision-key` in both modes (ADR amendment K2 §3.6).",
///      "$ref": "#/$defs/Sha256Hex"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliCompareSide {
    ///The side's revision key, from `--<side>-revision-key` in both modes (ADR amendment K2 §3.6).
    pub revision_key: Sha256Hex,
    ///The bundle key of the side's bundle (cli-spec.md §5.1.4), computed from its manifest's revision key and generator id. Absent for a source tree.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub bundle_key: ::std::option::Option<Sha256Hex>,
    ///How many objects the side's `projections/board-objects.json` holds, review-only objects included: today's `objects`.
    pub objects: Count,
}
///A count of things: a non-negative safe integer.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A count of things: a non-negative safe integer.",
///  "type": "integer",
///  "minimum": 0.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct Count(pub u64);
impl ::std::ops::Deref for Count {
    type Target = u64;
    fn deref(&self) -> &u64 {
        &self.0
    }
}
impl ::std::convert::From<Count> for u64 {
    fn from(value: Count) -> Self {
        value.0
    }
}
impl ::std::convert::From<u64> for Count {
    fn from(value: u64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for Count {
    type Err = <u64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for Count {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for Count {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for Count {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///Change counts per tab.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Change counts per tab.",
///  "type": "object",
///  "required": [
///    "bom",
///    "pcb",
///    "schematic"
///  ],
///  "properties": {
///    "bom": {
///      "description": "The BOM tab's rows.",
///      "$ref": "#/$defs/DesignCompareSummary"
///    },
///    "pcb": {
///      "description": "The PCB tab's changes.",
///      "$ref": "#/$defs/DesignCompareSummary"
///    },
///    "schematic": {
///      "description": "The Schematic tab's changes.",
///      "$ref": "#/$defs/DesignCompareSummary"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareCounts {
    ///The Schematic tab's changes.
    pub schematic: DesignCompareSummary,
    ///The PCB tab's changes.
    pub pcb: DesignCompareSummary,
    ///The BOM tab's rows.
    pub bom: DesignCompareSummary,
}
///Added, removed and changed counts.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Added, removed and changed counts.",
///  "type": "object",
///  "required": [
///    "added",
///    "changed",
///    "removed"
///  ],
///  "properties": {
///    "added": {
///      "description": "Added entries.",
///      "$ref": "#/$defs/Count"
///    },
///    "changed": {
///      "description": "Changed entries.",
///      "$ref": "#/$defs/Count"
///    },
///    "removed": {
///      "description": "Removed entries.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct DesignCompareSummary {
    ///Added entries.
    pub added: Count,
    ///Removed entries.
    pub removed: Count,
    ///Changed entries.
    pub changed: Count,
}
///Lowercase hexadecimal SHA-256 digest: exactly 64 characters, no prefix such as `sha256:`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Lowercase hexadecimal SHA-256 digest: exactly 64 characters, no prefix such as `sha256:`.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct Sha256Hex(pub ::std::string::String);
impl ::std::ops::Deref for Sha256Hex {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<Sha256Hex> for ::std::string::String {
    fn from(value: Sha256Hex) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for Sha256Hex {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for Sha256Hex {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for Sha256Hex {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
