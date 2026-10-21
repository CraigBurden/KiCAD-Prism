//! Connector interface control documents (ICDs) from one design bundle.
//!
//! The `connector-icd` binary reads a `.prism` bundle, selects the footprints
//! whose reference starts with a connector prefix (or the references it is
//! given), and writes one A3 landscape SVG per connector plus an index page
//! and a PDF of that page.
//!
//! Everything a sheet prints comes from members the bundle already carries:
//! the parsed board (`refilled/` or `sources/`), `projections/semantic-index.json`
//! for fields, terminals and net classes, `projections/placements.json` for
//! sides, positions and courtyards, and the STEP models under `sources/` or a
//! `--model-dir`, projected through Geometer. Nothing here reads the clock or
//! the network, so the same bundle gives the same SVG and HTML bytes.

mod board;
mod footprint;
mod hlr;
mod page;
mod pins;
mod pose;
mod sheet;

pub use board::{Connector, Icd, LoadOptions, ModelState, PinRow, Side, load, pages};
pub use hlr::{Cache, Session, ViewRole};
pub use page::{RenderedSheet, index_page};
pub use sheet::{ROWS_CONTINUATION, ROWS_FIRST, SheetContext, render_sheet};
