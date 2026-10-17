//! The parse stage's projection producers and how they run: all at once,
//! with `design.json` built beside them (amendment C2r §2 item 8).

use super::design;
use super::parse::Design;
use crate::manifest::PROJECTIONS;
use serde_json::Value;

/// Every projection: its member path, schema id and producer, serialized.
type Producer = fn(
    &prism_projections::ProjectionInput<'_>,
) -> Result<(Value, Vec<prism_projections::ProducerWarning>), String>;

fn produced<T: serde::Serialize>(
    result: Result<prism_projections::Produced<T>, prism_projections::ProjectionError>,
) -> Result<(Value, Vec<prism_projections::ProducerWarning>), String> {
    let produced = result.map_err(|error| error.message)?;
    let value = serde_json::to_value(&produced.document).map_err(|error| error.to_string())?;
    Ok((value, produced.warnings))
}

pub(super) const PRODUCERS: [Producer; 8] = [
    |input| produced(prism_projections::board_objects::produce(input)),
    |input| produced(prism_projections::occurrences::produce(input)),
    |input| produced(prism_projections::placements::produce(input)),
    |input| produced(prism_projections::project::produce(input)),
    |input| produced(prism_projections::route_metrics::produce(input)),
    |input| produced(prism_projections::semantic_index::produce(input)),
    |input| produced(prism_projections::stackup::produce(input)),
    |input| produced(prism_projections::system_interface::produce(input)),
];

/// What [`PRODUCERS`] and `design.json` give: `design.json` (absent without
/// a schematic model, or when the semantic index is not wanted) and each
/// producer's result, in [`PROJECTIONS`] order (`None` for a producer that is
/// not wanted).
pub(super) type ProducerResults = (
    Option<Result<Value, String>>,
    Vec<Option<Result<(Value, Vec<prism_projections::ProducerWarning>), String>>>,
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
            .iter()
            .zip(PROJECTIONS)
            .enumerate()
            .map(|(index, (producer, (path, _)))| {
                if Some(index) == semantic || !wanted(path) {
                    None
                } else {
                    Some(scope.spawn(|| producer(input)))
                }
            })
            .collect();
        let design_json = design_inputs
            .filter(|_| semantic.is_some())
            .map(|(index, facts)| {
                design::design_json(index, facts, &design.project, &design.sheets, design_board)
            });
        let with_design = prism_projections::ProjectionInput {
            design: design_json.as_ref().and_then(|built| built.as_ref().ok()),
            ..*input
        };
        let semantic_result = semantic.map(|index| PRODUCERS[index](&with_design));
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
        (design_json, results)
    })
}
