//! JSON Schema validation against the Prism contracts.
//!
//! The 33 Prism roots in `native/contracts/generated/schema/` are compiled
//! from TypeSpec and committed. This crate carries a byte-identical copy in
//! `schema/` (a test checks it against the committed files), because the
//! worker image builds `prism-kicad` from `native/src/rs` alone. Every schema
//! is registered under its `$id`, so the manifest's embedded generator and
//! effective-config roots resolve by id (bundle-format.md §9 step 3).
//!
//! The validator implements exactly the draft 2020-12 keywords these schemas
//! use: `$ref` (within a document and by `$id`), `type`, `const`, `enum`,
//! `properties`, `required`, `unevaluatedProperties` (only ever beside
//! `properties` at the same level, so it acts as `additionalProperties`),
//! `items`, `minItems`, `maxItems`, `uniqueItems`, `pattern`, `minLength`,
//! `maxLength`, `minimum`, `maximum`, `anyOf`, `oneOf` and `not`. A schema using any other
//! assertion keyword fails the registry test, so a new keyword cannot be
//! silently ignored.

use regex::Regex;
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::OnceLock;

/// The committed Prism schemas, `(file name, text)`.
pub const SCHEMA_FILES: [(&str, &str); 33] = [
    (
        "ArtworkConfigA0.json",
        include_str!("../schema/ArtworkConfigA0.json"),
    ),
    (
        "AssemblyHlrA0.json",
        include_str!("../schema/AssemblyHlrA0.json"),
    ),
    (
        "BoardObjectsA0.json",
        include_str!("../schema/BoardObjectsA0.json"),
    ),
    (
        "BundleManifestA3.json",
        include_str!("../schema/BundleManifestA3.json"),
    ),
    (
        "CliArtworkResultA0.json",
        include_str!("../schema/CliArtworkResultA0.json"),
    ),
    (
        "CliBuildResultA0.json",
        include_str!("../schema/CliBuildResultA0.json"),
    ),
    (
        "CliCompareResultA1.json",
        include_str!("../schema/CliCompareResultA1.json"),
    ),
    (
        "CliDiagnosticA0.json",
        include_str!("../schema/CliDiagnosticA0.json"),
    ),
    (
        "CliDrawingSheetResultA0.json",
        include_str!("../schema/CliDrawingSheetResultA0.json"),
    ),
    ("CliErrorA0.json", include_str!("../schema/CliErrorA0.json")),
    (
        "CliExtractResultA0.json",
        include_str!("../schema/CliExtractResultA0.json"),
    ),
    (
        "CliProjectAbsentA0.json",
        include_str!("../schema/CliProjectAbsentA0.json"),
    ),
    (
        "CliReuseResultA0.json",
        include_str!("../schema/CliReuseResultA0.json"),
    ),
    (
        "CliStrokeFontMetricsA0.json",
        include_str!("../schema/CliStrokeFontMetricsA0.json"),
    ),
    (
        "CliStrokeTextResultA0.json",
        include_str!("../schema/CliStrokeTextResultA0.json"),
    ),
    (
        "CliVendorListA0.json",
        include_str!("../schema/CliVendorListA0.json"),
    ),
    (
        "CliVendorRunResultA0.json",
        include_str!("../schema/CliVendorRunResultA0.json"),
    ),
    (
        "CliVerifyReportA0.json",
        include_str!("../schema/CliVerifyReportA0.json"),
    ),
    (
        "CliVersionA0.json",
        include_str!("../schema/CliVersionA0.json"),
    ),
    (
        "DesignCompareResultA1.json",
        include_str!("../schema/DesignCompareResultA1.json"),
    ),
    (
        "DrawingSheetRequestA0.json",
        include_str!("../schema/DrawingSheetRequestA0.json"),
    ),
    (
        "OccurrencesA0.json",
        include_str!("../schema/OccurrencesA0.json"),
    ),
    (
        "PlacementsA1.json",
        include_str!("../schema/PlacementsA1.json"),
    ),
    ("ProjectA0.json", include_str!("../schema/ProjectA0.json")),
    (
        "RevisionKeyEffectiveConfigA1.json",
        include_str!("../schema/RevisionKeyEffectiveConfigA1.json"),
    ),
    (
        "RevisionKeyRecordA1.json",
        include_str!("../schema/RevisionKeyRecordA1.json"),
    ),
    (
        "RevisionKeyVectorsA1.json",
        include_str!("../schema/RevisionKeyVectorsA1.json"),
    ),
    (
        "RouteMetricsA0.json",
        include_str!("../schema/RouteMetricsA0.json"),
    ),
    (
        "SemanticIndexA2.json",
        include_str!("../schema/SemanticIndexA2.json"),
    ),
    ("StackupA0.json", include_str!("../schema/StackupA0.json")),
    (
        "StrokeTextRequestA0.json",
        include_str!("../schema/StrokeTextRequestA0.json"),
    ),
    (
        "SystemInterfaceV1.json",
        include_str!("../schema/SystemInterfaceV1.json"),
    ),
    (
        "VendorJlcpcbConfigA0.json",
        include_str!("../schema/VendorJlcpcbConfigA0.json"),
    ),
];

