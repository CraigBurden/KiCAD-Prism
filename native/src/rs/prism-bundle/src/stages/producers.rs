//! The parse stage's projection producers and how they run: all at once,
//! with `design.json` built beside them (amendment C2r §2 item 8).
//!
//! The semantic index stays typed (`SemanticIndexA2`) until every producer
//! has finished: its `designKey` covers the whole read set, so stage parse
//! sets the field and serializes the member once, after the run
//! (bundle-format.md §2.3).

use super::design;
use super::parse::Design;
use crate::manifest::{DESIGN_PATH, PROJECTIONS};
use prism_kicad_contracts::generated::prism_board_objects_a0::BoardObjectsA0;
use prism_kicad_contracts::generated::prism_semantic_index_a2::SemanticIndexA2;
use prism_projections::Produced;
use serde_json::Value;

/// One producer's output.
pub(super) enum ProjectionResult {
    /// A document already kept as JSON, as the other six producers build it.
    Json {
        /// The document.
        value: Value,
        /// Its recorded warnings.
        warnings: Vec<prism_projections::ProducerWarning>,
    },
    /// The semantic index, still typed.
    SemanticIndex {
        /// The document; stage parse sets `designKey` before serializing it.
        document: Box<SemanticIndexA2>,
        /// Its recorded warnings.
        warnings: Vec<prism_projections::ProducerWarning>,
    },
    /// The board objects, still typed: the largest member, serialized once
    /// for a bundle and not at all for an in-memory parse.
    BoardObjects {
        /// The document.
        document: Box<BoardObjectsA0>,
        /// Its recorded warnings.
        warnings: Vec<prism_projections::ProducerWarning>,
    },
}

impl ProjectionResult {
    /// The schema id the document declares, the document as stage parse keeps
    /// or serializes it, and its warnings.
    pub(super) fn into_parts(
        self,
    ) -> (
        Option<String>,
        super::Document,
        Vec<prism_projections::ProducerWarning>,
    ) {
        match self {
            Self::Json { value, warnings } => {
                let schema = value
                    .get("schema")
                    .and_then(Value::as_str)
                    .map(str::to_owned);
                (schema, super::Document::Json(value), warnings)
            }
            Self::SemanticIndex { document, warnings } => (
                Some(document.schema.clone()),
                super::Document::SemanticIndex(document),
                warnings,
            ),
            Self::BoardObjects { document, warnings } => (
                Some(document.schema.clone()),
                super::Document::BoardObjects(document),
                warnings,
            ),
        }
    }
}

type Producer = fn(
    &prism_projections::ProjectionInput<'_>,
) -> Result<(Value, Vec<prism_projections::ProducerWarning>), String>;

type SemanticProducer = fn(
    &prism_projections::ProjectionInput<'_>,
)
    -> Result<Produced<SemanticIndexA2>, prism_projections::ProjectionError>;

type BoardObjectsProducer =
    fn(
        &prism_projections::ProjectionInput<'_>,
    ) -> Result<Produced<BoardObjectsA0>, prism_projections::ProjectionError>;

#[derive(Clone, Copy)]
enum ProducerKind {
    Json(Producer),
    Semantic(SemanticProducer),
    BoardObjects(BoardObjectsProducer),
}

fn produced<T: serde::Serialize>(
    result: Result<Produced<T>, prism_projections::ProjectionError>,
) -> Result<(Value, Vec<prism_projections::ProducerWarning>), String> {
    let produced = result.map_err(|error| error.message)?;
    let value = serde_json::to_value(&produced.document).map_err(|error| error.to_string())?;
    Ok((value, produced.warnings))
}

fn semantic(
    result: Result<Produced<SemanticIndexA2>, prism_projections::ProjectionError>,
) -> Result<ProjectionResult, String> {
    let produced = result.map_err(|error| error.message)?;
    Ok(ProjectionResult::SemanticIndex {
        document: Box::new(produced.document),
        warnings: produced.warnings,
    })
}

fn board_objects(
    input: &prism_projections::ProjectionInput<'_>,
) -> Result<Produced<BoardObjectsA0>, prism_projections::ProjectionError> {
    prism_projections::board_objects::produce(input)
}

fn occurrences(
    input: &prism_projections::ProjectionInput<'_>,
) -> Result<(Value, Vec<prism_projections::ProducerWarning>), String> {
    produced(prism_projections::occurrences::produce(input))
}

fn placements(
    input: &prism_projections::ProjectionInput<'_>,
) -> Result<(Value, Vec<prism_projections::ProducerWarning>), String> {
    produced(prism_projections::placements::produce(input))
}

fn project(
    input: &prism_projections::ProjectionInput<'_>,
) -> Result<(Value, Vec<prism_projections::ProducerWarning>), String> {
    produced(prism_projections::project::produce(input))
}

