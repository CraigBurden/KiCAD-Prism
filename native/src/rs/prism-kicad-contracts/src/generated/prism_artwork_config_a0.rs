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
///Default projection and designator colour policy (`assembly`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Default projection and designator colour policy (`assembly`).",
///  "type": "object",
///  "required": [
///    "default_projection",
///    "designator_color",
///    "dnp_designator_color",
///    "dnp_projection"
///  ],
///  "properties": {
///    "default_projection": {
///      "description": "The projection mode used for a fitted part.",
///      "$ref": "#/$defs/ArtworkProjectionMode"
///    },
///    "designator_color": {
///      "description": "Fallback colour for fitted assembly designators.",
///      "type": "string"
///    },
///    "dnp_designator_color": {
///      "description": "Fallback colour for do-not-populate assembly designators.",
///      "type": "string"
///    },
///    "dnp_projection": {
///      "description": "The projection mode used for a do-not-populate part.",
///      "$ref": "#/$defs/ArtworkProjectionMode"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkAssembly {
    ///The projection mode used for a fitted part.
    pub default_projection: ArtworkProjectionMode,
    ///The projection mode used for a do-not-populate part.
    pub dnp_projection: ArtworkProjectionMode,
    ///Fallback colour for fitted assembly designators.
    pub designator_color: ::std::string::String,
    ///Fallback colour for do-not-populate assembly designators.
    pub dnp_designator_color: ::std::string::String,
}
///The fitted assembly designator style.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The fitted assembly designator style.",
///  "type": "object",
///  "properties": {
///    "box_fill_ratio": {
///      "description": "Fraction of the component bounds used by the fitted text.",
///      "type": "number"
///    },
///    "callout": {
///      "description": "Place the designator outside the body region with a leader line, at\n`min_font_size_mm`, instead of fitting it inside. Testpoint views set it:\na 1 mm test pad has no room for a readable label.",
///      "type": "boolean"
///    },
///    "color": {
///      "description": "Text colour, CSS syntax.",
///      "type": "string"
///    },
///    "enabled": {
///      "description": "Draw the designators.",
///      "type": "boolean"
///    },
///    "font_weight": {
///      "description": "CSS font weight of the designator text.",
///      "type": "string"
///    },
///    "max_font_size_mm": {
///      "description": "Largest fitted font size in millimetres.",
///      "type": "number"
///    },
///    "min_font_size_mm": {
///      "description": "Smallest fitted font size in millimetres.",
///      "type": "number"
///    },
///    "opacity": {
///      "description": "Opacity from 0 to 1.",
///      "type": "number"
///    },
///    "rotation_aspect_threshold": {
///      "description": "Rotate the text when the fitted bounds are taller than this height/width ratio.",
///      "type": "number"
///    },
///    "rotation_direction": {
///      "description": "Designator rotation direction when the bounds are tall (`ccw` or `cw`).",
///      "type": "string"
///    },
///    "selector_overrides": {
///      "description": "Per-selector overrides merged over this style; the keys are designator\nselectors as written in the file, for example `*` or `TP*`, and each value\nis the override that applies to the designators the selector matches.\nOrdered by key in code point order.",
///      "$ref": "#/$defs/RecordArtworkSelectorOverride"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkAssemblyDesignatorStyle {
    ///Draw the designators.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub enabled: ::std::option::Option<bool>,
    ///Text colour, CSS syntax.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub color: ::std::option::Option<::std::string::String>,
    ///Fraction of the component bounds used by the fitted text.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub box_fill_ratio: ::std::option::Option<f64>,
    ///CSS font weight of the designator text.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub font_weight: ::std::option::Option<::std::string::String>,
    ///Smallest fitted font size in millimetres.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub min_font_size_mm: ::std::option::Option<f64>,
    ///Largest fitted font size in millimetres.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub max_font_size_mm: ::std::option::Option<f64>,
    ///Rotate the text when the fitted bounds are taller than this height/width ratio.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub rotation_aspect_threshold: ::std::option::Option<f64>,
    ///Designator rotation direction when the bounds are tall (`ccw` or `cw`).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub rotation_direction: ::std::option::Option<::std::string::String>,
    /**Place the designator outside the body region with a leader line, at
    `min_font_size_mm`, instead of fitting it inside. Testpoint views set it:
    a 1 mm test pad has no room for a readable label.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub callout: ::std::option::Option<bool>,
    ///Opacity from 0 to 1.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub opacity: ::std::option::Option<f64>,
    /**Per-selector overrides merged over this style; the keys are designator
    selectors as written in the file, for example `*` or `TP*`, and each value
    is the override that applies to the designators the selector matches.
    Ordered by key in code point order.*/
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub selector_overrides: ::std::option::Option<RecordArtworkSelectorOverride>,
}
impl ::std::default::Default for ArtworkAssemblyDesignatorStyle {
    fn default() -> Self {
        Self {
            box_fill_ratio: Default::default(),
            callout: Default::default(),
            color: Default::default(),
            enabled: Default::default(),
            font_weight: Default::default(),
            max_font_size_mm: Default::default(),
            min_font_size_mm: Default::default(),
            opacity: Default::default(),
            rotation_aspect_threshold: Default::default(),
            rotation_direction: Default::default(),
            selector_overrides: Default::default(),
        }
    }
}
///The board-cutout style.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The board-cutout style.",
///  "type": "object",
///  "properties": {
///    "color": {
///      "description": "Line colour, CSS syntax.",
///      "type": "string"
///    },
///    "enabled": {
///      "description": "Draw the cutouts.",
///      "type": "boolean"
///    },
///    "hatch": {
///      "description": "Fill the cutout interior with a hatch when true.",
///      "type": "boolean"
///    },
///    "outline_style": {
///      "description": "How the cutout outline is stroked.",
///      "$ref": "#/$defs/ArtworkOutlineStyle"
///    },
///    "outline_width_mm": {
///      "description": "Cutout outline stroke width in millimetres.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkBoardCutoutStyle {
    ///Draw the cutouts.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub enabled: ::std::option::Option<bool>,
    ///Line colour, CSS syntax.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub color: ::std::option::Option<::std::string::String>,
    ///Fill the cutout interior with a hatch when true.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub hatch: ::std::option::Option<bool>,
    ///How the cutout outline is stroked.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub outline_style: ::std::option::Option<ArtworkOutlineStyle>,
    ///Cutout outline stroke width in millimetres.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub outline_width_mm: ::std::option::Option<f64>,
}
impl ::std::default::Default for ArtworkBoardCutoutStyle {
    fn default() -> Self {
        Self {
            color: Default::default(),
            enabled: Default::default(),
            hatch: Default::default(),
            outline_style: Default::default(),
            outline_width_mm: Default::default(),
        }
    }
}
///The board-perimeter style.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The board-perimeter style.",
///  "type": "object",
///  "properties": {
///    "color": {
///      "description": "Line colour, CSS syntax.",
///      "type": "string"
///    },
///    "enabled": {
///      "description": "Draw the perimeter.",
///      "type": "boolean"
///    },
///    "line_width_mm": {
///      "description": "Stroke width in millimetres.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkBoardOutlineStyle {
    ///Draw the perimeter.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub enabled: ::std::option::Option<bool>,
    ///Line colour, CSS syntax.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub color: ::std::option::Option<::std::string::String>,
    ///Stroke width in millimetres.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub line_width_mm: ::std::option::Option<f64>,
}
impl ::std::default::Default for ArtworkBoardOutlineStyle {
    fn default() -> Self {
        Self {
            color: Default::default(),
            enabled: Default::default(),
            line_width_mm: Default::default(),
        }
    }
}
///The view's canvas bounds and margin.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The view's canvas bounds and margin.",
///  "type": "object",
///  "required": [
///    "bounds",
///    "margin_mm"
///  ],
///  "properties": {
///    "bounds": {
///      "description": "How the canvas is bounded.",
///      "$ref": "#/$defs/ArtworkCanvasBounds"
///    },
///    "margin_mm": {
///      "description": "Extra margin around the selected canvas bounds, in millimetres.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkCanvas {
    ///How the canvas is bounded.
    pub bounds: ArtworkCanvasBounds,
    ///Extra margin around the selected canvas bounds, in millimetres.
    pub margin_mm: f64,
}
///How the view's canvas is bounded.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How the view's canvas is bounded.",
///  "type": "string",
///  "enum": [
///    "board_outline",
///    "all_geometry",
///    "board_and_bodies"
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
pub enum ArtworkCanvasBounds {
    #[serde(rename = "board_outline")]
    BoardOutline,
    #[serde(rename = "all_geometry")]
    AllGeometry,
    #[serde(rename = "board_and_bodies")]
    BoardAndBodies,
}
impl ::std::fmt::Display for ArtworkCanvasBounds {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::BoardOutline => f.write_str("board_outline"),
            Self::AllGeometry => f.write_str("all_geometry"),
            Self::BoardAndBodies => f.write_str("board_and_bodies"),
        }
    }
}
impl ::std::str::FromStr for ArtworkCanvasBounds {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "board_outline" => Ok(Self::BoardOutline),
            "all_geometry" => Ok(Self::AllGeometry),
            "board_and_bodies" => Ok(Self::BoardAndBodies),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for ArtworkCanvasBounds {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ArtworkCanvasBounds {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ArtworkCanvasBounds {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**One per-component override (`components.<designator>`). The keys of the
`components` map are reference designators, for example `J1` or `U5`.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One per-component override (`components.<designator>`). The keys of the\n`components` map are reference designators, for example `J1` or `U5`.",
///  "type": "object",
///  "properties": {
///    "assembly_designators": {
///      "description": "Assembly designator style overrides for this component.",
///      "$ref": "#/$defs/ArtworkAssemblyDesignatorStyle"
///    },
///    "assembly_hlr": {
///      "description": "Assembly HLR style overrides for this component.",
///      "$ref": "#/$defs/ArtworkHlrStyle"
///    },
///    "cathode_pad": {
///      "description": "The pad name to use for this component's cathode marker.",
///      "type": "string"
///    },
///    "diode": {
///      "description": "Force diode/cathode detection on or off for this component.",
///      "type": "boolean"
///    },
///    "diode_line_art": {
///      "description": "Force diode line-art rendering on or off for this component.",
///      "type": "boolean"
///    },
///    "pin1_enabled": {
///      "description": "Force the pin-1 marker on or off for this component.",
///      "type": "boolean"
///    },
///    "pin1_pad": {
///      "description": "The pad name to use for this component's pin-1 marker.",
///      "type": "string"
///    },
///    "projection": {
///      "description": "The component's body projection mode.",
///      "$ref": "#/$defs/ArtworkProjectionMode"
///    },
///    "show_designator": {
///      "description": "Force the assembly designator on or off for this component.",
///      "type": "boolean"
///    },
///    "side": {
///      "description": "The side the component is treated as being on.",
///      "$ref": "#/$defs/ArtworkComponentSide"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkComponentOverride {
    ///The side the component is treated as being on.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub side: ::std::option::Option<ArtworkComponentSide>,
    ///The component's body projection mode.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub projection: ::std::option::Option<ArtworkProjectionMode>,
    ///Assembly HLR style overrides for this component.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub assembly_hlr: ::std::option::Option<ArtworkHlrStyle>,
    ///Assembly designator style overrides for this component.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub assembly_designators: ::std::option::Option<ArtworkAssemblyDesignatorStyle>,
    ///Force the pin-1 marker on or off for this component.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub pin1_enabled: ::std::option::Option<bool>,
    ///The pad name to use for this component's pin-1 marker.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub pin1_pad: ::std::option::Option<::std::string::String>,
    ///The pad name to use for this component's cathode marker.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub cathode_pad: ::std::option::Option<::std::string::String>,
    ///Force diode/cathode detection on or off for this component.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub diode: ::std::option::Option<bool>,
    ///Force diode line-art rendering on or off for this component.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub diode_line_art: ::std::option::Option<bool>,
    ///Force the assembly designator on or off for this component.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub show_designator: ::std::option::Option<bool>,
}
impl ::std::default::Default for ArtworkComponentOverride {
    fn default() -> Self {
        Self {
            assembly_designators: Default::default(),
            assembly_hlr: Default::default(),
            cathode_pad: Default::default(),
            diode: Default::default(),
            diode_line_art: Default::default(),
            pin1_enabled: Default::default(),
            pin1_pad: Default::default(),
            projection: Default::default(),
            show_designator: Default::default(),
            side: Default::default(),
        }
    }
}
/**The side a component override forces, `top`/`bottom` exactly as the config
file spells it (KiCad's own spelling for a front/back side).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The side a component override forces, `top`/`bottom` exactly as the config\nfile spells it (KiCad's own spelling for a front/back side).",
///  "type": "string",
///  "enum": [
///    "top",
///    "bottom"
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
pub enum ArtworkComponentSide {
    #[serde(rename = "top")]
    Top,
    #[serde(rename = "bottom")]
    Bottom,
}
impl ::std::fmt::Display for ArtworkComponentSide {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Top => f.write_str("top"),
            Self::Bottom => f.write_str("bottom"),
        }
    }
}
impl ::std::str::FromStr for ArtworkComponentSide {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "top" => Ok(Self::Top),
            "bottom" => Ok(Self::Bottom),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for ArtworkComponentSide {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ArtworkComponentSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ArtworkComponentSide {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
/**The artwork configuration `prism-kicad artwork --config` reads
(`pcb-svg.config.json` / `pcb-svg.testpoints.config.json` with `schema`
replaced).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "$id": "urn:prism:schema:prism.artwork.config:a0",
///  "title": "ArtworkConfigA0",
///  "description": "The artwork configuration `prism-kicad artwork --config` reads\n(`pcb-svg.config.json` / `pcb-svg.testpoints.config.json` with `schema`\nreplaced).",
///  "type": "object",
///  "required": [
///    "assembly",
///    "components",
///    "dnp",
///    "global",
///    "layer_outputs",
///    "pin1",
///    "schema",
///    "views"
///  ],
///  "properties": {
///    "assembly": {
///      "description": "Default projection and designator colour policy.",
///      "$ref": "#/$defs/ArtworkAssembly"
///    },
///    "components": {
///      "description": "Per-component overrides; the keys are reference designators (`J1`, `U5`),\nserialized in code point order. Empty when no component is overridden.",
///      "$ref": "#/$defs/RecordArtworkComponentOverride"
///    },
///    "dnp": {
///      "description": "The do-not-populate hatch/marker style.",
///      "$ref": "#/$defs/ArtworkDnp"
///    },
///    "global": {
///      "description": "Global rendering options and the default style table.",
///      "$ref": "#/$defs/ArtworkGlobal"
///    },
///    "layer_outputs": {
///      "description": "Standalone per-layer output settings.",
///      "$ref": "#/$defs/ArtworkLayerOutputs"
///    },
///    "pin1": {
///      "description": "Pin-1 marker selection policy.",
///      "$ref": "#/$defs/ArtworkPin1"
///    },
///    "schema": {
///      "description": "Document schema id.",
///      "type": "string",
///      "const": "prism.artwork.config.a0"
///    },
///    "views": {
///      "description": "The composed views, in file order. `prism-kicad artwork --view` names one\nor more of them.",
///      "type": "array",
///      "items": {
///        "$ref": "#/$defs/ArtworkView"
///      }
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkConfigA0 {
    ///Document schema id.
    pub schema: ::std::string::String,
    ///Global rendering options and the default style table.
    pub global: ArtworkGlobal,
    ///Default projection and designator colour policy.
    pub assembly: ArtworkAssembly,
    ///The do-not-populate hatch/marker style.
    pub dnp: ArtworkDnp,
    ///Pin-1 marker selection policy.
    pub pin1: ArtworkPin1,
    /**Per-component overrides; the keys are reference designators (`J1`, `U5`),
    serialized in code point order. Empty when no component is overridden.*/
    pub components: RecordArtworkComponentOverride,
    ///Standalone per-layer output settings.
    pub layer_outputs: ArtworkLayerOutputs,
    /**The composed views, in file order. `prism-kicad artwork --view` names one
    or more of them.*/
    pub views: ::std::vec::Vec<ArtworkView>,
}
///The do-not-populate hatch/marker style (`dnp`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The do-not-populate hatch/marker style (`dnp`).",
///  "type": "object",
///  "required": [
///    "color",
///    "hatch",
///    "hatch_angle_deg",
///    "hatch_line_width_mm",
///    "hatch_spacing_mm"
///  ],
///  "properties": {
///    "color": {
///      "description": "Marker colour, CSS syntax.",
///      "type": "string"
///    },
///    "hatch": {
///      "description": "Draw a hatch fill when true.",
///      "type": "boolean"
///    },
///    "hatch_angle_deg": {
///      "description": "Hatch angle in degrees.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "hatch_line_width_mm": {
///      "description": "Hatch stroke width in millimetres.",
///      "type": "number"
///    },
///    "hatch_spacing_mm": {
///      "description": "Hatch line spacing in millimetres.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkDnp {
    ///Marker colour, CSS syntax.
    pub color: ::std::string::String,
    ///Draw a hatch fill when true.
    pub hatch: bool,
    ///Hatch line spacing in millimetres.
    pub hatch_spacing_mm: f64,
    ///Hatch angle in degrees.
    pub hatch_angle_deg: Degrees,
    ///Hatch stroke width in millimetres.
    pub hatch_line_width_mm: f64,
}
/**A do-not-populate hatch override under `global.styles` or `views[].styles`:
each field it sets replaces the top-level `dnp` value.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A do-not-populate hatch override under `global.styles` or `views[].styles`:\neach field it sets replaces the top-level `dnp` value.",
///  "type": "object",
///  "properties": {
///    "color": {
///      "description": "Marker colour, CSS syntax.",
///      "type": "string"
///    },
///    "hatch": {
///      "description": "Draw a hatch fill when true.",
///      "type": "boolean"
///    },
///    "hatch_angle_deg": {
///      "description": "Hatch angle in degrees.",
///      "$ref": "#/$defs/Degrees"
///    },
///    "hatch_line_width_mm": {
///      "description": "Hatch stroke width in millimetres.",
///      "type": "number"
///    },
///    "hatch_spacing_mm": {
///      "description": "Hatch line spacing in millimetres.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkDnpStyle {
    ///Marker colour, CSS syntax.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub color: ::std::option::Option<::std::string::String>,
    ///Draw a hatch fill when true.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub hatch: ::std::option::Option<bool>,
    ///Hatch line spacing in millimetres.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub hatch_spacing_mm: ::std::option::Option<f64>,
    ///Hatch angle in degrees.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub hatch_angle_deg: ::std::option::Option<Degrees>,
    ///Hatch stroke width in millimetres.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub hatch_line_width_mm: ::std::option::Option<f64>,
}
impl ::std::default::Default for ArtworkDnpStyle {
    fn default() -> Self {
        Self {
            color: Default::default(),
            hatch: Default::default(),
            hatch_angle_deg: Default::default(),
            hatch_line_width_mm: Default::default(),
            hatch_spacing_mm: Default::default(),
        }
    }
}
///A circular or slotted drill overlay style (`drills`, `slots`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "A circular or slotted drill overlay style (`drills`, `slots`).",
///  "type": "object",
///  "properties": {
///    "enabled": {
///      "description": "Draw the overlays.",
///      "type": "boolean"
///    },
///    "non_plated_color": {
///      "description": "Colour of non-plated geometry.",
///      "type": "string"
///    },
///    "opacity": {
///      "description": "Opacity from 0 to 1.",
///      "type": "number"
///    },
///    "plated_color": {
///      "description": "Colour of plated geometry.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkDrillSlotStyle {
    ///Draw the overlays.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub enabled: ::std::option::Option<bool>,
    ///Colour of plated geometry.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub plated_color: ::std::option::Option<::std::string::String>,
    ///Colour of non-plated geometry.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub non_plated_color: ::std::option::Option<::std::string::String>,
    ///Opacity from 0 to 1.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub opacity: ::std::option::Option<f64>,
}
impl ::std::default::Default for ArtworkDrillSlotStyle {
    fn default() -> Self {
        Self {
            enabled: Default::default(),
            non_plated_color: Default::default(),
            opacity: Default::default(),
            plated_color: Default::default(),
        }
    }
}
/**Global rendering options and the default style table
(`global` of `pcb-svg.config.json`).*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Global rendering options and the default style table\n(`global` of `pcb-svg.config.json`).",
///  "type": "object",
///  "required": [
///    "canvas",
///    "clean_output",
///    "clip_holes_from_copper",
///    "clip_to_outline",
///    "include_metadata",
///    "mirror_bottom_view",
///    "show_empty_layers",
///    "styles",
///    "svg_scale",
///    "svg_size_unit"
///  ],
///  "properties": {
///    "canvas": {
///      "description": "SVG canvas bounds and margin policy.",
///      "$ref": "#/$defs/ArtworkCanvas"
///    },
///    "clean_output": {
///      "description": "Remove prior generated outputs before writing the new render set.",
///      "type": "boolean"
///    },
///    "clip_holes_from_copper": {
///      "description": "Clip drill and slot holes out of rendered copper layers.",
///      "type": "boolean"
///    },
///    "clip_to_outline": {
///      "description": "Clip rendered layers to the board outline when possible.",
///      "type": "boolean"
///    },
///    "include_metadata": {
///      "description": "Emit `data-*` metadata in generated SVG elements.",
///      "type": "boolean"
///    },
///    "mirror_bottom_view": {
///      "description": "Mirror bottom-side composed views into a board-front reading orientation.",
///      "type": "boolean"
///    },
///    "show_empty_layers": {
///      "description": "Write physical layer SVGs even when no geometry is present.",
///      "type": "boolean"
///    },
///    "styles": {
///      "description": "The default style table, merged under each view's own `styles`.",
///      "$ref": "#/$defs/ArtworkStyles"
///    },
///    "svg_scale": {
///      "description": "SVG user-unit scale factor per millimetre.",
///      "type": "number"
///    },
///    "svg_size_unit": {
///      "description": "SVG `width`/`height` unit suffix; an empty string keeps raw user units.",
///      "type": "string"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkGlobal {
    ///SVG canvas bounds and margin policy.
    pub canvas: ArtworkCanvas,
    ///Emit `data-*` metadata in generated SVG elements.
    pub include_metadata: bool,
    ///Write physical layer SVGs even when no geometry is present.
    pub show_empty_layers: bool,
    ///Clip rendered layers to the board outline when possible.
    pub clip_to_outline: bool,
    ///Clip drill and slot holes out of rendered copper layers.
    pub clip_holes_from_copper: bool,
    ///Mirror bottom-side composed views into a board-front reading orientation.
    pub mirror_bottom_view: bool,
    ///SVG user-unit scale factor per millimetre.
    pub svg_scale: f64,
    ///SVG `width`/`height` unit suffix; an empty string keeps raw user units.
    pub svg_size_unit: ::std::string::String,
    ///Remove prior generated outputs before writing the new render set.
    pub clean_output: bool,
    ///The default style table, merged under each view's own `styles`.
    pub styles: ArtworkStyles,
}
///The Geometer-backed assembly projection style.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The Geometer-backed assembly projection style.",
///  "type": "object",
///  "properties": {
///    "color": {
///      "description": "Line colour, CSS syntax.",
///      "type": "string"
///    },
///    "enabled": {
///      "description": "Draw the projection.",
///      "type": "boolean"
///    },
///    "include_outline": {
///      "description": "Include the silhouette (outline) geometry.",
///      "type": "boolean"
///    },
///    "include_visible": {
///      "description": "Include the visible-internal-edge (detail) geometry.",
///      "type": "boolean"
///    },
///    "line_width_mm": {
///      "description": "Stroke width in millimetres.",
///      "type": "number"
///    },
///    "opacity": {
///      "description": "Opacity from 0 to 1.",
///      "type": "number"
///    },
///    "union_polygons": {
///      "description": "Union outline polygons before rendering when Geometer supports it.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkHlrStyle {
    ///Draw the projection.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub enabled: ::std::option::Option<bool>,
    ///Line colour, CSS syntax.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub color: ::std::option::Option<::std::string::String>,
    ///Stroke width in millimetres.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub line_width_mm: ::std::option::Option<f64>,
    ///Opacity from 0 to 1.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub opacity: ::std::option::Option<f64>,
    ///Include the visible-internal-edge (detail) geometry.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub include_visible: ::std::option::Option<bool>,
    ///Include the silhouette (outline) geometry.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub include_outline: ::std::option::Option<bool>,
    ///Union outline polygons before rendering when Geometer supports it.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub union_polygons: ::std::option::Option<bool>,
}
impl ::std::default::Default for ArtworkHlrStyle {
    fn default() -> Self {
        Self {
            color: Default::default(),
            enabled: Default::default(),
            include_outline: Default::default(),
            include_visible: Default::default(),
            line_width_mm: Default::default(),
            opacity: Default::default(),
            union_polygons: Default::default(),
        }
    }
}
///Standalone per-layer output settings (`layer_outputs`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Standalone per-layer output settings (`layer_outputs`).",
///  "type": "object",
///  "required": [
///    "enabled"
///  ],
///  "properties": {
///    "enabled": {
///      "description": "Write standalone per-layer and virtual-layer SVGs.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkLayerOutputs {
    ///Write standalone per-layer and virtual-layer SVGs.
    pub enabled: bool,
}
///How a board cutout's outline is stroked.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How a board cutout's outline is stroked.",
///  "type": "string",
///  "enum": [
///    "solid",
///    "dashed"
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
pub enum ArtworkOutlineStyle {
    #[serde(rename = "solid")]
    Solid,
    #[serde(rename = "dashed")]
    Dashed,
}
impl ::std::fmt::Display for ArtworkOutlineStyle {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Solid => f.write_str("solid"),
            Self::Dashed => f.write_str("dashed"),
        }
    }
}
impl ::std::str::FromStr for ArtworkOutlineStyle {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "solid" => Ok(Self::Solid),
            "dashed" => Ok(Self::Dashed),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for ArtworkOutlineStyle {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ArtworkOutlineStyle {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ArtworkOutlineStyle {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///Pin-1 marker selection policy (`pin1`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "Pin-1 marker selection policy (`pin1`).",
///  "type": "object",
///  "required": [
///    "exclude_designators",
///    "exclude_single_pin"
///  ],
///  "properties": {
///    "exclude_designators": {
///      "description": "Designators excluded from pin-1 markers, as written: exact names, prefixes,\nwildcards or ranges. In file order.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "exclude_single_pin": {
///      "description": "Suppress pin-1 markers for single-pin footprints.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkPin1 {
    /**Designators excluded from pin-1 markers, as written: exact names, prefixes,
    wildcards or ranges. In file order.*/
    pub exclude_designators: ::std::vec::Vec<::std::string::String>,
    ///Suppress pin-1 markers for single-pin footprints.
    pub exclude_single_pin: bool,
}
///The pin-1 marker style.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The pin-1 marker style.",
///  "type": "object",
///  "properties": {
///    "color": {
///      "description": "Marker colour, CSS syntax.",
///      "type": "string"
///    },
///    "dot_diameter_mm": {
///      "description": "Fixed marker dot diameter in millimetres.",
///      "type": "number"
///    },
///    "enabled": {
///      "description": "Draw the markers.",
///      "type": "boolean"
///    },
///    "max_dot_diameter_mm": {
///      "description": "Largest marker dot diameter in millimetres.",
///      "type": "number"
///    },
///    "min_dot_diameter_mm": {
///      "description": "Smallest marker dot diameter in millimetres.",
///      "type": "number"
///    },
///    "pad_diameter_ratio": {
///      "description": "Marker diameter as a ratio of the selected pad size.",
///      "type": "number"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkPin1MarkerStyle {
    ///Draw the markers.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub enabled: ::std::option::Option<bool>,
    ///Marker colour, CSS syntax.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub color: ::std::option::Option<::std::string::String>,
    ///Fixed marker dot diameter in millimetres.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub dot_diameter_mm: ::std::option::Option<f64>,
    ///Marker diameter as a ratio of the selected pad size.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub pad_diameter_ratio: ::std::option::Option<f64>,
    ///Smallest marker dot diameter in millimetres.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub min_dot_diameter_mm: ::std::option::Option<f64>,
    ///Largest marker dot diameter in millimetres.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub max_dot_diameter_mm: ::std::option::Option<f64>,
}
impl ::std::default::Default for ArtworkPin1MarkerStyle {
    fn default() -> Self {
        Self {
            color: Default::default(),
            dot_diameter_mm: Default::default(),
            enabled: Default::default(),
            max_dot_diameter_mm: Default::default(),
            min_dot_diameter_mm: Default::default(),
            pad_diameter_ratio: Default::default(),
        }
    }
}
/**How a component's body is projected, used by `assembly.default_projection`,
`assembly.dnp_projection` and `views[].assembly_hlr_mode`. The value is
Cruncher's token (its `PCB_SVG_COMPONENT_PROJECTION_MODES`), kept verbatim.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "How a component's body is projected, used by `assembly.default_projection`,\n`assembly.dnp_projection` and `views[].assembly_hlr_mode`. The value is\nCruncher's token (its `PCB_SVG_COMPONENT_PROJECTION_MODES`), kept verbatim.",
///  "type": "string",
///  "enum": [
///    "detail",
///    "outline",
///    "bounding_box",
///    "model_bounds",
///    "pad_bounds",
///    "none"
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
pub enum ArtworkProjectionMode {
    #[serde(rename = "detail")]
    Detail,
    #[serde(rename = "outline")]
    Outline,
    #[serde(rename = "bounding_box")]
    BoundingBox,
    #[serde(rename = "model_bounds")]
    ModelBounds,
    #[serde(rename = "pad_bounds")]
    PadBounds,
    #[serde(rename = "none")]
    None,
}
impl ::std::fmt::Display for ArtworkProjectionMode {
    fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
        match *self {
            Self::Detail => f.write_str("detail"),
            Self::Outline => f.write_str("outline"),
            Self::BoundingBox => f.write_str("bounding_box"),
            Self::ModelBounds => f.write_str("model_bounds"),
            Self::PadBounds => f.write_str("pad_bounds"),
            Self::None => f.write_str("none"),
        }
    }
}
impl ::std::str::FromStr for ArtworkProjectionMode {
    type Err = self::error::ConversionError;
    fn from_str(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        match value {
            "detail" => Ok(Self::Detail),
            "outline" => Ok(Self::Outline),
            "bounding_box" => Ok(Self::BoundingBox),
            "model_bounds" => Ok(Self::ModelBounds),
            "pad_bounds" => Ok(Self::PadBounds),
            "none" => Ok(Self::None),
            _ => Err("invalid value".into()),
        }
    }
}
impl ::std::convert::TryFrom<&str> for ArtworkProjectionMode {
    type Error = self::error::ConversionError;
    fn try_from(value: &str) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<&::std::string::String> for ArtworkProjectionMode {
    type Error = self::error::ConversionError;
    fn try_from(
        value: &::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
impl ::std::convert::TryFrom<::std::string::String> for ArtworkProjectionMode {
    type Error = self::error::ConversionError;
    fn try_from(
        value: ::std::string::String,
    ) -> ::std::result::Result<Self, self::error::ConversionError> {
        value.parse()
    }
}
///One `selector_overrides` entry: whether matching designators are drawn.
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One `selector_overrides` entry: whether matching designators are drawn.",
///  "type": "object",
///  "required": [
///    "enabled"
///  ],
///  "properties": {
///    "enabled": {
///      "description": "Draw the designators the selector matches.",
///      "type": "boolean"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkSelectorOverride {
    ///Draw the designators the selector matches.
    pub enabled: bool,
}
/**The style table: one entry per rendered feature, each optional so a view may
merge only what it changes over `global.styles`. The entries are the ones
Prism's two config files use.*/
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "The style table: one entry per rendered feature, each optional so a view may\nmerge only what it changes over `global.styles`. The entries are the ones\nPrism's two config files use.",
///  "type": "object",
///  "properties": {
///    "assembly_designators": {
///      "description": "Fitted assembly reference-designator text.",
///      "$ref": "#/$defs/ArtworkAssemblyDesignatorStyle"
///    },
///    "assembly_hlr": {
///      "description": "The Geometer-backed assembly projection.",
///      "$ref": "#/$defs/ArtworkHlrStyle"
///    },
///    "board_cutouts": {
///      "description": "Internal board cutouts derived from smaller closed `Edge.Cuts` regions.",
///      "$ref": "#/$defs/ArtworkBoardCutoutStyle"
///    },
///    "board_outline": {
///      "description": "The board perimeter derived from `Edge.Cuts`.",
///      "$ref": "#/$defs/ArtworkBoardOutlineStyle"
///    },
///    "dnp": {
///      "description": "The do-not-populate hatch fill, a per-view override of the top-level `dnp`.",
///      "$ref": "#/$defs/ArtworkDnpStyle"
///    },
///    "drills": {
///      "description": "Circular drill overlays.",
///      "$ref": "#/$defs/ArtworkDrillSlotStyle"
///    },
///    "pin1_marker": {
///      "description": "Synthesized pin-1 markers (`PIN1_TOP`/`PIN1_BOTTOM`).",
///      "$ref": "#/$defs/ArtworkPin1MarkerStyle"
///    },
///    "slots": {
///      "description": "Slotted drill overlays.",
///      "$ref": "#/$defs/ArtworkDrillSlotStyle"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkStyles {
    ///The board perimeter derived from `Edge.Cuts`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub board_outline: ::std::option::Option<ArtworkBoardOutlineStyle>,
    ///Internal board cutouts derived from smaller closed `Edge.Cuts` regions.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub board_cutouts: ::std::option::Option<ArtworkBoardCutoutStyle>,
    ///Circular drill overlays.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub drills: ::std::option::Option<ArtworkDrillSlotStyle>,
    ///Slotted drill overlays.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub slots: ::std::option::Option<ArtworkDrillSlotStyle>,
    ///The Geometer-backed assembly projection.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub assembly_hlr: ::std::option::Option<ArtworkHlrStyle>,
    ///The do-not-populate hatch fill, a per-view override of the top-level `dnp`.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub dnp: ::std::option::Option<ArtworkDnpStyle>,
    ///Fitted assembly reference-designator text.
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub assembly_designators: ::std::option::Option<ArtworkAssemblyDesignatorStyle>,
    ///Synthesized pin-1 markers (`PIN1_TOP`/`PIN1_BOTTOM`).
    #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
    pub pin1_marker: ::std::option::Option<ArtworkPin1MarkerStyle>,
}
impl ::std::default::Default for ArtworkStyles {
    fn default() -> Self {
        Self {
            assembly_designators: Default::default(),
            assembly_hlr: Default::default(),
            board_cutouts: Default::default(),
            board_outline: Default::default(),
            dnp: Default::default(),
            drills: Default::default(),
            pin1_marker: Default::default(),
            slots: Default::default(),
        }
    }
}
///One composed view (one entry of `views`).
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "description": "One composed view (one entry of `views`).",
///  "type": "object",
///  "required": [
///    "assembly_hlr_mode",
///    "enabled",
///    "group_id",
///    "layers",
///    "name",
///    "output_svg",
///    "styles"
///  ],
///  "properties": {
///    "assembly_hlr_mode": {
///      "description": "The view's projection mode for its `ASSEMBLY_HLR_*` tokens.",
///      "$ref": "#/$defs/ArtworkProjectionMode"
///    },
///    "enabled": {
///      "description": "Whether the view is rendered.",
///      "type": "boolean"
///    },
///    "group_id": {
///      "description": "The SVG group id for the composed view.",
///      "type": "string"
///    },
///    "layers": {
///      "description": "The physical and virtual layer tokens rendered into this view, in draw\norder (first drawn at the bottom). A physical token is a KiCad layer name\n(`F.Cu`) or a config alias (`TOP`); a virtual token is one of\n`BOARD_OUTLINE`, `BOARD_CUTOUTS`, `DRILLS`, `SLOTS`, `PIN1_TOP`,\n`PIN1_BOTTOM`, the `ASSEMBLY_HLR_*`, `ASSEMBLY_BOUNDS_*` and\n`ASSEMBLY_DESIGNATORS_*` tokens.",
///      "type": "array",
///      "items": {
///        "type": "string"
///      }
///    },
///    "name": {
///      "description": "The view's stable name, used by `--view`.",
///      "type": "string"
///    },
///    "output_svg": {
///      "description": "The output path template relative to the output root; supports `{board}` and `{view}`.",
///      "type": "string"
///    },
///    "styles": {
///      "description": "Per-view style overrides merged over `global.styles`.",
///      "$ref": "#/$defs/ArtworkStyles"
///    }
///  },
///  "additionalProperties": false
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct ArtworkView {
    ///The view's stable name, used by `--view`.
    pub name: ::std::string::String,
    ///Whether the view is rendered.
    pub enabled: bool,
    ///The SVG group id for the composed view.
    pub group_id: ::std::string::String,
    ///The output path template relative to the output root; supports `{board}` and `{view}`.
    pub output_svg: ::std::string::String,
    /**The physical and virtual layer tokens rendered into this view, in draw
    order (first drawn at the bottom). A physical token is a KiCad layer name
    (`F.Cu`) or a config alias (`TOP`); a virtual token is one of
    `BOARD_OUTLINE`, `BOARD_CUTOUTS`, `DRILLS`, `SLOTS`, `PIN1_TOP`,
    `PIN1_BOTTOM`, the `ASSEMBLY_HLR_*`, `ASSEMBLY_BOUNDS_*` and
    `ASSEMBLY_DESIGNATORS_*` tokens.*/
    pub layers: ::std::vec::Vec<::std::string::String>,
    ///The view's projection mode for its `ASSEMBLY_HLR_*` tokens.
    pub assembly_hlr_mode: ArtworkProjectionMode,
    ///Per-view style overrides merged over `global.styles`.
    pub styles: ArtworkStyles,
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
///`RecordArtworkComponentOverride`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/ArtworkComponentOverride"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordArtworkComponentOverride(
    pub ::std::collections::BTreeMap<::std::string::String, ArtworkComponentOverride>,
);
impl ::std::ops::Deref for RecordArtworkComponentOverride {
    type Target = ::std::collections::BTreeMap<::std::string::String, ArtworkComponentOverride>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, ArtworkComponentOverride> {
        &self.0
    }
}
impl ::std::convert::From<RecordArtworkComponentOverride>
    for ::std::collections::BTreeMap<::std::string::String, ArtworkComponentOverride>
{
    fn from(value: RecordArtworkComponentOverride) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, ArtworkComponentOverride>,
    > for RecordArtworkComponentOverride
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, ArtworkComponentOverride>,
    ) -> Self {
        Self(value)
    }
}
///`RecordArtworkSelectorOverride`
///
/// <details><summary>JSON schema</summary>
///
/// ```json
///{
///  "type": "object",
///  "additionalProperties": {
///    "$ref": "#/$defs/ArtworkSelectorOverride"
///  }
///}
/// ```
/// </details>
#[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
#[serde(transparent)]
pub struct RecordArtworkSelectorOverride(
    pub ::std::collections::BTreeMap<::std::string::String, ArtworkSelectorOverride>,
);
impl ::std::ops::Deref for RecordArtworkSelectorOverride {
    type Target = ::std::collections::BTreeMap<::std::string::String, ArtworkSelectorOverride>;
    fn deref(
        &self,
    ) -> &::std::collections::BTreeMap<::std::string::String, ArtworkSelectorOverride> {
        &self.0
    }
}
impl ::std::convert::From<RecordArtworkSelectorOverride>
    for ::std::collections::BTreeMap<::std::string::String, ArtworkSelectorOverride>
{
    fn from(value: RecordArtworkSelectorOverride) -> Self {
        value.0
    }
}
impl
    ::std::convert::From<
        ::std::collections::BTreeMap<::std::string::String, ArtworkSelectorOverride>,
    > for RecordArtworkSelectorOverride
{
    fn from(
        value: ::std::collections::BTreeMap<::std::string::String, ArtworkSelectorOverride>,
    ) -> Self {
        Self(value)
    }
}