/// Keywords that carry no assertion.
const ANNOTATIONS: [&str; 6] = ["$schema", "$id", "$defs", "description", "title", "default"];

/// Assertion keywords the validator implements.
pub const KEYWORDS: [&str; 21] = [
    "$ref",
    "type",
    "const",
    "enum",
    "properties",
    "required",
    "unevaluatedProperties",
    "items",
    "minItems",
    "maxItems",
    "uniqueItems",
    "pattern",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "anyOf",
    "oneOf",
    "not",
];

/// Where a document broke its schema.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Violation {
    /// RFC 6901 pointer into the instance.
    pub pointer: String,
    /// What failed.
    pub message: String,
}

/// Every registered schema, by `$id`.
pub struct Registry {
    documents: BTreeMap<String, Value>,
    patterns: BTreeMap<String, Regex>,
}

/// `urn:prism:schema:prism.<name>:<version>` for `prism.<name>.<version>`.
#[must_use]
pub fn urn_for(schema_id: &str) -> Option<String> {
    let (name, version) = schema_id.rsplit_once('.')?;
    name.starts_with("prism.")
        .then(|| format!("urn:prism:schema:{name}:{version}"))
}

fn collect_patterns(node: &Value, patterns: &mut BTreeMap<String, Regex>) -> Result<(), String> {
    match node {
        Value::Object(map) => {
            if let Some(Value::String(pattern)) = map.get("pattern")
                && !patterns.contains_key(pattern)
            {
                let regex = Regex::new(pattern).map_err(|error| error.to_string())?;
                patterns.insert(pattern.clone(), regex);
            }
            map.values()
                .try_for_each(|child| collect_patterns(child, patterns))
        }
        Value::Array(items) => items
            .iter()
            .try_for_each(|child| collect_patterns(child, patterns)),
        _ => Ok(()),
    }
}

impl Registry {
    /// Build the registry from the embedded schemas.
    pub fn load() -> Result<Self, String> {
        let mut documents = BTreeMap::new();
        let mut patterns = BTreeMap::new();
        for (name, text) in SCHEMA_FILES {
            let document: Value =
                serde_json::from_str(text).map_err(|error| format!("{name}: {error}"))?;
            collect_patterns(&document, &mut patterns)
                .map_err(|error| format!("{name}: {error}"))?;
            let id = document
                .get("$id")
                .and_then(Value::as_str)
                .ok_or_else(|| format!("{name} has no $id"))?
                .to_owned();
            documents.insert(id, document);
        }
        Ok(Self {
            documents,
            patterns,
        })
    }

    /// Whether a schema is registered for `schema_id` (`prism.stackup.a0`).
    #[must_use]
    pub fn knows(&self, schema_id: &str) -> bool {
        urn_for(schema_id).is_some_and(|urn| self.documents.contains_key(&urn))
    }

