//! Per-view memoization for the decoded board families more than one consumer
//! reads.
//!
//! [`PcbView`] indexes exact source spans once, but every decode re-tokenizes
//! its form. The bundle's parse-stage producers run in parallel over one
//! shared `&PcbView`, and several of them read the same families (footprints,
//! footprint properties, pads, routing, zones and graphics). Each cached
//! family is decoded on first use and every later reader borrows the stored
//! values, errors included. A family that only one consumer reads stays lazy
//! in its own module.
//!
//! `OnceLock` keeps the cache thread-safe: [`PcbView`] stays `Sync`, and one
//! thread initializes while the others wait.

use super::*;
use crate::pcb::footprints::footprint_property_from_span;
use std::sync::OnceLock;

/// The decoded families shared across consumers of one [`PcbView`].
#[derive(Clone, Debug, Default)]
pub(super) struct PcbDecoded {
    footprints: OnceLock<Vec<Result<PcbFootprint, Error>>>,
    footprint_properties: OnceLock<Vec<Result<PcbFootprintProperty, Error>>>,
    pads: OnceLock<Vec<Result<PcbPad, Error>>>,
    segments: OnceLock<Vec<Result<PcbSegment, Error>>>,
    vias: OnceLock<Vec<Result<PcbVia, Error>>>,
    zones: OnceLock<Vec<Result<PcbZone, Error>>>,
    arcs: OnceLock<Vec<Result<PcbRoutingArc, Error>>>,
    graphics: OnceLock<Vec<Result<PcbGraphic, Error>>>,
    footprint_graphics: OnceLock<Vec<Result<PcbFootprintGraphic, Error>>>,
}

