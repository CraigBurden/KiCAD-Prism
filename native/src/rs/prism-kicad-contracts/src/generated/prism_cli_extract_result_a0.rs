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
/**Path of a member inside a `.prism` bundle archive: `/`-separated, relative,
no empty, `.` or `..` segment, no leading or trailing `/`, no backslash and
no `:`. The same rule as manifest a1's ArchivePath and prism-bundle's
`check_member_name`, without lookaround.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Path of a member inside a `.prism` bundle archive: `/`-separated, relative,\nno empty, `.` or `..` segment, no leading or trailing `/`, no backslash and\nno `:`. The same rule as manifest a1's ArchivePath and prism-bundle's\n`check_member_name`, without lookaround.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct ArchivePath(pub ::std::string::String);
impl ::std::ops::Deref for ArchivePath {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<ArchivePath> for ::std::string::String {
    fn from(value: ArchivePath) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for ArchivePath {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for ArchivePath {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for ArchivePath {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///A size in bytes: a non-negative safe integer.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A size in bytes: a non-negative safe integer.",
///  "type": "integer",
///  "minimum": 0.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct ByteCount(pub u64);
impl ::std::ops::Deref for ByteCount {
    type Target = u64;
    fn deref(&self) -> &u64 {
        &self.0
    }
}
impl ::std::convert::From<ByteCount> for u64 {
    fn from(value: ByteCount) -> Self {
        value.0
    }
}
impl ::std::convert::From<u64> for ByteCount {
    fn from(value: u64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for ByteCount {
    type Err = <u64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for ByteCount {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for ByteCount {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for ByteCount {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///stdout of `bundle extract` (exit 0).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.cli.extract_result:a0",
///  "title": "CliExtractResultA0",
///  "description": "stdout of `bundle extract` (exit 0).",
///  "type": "object",
///  "required": [
///    "members",
///    "schema"
///  ],
///  "properties": {
///    "members": {
///      "description": "Every member extracted, which is every member the `<member>` arguments\nselected, sorted by `path` in code point order. Each was written to\n`<output>/<path>` and its size and SHA-256 checked against the manifest.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/CliMemberDigest"
///      },
///      "minItems": 1
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.cli.extract_result.a0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliExtractResultA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    /**Every member extracted, which is every member the `<member>` arguments
    selected, sorted by `path` in code point order. Each was written to
    `<output>/<path>` and its size and SHA-256 checked against the manifest.*/
    pub members: ::std::vec::Vec<CliMemberDigest>,
}
///One archive member and its digest.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One archive member and its digest.",
///  "type": "object",
///  "required": [
///    "bytes",
///    "path",
///    "sha256"
///  ],
///  "properties": {
///    "bytes": {
///      "description": "Its uncompressed size in bytes.",
///      "$ref": "#/$defs/ByteCount"
///    },
///    "path": {
///      "description": "The member's archive path.",
///      "$ref": "#/$defs/ArchivePath"
///    },
///    "sha256": {
///      "description": "SHA-256 of its uncompressed bytes.",
///      "$ref": "#/$defs/Sha256Hex"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct CliMemberDigest {
    ///The member's archive path.
    pub path: ArchivePath,
    ///Its uncompressed size in bytes.
    pub bytes: ByteCount,
    ///SHA-256 of its uncompressed bytes.
    pub sha256: Sha256Hex,
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