    /// The `$id`s of every registered schema.
    pub fn ids(&self) -> impl Iterator<Item = &str> {
        self.documents.keys().map(String::as_str)
    }

    /// The registered document with `$id` `urn`.
    #[must_use]
    pub fn document(&self, urn: &str) -> Option<&Value> {
        self.documents.get(urn)
    }

    /// Validate `instance` against the schema registered for `schema_id`.
    pub fn validate(&self, schema_id: &str, instance: &Value) -> Result<(), Violation> {
        let urn = urn_for(schema_id).ok_or_else(|| Violation {
            pointer: String::new(),
            message: format!("{schema_id} is not a Prism schema id"),
        })?;
        let document = self.documents.get(&urn).ok_or_else(|| Violation {
            pointer: String::new(),
            message: format!("no schema is registered for {schema_id}"),
        })?;
        let mut path = Path {
            steps: Vec::new(),
            quiet: false,
        };
        Validation { registry: self }.check(&urn, document, instance, &mut path)
    }
}

/// The process-wide registry of the embedded schemas.
pub fn registry() -> &'static Registry {
    static REGISTRY: OnceLock<Registry> = OnceLock::new();
    REGISTRY.get_or_init(|| match Registry::load() {
        Ok(registry) => registry,
        // The schemas are compiled in and checked by the tests.
        Err(error) => panic!("embedded schemas do not load: {error}"),
    })
}

/// Validate `instance` against the Prism schema `schema_id`.
pub fn validate(schema_id: &str, instance: &Value) -> Result<(), Violation> {
    registry().validate(schema_id, instance)
}

fn escape_token(token: &str) -> String {
    token.replace('~', "~0").replace('/', "~1")
}

/// One step into the instance: an object key or an array index.
#[derive(Clone, Copy)]
enum Step<'i> {
    Key(&'i str),
    Index(usize),
}

/// Where the validator is in the instance. The RFC 6901 pointer is only
/// written out when a check fails, and not at all while `quiet`: inside the
/// branches of `anyOf`/`oneOf` and under `not`, where a failure is an answer,
/// not a report.
struct Path<'i> {
    steps: Vec<Step<'i>>,
    quiet: bool,
}

fn pointer(path: &[Step<'_>]) -> String {
    let mut out = String::new();
    for step in path {
        out.push('/');
        match step {
            Step::Key(key) if key.contains(['~', '/']) => out.push_str(&escape_token(key)),
            Step::Key(key) => out.push_str(key),
            Step::Index(index) => out.push_str(&index.to_string()),
        }
    }
    out
}

fn fail(path: &Path<'_>, message: impl FnOnce() -> String) -> Result<(), Violation> {
    if path.quiet {
        return Err(Violation {
            pointer: String::new(),
            message: String::new(),
        });
    }
    let pointer = pointer(&path.steps);
    let message = message();
    Err(Violation {
        message: if pointer.is_empty() {
            message
        } else {
            format!("{pointer}: {message}")
        },
        pointer,
    })
}

fn type_matches(name: &str, instance: &Value) -> bool {
    match name {
        "string" => instance.is_string(),
        "object" => instance.is_object(),
        "array" => instance.is_array(),
        "boolean" => instance.is_boolean(),
        "null" => instance.is_null(),
        "number" => instance.is_number(),
        "integer" => is_integer(instance),
        _ => false,
    }
}

fn is_integer(instance: &Value) -> bool {
    let Value::Number(number) = instance else {
        return false;
    };
    let whole = |value: f64| value.is_finite() && value.fract() == 0.0;
    number.is_i64() || number.is_u64() || number.as_f64().is_some_and(whole)
}

fn json_equal(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(x, y)| json_equal(x, y))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .all(|(key, value)| b.get(key).is_some_and(|other| json_equal(value, other)))
        }
        _ => left == right,
    }
}

