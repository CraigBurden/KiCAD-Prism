//! Field-delta builders shared by the net and structure changes, and the
//! change's field map (`RecordDesignCompareFieldDelta`).

use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;
use std::collections::BTreeMap;

/// The change's `fields`, keyed by display name.
pub(super) type Fields = BTreeMap<String, dc::DesignCompareFieldDelta>;

/// A text delta on both sides.
pub(super) fn text_delta(old: &str, new: &str) -> dc::DesignCompareFieldDelta {
    let value = |text: &str| Some(dc::BoardObjectsReviewValue::Variant0(text.to_owned()));
    dc::DesignCompareFieldDelta {
        old: value(old),
        new: value(new),
    }
}

/// A text delta whose sides may be absent.
pub(super) fn optional_text_delta(
    old: Option<&str>,
    new: Option<&str>,
) -> dc::DesignCompareFieldDelta {
    let value = |text: Option<&str>| {
        text.map(|text| dc::BoardObjectsReviewValue::Variant0(text.to_owned()))
    };
    dc::DesignCompareFieldDelta {
        old: value(old),
        new: value(new),
    }
}

/// A count delta on both sides.
pub(super) fn count_delta(old: u64, new: u64) -> dc::DesignCompareFieldDelta {
    let value = |count: u64| Some(dc::BoardObjectsReviewValue::Variant1(count as f64));
    dc::DesignCompareFieldDelta {
        old: value(old),
        new: value(new),
    }
}
