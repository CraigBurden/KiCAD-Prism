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
/**The HLR projection of every footprint that names a 3D model, the bundle
member `models/assembly-hlr.json` (stage `models`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.assembly_hlr:a0",
///  "title": "AssemblyHlrA0",
///  "description": "The HLR projection of every footprint that names a 3D model, the bundle\nmember `models/assembly-hlr.json` (stage `models`).",
///  "type": "object",
///  "required": [
///    "footprints",
///    "options",
///    "runtime",
///    "schema"
///  ],
///  "properties": {
///    "footprints": {
///      "description": "Every footprint that names a 3D model, sorted by `documentPath`, then\n`uuid`, each in code point order; a footprint with no model at all is not\nlisted. Footprints with a resolvable STEP model carry `pose`, `outline` and\n`detail`; the others carry a `status`.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/AssemblyHlrFootprint"
///      }
///    },
///    "options": {
///      "description": "The HLR options every footprint's projection used.",
///      "$ref": "#/$defs/AssemblyHlrOptions"
///    },
///    "runtime": {
///      "description": "The Geometer runtime the projection used.",
///      "$ref": "#/$defs/AssemblyHlrRuntime"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.assembly_hlr.a0"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///The HLR options every footprint's projection used.
    pub options: AssemblyHlrOptions,
    ///The Geometer runtime the projection used.
    pub runtime: AssemblyHlrRuntime,
    /**Every footprint that names a 3D model, sorted by `documentPath`, then
    `uuid`, each in code point order; a footprint with no model at all is not
    listed. Footprints with a resolvable STEP model carry `pose`, `outline` and
    `detail`; the others carry a `status`.*/
    pub footprints: ::std::vec::Vec<AssemblyHlrFootprint>,
}
///One circular edge of a projected edge set, the fields Geometer returns.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One circular edge of a projected edge set, the fields Geometer returns.",
///  "type": "object",
///  "required": [
///    "ccw",
///    "centerNm",
///    "endNm",
///    "extentDeg",
///    "fullCircle",
///    "radiusNm",
///    "startNm"
///  ],
///  "properties": {
///    "ccw": {
///      "description": "True when the arc runs counter-clockwise from `startNm` to `endNm`.",
///      "type": "boolean"
///    },
///    "centerNm": {
///      "description": "The arc's center point, board frame.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "endNm": {
///      "description": "The arc's end point, board frame.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "extentDeg": {
///      "description": "The arc's angular extent in degrees, from Geometer's `extent_rad`.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "fullCircle": {
///      "description": "True when the arc is a full circle, in which case `startNm` and `endNm` coincide.",
///      "type": "boolean"
///    },
///    "radiusNm": {
///      "description": "The arc's radius in nanometres.",
///      "$ref": "#/$defs/NonNegativeNanometres"
///    },
///    "startNm": {
///      "description": "The arc's start point, board frame.",
///      "$ref": "#/$defs/PointNm"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrArc {
    ///The arc's start point, board frame.
    #[serde(rename = "startNm")]
    pub start_nm: PointNm,
    ///The arc's end point, board frame.
    #[serde(rename = "endNm")]
    pub end_nm: PointNm,
    ///The arc's center point, board frame.
    #[serde(rename = "centerNm")]
    pub center_nm: PointNm,
    ///The arc's radius in nanometres.
    #[serde(rename = "radiusNm")]
    pub radius_nm: NonNegativeNanometres,
    ///The arc's angular extent in degrees, from Geometer's `extent_rad`.
    #[serde(rename = "extentDeg")]
    pub extent_deg: Degrees,
    ///True when the arc runs counter-clockwise from `startNm` to `endNm`.
    pub ccw: bool,
    ///True when the arc is a full circle, in which case `startNm` and `endNm` coincide.
    #[serde(rename = "fullCircle")]
    pub full_circle: bool,
}
///A footprint's projection curve output mode: Geometer's `curve_mode` token, kept verbatim.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A footprint's projection curve output mode: Geometer's `curve_mode` token, kept verbatim.",
///  "type": "string",
///  "enum": [
///    "native_arcs",
///    "polyline"
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
pub enum AssemblyHlrCurveMode {
    #[serde(rename = "native_arcs")]
    NativeArcs,
    #[serde(rename = "polyline")]
    Polyline,
}
impl ::std::fmt::Display for AssemblyHlrCurveMode {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::NativeArcs => f.write_str("native_arcs"),
            Self::Polyline => f.write_str("polyline"),
        }
    }
}
impl ::std::str::FromStr for AssemblyHlrCurveMode {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "native_arcs" => Ok(Self::NativeArcs),
            "polyline" => Ok(Self::Polyline),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for AssemblyHlrCurveMode {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for AssemblyHlrCurveMode {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for AssemblyHlrCurveMode {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A projected edge set: its segments and arcs.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A projected edge set: its segments and arcs.",
///  "type": "object",
///  "required": [
///    "arcs",
///    "segments"
///  ],
///  "properties": {
///    "arcs": {
///      "description": "The circular edges, in the order Geometer returned them after Cruncher's deduplication.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/AssemblyHlrArc"
///      }
///    },
///    "segments": {
///      "description": "The straight edges, in the order Geometer returned them after Cruncher's\ndeduplication (endpoints ordered and duplicates removed).",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/AssemblyHlrSegment"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrEdges {
    /**The straight edges, in the order Geometer returned them after Cruncher's
    deduplication (endpoints ordered and duplicates removed).*/
    pub segments: ::std::vec::Vec<AssemblyHlrSegment>,
    ///The circular edges, in the order Geometer returned them after Cruncher's deduplication.
    pub arcs: ::std::vec::Vec<AssemblyHlrArc>,
}
///One footprint's model, pose and projected geometry, or the reason it has none.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One footprint's model, pose and projected geometry, or the reason it has none.",
///  "type": "object",
///  "required": [
///    "documentPath",
///    "side",
///    "uuid"
///  ],
///  "properties": {
///    "detail": {
///      "description": "The visible-internal edges, board frame. Present exactly when the projection succeeded.",
///      "$ref": "#/$defs/AssemblyHlrEdges"
///    },
///    "documentPath": {
///      "description": "The board file's repository-relative path.",
///      "$ref": "#/$defs/RepoPath"
///    },
///    "outline": {
///      "description": "The silhouette edges, board frame. Present exactly when the projection succeeded.",
///      "$ref": "#/$defs/AssemblyHlrEdges"
///    },
///    "pose": {
///      "description": "The model's pose. Present exactly when the model was projected (`outline` and `detail` are present).",
///      "$ref": "#/$defs/AssemblyHlrPose"
///    },
///    "reference": {
///      "description": "The footprint's reference designator, as written. Absent when it has none or it is empty.",
///      "$ref": "#/$defs/Refdes"
///    },
///    "side": {
///      "description": "The footprint's side: `back` when its `(layer …)` starts with `B.`.",
///      "$ref": "#/$defs/Side"
///    },
///    "status": {
///      "description": "Why the footprint has no geometry. Present exactly when `outline` and\n`detail` are absent; absent when the projection succeeded.",
///      "$ref": "#/$defs/AssemblyHlrStatus"
///    },
///    "stepModel": {
///      "description": "The footprint's first STEP model. Absent when it names no `.step`/`.stp` model (`model-not-step`).",
///      "$ref": "#/$defs/AssemblyHlrModel"
///    },
///    "uuid": {
///      "description": "The footprint's `(uuid …)`, as written.",
///      "$ref": "#/$defs/KiCadUuid"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrFootprint {
    ///The board file's repository-relative path.
    #[serde(rename = "documentPath")]
    pub document_path: RepoPath,
    ///The footprint's `(uuid …)`, as written.
    pub uuid: KiCadUuid,
    ///The footprint's reference designator, as written. Absent when it has none or it is empty.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub reference: ::std::option::Option<Refdes>,
    ///The footprint's side: `back` when its `(layer …)` starts with `B.`.
    pub side: Side,
    ///The footprint's first STEP model. Absent when it names no `.step`/`.stp` model (`model-not-step`).
    #[serde(
        rename = "stepModel",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub step_model: ::std::option::Option<AssemblyHlrModel>,
    ///The model's pose. Present exactly when the model was projected (`outline` and `detail` are present).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub pose: ::std::option::Option<AssemblyHlrPose>,
    ///The silhouette edges, board frame. Present exactly when the projection succeeded.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub outline: ::std::option::Option<AssemblyHlrEdges>,
    ///The visible-internal edges, board frame. Present exactly when the projection succeeded.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub detail: ::std::option::Option<AssemblyHlrEdges>,
    /**Why the footprint has no geometry. Present exactly when `outline` and
    `detail` are absent; absent when the projection succeeded.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub status: ::std::option::Option<AssemblyHlrStatus>,
}
///The footprint's first STEP model and the digest of its bytes.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The footprint's first STEP model and the digest of its bytes.",
///  "type": "object",
///  "required": [
///    "reference"
///  ],
///  "properties": {
///    "reference": {
///      "description": "The model reference as written in the footprint's `(model …)`: a\n`${VAR}`-relative path, a repository-relative path, or a `kicad-embed://`\nreference.",
///      "type": "string"
///    },
///    "sha256": {
///      "description": "SHA-256 of the STEP file's bytes. Absent when the bytes could not be resolved (`model-unavailable`).",
///      "$ref": "#/$defs/Sha256Hex"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrModel {
    /**The model reference as written in the footprint's `(model …)`: a
    `${VAR}`-relative path, a repository-relative path, or a `kicad-embed://`
    reference.*/
    pub reference: ::std::string::String,
    ///SHA-256 of the STEP file's bytes. Absent when the bytes could not be resolved (`model-unavailable`).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub sha256: ::std::option::Option<Sha256Hex>,
}
/**The HLR options every footprint's projection used. The values are the
options passed to Geometer, so a consumer can reproduce the projection from
the model bytes. The projection's side is not here: it is each footprint's
own `side`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The HLR options every footprint's projection used. The values are the\noptions passed to Geometer, so a consumer can reproduce the projection from\nthe model bytes. The projection's side is not here: it is each footprint's\nown `side`.",
///  "type": "object",
///  "required": [
///    "curveMode",
///    "includeOutline",
///    "includeVisible",
///    "outlineAlgorithm",
///    "roundDigits",
///    "samplesPerCurve",
///    "unionPolygons"
///  ],
///  "properties": {
///    "curveMode": {
///      "description": "The curve output mode.",
///      "$ref": "#/$defs/AssemblyHlrCurveMode"
///    },
///    "edgeFlags": {
///      "description": "The per-edge-family visibility flags passed to Geometer. The keys are\nGeometer's flag names (for example `edge_v_outline`), serialized in code\npoint order. Absent when no flags were set.",
///      "$ref": "#/$defs/RecordBoolean"
///    },
///    "hlrAngleTolerance": {
///      "description": "The hidden-line-removal angle tolerance in degrees, when set. Absent when Geometer's default applies.",
///      "type": "number"
///    },
///    "includeOutline": {
///      "description": "Include the silhouette (`outline`).",
///      "type": "boolean"
///    },
///    "includeVisible": {
///      "description": "Include the visible internal edges (`detail`).",
///      "type": "boolean"
///    },
///    "meshAngularDeflection": {
///      "description": "Mesh angular deflection in radians, when set. Absent when Geometer's default applies.",
///      "type": "number"
///    },
///    "meshLinearDeflection": {
///      "description": "Mesh linear deflection in millimetres, when set. Absent when Geometer's default applies.",
///      "type": "number"
///    },
///    "meshRelative": {
///      "description": "Whether the mesh deflections are relative to the model size, when set. Absent when Geometer's default applies.",
///      "type": "boolean"
///    },
///    "outlineAlgorithm": {
///      "description": "The outline (silhouette) algorithm.",
///      "$ref": "#/$defs/AssemblyHlrOutlineAlgorithm"
///    },
///    "projectionAlgorithm": {
///      "description": "The projection algorithm, when the config set one. Absent when Geometer's default applies.",
///      "$ref": "#/$defs/AssemblyHlrProjectionAlgorithm"
///    },
///    "roundDigits": {
///      "description": "Decimal digits retained in the projected geometry.",
///      "$ref": "#/$defs/Count"
///    },
///    "samplesPerCurve": {
///      "description": "How many segments one curve samples into when `curveMode` is `polyline`.",
///      "$ref": "#/$defs/Count"
///    },
///    "unionPolygons": {
///      "description": "Union outline polygons before rendering.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrOptions {
    ///The projection algorithm, when the config set one. Absent when Geometer's default applies.
    #[serde(
        rename = "projectionAlgorithm",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub projection_algorithm: ::std::option::Option<AssemblyHlrProjectionAlgorithm>,
    ///The outline (silhouette) algorithm.
    #[serde(rename = "outlineAlgorithm")]
    pub outline_algorithm: AssemblyHlrOutlineAlgorithm,
    ///The curve output mode.
    #[serde(rename = "curveMode")]
    pub curve_mode: AssemblyHlrCurveMode,
    ///How many segments one curve samples into when `curveMode` is `polyline`.
    #[serde(rename = "samplesPerCurve")]
    pub samples_per_curve: Count,
    ///Decimal digits retained in the projected geometry.
    #[serde(rename = "roundDigits")]
    pub round_digits: Count,
    ///Include the visible internal edges (`detail`).
    #[serde(rename = "includeVisible")]
    pub include_visible: bool,
    ///Include the silhouette (`outline`).
    #[serde(rename = "includeOutline")]
    pub include_outline: bool,
    ///Union outline polygons before rendering.
    #[serde(rename = "unionPolygons")]
    pub union_polygons: bool,
    ///Mesh linear deflection in millimetres, when set. Absent when Geometer's default applies.
    #[serde(
        rename = "meshLinearDeflection",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub mesh_linear_deflection: ::std::option::Option<f64>,
    ///Mesh angular deflection in radians, when set. Absent when Geometer's default applies.
    #[serde(
        rename = "meshAngularDeflection",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub mesh_angular_deflection: ::std::option::Option<f64>,
    ///Whether the mesh deflections are relative to the model size, when set. Absent when Geometer's default applies.
    #[serde(
        rename = "meshRelative",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub mesh_relative: ::std::option::Option<bool>,
    ///The hidden-line-removal angle tolerance in degrees, when set. Absent when Geometer's default applies.
    #[serde(
        rename = "hlrAngleTolerance",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub hlr_angle_tolerance: ::std::option::Option<f64>,
    /**The per-edge-family visibility flags passed to Geometer. The keys are
    Geometer's flag names (for example `edge_v_outline`), serialized in code
    point order. Absent when no flags were set.*/
    #[serde(
        rename = "edgeFlags",
        default,
        skip_serializing_if = "::std::option::Option::is_none"
    )]
    pub edge_flags: ::std::option::Option<RecordBoolean>,
}
///The outline (silhouette) algorithm: Geometer's `outline_algorithm` token, kept verbatim.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The outline (silhouette) algorithm: Geometer's `outline_algorithm` token, kept verbatim.",
///  "type": "string",
///  "enum": [
///    "hlr-close",
///    "mesh-shadow",
///    "fast-mesh-shadow"
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
pub enum AssemblyHlrOutlineAlgorithm {
    #[serde(rename = "hlr-close")]
    HlrClose,
    #[serde(rename = "mesh-shadow")]
    MeshShadow,
    #[serde(rename = "fast-mesh-shadow")]
    FastMeshShadow,
}
impl ::std::fmt::Display for AssemblyHlrOutlineAlgorithm {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::HlrClose => f.write_str("hlr-close"),
            Self::MeshShadow => f.write_str("mesh-shadow"),
            Self::FastMeshShadow => f.write_str("fast-mesh-shadow"),
        }
    }
}
impl ::std::str::FromStr for AssemblyHlrOutlineAlgorithm {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "hlr-close" => Ok(Self::HlrClose),
            "mesh-shadow" => Ok(Self::MeshShadow),
            "fast-mesh-shadow" => Ok(Self::FastMeshShadow),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for AssemblyHlrOutlineAlgorithm {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for AssemblyHlrOutlineAlgorithm {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for AssemblyHlrOutlineAlgorithm {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**The pose of the footprint's model: the footprint's placement on the board,
plus the model's own offset, rotation and scale, exactly the inputs of
Cruncher's `kicad_model_local_pose`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The pose of the footprint's model: the footprint's placement on the board,\nplus the model's own offset, rotation and scale, exactly the inputs of\nCruncher's `kicad_model_local_pose`.",
///  "type": "object",
///  "required": [
///    "modelOffset",
///    "modelRotation",
///    "modelScale",
///    "positionNm",
///    "rotationDeg"
///  ],
///  "properties": {
///    "modelOffset": {
///      "description": "The model's `(offset x y z)` as written, in nanometres.",
///      "$ref": "#/$defs/AssemblyHlrVector3Nm"
///    },
///    "modelRotation": {
///      "description": "The model's `(rotate x y z)` as written, in degrees.",
///      "$ref": "#/$defs/AssemblyHlrRotation3Deg"
///    },
///    "modelScale": {
///      "description": "The model's `(scale x y z)` as written.",
///      "$ref": "#/$defs/AssemblyHlrScale3"
///    },
///    "positionNm": {
///      "description": "Board-absolute anchor of the footprint: its `(at x y)` in KiCad's board frame.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "rotationDeg": {
///      "description": "The footprint's orientation in degrees, as written, not normalized.",
///      "$ref": "#/$defs/Degrees"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrPose {
    ///Board-absolute anchor of the footprint: its `(at x y)` in KiCad's board frame.
    #[serde(rename = "positionNm")]
    pub position_nm: PointNm,
    ///The footprint's orientation in degrees, as written, not normalized.
    #[serde(rename = "rotationDeg")]
    pub rotation_deg: Degrees,
    ///The model's `(offset x y z)` as written, in nanometres.
    #[serde(rename = "modelOffset")]
    pub model_offset: AssemblyHlrVector3Nm,
    ///The model's `(rotate x y z)` as written, in degrees.
    #[serde(rename = "modelRotation")]
    pub model_rotation: AssemblyHlrRotation3Deg,
    ///The model's `(scale x y z)` as written.
    #[serde(rename = "modelScale")]
    pub model_scale: AssemblyHlrScale3,
}
///The projection algorithm: Geometer's `projection_algorithm` token, kept verbatim.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The projection algorithm: Geometer's `projection_algorithm` token, kept verbatim.",
///  "type": "string",
///  "enum": [
///    "poly",
///    "exact",
///    "fast"
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
pub enum AssemblyHlrProjectionAlgorithm {
    #[serde(rename = "poly")]
    Poly,
    #[serde(rename = "exact")]
    Exact,
    #[serde(rename = "fast")]
    Fast,
}
impl ::std::fmt::Display for AssemblyHlrProjectionAlgorithm {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Poly => f.write_str("poly"),
            Self::Exact => f.write_str("exact"),
            Self::Fast => f.write_str("fast"),
        }
    }
}
impl ::std::str::FromStr for AssemblyHlrProjectionAlgorithm {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "poly" => Ok(Self::Poly),
            "exact" => Ok(Self::Exact),
            "fast" => Ok(Self::Fast),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for AssemblyHlrProjectionAlgorithm {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for AssemblyHlrProjectionAlgorithm {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for AssemblyHlrProjectionAlgorithm {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A three-dimensional rotation in degrees.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A three-dimensional rotation in degrees.",
///  "type": "object",
///  "required": [
///    "xDeg",
///    "yDeg",
///    "zDeg"
///  ],
///  "properties": {
///    "xDeg": {
///      "description": "Rotation about x, in degrees as written.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "yDeg": {
///      "description": "Rotation about y, in degrees as written.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "zDeg": {
///      "description": "Rotation about z, in degrees as written.",
///      "$ref": "#/$defs/Degrees"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrRotation3Deg {
    ///Rotation about x, in degrees as written.
    #[serde(rename = "xDeg")]
    pub x_deg: Degrees,
    ///Rotation about y, in degrees as written.
    #[serde(rename = "yDeg")]
    pub y_deg: Degrees,
    ///Rotation about z, in degrees as written.
    #[serde(rename = "zDeg")]
    pub z_deg: Degrees,
}
///The Geometer runtime the projection used.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The Geometer runtime the projection used.",
///  "type": "object",
///  "required": [
///    "geometerVersion"
///  ],
///  "properties": {
///    "geometerVersion": {
///      "description": "The Geometer runtime's version string, exactly as `geometer.version()`\nreports it, for example `2026.9.7`. It is part of the generator id's\n`hlr_procedure`.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrRuntime {
    /**The Geometer runtime's version string, exactly as `geometer.version()`
    reports it, for example `2026.9.7`. It is part of the generator id's
    `hlr_procedure`.*/
    #[serde(rename = "geometerVersion")]
    pub geometer_version: ::std::string::String,
}
///A three-dimensional scale factor.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A three-dimensional scale factor.",
///  "type": "object",
///  "required": [
///    "x",
///    "y",
///    "z"
///  ],
///  "properties": {
///    "x": {
///      "description": "X scale factor.",
///      "type": "number"
///    },
///    "y": {
///      "description": "Y scale factor.",
///      "type": "number"
///    },
///    "z": {
///      "description": "Z scale factor.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrScale3 {
    ///X scale factor.
    pub x: f64,
    ///Y scale factor.
    pub y: f64,
    ///Z scale factor.
    pub z: f64,
}
///One straight edge of a projected edge set.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One straight edge of a projected edge set.",
///  "type": "object",
///  "required": [
///    "endNm",
///    "startNm"
///  ],
///  "properties": {
///    "endNm": {
///      "description": "The edge's end point, board frame.",
///      "$ref": "#/$defs/PointNm"
///    },
///    "startNm": {
///      "description": "The edge's start point, board frame.",
///      "$ref": "#/$defs/PointNm"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrSegment {
    ///The edge's start point, board frame.
    #[serde(rename = "startNm")]
    pub start_nm: PointNm,
    ///The edge's end point, board frame.
    #[serde(rename = "endNm")]
    pub end_nm: PointNm,
}
///Why a footprint's body was not projected.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Why a footprint's body was not projected.",
///  "type": "string",
///  "enum": [
///    "model-unavailable",
///    "model-not-step",
///    "projection-failed"
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
pub enum AssemblyHlrStatus {
    #[serde(rename = "model-unavailable")]
    ModelUnavailable,
    #[serde(rename = "model-not-step")]
    ModelNotStep,
    #[serde(rename = "projection-failed")]
    ProjectionFailed,
}
impl ::std::fmt::Display for AssemblyHlrStatus {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::ModelUnavailable => f.write_str("model-unavailable"),
            Self::ModelNotStep => f.write_str("model-not-step"),
            Self::ProjectionFailed => f.write_str("projection-failed"),
        }
    }
}
impl ::std::str::FromStr for AssemblyHlrStatus {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "model-unavailable" => Ok(Self::ModelUnavailable),
            "model-not-step" => Ok(Self::ModelNotStep),
            "projection-failed" => Ok(Self::ProjectionFailed),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for AssemblyHlrStatus {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for AssemblyHlrStatus {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for AssemblyHlrStatus {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///A three-dimensional vector in nanometres.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A three-dimensional vector in nanometres.",
///  "type": "object",
///  "required": [
///    "xNm",
///    "yNm",
///    "zNm"
///  ],
///  "properties": {
///    "xNm": {
///      "description": "X component in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "yNm": {
///      "description": "Y component in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    },
///    "zNm": {
///      "description": "Z component in nanometres.",
///      "$ref": "#/$defs/Nanometres"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct AssemblyHlrVector3Nm {
    ///X component in nanometres.
    #[serde(rename = "xNm")]
    pub x_nm: Nanometres,
    ///Y component in nanometres.
    #[serde(rename = "yNm")]
    pub y_nm: Nanometres,
    ///Z component in nanometres.
    #[serde(rename = "zNm")]
    pub z_nm: Nanometres,
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
///`RecordBoolean`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "type": "boolean"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordBoolean(pub ::std::collections::BTreeMap<::std::string::String, bool>);
impl ::std::ops::Deref for RecordBoolean {
    type Target = ::std::collections::BTreeMap<::std::string::String, bool>;
    fn deref(&self) -> &::std::collections::BTreeMap<::std::string::String, bool> {
        &self.0
    }
}
impl ::std::convert::From<RecordBoolean>
    for ::std::collections::BTreeMap<::std::string::String, bool>
{
    fn from(value: RecordBoolean) -> Self {
        value.0
    }
}
impl ::std::convert::From<::std::collections::BTreeMap<::std::string::String, bool>>
    for RecordBoolean
{
    fn from(value: ::std::collections::BTreeMap<::std::string::String, bool>) -> Self {
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
///Board side of a footprint, pad or graphic.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Board side of a footprint, pad or graphic.",
///  "type": "string",
///  "enum": [
///    "front",
///    "back"
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
pub enum Side {
    #[serde(rename = "front")]
    Front,
    #[serde(rename = "back")]
    Back,
}
impl ::std::fmt::Display for Side {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Front => f.write_str("front"),
            Self::Back => f.write_str("back"),
        }
    }
}
impl ::std::str::FromStr for Side {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "front" => Ok(Self::Front),
            "back" => Ok(Self::Back),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for Side {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for Side {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for Side {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
