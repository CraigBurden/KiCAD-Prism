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
///The change counts of a `compare`, equal to `counts` of the delta document written to `-o`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The change counts of a `compare`, equal to `counts` of the delta document written to `-o`.",
///  "type": "object",
///  "required": [
///    "added",
///    "base_objects",
///    "head_objects",
///    "ignored",
///    "modified",
///    "removed",
///    "unchanged"
///  ],
///  "properties": {
///    "added": {
///      "description": "Objects only in `--head`.",
///      "$ref": "#/$defs/Count"
///    },
///    "base_objects": {
///      "description": "Objects in `--base`.",
///      "$ref": "#/$defs/Count"
///    },
///    "head_objects": {
///      "description": "Objects in `--head`.",
///      "$ref": "#/$defs/Count"
///    },
///    "ignored": {
///      "description": "Objects matched across a UUID change or with only generated content changed.",
///      "$ref": "#/$defs/Count"
///    },
///    "modified": {
///      "description": "Objects in both whose content differs.",
///      "$ref": "#/$defs/Count"
///    },
///    "removed": {
///      "description": "Objects only in `--base`.",
///      "$ref": "#/$defs/Count"
///    },
///    "unchanged": {
///      "description": "Objects in both with equal content, the ignored ones included.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliCompareCounts {
    ///Objects only in `--head`.
    pub added: Count,
    ///Objects only in `--base`.
    pub removed: Count,
    ///Objects in both whose content differs.
    pub modified: Count,
    ///Objects in both with equal content, the ignored ones included.
    pub unchanged: Count,
    ///Objects matched across a UUID change or with only generated content changed.
    pub ignored: Count,
    ///Objects in `--base`.
    pub base_objects: Count,
    ///Objects in `--head`.
    pub head_objects: Count,
}
/**stdout of `compare` (exit 0), written after `-o` holds the
`CompareObjectDeltaA0` document (cli-spec.md §5.6).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.compare_result:a0",
///  "title": "CliCompareResultA0",
///  "description": "stdout of `compare` (exit 0), written after `-o` holds the\n`CompareObjectDeltaA0` document (cli-spec.md §5.6).",
///  "type": "object",
///  "required": [
///    "base",
///    "counts",
///    "head",
///    "schema"
///  ],
///  "properties": {
///    "base": {
///      "description": "The `--base` bundle.",
///      "$ref": "#/$defs/CliCompareSide"
///    },
///    "counts": {
///      "description": "The change counts of the written delta.",
///      "$ref": "#/$defs/CliCompareCounts"
///    },
///    "head": {
///      "description": "The `--head` bundle.",
///      "$ref": "#/$defs/CliCompareSide"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.compare_result.a0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliCompareResultA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The `--base` bundle.
    pub base: CliCompareSide,
    ///The `--head` bundle.
    pub head: CliCompareSide,
    ///The change counts of the written delta.
    pub counts: CliCompareCounts,
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
///    "bundle_key",
///    "objects"
///  ],
///  "properties": {
///    "bundle_key": {
///      "description": "The bundle key of the side's bundle (cli-spec.md §5.1.4), computed from its manifest's revision key and generator id.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "objects": {
///      "description": "How many objects the side's `projections/board-objects.json` holds, review-only objects included: today's `objects`.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliCompareSide {
    ///The bundle key of the side's bundle (cli-spec.md §5.1.4), computed from its manifest's revision key and generator id.
    pub bundle_key: Sha256Hex,
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
