//! Power net names, a port of `_power_net_names`
//! (interface_extractor.py:324-336).
//!
//! Every placed symbol in the whole hierarchy whose library symbol carries the
//! `power` flag contributes its `Value` property, when non-empty. The fork's
//! occurrences are kicad_monkey's `walk_symbols` order, and each occurrence's
//! definition owns that symbol's library symbols, so
//! `library_symbol_for_placement` is `sheet.get_lib_symbol_for_symbol`.

use prism_kicad_core::SchematicBundleIndex;
use std::collections::BTreeSet;

/// `_power_net_names(design)`: the `Value`s of placed power symbols.
pub(super) fn power_net_names(index: &SchematicBundleIndex) -> BTreeSet<String> {
    let mut names = BTreeSet::new();
    for occurrence in index.occurrences() {
        let Some(definition) = index.definition(&occurrence.source_path) else {
            continue;
        };
        for symbol in &definition.symbols {
            let Some(library) = definition.library_symbol_for_placement(symbol) else {
                continue;
            };
            if !library.power {
                continue;
            }
            let value = symbol
                .properties
                .iter()
                .find(|property| property.key == "Value")
                .map_or("", |property| property.value.as_str());
            if !value.is_empty() {
                names.insert(value.to_owned());
            }
        }
    }
    names
}