impl PcbView<'_> {
    pub fn layers(&self) -> impl Iterator<Item = Result<PcbLayer, Error>> + '_ {
        self.layer_forms
            .iter()
            .filter(move |_| self.selection.contains(PcbFamily::Layers))
            .map(|span| layer_from_span(self.source, span))
    }

    pub fn nets(&self) -> impl Iterator<Item = Result<PcbNet, Error>> + '_ {
        self.nets
            .iter()
            .filter(move |_| self.selection.contains(PcbFamily::Nets))
            .map(|span| net_from_span(self.source, span))
    }

    pub fn properties(&self) -> impl Iterator<Item = Result<PcbProperty, Error>> + '_ {
        self.properties
            .iter()
            .filter(move |_| self.selection.contains(PcbFamily::Properties))
            .map(|span| property_from_span(self.source, span))
    }

    /// Decoded footprints in board order, decoded once per view.
    pub fn decoded_footprints(&self) -> &[Result<PcbFootprint, Error>] {
        if !self.selection.contains(PcbFamily::Footprints) {
            return &[];
        }
        self.decoded.footprints.get_or_init(|| {
            self.footprints
                .iter()
                .map(|indexed| footprint_from_span(self.source, indexed, self.limits))
                .collect()
        })
    }

    /// Owned iterator over [`PcbView::decoded_footprints`].
    pub fn footprints(&self) -> impl Iterator<Item = Result<PcbFootprint, Error>> + '_ {
        self.decoded_footprints().iter().cloned()
    }

    /// Decoded footprint properties in board order, decoded once per view.
    pub fn decoded_footprint_properties(&self) -> &[Result<PcbFootprintProperty, Error>] {
        if !self.selection.contains(PcbFamily::FootprintProperties) {
            return &[];
        }
        self.decoded.footprint_properties.get_or_init(|| {
            self.footprint_properties
                .iter()
                .map(|indexed| footprint_property_from_span(self.source, indexed, self.limits))
                .collect()
        })
    }

    /// Owned iterator over [`PcbView::decoded_footprint_properties`].
    pub fn footprint_properties(
        &self,
    ) -> impl Iterator<Item = Result<PcbFootprintProperty, Error>> + '_ {
        self.decoded_footprint_properties().iter().cloned()
    }

    /// Decoded pads, their nets resolved, decoded once per view.
    pub fn decoded_pads(&self) -> &[Result<PcbPad, Error>] {
        if !self.selection.contains(PcbFamily::Pads) {
            return &[];
        }
        self.decoded.pads.get_or_init(|| {
            self.pads
                .iter()
                .map(|indexed| {
                    pads::pad_from_span(self.source, indexed, self.limits).map(|mut pad| {
                        pad.net = self.net_resolver.resolve(pad.net);
                        pad
                    })
                })
                .collect()
        })
    }

    /// Owned iterator over [`PcbView::decoded_pads`].
    pub fn pads(&self) -> impl Iterator<Item = Result<PcbPad, Error>> + '_ {
        self.decoded_pads().iter().cloned()
    }

    pub fn models(&self) -> impl Iterator<Item = Result<PcbModelReference, Error>> + '_ {
        self.models
            .iter()
            .filter(move |_| self.selection.contains(PcbFamily::Models))
            .map(|indexed| model_from_span(self.source, indexed, self.limits))
    }

    /// Decoded track segments, their nets resolved, decoded once per view.
    pub fn decoded_segments(&self) -> &[Result<PcbSegment, Error>] {
        if !self.selection.contains(PcbFamily::Segments) {
            return &[];
        }
        self.decoded.segments.get_or_init(|| {
            self.segments
                .iter()
                .map(|span| {
                    segment_from_span(self.source, span, self.limits).map(|mut segment| {
                        segment.net = self.net_resolver.resolve(segment.net);
                        segment
                    })
                })
                .collect()
        })
    }

    /// Owned iterator over [`PcbView::decoded_segments`].
    pub fn segments(&self) -> impl Iterator<Item = Result<PcbSegment, Error>> + '_ {
        self.decoded_segments().iter().cloned()
    }

    /// Decoded vias, their nets resolved, decoded once per view.
    pub fn decoded_vias(&self) -> &[Result<PcbVia, Error>] {
        if !self.selection.contains(PcbFamily::Vias) {
            return &[];
        }
        self.decoded.vias.get_or_init(|| {
            self.vias
                .iter()
                .map(|span| {
                    vias::via_from_span(self.source, span, self.limits).map(|mut via| {
                        via.net = self.net_resolver.resolve(via.net);
                        via
                    })
                })
                .collect()
        })
    }

    /// Owned iterator over [`PcbView::decoded_vias`].
    pub fn vias(&self) -> impl Iterator<Item = Result<PcbVia, Error>> + '_ {
        self.decoded_vias().iter().cloned()
    }

    /// Decoded zones, their nets resolved, decoded once per view.
    pub fn decoded_zones(&self) -> &[Result<PcbZone, Error>] {
        if !self.selection.contains(PcbFamily::Zones) {
            return &[];
        }
        self.decoded.zones.get_or_init(|| {
            self.zones
                .iter()
                .map(|span| {
                    zones::zone_from_span(self.source, span, self.limits).map(|mut zone| {
                        zone.net = self.net_resolver.resolve(zone.net);
                        zone
                    })
                })
                .collect()
        })
    }

    /// Owned iterator over [`PcbView::decoded_zones`].
    pub fn zones(&self) -> impl Iterator<Item = Result<PcbZone, Error>> + '_ {
        self.decoded_zones().iter().cloned()
    }

    /// Decoded board graphics, decoded once per view.
    pub fn decoded_graphics(&self) -> &[Result<PcbGraphic, Error>] {
        if !self.selection.contains(PcbFamily::Graphics) {
            return &[];
        }
        self.decoded.graphics.get_or_init(|| {
            self.graphics
                .iter()
                .map(|span| graphic_from_span(self.source, span, self.limits))
                .collect()
        })
    }

    /// Owned iterator over [`PcbView::decoded_graphics`].
    pub fn graphics(&self) -> impl Iterator<Item = Result<PcbGraphic, Error>> + '_ {
        self.decoded_graphics().iter().cloned()
    }

    /// Decoded routing arcs, their nets resolved, decoded once per view.
    pub fn decoded_arcs(&self) -> &[Result<PcbRoutingArc, Error>] {
        if !self.selection.contains(PcbFamily::Arcs) {
            return &[];
        }
        self.decoded.arcs.get_or_init(|| {
            self.arcs
                .iter()
                .map(|span| {
                    routing_arc_from_span(self.source, span, self.limits).map(|mut arc| {
                        arc.net = self.net_resolver.resolve(arc.net);
                        arc
                    })
                })
                .collect()
        })
    }

    /// Owned iterator over [`PcbView::decoded_arcs`].
    pub fn arcs(&self) -> impl Iterator<Item = Result<PcbRoutingArc, Error>> + '_ {
        self.decoded_arcs().iter().cloned()
    }

    pub fn dimensions(&self) -> impl Iterator<Item = Result<PcbDimension, Error>> + '_ {
        self.dimensions
            .iter()
            .filter(move |_| self.selection.contains(PcbFamily::Dimensions))
            .map(|span| dimension_from_span(self.source, span, self.limits))
    }

    pub fn groups(&self) -> impl Iterator<Item = Result<PcbGroup, Error>> + '_ {
        self.groups
            .iter()
            .filter(move |_| self.selection.contains(PcbFamily::Groups))
            .map(|span| group_from_span(self.source, span, self.limits))
    }

    pub fn generated_items(&self) -> impl Iterator<Item = Result<PcbGeneratedItem, Error>> + '_ {
        self.generated_items
            .iter()
            .filter(move |_| self.selection.contains(PcbFamily::GeneratedItems))
            .map(|span| generated_from_span(self.source, span, self.limits))
    }
}

impl PcbView<'_> {
    /// Decoded footprint graphics in board order, decoded once per view.
    pub fn decoded_footprint_graphics(&self) -> &[Result<PcbFootprintGraphic, Error>] {
        if !self.selection.contains(PcbFamily::FootprintGraphics) {
            return &[];
        }
        self.decoded.footprint_graphics.get_or_init(|| {
            self.footprint_graphics
                .iter()
                .map(|indexed| {
                    Ok(PcbFootprintGraphic {
                        footprint_index: indexed.parent_index,
                        graphic: graphic_from_span(self.source, &indexed.span, self.limits)?,
                    })
                })
                .collect()
        })
    }

    /// Owned iterator over [`PcbView::decoded_footprint_graphics`].
    pub fn footprint_graphics(
        &self,
    ) -> impl Iterator<Item = Result<PcbFootprintGraphic, Error>> + '_ {
        self.decoded_footprint_graphics().iter().cloned()
    }
}