fn route_metrics(
    input: &prism_projections::ProjectionInput<'_>,
) -> Result<(Value, Vec<prism_projections::ProducerWarning>), String> {
    produced(prism_projections::route_metrics::produce(input))
}

fn semantic_index(
    input: &prism_projections::ProjectionInput<'_>,
) -> Result<Produced<SemanticIndexA2>, prism_projections::ProjectionError> {
    prism_projections::semantic_index::produce(input)
}

fn stackup(
    input: &prism_projections::ProjectionInput<'_>,
) -> Result<(Value, Vec<prism_projections::ProducerWarning>), String> {
    produced(prism_projections::stackup::produce(input))
}

fn system_interface(
    input: &prism_projections::ProjectionInput<'_>,
) -> Result<(Value, Vec<prism_projections::ProducerWarning>), String> {
    produced(prism_projections::system_interface::produce(input))
}

const PRODUCERS: [ProducerKind; 8] = [
    ProducerKind::BoardObjects(board_objects),
    ProducerKind::Json(occurrences),
    ProducerKind::Json(placements),
    ProducerKind::Json(project),
    ProducerKind::Json(route_metrics),
    ProducerKind::Semantic(semantic_index),
    ProducerKind::Json(stackup),
    ProducerKind::Json(system_interface),
];

impl ProducerKind {
    fn run(
        self,
        input: &prism_projections::ProjectionInput<'_>,
    ) -> Result<ProjectionResult, String> {
        match self {
            Self::Json(producer) => {
                producer(input).map(|(value, warnings)| ProjectionResult::Json { value, warnings })
            }
            Self::Semantic(producer) => semantic(producer(input)),
            Self::BoardObjects(producer) => {
                let produced = producer(input).map_err(|error| error.message)?;
                Ok(ProjectionResult::BoardObjects {
                    document: Box::new(produced.document),
                    warnings: produced.warnings,
                })
            }
        }
    }
}

/// What [`PRODUCERS`] and `design.json` give: `design.json` (absent without
/// a schematic model, or when the semantic index is not wanted) and each
/// producer's result, in [`PROJECTIONS`] order (`None` for a producer that is
/// not wanted).
pub(super) type ProducerResults = (
    Option<Result<Value, String>>,
    Vec<Option<Result<ProjectionResult, String>>>,
);

/// Run the producers at once, and build `design.json` beside them. Only the
/// semantic index reads `design.json`, so it starts once that exists. The
/// producers only read their input; their results come back in
/// [`PROJECTIONS`] order, so nothing recorded depends on which finished first.
pub(super) fn run(
    input: &prism_projections::ProjectionInput<'_>,
    design_inputs: Option<(
        &prism_kicad_core::SchematicBundleIndex,
        &prism_kicad_core::KiCadDesignFacts<'_>,
    )>,
    design: &Design,
    design_board: Option<(&str, &prism_kicad_core::PcbView<'_>)>,
    wanted: &(dyn Fn(&str) -> bool + Sync),
) -> ProducerResults {
    std::thread::scope(|scope| {
        let joined = |handle: std::thread::ScopedJoinHandle<'_, _>| {
            handle
                .join()
                .unwrap_or_else(|panic| std::panic::resume_unwind(panic))
        };
        // Only the semantic index reads `design.json`; it starts once
        // `design.json` exists, the others at once.
        let semantic = PROJECTIONS
            .iter()
            .position(|(path, _)| *path == "projections/semantic-index.json");
        let semantic = semantic.filter(|index| wanted(PROJECTIONS[*index].0));
        let handles: Vec<_> = PRODUCERS
            .into_iter()
            .zip(PROJECTIONS)
            .enumerate()
            .map(|(index, (producer, (path, _)))| {
                if Some(index) == semantic || !wanted(path) {
                    None
                } else {
                    Some(scope.spawn(move || producer.run(input)))
                }
            })
            .collect();
        // A run that does not write `design.json` (`compare`) builds only the
        // `components` and `nets` the semantic index reads; its failure is
        // still reported as `design.json`'s.
        let full = wanted(DESIGN_PATH);
        let design_json = design_inputs
            .filter(|_| semantic.is_some())
            .map(|(index, facts)| {
                if full {
                    design::design_json(index, facts, &design.project, &design.sheets, design_board)
                } else {
                    design::semantic_inputs(index, facts)
                }
            });
        let with_design = prism_projections::ProjectionInput {
            design: design_json.as_ref().and_then(|built| built.as_ref().ok()),
            ..*input
        };
        let semantic_result = semantic.map(|index| PRODUCERS[index].run(&with_design));
        let mut semantic_result = semantic_result;
        let results = handles
            .into_iter()
            .enumerate()
            .map(|(index, handle)| match handle {
                Some(handle) => Some(joined(handle)),
                None if Some(index) == semantic => semantic_result.take(),
                None => None,
            })
            .collect();
        let design_json = design_json.filter(|built| full || built.is_err());
        (design_json, results)
    })
}