/// `{"not": {}}`: the schema that allows nothing.
fn allows_nothing(schema: &Value) -> bool {
    schema.as_object().is_some_and(|keywords| {
        keywords.len() == 1
            && keywords
                .get("not")
                .and_then(Value::as_object)
                .is_some_and(serde_json::Map::is_empty)
    })
}

struct Validation<'r> {
    registry: &'r Registry,
}

impl<'r> Validation<'r> {
    fn resolve(&self, doc: &str, reference: &str) -> Option<(&'r str, &'r Value)> {
        let (target, fragment) = match reference.split_once('#') {
            Some((target, fragment)) => (target, fragment),
            None => (reference, ""),
        };
        let urn = if target.is_empty() { doc } else { target };
        let (urn, mut node) = self.registry.documents.get_key_value(urn)?;
        for token in fragment.split('/').filter(|token| !token.is_empty()) {
            node = if token.contains('~') {
                node.get(token.replace("~1", "/").replace("~0", "~"))?
            } else {
                node.get(token)?
            };
        }
        Some((urn.as_str(), node))
    }

    fn check<'i>(
        &self,
        doc: &str,
        schema: &Value,
        instance: &'i Value,
        path: &mut Path<'i>,
    ) -> Result<(), Violation> {
        let Value::Object(keywords) = schema else {
            return match schema {
                Value::Bool(false) => fail(path, || "no value is allowed here".to_owned()),
                _ => Ok(()),
            };
        };
        for (keyword, value) in keywords {
            if !ANNOTATIONS.contains(&keyword.as_str()) {
                self.keyword(doc, keyword, value, keywords, instance, path)?;
            }
        }
        Ok(())
    }

    fn keyword<'i>(
        &self,
        doc: &str,
        keyword: &str,
        value: &Value,
        siblings: &serde_json::Map<String, Value>,
        instance: &'i Value,
        path: &mut Path<'i>,
    ) -> Result<(), Violation> {
        match keyword {
            "$ref" => self.reference(doc, value, instance, path),
            "properties" | "required" | "unevaluatedProperties" => {
                self.object(doc, keyword, value, siblings, instance, path)
            }
            "items" => self.items(doc, value, instance, path),
            "pattern" | "minLength" | "maxLength" => self.string(keyword, value, instance, path),
            "anyOf" | "oneOf" => self.combination(doc, keyword, value, instance, path),
            "not" => self.negation(doc, value, instance, path),
            other => assertion(other, value, instance, path),
        }
    }

    fn negation<'i>(
        &self,
        doc: &str,
        value: &Value,
        instance: &'i Value,
        path: &mut Path<'i>,
    ) -> Result<(), Violation> {
        let outer = std::mem::replace(&mut path.quiet, true);
        let matched = self.check(doc, value, instance, path).is_ok();
        path.quiet = outer;
        if matched {
            fail(path, || "matches a schema it must not match".to_owned())
        } else {
            Ok(())
        }
    }

    fn reference<'i>(
        &self,
        doc: &str,
        value: &Value,
        instance: &'i Value,
        path: &mut Path<'i>,
    ) -> Result<(), Violation> {
        let reference = value.as_str().unwrap_or_default();
        let Some((target_doc, target)) = self.resolve(doc, reference) else {
            return Err(Violation {
                pointer: pointer(&path.steps),
                message: format!("unresolvable $ref {reference}"),
            });
        };
        self.check(target_doc, target, instance, path)
    }

    fn object<'i>(
        &self,
        doc: &str,
        keyword: &str,
        value: &Value,
        siblings: &serde_json::Map<String, Value>,
        instance: &'i Value,
        path: &mut Path<'i>,
    ) -> Result<(), Violation> {
        let Value::Object(fields) = instance else {
            return Ok(());
        };
        match keyword {
            "required" => {
                for name in value
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                {
                    if !fields.contains_key(name) {
                        return fail(path, || format!("missing required property {name}"));
                    }
                }
                Ok(())
            }
            "properties" => {
                let Value::Object(properties) = value else {
                    return Ok(());
                };
                for (name, child) in fields {
                    if let Some(schema) = properties.get(name) {
                        self.child(doc, schema, child, path, Step::Key(name))?;
                    }
                }
                Ok(())
            }
            _ => {
                let declared = siblings.get("properties").and_then(Value::as_object);
                let nothing = allows_nothing(value);
                for (name, child) in fields {
                    if declared.is_none_or(|properties| !properties.contains_key(name)) {
                        if nothing {
                            path.steps.push(Step::Key(name));
                            let result = fail(path, || format!("property {name} is not allowed"));
                            path.steps.pop();
                            return result;
                        }
                        self.child(doc, value, child, path, Step::Key(name))?;
                    }
                }
                Ok(())
            }
        }
    }

    fn child<'i>(
        &self,
        doc: &str,
        schema: &Value,
        instance: &'i Value,
        path: &mut Path<'i>,
        step: Step<'i>,
    ) -> Result<(), Violation> {
        path.steps.push(step);
        let result = self.check(doc, schema, instance, path);
        path.steps.pop();
        result
    }

    fn items<'i>(
        &self,
        doc: &str,
        value: &Value,
        instance: &'i Value,
        path: &mut Path<'i>,
    ) -> Result<(), Violation> {
        let Value::Array(items) = instance else {
            return Ok(());
        };
        for (index, item) in items.iter().enumerate() {
            self.child(doc, value, item, path, Step::Index(index))?;
        }
        Ok(())
    }

    fn string(
        &self,
        keyword: &str,
        value: &Value,
        instance: &Value,
        path: &Path<'_>,
    ) -> Result<(), Violation> {
        let Value::String(text) = instance else {
            return Ok(());
        };
        if keyword == "minLength" || keyword == "maxLength" {
            let bound = value.as_u64().unwrap_or(0);
            let length = u64::try_from(text.chars().count()).unwrap_or(u64::MAX);
            if keyword == "minLength" && length < bound {
                return fail(path, || format!("is shorter than {bound} characters"));
            }
            if keyword == "maxLength" && length > bound {
                return fail(path, || format!("is longer than {bound} characters"));
            }
            return Ok(());
        }
        let pattern = value.as_str().unwrap_or_default();
        match self.registry.patterns.get(pattern) {
            Some(regex) if regex.is_match(text) => Ok(()),
            Some(_) => fail(path, || format!("does not match the pattern {pattern}")),
            None => fail(path, || format!("unknown pattern {pattern}")),
        }
    }

    fn combination<'i>(
        &self,
        doc: &str,
        keyword: &str,
        value: &Value,
        instance: &'i Value,
        path: &mut Path<'i>,
    ) -> Result<(), Violation> {
        let branches = value.as_array().map(Vec::as_slice).unwrap_or_default();
        let mut matched = 0usize;
        let mut first_error = None;
        // A lone branch's own error is the one reported, so only a choice
        // between branches runs quietly.
        let outer = path.quiet;
        path.quiet |= branches.len() > 1;
        for branch in branches {
            match self.check(doc, branch, instance, path) {
                Ok(()) => matched += 1,
                Err(error) => {
                    first_error.get_or_insert(error);
                }
            }
        }
        path.quiet = outer;
        match (keyword, matched) {
            ("anyOf", 0) | ("oneOf", 0) => match first_error {
                Some(error) if branches.len() == 1 => Err(error),
                _ => fail(path, || format!("matches none of the {keyword} branches")),
            },
            ("oneOf", 1) | ("anyOf", _) => Ok(()),
            _ => fail(path, || {
                format!("matches {matched} oneOf branches, not one")
            }),
        }
    }
}

