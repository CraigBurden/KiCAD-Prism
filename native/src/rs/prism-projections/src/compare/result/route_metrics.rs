//! Route metrics (`/routeMetrics`): each revision's routed nets
//! (`field-maps/route-metrics.md` "Design Comparison's derived values"), with
//! the via barrel length from the stackup member.
//!
//! Skeleton: C2r step 4 fills it in.

use super::Revision;
use prism_kicad_contracts::generated::prism_design_compare_result_a0 as dc;

pub(super) fn build(_base: &Revision, _head: &Revision) -> dc::DesignCompareRouteMetrics {
    dc::DesignCompareRouteMetrics {
        base: dc::RecordDesignCompareRouteMetric(Default::default()),
        head: dc::RecordDesignCompareRouteMetric(Default::default()),
    }
}
