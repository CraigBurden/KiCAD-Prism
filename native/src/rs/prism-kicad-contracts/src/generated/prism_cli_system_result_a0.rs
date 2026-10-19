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
///How many of each section the written system bundle holds.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How many of each section the written system bundle holds.",
///  "type": "object",
///  "required": [
///    "errors",
///    "links",
///    "mates",
///    "nets",
///    "pending_occurrences",
///    "ready_occurrences",
///    "suggestions",
///    "warnings"
///  ],
///  "properties": {
///    "errors": {
///      "description": "Findings of severity error that no waiver covers.",
///      "$ref": "#/$defs/Count"
///    },
///    "links": {
///      "description": "Harness link wirings.",
///      "$ref": "#/$defs/Count"
///    },
///    "mates": {
///      "description": "B2B mappings.",
///      "$ref": "#/$defs/Count"
///    },
///    "nets": {
///      "description": "System nets.",
///      "$ref": "#/$defs/Count"
///    },
///    "pending_occurrences": {
///      "description": "Board occurrences whose design bundle is not built yet.",
///      "$ref": "#/$defs/Count"
///    },
///    "ready_occurrences": {
///      "description": "Occurrences read from their design bundles.",
///      "$ref": "#/$defs/Count"
///    },
///    "suggestions": {
///      "description": "Sub-port suggestions.",
///      "$ref": "#/$defs/Count"
///    },
///    "warnings": {
///      "description": "Findings of severity warning that no waiver covers.",
///      "$ref": "#/$defs/Count"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliSystemCounts {
    ///Occurrences read from their design bundles.
    pub ready_occurrences: Count,
    ///Board occurrences whose design bundle is not built yet.
    pub pending_occurrences: Count,
    ///System nets.
    pub nets: Count,
    ///B2B mappings.
    pub mates: Count,
    ///Harness link wirings.
    pub links: Count,
    ///Sub-port suggestions.
    pub suggestions: Count,
    ///Findings of severity error that no waiver covers.
    pub errors: Count,
    ///Findings of severity warning that no waiver covers.
    pub warnings: Count,
}
///stdout of `system build` (exit 0), written after `-o` holds the `SystemBundleA0`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.system_result:a0",
///  "title": "CliSystemResultA0",
///  "description": "stdout of `system build` (exit 0), written after `-o` holds the `SystemBundleA0`.",
///  "type": "object",
///  "required": [
///    "counts",
///    "document_sha256",
///    "schema",
///    "system_bundle_key"
///  ],
///  "properties": {
///    "counts": {
///      "description": "The written bundle's section counts.",
///      "$ref": "#/$defs/CliSystemCounts"
///    },
///    "document_sha256": {
///      "description": "SHA-256 of the input document's canonical JSON.",
///      "$ref": "#/$defs/Sha256Hex"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.system_result.a0"
///    },
///    "system_bundle_key": {
///      "description": "The system bundle key (`docs/system-builder/CONTRACTS.md` §8.1).",
///      "$ref": "#/$defs/Sha256Hex"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliSystemResultA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The system bundle key (`docs/system-builder/CONTRACTS.md` §8.1).
    pub system_bundle_key: Sha256Hex,
    ///SHA-256 of the input document's canonical JSON.
    pub document_sha256: Sha256Hex,
    ///The written bundle's section counts.
    pub counts: CliSystemCounts,
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