/// The keywords that read only the instance.
fn assertion(
    keyword: &str,
    value: &Value,
    instance: &Value,
    path: &Path<'_>,
) -> Result<(), Violation> {
    match keyword {
        "type" => check_type(value, instance, path),
        "const" if !json_equal(value, instance) => {
            fail(path, || format!("must be the constant {value}"))
        }
        "const" => Ok(()),
        "enum" => check_enum(value, instance, path),
        "minItems" | "maxItems" | "uniqueItems" => check_array_size(keyword, value, instance, path),
        "minimum" | "maximum" | "exclusiveMinimum" | "exclusiveMaximum" => {
            check_bound(keyword, value, instance, path)
        }
        other => fail(path, || {
            format!("the validator does not know keyword {other}")
        }),
    }
}

fn check_type(value: &Value, instance: &Value, path: &Path<'_>) -> Result<(), Violation> {
    let accepted = match value {
        Value::String(name) => type_matches(name, instance),
        Value::Array(names) => names
            .iter()
            .filter_map(Value::as_str)
            .any(|name| type_matches(name, instance)),
        _ => true,
    };
    if accepted {
        Ok(())
    } else {
        fail(path, || format!("must be of type {value}"))
    }
}

fn check_enum(value: &Value, instance: &Value, path: &Path<'_>) -> Result<(), Violation> {
    let allowed = value.as_array().map(Vec::as_slice).unwrap_or_default();
    if allowed
        .iter()
        .any(|candidate| json_equal(candidate, instance))
    {
        Ok(())
    } else {
        fail(path, || format!("must be one of {value}"))
    }
}

