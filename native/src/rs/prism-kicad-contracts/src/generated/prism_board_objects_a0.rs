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
/**Every addressable object and review-only settings object of the project's
KiCad documents, for Design Comparison.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.board_objects:a0",
///  "title": "BoardObjectsA0",
///  "description": "Every addressable object and review-only settings object of the project's\nKiCad documents, for Design Comparison.",
///  "type": "object",
///  "required": [
///    "documents",
///    "schema"
///  ],
///  "properties": {
///    "documents": {
///      "description": "One entry per `.kicad_sch`, `.kicad_pcb`, `.kicad_pro` and `.kicad_dru`\nmember of the bundle's `sources/`, which is the closure the build read\nfor this project (bundle-format.md §2.2), never the repository-wide key\nsource set, so another project's files appear only when this project\nreferences them. Files that yield no object are included. Sorted by\n`path` in code point order; `path` is unique. A file the producer cannot\nparse is left out and reported as a warning of stage `parse` in\n`bundle.json`. Empty only when the closure has none of these files.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/BoardObjectsDocument"
///      }
///    },
///    "schema": {
///      "description": "Schema id of this document.",
///      "type": "string",
///      "const": "prism.board_objects.a0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsA0 {
    ///Schema id of this document.
    pub schema: ::std::string::String,
    /**One entry per `.kicad_sch`, `.kicad_pcb`, `.kicad_pro` and `.kicad_dru`
    member of the bundle's `sources/`, which is the closure the build read
    for this project (bundle-format.md §2.2), never the repository-wide key
    source set, so another project's files appear only when this project
    references them. Files that yield no object are included. Sorted by
    `path` in code point order; `path` is unique. A file the producer cannot
    parse is left out and reported as a warning of stage `parse` in
    `bundle.json`. Empty only when the closure has none of these files.*/
    pub documents: ::std::vec::Vec<BoardObjectsDocument>,
}
///An arc track: board-level `(arc (start …) (mid …) (end …) …)` (`ecad-parse.mjs:1498-1513`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "An arc track: board-level `(arc (start …) (mid …) (end …) …)` (`ecad-parse.mjs:1498-1513`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "Centroid of the arc's start, mid and end points, board frame, computed by the field map's centroid rule. Absent when it has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "arc"
///    },
///    "layer": {
///      "description": "The arc's `(layer …)`. Absent when the form has none.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "net": {
///      "description": "The arc's net, by name. Absent when the arc has no net.",
///      "$ref": "#/$defs/NetName"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Width`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsArc {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Centroid of the arc's start, mid and end points, board frame, computed by the field map's centroid rule. Absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The arc's `(layer …)`. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<LayerName>,
    ///The arc's net, by name. Absent when the arc has no net.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<NetName>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Width`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A schematic bus: `(bus (pts …) …)` (`ecad-parse.mjs:1039-1049`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A schematic bus: `(bus (pts …) …)` (`ecad-parse.mjs:1039-1049`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "Centroid of the bus's `(pts …)` points, schematic page frame, computed by the field map's centroid rule. Absent when it has no point.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "bus"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Stroke`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsBus {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Centroid of the bus's `(pts …)` points, schematic page frame, computed by the field map's centroid rule. Absent when it has no point.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Stroke`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A bus entry: `(bus_entry …)` (`ecad-parse.mjs:1068-1083`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A bus entry: `(bus_entry …)` (`ecad-parse.mjs:1068-1083`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The entry's `(at x y)`, schematic page frame. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "bus_entry"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Size`, `Stroke`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsBusEntry {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///The entry's `(at x y)`, schematic page frame. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Size`, `Stroke`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A `(color <r> <g> <b> [<a>])` as written.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A `(color <r> <g> <b> [<a>])` as written.",
