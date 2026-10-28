//! Whether a pin is a power port, and of which kind.

use crate::SchematicDriverPriority;

pub(super) struct PinPowerSemantics {
    pub(super) priority: SchematicDriverPriority,
    pub(super) power_value: String,
    pub(super) is_power: bool,
    pub(super) implicit: bool,
}

pub(super) fn classify_pin_power(
    terminal: &crate::SchematicSymbolTerminal,
    symbol: &crate::SchematicEffectiveSymbol,
    library: Option<&crate::SchematicLibrarySymbol>,
) -> PinPowerSemantics {
    let parent_is_power = symbol.lib_id != "power:PWR_FLAG"
        && (symbol.lib_id.starts_with("power:") || library.is_some_and(|value| value.power));
    if implicit_hidden_power(terminal, parent_is_power) {
        return PinPowerSemantics {
            priority: SchematicDriverPriority::GlobalPowerPin,
            power_value: terminal.pin_name.clone(),
            is_power: true,
            implicit: true,
        };
    }
    let is_power = parent_is_power && terminal.electrical_type == "power_in";
    let priority =
        if is_power && library.is_some_and(|value| value.power_kind.as_deref() == Some("local")) {
            SchematicDriverPriority::LocalPowerPin
        } else if is_power {
            SchematicDriverPriority::GlobalPowerPin
        } else {
            SchematicDriverPriority::Pin
        };
    PinPowerSemantics {
        priority,
        power_value: if is_power {
            symbol.value.clone()
        } else {
            String::new()
        },
        is_power,
        implicit: false,
    }
}

fn implicit_hidden_power(terminal: &crate::SchematicSymbolTerminal, parent_is_power: bool) -> bool {
    !parent_is_power
        && terminal.electrical_type == "power_in"
        && terminal.hidden
        && !terminal.pin_name.is_empty()
        && terminal.pin_name != "~"
        && terminal.pin_name != terminal.pin_number
}