fn check_array_size(
    keyword: &str,
    value: &Value,
    instance: &Value,
    path: &Path<'_>,
) -> Result<(), Violation> {
    let Value::Array(items) = instance else {
        return Ok(());
    };
    let count = u64::try_from(items.len()).unwrap_or(u64::MAX);
    match keyword {
        "minItems" if count < value.as_u64().unwrap_or(0) => {
            fail(path, || format!("has fewer than {value} items"))
        }
        "maxItems" if count > value.as_u64().unwrap_or(u64::MAX) => {
            fail(path, || format!("has more than {value} items"))
        }
        "uniqueItems" if value.as_bool() == Some(true) => {
            for (index, item) in items.iter().enumerate() {
                if items[..index]
                    .iter()
                    .any(|earlier| json_equal(earlier, item))
                {
                    return fail(path, || format!("item {index} repeats an earlier item"));
                }
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

fn check_bound(
    keyword: &str,
    value: &Value,
    instance: &Value,
    path: &Path<'_>,
) -> Result<(), Violation> {
    let (Some(number), Some(bound)) = (instance.as_f64(), value.as_f64()) else {
        return Ok(());
    };
    let inside = match keyword {
        "minimum" => number >= bound,
        "exclusiveMinimum" => number > bound,
        "exclusiveMaximum" => number < bound,
        _ => number <= bound,
    };
    if inside {
        Ok(())
    } else {
        fail(path, || format!("must be {keyword} {value}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn keywords_of(node: &Value, inside_map: bool, found: &mut std::collections::BTreeSet<String>) {
        match node {
            Value::Object(map) => {
                for (key, child) in map {
                    if !inside_map {
                        found.insert(key.clone());
                    }
                    keywords_of(child, matches!(key.as_str(), "properties" | "$defs"), found);
                }
            }
            Value::Array(items) => items
                .iter()
                .for_each(|child| keywords_of(child, false, found)),
            _ => {}
        }
    }

    #[test]
    fn every_keyword_the_schemas_use_is_implemented() {
        let registry = Registry::load().unwrap();
        let mut found = std::collections::BTreeSet::new();
        for id in registry.ids() {
            keywords_of(registry.document(id).unwrap(), false, &mut found);
        }
        for keyword in found {
            assert!(
                KEYWORDS.contains(&keyword.as_str()) || ANNOTATIONS.contains(&keyword.as_str()),
                "unimplemented keyword {keyword}"
            );
        }
    }

    #[test]
    fn exclusive_bounds_refuse_the_bound_itself() {
        let schema = json!(0);
        let at = Path {
            steps: vec![Step::Key("x")],
            quiet: false,
        };
        assert!(check_bound("exclusiveMinimum", &schema, &json!(0.5), &at).is_ok());
        assert!(check_bound("exclusiveMinimum", &schema, &json!(0), &at).is_err());
        assert!(check_bound("minimum", &schema, &json!(0), &at).is_ok());
        assert!(check_bound("exclusiveMaximum", &schema, &json!(0), &at).is_err());
        assert!(check_bound("exclusiveMaximum", &schema, &json!(-1), &at).is_ok());
        assert_eq!(
            check_bound("minimum", &schema, &json!(-1), &at)
                .unwrap_err()
                .message,
            "/x: must be minimum 0"
        );
    }

    /// A failed branch of a choice is an answer, not a report: it builds no
    /// message, and the reported violation is the same as before.
    #[test]
    fn choices_report_as_before() {
        let registry = Registry {
            documents: BTreeMap::from([(
                "urn:test".to_owned(),
                json!({
                    "properties": {
                        "pick": { "oneOf": [{ "const": 1 }, { "type": "string", "pattern": "^a" }] },
                        "lone": { "anyOf": [{ "type": "integer" }] },
                        "never": { "not": { "type": "integer" } }
                    }
                }),
            )]),
            patterns: BTreeMap::from([("^a".to_owned(), Regex::new("^a").unwrap())]),
        };
        let check = |instance: Value| {
            let mut path = Path {
                steps: Vec::new(),
                quiet: false,
            };
            Validation {
                registry: &registry,
            }
            .check(
                "urn:test",
                &registry.documents["urn:test"],
                &instance,
                &mut path,
            )
        };
        assert!(check(json!({ "pick": "abc", "lone": 2, "never": "x" })).is_ok());
        let error = check(json!({ "pick": "zzz" })).unwrap_err();
        assert_eq!(error.pointer, "/pick");
        assert_eq!(error.message, "/pick: matches none of the oneOf branches");
        let error = check(json!({ "lone": "x" })).unwrap_err();
        assert_eq!(error.message, "/lone: must be of type \"integer\"");
        let error = check(json!({ "never": 3 })).unwrap_err();
        assert_eq!(error.message, "/never: matches a schema it must not match");
    }

    #[test]
    fn the_embedded_schemas_are_the_committed_ones() {
        let committed = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../contracts/generated/schema"
        );
        for (name, text) in SCHEMA_FILES {
            let path = std::path::Path::new(committed).join(name);
            let on_disk = std::fs::read_to_string(&path).unwrap();
            assert_eq!(
                on_disk, text,
                "{name} differs from contracts/generated/schema"
            );
        }
        let prism_roots = std::fs::read_dir(committed)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| {
                std::fs::read_to_string(entry.path())
                    .is_ok_and(|text| text.contains("\"$id\": \"urn:prism:schema:"))
            })
            .count();
        assert_eq!(
            prism_roots,
            SCHEMA_FILES.len(),
            "a Prism root is not embedded"
        );
    }

    #[test]
    fn every_example_validates() {
        let examples = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../contracts/prism/examples"
        );
        let mut checked = 0;
        for entry in std::fs::read_dir(examples).unwrap() {
            let path = entry.unwrap().path();
            let value: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
            let schema = value["schema"].as_str().unwrap().to_owned();
            validate(&schema, &value)
                .unwrap_or_else(|error| panic!("{}: {error:?}", path.display()));
            checked += 1;
        }
        assert_eq!(checked, 33);
    }

    #[test]
    fn violations_carry_a_pointer() {
        let mut value: Value = serde_json::from_str(include_str!(
            "../../../../contracts/prism/examples/CliErrorA0.example.json"
        ))
        .unwrap();
        value["location"]["path"] = json!("../x");
        let error = validate("prism.cli.error.a0", &value).unwrap_err();
        assert_eq!(error.pointer, "/location/path");
        value["location"]["path"] = json!("sources/x");
        value["extra"] = json!(1);
        assert_eq!(
            validate("prism.cli.error.a0", &value).unwrap_err().pointer,
            "/extra"
        );
        assert!(validate("prism.nope.a0", &value).is_err());
        assert!(
            registry().knows("prism.stackup.a0") && !registry().knows("kicad_monkey.design.a0")
        );
    }
}