///  "type": "object",
///  "required": [
///    "blue",
///    "green",
///    "red"
///  ],
///  "properties": {
///    "alpha": {
///      "description": "Alpha, 0 to 1. Absent when not written; readers then use 1.",
///      "type": "number"
///    },
///    "blue": {
///      "description": "Blue, 0 to 255.",
///      "type": "number"
///    },
///    "green": {
///      "description": "Green, 0 to 255.",
///      "type": "number"
///    },
///    "red": {
///      "description": "Red, 0 to 255.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsColor {
    ///Red, 0 to 255.
    pub red: f64,
    ///Green, 0 to 255.
    pub green: f64,
    ///Blue, 0 to 255.
    pub blue: f64,
    ///Alpha, 0 to 1. Absent when not written; readers then use 1.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub alpha: ::std::option::Option<f64>,
}
/**Content digest of one KiCad object: the first 16 hexadecimal digits of the
SHA-256 of the object's canonical form text (field map, "contentDigest").
The canonical form keeps the object's own s-expression without its
identity (`uuid`, `tstamp`), without data KiCad regenerates
(`fields_autoplaced`, `filled_polygon`, `render_cache`, an instance path's
`page`), with its net written by name, with each child object (a
footprint's pads, zones, graphics and texts; a symbol's or sheet's pins)
replaced by a reference to its uuid, and with only the child forms listed
for its form head in the field map. Two objects with the same key have
equal digests exactly when that content is equal; the value means nothing
else and is never compared across keys.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Content digest of one KiCad object: the first 16 hexadecimal digits of the\nSHA-256 of the object's canonical form text (field map, \"contentDigest\").\nThe canonical form keeps the object's own s-expression without its\nidentity (`uuid`, `tstamp`), without data KiCad regenerates\n(`fields_autoplaced`, `filled_polygon`, `render_cache`, an instance path's\n`page`), with its net written by name, with each child object (a\nfootprint's pads, zones, graphics and texts; a symbol's or sheet's pins)\nreplaced by a reference to its uuid, and with only the child forms listed\nfor its form head in the field map. Two objects with the same key have\nequal digests exactly when that content is equal; the value means nothing\nelse and is never compared across keys.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct BoardObjectsContentDigest(pub ::std::string::String);
impl ::std::ops::Deref for BoardObjectsContentDigest {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<BoardObjectsContentDigest> for ::std::string::String {
    fn from(value: BoardObjectsContentDigest) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for BoardObjectsContentDigest {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for BoardObjectsContentDigest {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for BoardObjectsContentDigest {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
///The objects of one KiCad document.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The objects of one KiCad document.",
///  "type": "object",
///  "required": [
///    "objects",
///    "path",
///    "reviewOnlyObjects"
///  ],
///  "properties": {
///    "objects": {
///      "description": "The document's objects that carry a KiCad uuid, in file order: ordered\nby the byte offset of each object's opening parenthesis, so a footprint\nprecedes its pads and a symbol its pins. `uuid` is unique within the\narray: when two forms of one document carry the same uuid only the\nlater one is kept and stage `parse` gets a warning. Always empty for a\n`.kicad_pro` or `.kicad_dru` document.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/BoardObjectsObject"
///      }
///    },
///    "path": {
///      "description": "The document's repository-relative path. With an object's `uuid` it\nforms the object's ObjectRef `<path>#<uuid>`, Design Comparison's object\nkey (`ecad-diff.mjs:93-95`). Today's `documentPath`\n(`ecad-parse.mjs:1689`) is relative to the project directory instead;\nthe ids change once, by decision (conventions.md §8).",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "reviewOnlyObjects": {
///      "description": "The document's review-only objects, sorted by `id` in code point order;\n`id` is unique (of two objects with one id, the one today's index\nemits later is kept, as its keyed map does). `.kicad_pro`: every kind\nexcept `custom-rule`, `fabrication-output` and `bus_alias`;\n`.kicad_dru`: `custom-rule`; `.kicad_pcb`: `fabrication-output`;\n`.kicad_sch`: `bus_alias`. Empty when the document has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/BoardObjectsReviewOnlyObject"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsDocument {
    /**The document's repository-relative path. With an object's `uuid` it
    forms the object's ObjectRef `<path>#<uuid>`, Design Comparison's object
    key (`ecad-diff.mjs:93-95`). Today's `documentPath`
    (`ecad-parse.mjs:1689`) is relative to the project directory instead;
    the ids change once, by decision (conventions.md §8).*/
    pub path: RepoPath,
    /**The document's objects that carry a KiCad uuid, in file order: ordered
    by the byte offset of each object's opening parenthesis, so a footprint
    precedes its pads and a symbol its pins. `uuid` is unique within the
    array: when two forms of one document carry the same uuid only the
    later one is kept and stage `parse` gets a warning. Always empty for a
    `.kicad_pro` or `.kicad_dru` document.*/
    pub objects: ::std::vec::Vec<BoardObjectsObject>,
    /**The document's review-only objects, sorted by `id` in code point order;
    `id` is unique (of two objects with one id, the one today's index
    emits later is kept, as its keyed map does). `.kicad_pro`: every kind
    except `custom-rule`, `fabrication-output` and `bus_alias`;
    `.kicad_dru`: `custom-rule`; `.kicad_pcb`: `fabrication-output`;
    `.kicad_sch`: `bus_alias`. Empty when the document has none.*/
    #[serde(rename = "reviewOnlyObjects")]
    pub review_only_objects: ::std::vec::Vec<BoardObjectsReviewOnlyObject>,
}
///A text's `(font …)`, with only what the file writes.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A text's `(font …)`, with only what the file writes.",
///  "type": "object",
///  "properties": {
///    "bold": {
///      "description": "The `bold` flag as written: true for `bold` or `(bold yes)`, false for `(bold no)`. Absent when not written.",
///      "type": "boolean"
///    },
///    "color": {
///      "description": "The `(color …)`. Absent when not written.",
///      "$ref": "#/$defs/BoardObjectsColor"
///    },
///    "face": {
///      "description": "The `(face …)` font name. Absent when not written.",
///      "type": "string"
///    },
///    "italic": {
///      "description": "The `italic` flag as written: true for `italic` or `(italic yes)`, false for `(italic no)`. Absent when not written.",
///      "type": "boolean"
///    },
///    "lineSpacing": {
///      "description": "The `(line_spacing …)` factor as written. Absent when not written.",
///      "type": "number"
///    },
///    "size": {
///      "description": "The `(size …)`. Absent when not written.",
///      "$ref": "#/$defs/BoardObjectsFontSize"
///    },
///    "thicknessNm": {
///      "description": "The `(thickness …)` stroke width. Absent when not written.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsFont {
    ///The `(face …)` font name. Absent when not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub face: ::std::option::Option<::std::string::String>,
    ///The `(size …)`. Absent when not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub size: ::std::option::Option<BoardObjectsFontSize>,
    ///The `(thickness …)` stroke width. Absent when not written.
    #[serde(
        rename = "thicknessNm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub thickness_nm: ::std::option::Option<NonNegativeNanometres>,
    ///The `bold` flag as written: true for `bold` or `(bold yes)`, false for `(bold no)`. Absent when not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub bold: ::std::option::Option<bool>,
    ///The `italic` flag as written: true for `italic` or `(italic yes)`, false for `(italic no)`. Absent when not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub italic: ::std::option::Option<bool>,
    ///The `(line_spacing …)` factor as written. Absent when not written.
    #[serde(
        rename = "lineSpacing",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub line_spacing: ::std::option::Option<f64>,
    ///The `(color …)`. Absent when not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub color: ::std::option::Option<BoardObjectsColor>,
}
impl ::std::default::Default for BoardObjectsFont {
    fn default() -> Self {
        Self {
            bold: Default::default(),
            color: Default::default(),
            face: Default::default(),
            italic: Default::default(),
            line_spacing: Default::default(),
            size: Default::default(),
            thickness_nm: Default::default(),
        }
    }
}
///A font's `(size <height> <width>)`; a missing value is 0.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A font's `(size <height> <width>)`; a missing value is 0.",
///  "type": "object",
///  "required": [
///    "heightNm",
///    "widthNm"
///  ],
///  "properties": {
///    "heightNm": {
///      "description": "The first value: glyph height.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "widthNm": {
///      "description": "The second value: glyph width.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsFontSize {
    ///The first value: glyph height.
    #[serde(rename = "heightNm")]
    pub height_nm: NonNegativeNanometres,
    ///The second value: glyph width.
    #[serde(rename = "widthNm")]
    pub width_nm: NonNegativeNanometres,
}
///A footprint placed on the board: `(footprint "<lib id>" …)` (`ecad-parse.mjs:1380-1412`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A footprint placed on the board: `(footprint \"<lib id>\" …)` (`ecad-parse.mjs:1380-1412`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "properties",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The footprint's anchor, `(at x y …)`, board frame. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "footprintPath": {
///      "description": "The footprint's `(path …)`, board form (no root sheet uuid): the occurrence of the symbol it was placed from. Today's `kiidPaths` is the one-entry list of this value. Absent when the footprint has no valid path.",
///      "$ref": "#/$defs/KiidPath"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "footprint"
///    },
///    "layer": {
///      "description": "The footprint's `(layer …)`: `F.Cu`, or `B.Cu` for a flipped footprint. Absent when the form has none.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "libId": {
///      "description": "The footprint's library link, the form's first value, as written. Absent when it is empty.",
///      "$ref": "#/$defs/LibId"
///    },
///    "properties": {
///      "description": "The footprint's fields, in file order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/BoardObjectsFootprintProperty"
///      }
///    },
///    "refdes": {
///      "description": "The `Reference` field's value (`ecad-parse.mjs:1383-1385`). Absent when it is missing or empty.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Description`, `Attributes`, `Exclude from BOM`, `Exclude from position files`, `Board only`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "rotationDeg": {
///      "description": "The angle of the footprint's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsFootprint {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///The footprint's library link, the form's first value, as written. Absent when it is empty.
    #[serde(
        rename = "libId",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub lib_id: ::std::option::Option<LibId>,
    ///The footprint's anchor, `(at x y …)`, board frame. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The angle of the footprint's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is.
    #[serde(
        rename = "rotationDeg",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub rotation_deg: ::std::option::Option<Degrees>,
    ///The footprint's `(layer …)`: `F.Cu`, or `B.Cu` for a flipped footprint. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<LayerName>,
    ///The footprint's `(path …)`, board form (no root sheet uuid): the occurrence of the symbol it was placed from. Today's `kiidPaths` is the one-entry list of this value. Absent when the footprint has no valid path.
    #[serde(
        rename = "footprintPath",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub footprint_path: ::std::option::Option<KiidPath>,
    ///The `Reference` field's value (`ecad-parse.mjs:1383-1385`). Absent when it is missing or empty.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<Refdes>,
    ///The footprint's fields, in file order.
    pub properties: ::std::vec::Vec<BoardObjectsFootprintProperty>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Description`, `Attributes`, `Exclude from BOM`, `Exclude from position files`, `Board only`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A footprint drawing: `(fp_line …)`, `(fp_rect …)`, `(fp_arc …)`, `(fp_circle …)` or `(fp_poly …)` inside a footprint (`ecad-parse.mjs:1461-1477`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A footprint drawing: `(fp_line …)`, `(fp_rect …)`, `(fp_arc …)`, `(fp_circle …)` or `(fp_poly …)` inside a footprint (`ecad-parse.mjs:1461-1477`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "Centroid of the drawing's points as the field map's per-form table defines them, footprint-local as the file stores them. Absent when there is no point.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "footprint-graphic"
///    },
///    "layer": {
///      "description": "The drawing's `(layer …)`. Absent when the form has none.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "parentUuid": {
///      "description": "Uuid of the footprint. Absent only when it has no valid uuid.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "refdes": {
///      "description": "The footprint's `refdes`. Absent when it has none.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Stroke`, `Fill`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsFootprintGraphic {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Uuid of the footprint. Absent only when it has no valid uuid.
    #[serde(
        rename = "parentUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_uuid: ::std::option::Option<KiCadUuid>,
    ///The footprint's `refdes`. Absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<Refdes>,
    ///Centroid of the drawing's points as the field map's per-form table defines them, footprint-local as the file stores them. Absent when there is no point.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The drawing's `(layer …)`. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<LayerName>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Stroke`, `Fill`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///One field of a board footprint (field map, "Footprint properties").
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One field of a board footprint (field map, \"Footprint properties\").",
///  "type": "object",
///  "required": [
///    "hide",
///    "name",
///    "value"
///  ],
///  "properties": {
///    "at": {
///      "description": "The field's `(at x y …)` as written, footprint-local. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "hide": {
///      "description": "True when the field form has `(hide yes)` or a bare `hide`; false otherwise.",
///      "type": "boolean"
///    },
///    "name": {
///      "description": "The field name (`Reference`, `Value`, `Footprint`, a user field).",
///      "type": "string"
///    },
///    "value": {
///      "description": "The field value as written; may be empty.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsFootprintProperty {
    ///The field name (`Reference`, `Value`, `Footprint`, a user field).
    pub name: ::std::string::String,
    ///The field value as written; may be empty.
    pub value: ::std::string::String,
    ///The field's `(at x y …)` as written, footprint-local. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///True when the field form has `(hide yes)` or a bare `hide`; false otherwise.
    pub hide: bool,
}
///A footprint text: `(fp_text reference|value|user "…" …)` inside a footprint (`ecad-parse.mjs:1478-1495`). KiCad 8 and later keep `Reference` and `Value` as properties, not as texts.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A footprint text: `(fp_text reference|value|user \"…\" …)` inside a footprint (`ecad-parse.mjs:1478-1495`). KiCad 8 and later keep `Reference` and `Value` as properties, not as texts.",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The text's `(at x y …)` as written: footprint-local. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "footprint-text"
///    },
///    "layer": {
///      "description": "The text's `(layer …)`. Absent when the form has none.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "parentUuid": {
///      "description": "Uuid of the footprint. Absent only when it has no valid uuid.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "refdes": {
///      "description": "The footprint's `refdes`. Absent when it has none.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Text kind`, `Text`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "rotationDeg": {
///      "description": "The angle of the text's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "text": {
///      "description": "The text as written (unexpanded variables such as `${REFERENCE}` stay). Absent when the form has none.",
///      "type": "string"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsFootprintText {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Uuid of the footprint. Absent only when it has no valid uuid.
    #[serde(
        rename = "parentUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_uuid: ::std::option::Option<KiCadUuid>,
    ///The footprint's `refdes`. Absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<Refdes>,
    ///The text's `(at x y …)` as written: footprint-local. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The angle of the text's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is.
    #[serde(
        rename = "rotationDeg",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub rotation_deg: ::std::option::Option<Degrees>,
    ///The text's `(layer …)`. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<LayerName>,
    ///The text as written (unexpanded variables such as `${REFERENCE}` stay). Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub text: ::std::option::Option<::std::string::String>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Text kind`, `Text`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
/**A drawing that is not part of a footprint. Schematic: `(polyline …)`,
`(rectangle …)`, `(arc …)`, `(circle …)`, `(bezier …)`, `(text …)`,
`(text_box …)` (`ecad-parse.mjs:1105-1118`). Board: `(gr_line …)`,
`(gr_rect …)`, `(gr_arc …)`, `(gr_circle …)`, `(gr_poly …)`,
`(gr_text …)`, `(dimension …)` (`ecad-parse.mjs:1557-1571`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A drawing that is not part of a footprint. Schematic: `(polyline …)`,\n`(rectangle …)`, `(arc …)`, `(circle …)`, `(bezier …)`, `(text …)`,\n`(text_box …)` (`ecad-parse.mjs:1105-1118`). Board: `(gr_line …)`,\n`(gr_rect …)`, `(gr_arc …)`, `(gr_circle …)`, `(gr_poly …)`,\n`(gr_text …)`, `(dimension …)` (`ecad-parse.mjs:1557-1571`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "Position of the drawing in the document frame (schematic page or board,\n+y down): the form's `(at …)` when it has one, else the centroid of its\npoints as the field map's per-form table defines them. Absent for the\nforms the table marks so (a schematic `circle`, a board `dimension`).",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "graphic"
///    },
///    "layer": {
///      "description": "Board drawings only: the drawing's `(layer …)`. Absent on schematic drawings and when the form has none.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Graphic type`, `Text`, `Stroke`, `Fill`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "text": {
///      "description": "The drawing's text: schematic `text`/`text_box`, board `gr_text`. Absent on every other form.",
///      "type": "string"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsGraphic {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    /**Position of the drawing in the document frame (schematic page or board,
    +y down): the form's `(at …)` when it has one, else the centroid of its
    points as the field map's per-form table defines them. Absent for the
    forms the table marks so (a schematic `circle`, a board `dimension`).*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///Board drawings only: the drawing's `(layer …)`. Absent on schematic drawings and when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<LayerName>,
    ///The drawing's text: schematic `text`/`text_box`, board `gr_text`. Absent on every other form.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub text: ::std::option::Option<::std::string::String>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Graphic type`, `Text`, `Stroke`, `Fill`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A board group: `(group "<name>" (uuid …) (members …))` (`ecad-parse.mjs:1573-1584`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A board group: `(group \"<name>\" (uuid …) (members …))` (`ecad-parse.mjs:1573-1584`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "name",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "group"
///    },
///    "name": {
///      "description": "The group's name as written; empty for an unnamed group.",
///      "type": "string"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Group`, `Members`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsGroup {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///The group's name as written; empty for an unnamed group.
    pub name: ::std::string::String,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Group`, `Members`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///Horizontal justification of a text, as today's index reads `(justify …)` (`left`/`right`; `center` when neither is written).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Horizontal justification of a text, as today's index reads `(justify …)` (`left`/`right`; `center` when neither is written).",
///  "type": "string",
///  "enum": [
///    "left",
///    "right",
///    "center"
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
pub enum BoardObjectsHorizontalJustify {
    #[serde(rename = "left")]
    Left,
    #[serde(rename = "right")]
    Right,
    #[serde(rename = "center")]
    Center,
}
impl ::std::fmt::Display for BoardObjectsHorizontalJustify {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Left => f.write_str("left"),
            Self::Right => f.write_str("right"),
            Self::Center => f.write_str("center"),
        }
    }
}
impl ::std::str::FromStr for BoardObjectsHorizontalJustify {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "left" => Ok(Self::Left),
            "right" => Ok(Self::Right),
            "center" => Ok(Self::Center),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for BoardObjectsHorizontalJustify {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for BoardObjectsHorizontalJustify {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for BoardObjectsHorizontalJustify {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A schematic bitmap: `(image …)` (`ecad-parse.mjs:1120-1125`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A schematic bitmap: `(image …)` (`ecad-parse.mjs:1120-1125`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The image's `(at x y)` centre, schematic page frame. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "image"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Scale`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsImage {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///The image's `(at x y)` centre, schematic page frame. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Scale`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A junction dot: `(junction …)` (`ecad-parse.mjs:1068-1083`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A junction dot: `(junction …)` (`ecad-parse.mjs:1068-1083`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The junction's `(at x y)`, schematic page frame. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "junction"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Diameter`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsJunction {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///The junction's `(at x y)`, schematic page frame. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Diameter`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A text's `(justify …)` as today's index reads it.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A text's `(justify …)` as today's index reads it.",
///  "type": "object",
///  "required": [
///    "horizontal",
///    "mirror",
///    "vertical"
///  ],
///  "properties": {
///    "horizontal": {
///      "description": "Horizontal justification.",
///      "$ref": "#/$defs/BoardObjectsHorizontalJustify"
///    },
///    "mirror": {
///      "description": "True when the justify form contains `mirror`.",
///      "type": "boolean"
///    },
///    "vertical": {
///      "description": "Vertical justification.",
///      "$ref": "#/$defs/BoardObjectsVerticalJustify"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsJustify {
    ///Horizontal justification.
    pub horizontal: BoardObjectsHorizontalJustify,
    ///Vertical justification.
    pub vertical: BoardObjectsVerticalJustify,
    ///True when the justify form contains `mirror`.
    pub mirror: bool,
}
///A net label of any scope: `(label …)`, `(global_label …)` or `(hierarchical_label …)` (`ecad-parse.mjs:1085-1103`). The scope is part of `contentDigest`, not a field.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A net label of any scope: `(label …)`, `(global_label …)` or `(hierarchical_label …)` (`ecad-parse.mjs:1085-1103`). The scope is part of `contentDigest`, not a field.",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The label's `(at x y …)`, schematic page frame. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "label"
///    },
///    "net": {
///      "description": "The label's text again: the name the label gives its net on its sheet, not the resolved full net name (`ecad-parse.mjs:1096`). Absent exactly when `text` is.",
///      "type": "string"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Text`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "rotationDeg": {
///      "description": "The angle of the label's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "text": {
///      "description": "The label's text as written. Absent when the form has none.",
///      "type": "string"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsLabel {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///The label's text as written. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub text: ::std::option::Option<::std::string::String>,
    ///The label's text again: the name the label gives its net on its sheet, not the resolved full net name (`ecad-parse.mjs:1096`). Absent exactly when `text` is.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<::std::string::String>,
    ///The label's `(at x y …)`, schematic page frame. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The angle of the label's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is.
    #[serde(
        rename = "rotationDeg",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub rotation_deg: ::std::option::Option<Degrees>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Text`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
/**A board layer exactly as the file writes it on a pad or zone: a canonical
layer name (`F.Cu`, `In2.Cu`, `B.Mask`) or a KiCad wildcard set (`*.Cu`,
`F&B.Cu`, `*.Mask`), not expanded. Today's Design Comparison shows and
compares the wildcard spelling (`ecad-parse.mjs:1423`, `:1452-1454`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A board layer exactly as the file writes it on a pad or zone: a canonical\nlayer name (`F.Cu`, `In2.Cu`, `B.Mask`) or a KiCad wildcard set (`*.Cu`,\n`F&B.Cu`, `*.Mask`), not expanded. Today's Design Comparison shows and\ncompares the wildcard spelling (`ecad-parse.mjs:1423`, `:1452-1454`).",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct BoardObjectsLayerSpec(::std::string::String);
impl ::std::ops::Deref for BoardObjectsLayerSpec {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<BoardObjectsLayerSpec> for ::std::string::String {
    fn from(value: BoardObjectsLayerSpec) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for BoardObjectsLayerSpec {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for BoardObjectsLayerSpec {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for BoardObjectsLayerSpec {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for BoardObjectsLayerSpec {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for BoardObjectsLayerSpec {
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
///How a schematic symbol is mirrored, KiCad's `(mirror x)` or `(mirror y)`.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How a schematic symbol is mirrored, KiCad's `(mirror x)` or `(mirror y)`.",
///  "type": "string",
///  "enum": [
///    "x",
///    "y"
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
pub enum BoardObjectsMirror {
    #[serde(rename = "x")]
    X,
    #[serde(rename = "y")]
    Y,
}
impl ::std::fmt::Display for BoardObjectsMirror {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::X => f.write_str("x"),
            Self::Y => f.write_str("y"),
        }
    }
}
impl ::std::str::FromStr for BoardObjectsMirror {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "x" => Ok(Self::X),
            "y" => Ok(Self::Y),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for BoardObjectsMirror {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for BoardObjectsMirror {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for BoardObjectsMirror {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A no-connect flag: `(no_connect …)` (`ecad-parse.mjs:1068-1083`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A no-connect flag: `(no_connect …)` (`ecad-parse.mjs:1068-1083`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The flag's `(at x y)`, schematic page frame. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "no_connect"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (today always empty).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsNoConnect {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///The flag's `(at x y)`, schematic page frame. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///Review fields, serialized with keys in code point order; keys are review labels (today always empty).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
/**One object with a KiCad uuid. The variant is chosen by `kind`; the field
map lists each kind's KiCad forms.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One object with a KiCad uuid. The variant is chosen by `kind`; the field\nmap lists each kind's KiCad forms.",
///  "oneOf": [
///    {
///      "$ref": "#/$defs/BoardObjectsSymbol"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsPin"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsSheet"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsSheetPin"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsWire"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsBus"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsJunction"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsNoConnect"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsBusEntry"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsLabel"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsGraphic"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsImage"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsTable"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsFootprint"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsPad"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsZone"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsFootprintGraphic"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsFootprintText"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsTrack"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsArc"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsVia"
///    },
///    {
///      "$ref": "#/$defs/BoardObjectsGroup"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum BoardObjectsObject {
    Symbol(BoardObjectsSymbol),
    Pin(BoardObjectsPin),
    Sheet(BoardObjectsSheet),
    SheetPin(BoardObjectsSheetPin),
    Wire(BoardObjectsWire),
    Bus(BoardObjectsBus),
    Junction(BoardObjectsJunction),
    NoConnect(BoardObjectsNoConnect),
    BusEntry(BoardObjectsBusEntry),
    Label(BoardObjectsLabel),
    Graphic(BoardObjectsGraphic),
    Image(BoardObjectsImage),
    Table(BoardObjectsTable),
    Footprint(BoardObjectsFootprint),
    Pad(BoardObjectsPad),
    Zone(BoardObjectsZone),
    FootprintGraphic(BoardObjectsFootprintGraphic),
    FootprintText(BoardObjectsFootprintText),
    Track(BoardObjectsTrack),
    Arc(BoardObjectsArc),
    Via(BoardObjectsVia),
    Group(BoardObjectsGroup),
}
impl ::std::convert::From<BoardObjectsSymbol> for BoardObjectsObject {
    fn from(value: BoardObjectsSymbol) -> Self {
        Self::Symbol(value)
    }
}
impl ::std::convert::From<BoardObjectsPin> for BoardObjectsObject {
    fn from(value: BoardObjectsPin) -> Self {
        Self::Pin(value)
    }
}
impl ::std::convert::From<BoardObjectsSheet> for BoardObjectsObject {
    fn from(value: BoardObjectsSheet) -> Self {
        Self::Sheet(value)
    }
}
impl ::std::convert::From<BoardObjectsSheetPin> for BoardObjectsObject {
    fn from(value: BoardObjectsSheetPin) -> Self {
        Self::SheetPin(value)
    }
}
impl ::std::convert::From<BoardObjectsWire> for BoardObjectsObject {
    fn from(value: BoardObjectsWire) -> Self {
        Self::Wire(value)
    }
}
impl ::std::convert::From<BoardObjectsBus> for BoardObjectsObject {
    fn from(value: BoardObjectsBus) -> Self {
        Self::Bus(value)
    }
}
impl ::std::convert::From<BoardObjectsJunction> for BoardObjectsObject {
    fn from(value: BoardObjectsJunction) -> Self {
        Self::Junction(value)
    }
}
impl ::std::convert::From<BoardObjectsNoConnect> for BoardObjectsObject {
    fn from(value: BoardObjectsNoConnect) -> Self {
        Self::NoConnect(value)
    }
}
impl ::std::convert::From<BoardObjectsBusEntry> for BoardObjectsObject {
    fn from(value: BoardObjectsBusEntry) -> Self {
        Self::BusEntry(value)
    }
}
impl ::std::convert::From<BoardObjectsLabel> for BoardObjectsObject {
    fn from(value: BoardObjectsLabel) -> Self {
        Self::Label(value)
    }
}
impl ::std::convert::From<BoardObjectsGraphic> for BoardObjectsObject {
    fn from(value: BoardObjectsGraphic) -> Self {
        Self::Graphic(value)
    }
}
impl ::std::convert::From<BoardObjectsImage> for BoardObjectsObject {
    fn from(value: BoardObjectsImage) -> Self {
        Self::Image(value)
    }
}
impl ::std::convert::From<BoardObjectsTable> for BoardObjectsObject {
    fn from(value: BoardObjectsTable) -> Self {
        Self::Table(value)
    }
}
impl ::std::convert::From<BoardObjectsFootprint> for BoardObjectsObject {
    fn from(value: BoardObjectsFootprint) -> Self {
        Self::Footprint(value)
    }
}
impl ::std::convert::From<BoardObjectsPad> for BoardObjectsObject {
    fn from(value: BoardObjectsPad) -> Self {
        Self::Pad(value)
    }
}
impl ::std::convert::From<BoardObjectsZone> for BoardObjectsObject {
    fn from(value: BoardObjectsZone) -> Self {
        Self::Zone(value)
    }
}
impl ::std::convert::From<BoardObjectsFootprintGraphic> for BoardObjectsObject {
    fn from(value: BoardObjectsFootprintGraphic) -> Self {
        Self::FootprintGraphic(value)
    }
}
impl ::std::convert::From<BoardObjectsFootprintText> for BoardObjectsObject {
    fn from(value: BoardObjectsFootprintText) -> Self {
        Self::FootprintText(value)
    }
}
impl ::std::convert::From<BoardObjectsTrack> for BoardObjectsObject {
    fn from(value: BoardObjectsTrack) -> Self {
        Self::Track(value)
    }
}
impl ::std::convert::From<BoardObjectsArc> for BoardObjectsObject {
    fn from(value: BoardObjectsArc) -> Self {
        Self::Arc(value)
    }
}
impl ::std::convert::From<BoardObjectsVia> for BoardObjectsObject {
    fn from(value: BoardObjectsVia) -> Self {
        Self::Via(value)
    }
}
impl ::std::convert::From<BoardObjectsGroup> for BoardObjectsObject {
    fn from(value: BoardObjectsGroup) -> Self {
        Self::Group(value)
    }
}
///A footprint pad: `(pad …)` inside a footprint (`ecad-parse.mjs:1413-1441`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A footprint pad: `(pad …)` inside a footprint (`ecad-parse.mjs:1413-1441`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The pad's `(at x y …)` as written: footprint-local, relative to the footprint anchor before its rotation; a back-side footprint's children are already mirrored in the file. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "pad"
///    },
///    "layer": {
///      "description": "The first entry of the pad's `(layers …)` as written, wildcard sets included. Absent when the pad has no layer.",
///      "$ref": "#/$defs/BoardObjectsLayerSpec"
///    },
///    "net": {
///      "description": "The pad's net, by name. Absent when the pad has no net.",
///      "$ref": "#/$defs/NetName"
///    },
///    "number": {
///      "description": "The pad number as written; empty for an unnumbered pad. Absent when the form has none.",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "parentUuid": {
///      "description": "Uuid of the footprint the pad belongs to. Absent only when that footprint has no valid uuid.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "refdes": {
///      "description": "The parent footprint's `refdes`. Absent when it has none.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Pad number`, `Pad type`, `Pad shape`, `Size`, `Drill`, `Layers`, `Clearance`, `Solder mask margin`, `Solder paste margin`, `Thermal width`, `Thermal gap`, `Zone connection`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "rotationDeg": {
///      "description": "The angle of the pad's `(at x y angle)` as written, which KiCad stores in the board frame (it includes the footprint's rotation); 0 when omitted. Present exactly when `at` is.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsPad {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Uuid of the footprint the pad belongs to. Absent only when that footprint has no valid uuid.
    #[serde(
        rename = "parentUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_uuid: ::std::option::Option<KiCadUuid>,
    ///The pad number as written; empty for an unnumbered pad. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub number: ::std::option::Option<PadNumber>,
    ///The parent footprint's `refdes`. Absent when it has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<Refdes>,
    ///The pad's `(at x y …)` as written: footprint-local, relative to the footprint anchor before its rotation; a back-side footprint's children are already mirrored in the file. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The angle of the pad's `(at x y angle)` as written, which KiCad stores in the board frame (it includes the footprint's rotation); 0 when omitted. Present exactly when `at` is.
    #[serde(
        rename = "rotationDeg",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub rotation_deg: ::std::option::Option<Degrees>,
    ///The first entry of the pad's `(layers …)` as written, wildcard sets included. Absent when the pad has no layer.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<BoardObjectsLayerSpec>,
    ///The pad's net, by name. Absent when the pad has no net.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<NetName>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Pad number`, `Pad type`, `Pad shape`, `Size`, `Drill`, `Layers`, `Clearance`, `Solder mask margin`, `Solder paste margin`, `Thermal width`, `Thermal gap`, `Zone connection`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A pin instance of a placed symbol: `(pin "<number>" (uuid …))` inside the symbol (`ecad-parse.mjs:986-1002`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A pin instance of a placed symbol: `(pin \"<number>\" (uuid …))` inside the symbol (`ecad-parse.mjs:986-1002`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The parent symbol's anchor (a pin instance has no position of its own), schematic page frame. Absent when the symbol has no `(at …)`.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "pin"
///    },
///    "number": {
///      "description": "The pin number as written. Absent when the form has none.",
///      "$ref": "#/$defs/PadNumber"
///    },
///    "parentUuid": {
///      "description": "Uuid of the symbol the pin belongs to. Absent only when that symbol has no valid uuid.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "refdes": {
///      "description": "The parent symbol's `refdes`. Absent when the parent has none.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Pin number`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsPin {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Uuid of the symbol the pin belongs to. Absent only when that symbol has no valid uuid.
    #[serde(
        rename = "parentUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_uuid: ::std::option::Option<KiCadUuid>,
    ///The pin number as written. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub number: ::std::option::Option<PadNumber>,
    ///The parent symbol's `refdes`. Absent when the parent has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<Refdes>,
    ///The parent symbol's anchor (a pin instance has no position of its own), schematic page frame. Absent when the symbol has no `(at …)`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Pin number`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
/**Identity of a review-only object, unique within its document: today's
synthetic id `<kind with _ written as ->:<16 hex digits>`, for example
`net-class:3f0c…` or `drc-exclusion:1ca4…`. The digits are the first 16
of the BLAKE2b-512 digest of the JSON text of the object's identity
string (`ecad-parse.mjs:252-257`, `:542`); the field map lists the
identity string of each kind.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Identity of a review-only object, unique within its document: today's\nsynthetic id `<kind with _ written as ->:<16 hex digits>`, for example\n`net-class:3f0c…` or `drc-exclusion:1ca4…`. The digits are the first 16\nof the BLAKE2b-512 digest of the JSON text of the object's identity\nstring (`ecad-parse.mjs:252-257`, `:542`); the field map lists the\nidentity string of each kind.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct BoardObjectsReviewOnlyId(pub ::std::string::String);
impl ::std::ops::Deref for BoardObjectsReviewOnlyId {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<BoardObjectsReviewOnlyId> for ::std::string::String {
    fn from(value: BoardObjectsReviewOnlyId) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for BoardObjectsReviewOnlyId {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for BoardObjectsReviewOnlyId {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for BoardObjectsReviewOnlyId {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**Kind of a review-only object: structured settings or definitions that have
no KiCad uuid and nothing to paint, reviewed by their fields alone
(`reviewOnly: true` today). Today's spelling is the value with every `-`
written as `_`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Kind of a review-only object: structured settings or definitions that have\nno KiCad uuid and nothing to paint, reviewed by their fields alone\n(`reviewOnly: true` today). Today's spelling is the value with every `-`\nwritten as `_`.",
///  "type": "string",
///  "enum": [
///    "net-class",
///    "net-class-assignment",
///    "board-constraint",
///    "drc-severity",
///    "routing-preset",
///    "board-default",
///    "teardrop-setting",
///    "zone-setting",
///    "drc-exclusion",
///    "erc-exclusion",
///    "erc-pin-rule",
///    "project-metadata",
///    "custom-rule",
///    "fabrication-output",
///    "bus_alias"
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
pub enum BoardObjectsReviewOnlyKind {
    #[serde(rename = "net-class")]
    NetClass,
    #[serde(rename = "net-class-assignment")]
    NetClassAssignment,
    #[serde(rename = "board-constraint")]
    BoardConstraint,
    #[serde(rename = "drc-severity")]
    DrcSeverity,
    #[serde(rename = "routing-preset")]
    RoutingPreset,
    #[serde(rename = "board-default")]
    BoardDefault,
    #[serde(rename = "teardrop-setting")]
    TeardropSetting,
    #[serde(rename = "zone-setting")]
    ZoneSetting,
    #[serde(rename = "drc-exclusion")]
    DrcExclusion,
    #[serde(rename = "erc-exclusion")]
    ErcExclusion,
    #[serde(rename = "erc-pin-rule")]
    ErcPinRule,
    #[serde(rename = "project-metadata")]
    ProjectMetadata,
    #[serde(rename = "custom-rule")]
    CustomRule,
    #[serde(rename = "fabrication-output")]
    FabricationOutput,
    #[serde(rename = "bus_alias")]
    BusAlias,
}
impl ::std::fmt::Display for BoardObjectsReviewOnlyKind {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::NetClass => f.write_str("net-class"),
            Self::NetClassAssignment => f.write_str("net-class-assignment"),
            Self::BoardConstraint => f.write_str("board-constraint"),
            Self::DrcSeverity => f.write_str("drc-severity"),
            Self::RoutingPreset => f.write_str("routing-preset"),
            Self::BoardDefault => f.write_str("board-default"),
            Self::TeardropSetting => f.write_str("teardrop-setting"),
            Self::ZoneSetting => f.write_str("zone-setting"),
            Self::DrcExclusion => f.write_str("drc-exclusion"),
            Self::ErcExclusion => f.write_str("erc-exclusion"),
            Self::ErcPinRule => f.write_str("erc-pin-rule"),
            Self::ProjectMetadata => f.write_str("project-metadata"),
            Self::CustomRule => f.write_str("custom-rule"),
            Self::FabricationOutput => f.write_str("fabrication-output"),
            Self::BusAlias => f.write_str("bus_alias"),
        }
    }
}
impl ::std::str::FromStr for BoardObjectsReviewOnlyKind {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "net-class" => Ok(Self::NetClass),
            "net-class-assignment" => Ok(Self::NetClassAssignment),
            "board-constraint" => Ok(Self::BoardConstraint),
            "drc-severity" => Ok(Self::DrcSeverity),
            "routing-preset" => Ok(Self::RoutingPreset),
            "board-default" => Ok(Self::BoardDefault),
            "teardrop-setting" => Ok(Self::TeardropSetting),
            "zone-setting" => Ok(Self::ZoneSetting),
            "drc-exclusion" => Ok(Self::DrcExclusion),
            "erc-exclusion" => Ok(Self::ErcExclusion),
            "erc-pin-rule" => Ok(Self::ErcPinRule),
            "project-metadata" => Ok(Self::ProjectMetadata),
            "custom-rule" => Ok(Self::CustomRule),
            "fabrication-output" => Ok(Self::FabricationOutput),
            "bus_alias" => Ok(Self::BusAlias),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for BoardObjectsReviewOnlyKind {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for BoardObjectsReviewOnlyKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for BoardObjectsReviewOnlyKind {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A settings or definition object with no KiCad uuid, reviewed only by its fields (`ecad-parse.mjs:533-551`, `:553-858`, `:1051-1066`, `:1586-1591`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A settings or definition object with no KiCad uuid, reviewed only by its fields (`ecad-parse.mjs:533-551`, `:553-858`, `:1051-1066`, `:1586-1591`).",
///  "type": "object",
///  "required": [
///    "id",
///    "kind",
///    "name",
///    "reviewFields"
///  ],
///  "properties": {
///    "id": {
///      "description": "The object's id; with the document path it forms Design Comparison's key `<path>#<id>`.",
///      "$ref": "#/$defs/BoardObjectsReviewOnlyId"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "$ref": "#/$defs/BoardObjectsReviewOnlyKind"
///    },
///    "name": {
///      "description": "The object's display name: the class name, net pattern, rule name, alias name, exclusion label, pin-type pair, or the fixed name of a singleton kind.",
///      "type": "string",
///      "minLength": 1
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels, which for the settings kinds are derived from KiCad's own setting keys (field map, \"Review fields\"). Never empty except for a `net-class` whose class sets no value.",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsReviewOnlyObject {
    ///Kind of object.
    pub kind: BoardObjectsReviewOnlyKind,
    ///The object's id; with the document path it forms Design Comparison's key `<path>#<id>`.
    pub id: BoardObjectsReviewOnlyId,
    ///The object's display name: the class name, net pattern, rule name, alias name, exclusion label, pin-type pair, or the fixed name of a singleton kind.
    pub name: BoardObjectsReviewOnlyObjectName,
    ///Review fields, serialized with keys in code point order; keys are review labels, which for the settings kinds are derived from KiCad's own setting keys (field map, "Review fields"). Never empty except for a `net-class` whose class sets no value.
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///The object's display name: the class name, net pattern, rule name, alias name, exclusion label, pin-type pair, or the fixed name of a singleton kind.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The object's display name: the class name, net pattern, rule name, alias name, exclusion label, pin-type pair, or the fixed name of a singleton kind.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct BoardObjectsReviewOnlyObjectName(::std::string::String);
impl ::std::ops::Deref for BoardObjectsReviewOnlyObjectName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<BoardObjectsReviewOnlyObjectName> for ::std::string::String {
    fn from(value: BoardObjectsReviewOnlyObjectName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for BoardObjectsReviewOnlyObjectName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for BoardObjectsReviewOnlyObjectName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for BoardObjectsReviewOnlyObjectName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for BoardObjectsReviewOnlyObjectName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for BoardObjectsReviewOnlyObjectName {
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
///One scalar in a settings table.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One scalar in a settings table.",
///  "oneOf": [
///    {
///      "description": "A text.",
///      "type": "string"
///    },
///    {
///      "description": "A number.",
///      "type": "number"
///    },
///    {
///      "description": "A flag.",
///      "type": "boolean"
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum BoardObjectsReviewScalar {
    String(::std::string::String),
    Number(f64),
    Boolean(bool),
}
impl ::std::fmt::Display for BoardObjectsReviewScalar {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match self {
            Self::String(x) => x.fmt(f),
            Self::Number(x) => x.fmt(f),
            Self::Boolean(x) => x.fmt(f),
        }
    }
}
impl ::std::convert::From<f64> for BoardObjectsReviewScalar {
    fn from(value: f64) -> Self {
        Self::Number(value)
    }
}
impl ::std::convert::From<bool> for BoardObjectsReviewScalar {
    fn from(value: bool) -> Self {
        Self::Boolean(value)
    }
}
///A flat table of settings; keys are KiCad's setting keys as written, serialized in code point order.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A flat table of settings; keys are KiCad's setting keys as written, serialized in code point order.",
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/BoardObjectsReviewScalar"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct BoardObjectsReviewTable(
    pub ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar>,
);
impl ::std::ops::Deref for BoardObjectsReviewTable {
    type Target = ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar> {
        &self.0
    }
}
impl ::std::convert::From<BoardObjectsReviewTable>
    for ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar>
{
    fn from(value: BoardObjectsReviewTable) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar>,
    > for BoardObjectsReviewTable
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewScalar>,
    ) -> Self {
        Self(value)
    }
}
/**One review-field value, as Design Comparison shows it: the value today's
index writes, unconverted (lengths stay the millimetres the file writes,
flags stay booleans, `Size` stays a `w × h` text). A presentation value,
not a typed fact: typed lengths of this member are the `…Nm` fields. A
value of any other shape is written as its canonical JSON text (field
map).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One review-field value, as Design Comparison shows it: the value today's\nindex writes, unconverted (lengths stay the millimetres the file writes,\nflags stay booleans, `Size` stays a `w × h` text). A presentation value,\nnot a typed fact: typed lengths of this member are the `…Nm` fields. A\nvalue of any other shape is written as its canonical JSON text (field\nmap).",
///  "oneOf": [
///    {
///      "description": "A text.",
///      "type": "string"
///    },
///    {
///      "description": "A number as today's index writes it.",
///      "type": "number"
///    },
///    {
///      "description": "A flag.",
///      "type": "boolean"
///    },
///    {
///      "description": "A list of texts, in the order today's index writes them.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    {
///      "description": "A list of numbers, in the order today's index writes them.",
///      "type": "array",
///      "items": {
///        "type": "number"
///      }
///    },
///    {
///      "description": "One table of settings (for example a teardrop parameter set).",
///      "$ref": "#/$defs/BoardObjectsReviewTable"
///    },
///    {
///      "description": "A list of tables, in the order today's index writes them.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/BoardObjectsReviewTable"
///      }
///    }
///  ]
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum BoardObjectsReviewValue {
    Variant0(::std::string::String),
    Variant1(f64),
    Variant2(bool),
    Variant3(::std::vec::Vec<::std::string::String>),
    Variant4(::std::vec::Vec<f64>),
    Variant5(BoardObjectsReviewTable),
    Variant6(::std::vec::Vec<BoardObjectsReviewTable>),
}
impl ::std::convert::From<f64> for BoardObjectsReviewValue {
    fn from(value: f64) -> Self {
        Self::Variant1(value)
    }
}
impl ::std::convert::From<bool> for BoardObjectsReviewValue {
    fn from(value: bool) -> Self {
        Self::Variant2(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<::std::string::String>> for BoardObjectsReviewValue {
    fn from(value: ::std::vec::Vec<::std::string::String>) -> Self {
        Self::Variant3(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<f64>> for BoardObjectsReviewValue {
    fn from(value: ::std::vec::Vec<f64>) -> Self {
        Self::Variant4(value)
    }
}
impl ::std::convert::From<BoardObjectsReviewTable> for BoardObjectsReviewValue {
    fn from(value: BoardObjectsReviewTable) -> Self {
        Self::Variant5(value)
    }
}
impl ::std::convert::From<::std::vec::Vec<BoardObjectsReviewTable>> for BoardObjectsReviewValue {
    fn from(value: ::std::vec::Vec<BoardObjectsReviewTable>) -> Self {
        Self::Variant6(value)
    }
}
///One `(property "<name>" "<value>" …)` field of a schematic symbol or sheet (`ecad-parse.mjs:914-928`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One `(property \"<name>\" \"<value>\" …)` field of a schematic symbol or sheet (`ecad-parse.mjs:914-928`).",
///  "type": "object",
///  "required": [
///    "hide",
///    "name",
///    "value"
///  ],
///  "properties": {
///    "at": {
///      "description": "The field's `(at x y …)`, schematic page frame. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "effects": {
///      "description": "The field's `(effects …)`. Absent when the form has none.",
///      "$ref": "#/$defs/BoardObjectsTextEffects"
///    },
///    "hide": {
///      "description": "True when the property form itself has `(hide yes)` or a bare `hide` (KiCad 8 and later).",
///      "type": "boolean"
///    },
///    "name": {
///      "description": "The field name as written (`Reference`, `Value`, `Sheetname`, a user field).",
///      "type": "string"
///    },
///    "rotationDeg": {
///      "description": "The angle of the field's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "value": {
///      "description": "The field value as written; may be empty.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsSchematicProperty {
    ///The field name as written (`Reference`, `Value`, `Sheetname`, a user field).
    pub name: ::std::string::String,
    ///The field value as written; may be empty.
    pub value: ::std::string::String,
    ///The field's `(at x y …)`, schematic page frame. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The angle of the field's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is.
    #[serde(
        rename = "rotationDeg",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub rotation_deg: ::std::option::Option<Degrees>,
    ///True when the property form itself has `(hide yes)` or a bare `hide` (KiCad 8 and later).
    pub hide: bool,
    ///The field's `(effects …)`. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub effects: ::std::option::Option<BoardObjectsTextEffects>,
}
///A hierarchical sheet: KiCad `(sheet …)` (`ecad-parse.mjs:1005-1015`). Today's index gives it no review fields.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A hierarchical sheet: KiCad `(sheet …)` (`ecad-parse.mjs:1005-1015`). Today's index gives it no review fields.",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kiidPaths",
///    "kind",
///    "properties",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The sheet box's `(at x y)` corner, schematic page frame. Absent when the form has no `(at …)`.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kiidPaths": {
///      "description": "Every instance path of the sheet, schematic form: each\n`(instances (project … (path P …)))` entry's P followed by `/<uuid>`.\nEach once, sorted in code point order. Empty when it has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/KiidPath"
///      }
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "sheet"
///    },
///    "properties": {
///      "description": "The sheet's `(property …)` fields (`Sheetname`, `Sheetfile`, user fields), in file order.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/BoardObjectsSchematicProperty"
///      }
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsSheet {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///The sheet box's `(at x y)` corner, schematic page frame. Absent when the form has no `(at …)`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    /**Every instance path of the sheet, schematic form: each
    `(instances (project … (path P …)))` entry's P followed by `/<uuid>`.
    Each once, sorted in code point order. Empty when it has none.*/
    #[serde(rename = "kiidPaths")]
    pub kiid_paths: ::std::vec::Vec<KiidPath>,
    ///The sheet's `(property …)` fields (`Sheetname`, `Sheetfile`, user fields), in file order.
    pub properties: ::std::vec::Vec<BoardObjectsSchematicProperty>,
}
///A sheet pin: `(pin "<name>" <type> …)` inside a sheet (`ecad-parse.mjs:1016-1036`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A sheet pin: `(pin \"<name>\" <type> …)` inside a sheet (`ecad-parse.mjs:1016-1036`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The pin's `(at x y …)`, schematic page frame. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "sheet-pin"
///    },
///    "name": {
///      "description": "The pin's name as written. Absent when the form has none.",
///      "type": "string"
///    },
///    "parentUuid": {
///      "description": "Uuid of the sheet the pin belongs to. Absent only when that sheet has no valid uuid.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Sheet pin`, `Electrical type`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "rotationDeg": {
///      "description": "The angle of the pin's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "text": {
///      "description": "The same value as `name` (today's index emits both). Absent exactly when `name` is.",
///      "type": "string"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsSheetPin {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Uuid of the sheet the pin belongs to. Absent only when that sheet has no valid uuid.
    #[serde(
        rename = "parentUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_uuid: ::std::option::Option<KiCadUuid>,
    ///The pin's name as written. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub name: ::std::option::Option<::std::string::String>,
    ///The same value as `name` (today's index emits both). Absent exactly when `name` is.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub text: ::std::option::Option<::std::string::String>,
    ///The pin's `(at x y …)`, schematic page frame. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The angle of the pin's `(at x y angle)` as written; 0 when omitted. Present exactly when `at` is.
    #[serde(
        rename = "rotationDeg",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub rotation_deg: ::std::option::Option<Degrees>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Sheet pin`, `Electrical type`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A placed schematic symbol: KiCad `(symbol (lib_id …) …)` (`ecad-parse.mjs:958-985`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A placed schematic symbol: KiCad `(symbol (lib_id …) …)` (`ecad-parse.mjs:958-985`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "dnp",
///    "inBom",
///    "instances",
///    "kiidPaths",
///    "kind",
///    "onBoard",
///    "properties",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The symbol's anchor, `(at x y …)`, in the schematic page frame (+y down). Absent when the form has no `(at …)`.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "dnp": {
///      "description": "True when the symbol's own `(dnp …)` is `yes`; false otherwise, including when it is absent. Sheet-level DNP is not folded in.",
///      "type": "boolean"
///    },
///    "inBom": {
///      "description": "False when the symbol's own `(in_bom …)` is `no`; true otherwise, including when it is absent.",
///      "type": "boolean"
///    },
///    "instances": {
///      "description": "The symbol's instances, in file order over every `(project …)` and its\n`(path …)` entries; when there is none, one entry holding only the\n`(default_instance (reference …))`, if there is one\n(`ecad-parse.mjs:893-912`). Empty when the symbol has neither.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/BoardObjectsSymbolInstance"
///      }
///    },
///    "kiidPaths": {
///      "description": "Every occurrence path of the symbol, schematic form: each\n`(instances (project … (path P …)))` entry's P (without a trailing `/`)\nfollowed by `/<uuid>` (`ecad-parse.mjs:867-877`). Each path once,\nsorted in code point order. Empty when the symbol has no instance path.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/KiidPath"
///      }
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "symbol"
///    },
///    "libId": {
///      "description": "The symbol's `(lib_id …)` as written. Absent when the form has none.",
///      "$ref": "#/$defs/LibId"
///    },
///    "mirror": {
///      "description": "The symbol's `(mirror …)`. Absent when the symbol is not mirrored.",
///      "$ref": "#/$defs/BoardObjectsMirror"
///    },
///    "onBoard": {
///      "description": "False when the symbol's own `(on_board …)` is `no`; true otherwise, including when it is absent.",
///      "type": "boolean"
///    },
///    "properties": {
///      "description": "The symbol's `(property …)` fields, in file order (`ecad-parse.mjs:914-928`).",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/BoardObjectsSchematicProperty"
///      }
///    },
///    "refdes": {
///      "description": "The reference designator: the first non-empty `(reference …)` of the\nsymbol's `(instances …)`, else its `(default_instance (reference …))`,\nelse its `Reference` property (`ecad-parse.mjs:879-891`). Includes\npower (`#PWR01`) and unannotated (`R?`) references. Absent when none of\nthese is non-empty.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (today: `Unit`). Field map, \"Review fields\".",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "rotationDeg": {
///      "description": "The angle of the symbol's `(at x y angle)` as written; 0 when the form omits it. Present exactly when `at` is.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsSymbol {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///The symbol's `(lib_id …)` as written. Absent when the form has none.
    #[serde(
        rename = "libId",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub lib_id: ::std::option::Option<LibId>,
    ///The symbol's anchor, `(at x y …)`, in the schematic page frame (+y down). Absent when the form has no `(at …)`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The angle of the symbol's `(at x y angle)` as written; 0 when the form omits it. Present exactly when `at` is.
    #[serde(
        rename = "rotationDeg",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub rotation_deg: ::std::option::Option<Degrees>,
    ///The symbol's `(mirror …)`. Absent when the symbol is not mirrored.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub mirror: ::std::option::Option<BoardObjectsMirror>,
    ///True when the symbol's own `(dnp …)` is `yes`; false otherwise, including when it is absent. Sheet-level DNP is not folded in.
    pub dnp: bool,
    ///False when the symbol's own `(in_bom …)` is `no`; true otherwise, including when it is absent.
    #[serde(rename = "inBom")]
    pub in_bom: bool,
    ///False when the symbol's own `(on_board …)` is `no`; true otherwise, including when it is absent.
    #[serde(rename = "onBoard")]
    pub on_board: bool,
    /**The reference designator: the first non-empty `(reference …)` of the
    symbol's `(instances …)`, else its `(default_instance (reference …))`,
    else its `Reference` property (`ecad-parse.mjs:879-891`). Includes
    power (`#PWR01`) and unannotated (`R?`) references. Absent when none of
    these is non-empty.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<Refdes>,
    /**Every occurrence path of the symbol, schematic form: each
    `(instances (project … (path P …)))` entry's P (without a trailing `/`)
    followed by `/<uuid>` (`ecad-parse.mjs:867-877`). Each path once,
    sorted in code point order. Empty when the symbol has no instance path.*/
    #[serde(rename = "kiidPaths")]
    pub kiid_paths: ::std::vec::Vec<KiidPath>,
    /**The symbol's instances, in file order over every `(project …)` and its
    `(path …)` entries; when there is none, one entry holding only the
    `(default_instance (reference …))`, if there is one
    (`ecad-parse.mjs:893-912`). Empty when the symbol has neither.*/
    pub instances: ::std::vec::Vec<BoardObjectsSymbolInstance>,
    ///The symbol's `(property …)` fields, in file order (`ecad-parse.mjs:914-928`).
    pub properties: ::std::vec::Vec<BoardObjectsSchematicProperty>,
    ///Review fields, serialized with keys in code point order; keys are review labels (today: `Unit`). Field map, "Review fields".
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///One `(path …)` instance of a placed symbol.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One `(path …)` instance of a placed symbol.",
///  "type": "object",
///  "properties": {
///    "path": {
///      "description": "The occurrence path, schematic form: the instance's path (without a trailing `/`) followed by `/<symbol uuid>`. Absent for the `default_instance` entry or when the path is not a valid KIID path.",
///      "$ref": "#/$defs/KiidPath"
///    },
///    "reference": {
///      "description": "The instance's `(reference …)`. Absent when it has none or it is empty.",
///      "$ref": "#/$defs/Refdes"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsSymbolInstance {
    ///The instance's `(reference …)`. Absent when it has none or it is empty.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reference: ::std::option::Option<Refdes>,
    ///The occurrence path, schematic form: the instance's path (without a trailing `/`) followed by `/<symbol uuid>`. Absent for the `default_instance` entry or when the path is not a valid KIID path.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub path: ::std::option::Option<KiidPath>,
}
impl ::std::default::Default for BoardObjectsSymbolInstance {
    fn default() -> Self {
        Self {
            path: Default::default(),
            reference: Default::default(),
        }
    }
}
///A schematic table: `(table …)` (`ecad-parse.mjs:1126-1134`). It has no position.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A schematic table: `(table …)` (`ecad-parse.mjs:1126-1134`). It has no position.",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "table"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Columns`, `Rows`, `Table content`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsTable {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Columns`, `Rows`, `Table content`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A text's `(effects …)`, with only what the file writes (`kicad-sexpr-parser.mjs:511-550`, as today's index reads it).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A text's `(effects …)`, with only what the file writes (`kicad-sexpr-parser.mjs:511-550`, as today's index reads it).",
///  "type": "object",
///  "properties": {
///    "font": {
///      "description": "The `(font …)`. Absent when the effects have none.",
///      "$ref": "#/$defs/BoardObjectsFont"
///    },
///    "hide": {
///      "description": "The effects' `hide` flag as written: true for `hide` or `(hide yes)`, false for `(hide no)`. Absent when not written.",
///      "type": "boolean"
///    },
///    "href": {
///      "description": "The effects' `(href …)` as written. Absent when not written.",
///      "type": "string"
///    },
///    "justify": {
///      "description": "The `(justify …)`. Absent when the effects have none.",
///      "$ref": "#/$defs/BoardObjectsJustify"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsTextEffects {
    ///The `(font …)`. Absent when the effects have none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub font: ::std::option::Option<BoardObjectsFont>,
    ///The `(justify …)`. Absent when the effects have none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub justify: ::std::option::Option<BoardObjectsJustify>,
    ///The effects' `hide` flag as written: true for `hide` or `(hide yes)`, false for `(hide no)`. Absent when not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub hide: ::std::option::Option<bool>,
    ///The effects' `(href …)` as written. Absent when not written.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub href: ::std::option::Option<::std::string::String>,
}
impl ::std::default::Default for BoardObjectsTextEffects {
    fn default() -> Self {
        Self {
            font: Default::default(),
            hide: Default::default(),
            href: Default::default(),
            justify: Default::default(),
        }
    }
}
///A straight track: `(segment …)` (`ecad-parse.mjs:1498-1513`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A straight track: `(segment …)` (`ecad-parse.mjs:1498-1513`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "Centroid of the track's start and end, board frame, computed by the field map's centroid rule. Absent when it has neither.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "track"
///    },
///    "layer": {
///      "description": "The track's `(layer …)`. Absent when the form has none (KiCad 10 writes `(layers …)` for a track with a mask opening; it is then absent).",
///      "$ref": "#/$defs/LayerName"
///    },
///    "net": {
///      "description": "The track's net, by name. Absent when the track has no net.",
///      "$ref": "#/$defs/NetName"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Width`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsTrack {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Centroid of the track's start and end, board frame, computed by the field map's centroid rule. Absent when it has neither.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The track's `(layer …)`. Absent when the form has none (KiCad 10 writes `(layers …)` for a track with a mask opening; it is then absent).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<LayerName>,
    ///The track's net, by name. Absent when the track has no net.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<NetName>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Width`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///Vertical justification of a text, as today's index reads `(justify …)` (`top`/`bottom`; `center` when neither is written).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Vertical justification of a text, as today's index reads `(justify …)` (`top`/`bottom`; `center` when neither is written).",
///  "type": "string",
///  "enum": [
///    "top",
///    "bottom",
///    "center"
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
pub enum BoardObjectsVerticalJustify {
    #[serde(rename = "top")]
    Top,
    #[serde(rename = "bottom")]
    Bottom,
    #[serde(rename = "center")]
    Center,
}
impl ::std::fmt::Display for BoardObjectsVerticalJustify {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Top => f.write_str("top"),
            Self::Bottom => f.write_str("bottom"),
            Self::Center => f.write_str("center"),
        }
    }
}
impl ::std::str::FromStr for BoardObjectsVerticalJustify {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "top" => Ok(Self::Top),
            "bottom" => Ok(Self::Bottom),
            "center" => Ok(Self::Center),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for BoardObjectsVerticalJustify {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for BoardObjectsVerticalJustify {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for BoardObjectsVerticalJustify {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A via: `(via …)` (`ecad-parse.mjs:1515-1541`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A via: `(via …)` (`ecad-parse.mjs:1515-1541`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "layers",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "The via's `(at x y)`, board frame. Absent when the form has none.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "via"
///    },
///    "layer": {
///      "description": "The first entry of `layers`. Absent when `layers` is empty.",
///      "$ref": "#/$defs/LayerName"
///    },
///    "layers": {
///      "description": "The via's `(layers …)` entries, in file order (its two end layers). Empty when the form has none.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/LayerName"
///      }
///    },
///    "net": {
///      "description": "The via's net, by name. Absent when the via has no net.",
///      "$ref": "#/$defs/NetName"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Via type`, `Diameter`, `Drill`, `Layer span`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsVia {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///The via's `(at x y)`, board frame. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The first entry of `layers`. Absent when `layers` is empty.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<LayerName>,
    ///The via's `(layers …)` entries, in file order (its two end layers). Empty when the form has none.
    pub layers: ::std::vec::Vec<LayerName>,
    ///The via's net, by name. Absent when the via has no net.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<NetName>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Via type`, `Diameter`, `Drill`, `Layer span`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A schematic wire: `(wire (pts …) …)` (`ecad-parse.mjs:1039-1049`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A schematic wire: `(wire (pts …) …)` (`ecad-parse.mjs:1039-1049`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "Centroid of the wire's `(pts …)` points, schematic page frame, computed by the field map's centroid rule. Absent when it has no point.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "wire"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Stroke`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsWire {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Centroid of the wire's `(pts …)` points, schematic page frame, computed by the field map's centroid rule. Absent when it has no point.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Stroke`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
///A copper zone or rule area, on the board or inside a footprint: `(zone …)` (`ecad-parse.mjs:1442-1460`, `:1543-1555`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A copper zone or rule area, on the board or inside a footprint: `(zone …)` (`ecad-parse.mjs:1442-1460`, `:1543-1555`).",
///  "type": "object",
///  "required": [
///    "contentDigest",
///    "kind",
///    "reviewFields",
///    "uuid"
///  ],
///  "properties": {
///    "at": {
///      "description": "Centroid of the points of all the zone's `(polygon (pts …))` outlines\n(fill polygons excluded), computed by the field map's centroid rule, in\nthe frame the file stores them: the board frame, except for a footprint\nzone in a board of format 20260616 or later, whose outline is\nfootprint-local (fork: `src/rs/kicad-monkey-core/src/pcb/footprints.rs:36-37`).\nAbsent when the outline has no point.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "contentDigest": {
///      "description": "Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.",
///      "$ref": "#/$defs/BoardObjectsContentDigest"
///    },
///    "kind": {
///      "description": "Kind of object.",
///      "type": "string",
///      "const": "zone"
///    },
///    "layer": {
///      "description": "The zone's `(layer …)`; a footprint zone without one takes the first entry of its `(layers …)`. As written, wildcard sets included. Absent when there is none.",
///      "$ref": "#/$defs/BoardObjectsLayerSpec"
///    },
///    "name": {
///      "description": "The zone's `(name …)` as written. Absent when the form has none.",
///      "type": "string"
///    },
///    "net": {
///      "description": "The zone's net: its `(net_name …)` when non-empty, else the name of its `(net …)`. Absent when the zone has no net.",
///      "$ref": "#/$defs/NetName"
///    },
///    "parentUuid": {
///      "description": "Footprint zones only: uuid of the footprint. Absent on board zones and when the footprint has no valid uuid.",
///      "$ref": "#/$defs/KiCadUuid"
///    },
///    "refdes": {
///      "description": "Footprint zones only: the footprint's `refdes`. Absent on board zones and when the footprint has none.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "reviewFields": {
///      "description": "Review fields, serialized with keys in code point order; keys are review labels (`Zone name`, `Zone layers`, `Priority`, `Hatch`, `Pad connection`, `Minimum thickness`, `Keepout`, `Fill rules`).",
///      "$ref": "#/$defs/RecordBoardObjectsReviewValue"
///    },
///    "uuid": {
///      "description": "The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by\nKiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never\nreaches the parser. An object without an id\nis not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an\nobject whose id is not a canonical uuid is not listed either (today it\nis) and stage `parse` gets a warning.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct BoardObjectsZone {
    ///Kind of object.
    pub kind: ::std::string::String,
    /**The object's KiCad uuid: its `(uuid …)`. Older files are upgraded by
    KiCad before parse (bundle-format.md §2.2), so `(tstamp …)` never
    reaches the parser. An object without an id
    is not listed, as today (`ecad-parse.mjs:940-944`, `:1351-1353`); an
    object whose id is not a canonical uuid is not listed either (today it
    is) and stage `parse` gets a warning.*/
    pub uuid: KiCadUuid,
    ///Digest of the object's authored content, today's `hash` (`ecad-parse.mjs:952`, `:1366-1374`); see the scalar's doc and the field map.
    #[serde(rename = "contentDigest")]
    pub content_digest: BoardObjectsContentDigest,
    ///Footprint zones only: uuid of the footprint. Absent on board zones and when the footprint has no valid uuid.
    #[serde(
        rename = "parentUuid",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub parent_uuid: ::std::option::Option<KiCadUuid>,
    ///Footprint zones only: the footprint's `refdes`. Absent on board zones and when the footprint has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub refdes: ::std::option::Option<Refdes>,
    /**Centroid of the points of all the zone's `(polygon (pts …))` outlines
    (fill polygons excluded), computed by the field map's centroid rule, in
    the frame the file stores them: the board frame, except for a footprint
    zone in a board of format 20260616 or later, whose outline is
    footprint-local (fork: `src/rs/kicad-monkey-core/src/pcb/footprints.rs:36-37`).
    Absent when the outline has no point.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub at: ::std::option::Option<PointNm>,
    ///The zone's `(layer …)`; a footprint zone without one takes the first entry of its `(layers …)`. As written, wildcard sets included. Absent when there is none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub layer: ::std::option::Option<BoardObjectsLayerSpec>,
    ///The zone's net: its `(net_name …)` when non-empty, else the name of its `(net …)`. Absent when the zone has no net.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub net: ::std::option::Option<NetName>,
    ///The zone's `(name …)` as written. Absent when the form has none.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub name: ::std::option::Option<::std::string::String>,
    ///Review fields, serialized with keys in code point order; keys are review labels (`Zone name`, `Zone layers`, `Priority`, `Hatch`, `Pad connection`, `Minimum thickness`, `Keepout`, `Fill rules`).
    #[serde(rename = "reviewFields")]
    pub review_fields: RecordBoardObjectsReviewValue,
}
/**Angle in degrees. In new documents it is as written in the KiCad file:
not normalized, not rounded. A parity document may round it as today's
output does, and its field says so. A positive angle is a counter-clockwise rotation as KiCad shows
it on the front side. Each field states the frame its angle is in.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Angle in degrees. In new documents it is as written in the KiCad file:\nnot normalized, not rounded. A parity document may round it as today's\noutput does, and its field says so. A positive angle is a counter-clockwise rotation as KiCad shows\nit on the front side. Each field states the frame its angle is in.",
///  "type": "number"
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct Degrees(pub f64);
impl ::std::ops::Deref for Degrees {
    type Target = f64;
    fn deref(&self) -> &f64 {
        &self.0
    }
}
impl ::std::convert::From<Degrees> for f64 {
    fn from(value: Degrees) -> Self {
        value.0
    }
}
impl ::std::convert::From<f64> for Degrees {
    fn from(value: f64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for Degrees {
    type Err = <f64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for Degrees {
    type Error = <f64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for Degrees {
    type Error = <f64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for Degrees {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
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
/**KiCad canonical layer name as the board file's `(layers …)` table spells
it, for example `F.Cu`, `In1.Cu`, `B.Mask`, `Edge.Cuts` or `User.1`. Never
the user-assigned layer name, which a contract carries in a separate
optional field. Never a wildcard set such as `*.Cu` or `F&B.Cu`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad canonical layer name as the board file's `(layers …)` table spells\nit, for example `F.Cu`, `In1.Cu`, `B.Mask`, `Edge.Cuts` or `User.1`. Never\nthe user-assigned layer name, which a contract carries in a separate\noptional field. Never a wildcard set such as `*.Cu` or `F&B.Cu`.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct LayerName(::std::string::String);
impl ::std::ops::Deref for LayerName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<LayerName> for ::std::string::String {
    fn from(value: LayerName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for LayerName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for LayerName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for LayerName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for LayerName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for LayerName {
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
/**Length or coordinate in integer nanometres, KiCad's internal board unit.
Converted from the file's decimal millimetres as KiCad's own parser does:
the double product value_mm * 1e6, rounded half away from zero. A single
coordinate or dimension fits KiCad's 32-bit range; sums (for example a
net's total track length) may not, hence a safe integer (|n| < 2^53).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Length or coordinate in integer nanometres, KiCad's internal board unit.\nConverted from the file's decimal millimetres as KiCad's own parser does:\nthe double product value_mm * 1e6, rounded half away from zero. A single\ncoordinate or dimension fits KiCad's 32-bit range; sums (for example a\nnet's total track length) may not, hence a safe integer (|n| < 2^53).",
///  "type": "integer"
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct Nanometres(pub i64);
impl ::std::ops::Deref for Nanometres {
    type Target = i64;
    fn deref(&self) -> &i64 {
        &self.0
    }
}
impl ::std::convert::From<Nanometres> for i64 {
    fn from(value: Nanometres) -> Self {
        value.0
    }
}
impl ::std::convert::From<i64> for Nanometres {
    fn from(value: i64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for Nanometres {
    type Err = <i64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for Nanometres {
    type Error = <i64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for Nanometres {
    type Error = <i64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for Nanometres {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**KiCad full net name as KiCad resolves it, including the sheet path prefix
of a local net (`/Power/VBUS`), a global name (`GND`) or a generated name
(`Net-(R1-Pad2)`, `unconnected-(U1-PA0-Pad3)`). "No net" is expressed by
omitting the field, never by an empty name.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "KiCad full net name as KiCad resolves it, including the sheet path prefix\nof a local net (`/Power/VBUS`), a global name (`GND`) or a generated name\n(`Net-(R1-Pad2)`, `unconnected-(U1-PA0-Pad3)`). \"No net\" is expressed by\nomitting the field, never by an empty name.",
///  "type": "string",
///  "minLength": 1
///}
/// ```
/// </details>
#[derive(::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
#[serde(transparent)]
pub struct NetName(::std::string::String);
impl ::std::ops::Deref for NetName {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<NetName> for ::std::string::String {
    fn from(value: NetName) -> Self {
        value.0
    }
}
impl ::std::str::FromStr for NetName {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        if value.chars().count() < 1usize {
            return Err("shorter than 1 characters".into());
        }
        Ok(Self(value.to_string()))
    }
}
impl ::std::convert::TryFrom<&str> for NetName {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for NetName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for NetName {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl<'de> ::serde::Deserialize<'de> for NetName {
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
///A Nanometres value that is never negative: a thickness, width, diameter or length.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A Nanometres value that is never negative: a thickness, width, diameter or length.",
///  "type": "integer",
///  "minimum": 0.0
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct NonNegativeNanometres(pub u64);
impl ::std::ops::Deref for NonNegativeNanometres {
    type Target = u64;
    fn deref(&self) -> &u64 {
        &self.0
    }
}
impl ::std::convert::From<NonNegativeNanometres> for u64 {
    fn from(value: NonNegativeNanometres) -> Self {
        value.0
    }
}
impl ::std::convert::From<u64> for NonNegativeNanometres {
    fn from(value: u64) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for NonNegativeNanometres {
    type Err = <u64 as ::std::str::FromStr>::Err;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.parse()?))
    }
}
impl ::std::convert::TryFrom<&str> for NonNegativeNanometres {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: &str) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<String> for NonNegativeNanometres {
    type Error = <u64 as ::std::str::FromStr>::Err;
    fn try_from(value: String) -> ::std::result::Result<Self, Self::Error> {
        value.parse()
    }
}
impl ::std::fmt::Display for NonNegativeNanometres {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**Pad or pin number as written in the file, always a string (`1`, `A1`,
`EP`). Empty for a pad KiCad leaves unnumbered, such as a mechanical
non-plated hole.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Pad or pin number as written in the file, always a string (`1`, `A1`,\n`EP`). Empty for a pad KiCad leaves unnumbered, such as a mechanical\nnon-plated hole.",
///  "type": "string"
///}
/// ```
/// </details>
#[derive(
    ::serde::Deserialize, ::serde::Serialize, Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd,
)]
#[serde(transparent)]
pub struct PadNumber(pub ::std::string::String);
impl ::std::ops::Deref for PadNumber {
    type Target = ::std::string::String;
    fn deref(&self) -> &::std::string::String {
        &self.0
    }
}
impl ::std::convert::From<PadNumber> for ::std::string::String {
    fn from(value: PadNumber) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::string::String> for PadNumber {
    fn from(value: ::std::string::String) -> Self {
        Self(value)
    }
}
impl ::std::str::FromStr for PadNumber {
    type Err = ::std::convert::Infallible;
    fn from_str(value: &str) -> ::std::result::Result<Self, Self::Err> {
        Ok(Self(value.to_string()))
    }
}
impl ::std::fmt::Display for PadNumber {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        self.0.fmt(f)
    }
}
/**A point in nanometres in KiCad's board frame: +x to the right, +y down, as
in the file and never flipped. The field holding the point states whether
it is board-absolute or footprint-local. For camelCase (projection)
documents only.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A point in nanometres in KiCad's board frame: +x to the right, +y down, as\nin the file and never flipped. The field holding the point states whether\nit is board-absolute or footprint-local. For camelCase (projection)\ndocuments only.",
///  "type": "object",
///  "required": [
///    "xNm",
///    "yNm"
///  ],
///  "properties": {
///    "xNm": {
///      "description": "X coordinate in nanometres, +x to the right.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "Y coordinate in nanometres, +y down.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct PointNm {
    ///X coordinate in nanometres, +x to the right.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y coordinate in nanometres, +y down.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
}
///`RecordBoardObjectsReviewValue`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/BoardObjectsReviewValue"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordBoardObjectsReviewValue(
    pub ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue>,
);
impl ::std::ops::Deref for RecordBoardObjectsReviewValue {
    type Target = ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue> {
        &self.0
    }
}
impl ::std::convert::From<RecordBoardObjectsReviewValue>
    for ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue>
{
    fn from(value: RecordBoardObjectsReviewValue) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue>,
    > for RecordBoardObjectsReviewValue
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, BoardObjectsReviewValue>,
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
impl<'de> ::serde::Deserialize<'de> for BoardObjectsObject {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("symbol") {
            return ::serde_json::from_value::<BoardObjectsSymbol>(value)
                .map(Self::Symbol)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("pin") {
            return ::serde_json::from_value::<BoardObjectsPin>(value)
                .map(Self::Pin)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("sheet") {
            return ::serde_json::from_value::<BoardObjectsSheet>(value)
                .map(Self::Sheet)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("sheet-pin") {
            return ::serde_json::from_value::<BoardObjectsSheetPin>(value)
                .map(Self::SheetPin)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("wire") {
            return ::serde_json::from_value::<BoardObjectsWire>(value)
                .map(Self::Wire)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("bus") {
            return ::serde_json::from_value::<BoardObjectsBus>(value)
                .map(Self::Bus)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("junction") {
            return ::serde_json::from_value::<BoardObjectsJunction>(value)
                .map(Self::Junction)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("no_connect") {
            return ::serde_json::from_value::<BoardObjectsNoConnect>(value)
                .map(Self::NoConnect)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("bus_entry") {
            return ::serde_json::from_value::<BoardObjectsBusEntry>(value)
                .map(Self::BusEntry)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("label") {
            return ::serde_json::from_value::<BoardObjectsLabel>(value)
                .map(Self::Label)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("graphic") {
            return ::serde_json::from_value::<BoardObjectsGraphic>(value)
                .map(Self::Graphic)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("image") {
            return ::serde_json::from_value::<BoardObjectsImage>(value)
                .map(Self::Image)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("table") {
            return ::serde_json::from_value::<BoardObjectsTable>(value)
                .map(Self::Table)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("footprint") {
            return ::serde_json::from_value::<BoardObjectsFootprint>(value)
                .map(Self::Footprint)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("pad") {
            return ::serde_json::from_value::<BoardObjectsPad>(value)
                .map(Self::Pad)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("zone") {
            return ::serde_json::from_value::<BoardObjectsZone>(value)
                .map(Self::Zone)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("footprint-graphic") {
            return ::serde_json::from_value::<BoardObjectsFootprintGraphic>(value)
                .map(Self::FootprintGraphic)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("footprint-text") {
            return ::serde_json::from_value::<BoardObjectsFootprintText>(value)
                .map(Self::FootprintText)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("track") {
            return ::serde_json::from_value::<BoardObjectsTrack>(value)
                .map(Self::Track)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("arc") {
            return ::serde_json::from_value::<BoardObjectsArc>(value)
                .map(Self::Arc)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("via") {
            return ::serde_json::from_value::<BoardObjectsVia>(value)
                .map(Self::Via)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        if value.get("kind").and_then(::serde_json::Value::as_str) == Some("group") {
            return ::serde_json::from_value::<BoardObjectsGroup>(value)
                .map(Self::Group)
                .map_err(<D::Error as ::serde::de::Error>::custom);
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum BoardObjectsObject",
        ))
    }
}
impl<'de> ::serde::Deserialize<'de> for BoardObjectsReviewScalar {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if let Ok(inner) = ::serde_json::from_value::<::std::string::String>(value.clone()) {
            return Ok(Self::String(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<f64>(value.clone()) {
            return Ok(Self::Number(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<bool>(value.clone()) {
            return Ok(Self::Boolean(inner));
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum BoardObjectsReviewScalar",
        ))
    }
}
impl<'de> ::serde::Deserialize<'de> for BoardObjectsReviewValue {
    #[allow(
        clippy::too_many_lines,
        reason = "generated: one dispatch arm per union variant"
    )]
    fn deserialize<D: ::serde::Deserializer<'de>>(
        deserializer: D,
    ) -> ::std::result::Result<Self, D::Error> {
        let value = <::serde_json::Value as ::serde::Deserialize>::deserialize(deserializer)?;
        if let Ok(inner) = ::serde_json::from_value::<::std::string::String>(value.clone()) {
            return Ok(Self::Variant0(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<f64>(value.clone()) {
            return Ok(Self::Variant1(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<bool>(value.clone()) {
            return Ok(Self::Variant2(inner));
        }
        if let Ok(inner) =
            ::serde_json::from_value::<::std::vec::Vec<::std::string::String>>(value.clone())
        {
            return Ok(Self::Variant3(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<::std::vec::Vec<f64>>(value.clone()) {
            return Ok(Self::Variant4(inner));
        }
        if let Ok(inner) = ::serde_json::from_value::<BoardObjectsReviewTable>(value.clone()) {
            return Ok(Self::Variant5(inner));
        }
        if let Ok(inner) =
            ::serde_json::from_value::<::std::vec::Vec<BoardObjectsReviewTable>>(value.clone())
        {
            return Ok(Self::Variant6(inner));
        }
        Err(<D::Error as ::serde::de::Error>::custom(
            "data did not match any variant of untagged enum BoardObjectsReviewValue",
        ))
    }
}
