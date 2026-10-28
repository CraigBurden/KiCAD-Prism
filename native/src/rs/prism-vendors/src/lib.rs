//! Vendor BOM and placement outputs over a design bundle (ADR amendment C3
//! §3.3, cli-spec.md §5.8).
//!
//! One shared core normalises the bundle's assembly view into components and
//! placements; each vendor module maps that to its own files. The registry is
//! fixed by the binary, so Release Studio's vendor selection can read it from
//! `prism-kicad vendor list`.
//!
//! The rules are ported from Cruncher 2026.9.7 (MIT): the design adapter is
//! `kicad_manufacturing_design.py`, the normalisation and grouping are
//! `bom_pnp_model.py`, and the JLCPCB tables are `kicad_cruncher_cmd_bom.py`,
//! `kicad_cruncher_cmd_pnp.py` and `kicad_cruncher_cmd_jlc.py`. Each function
//! that carries a rule names the file it came from.

pub mod design;
pub mod jlcpcb;
mod xlsx;

use prism_kicad_contracts::generated::prism_cli_vendor_list_a0::{
    CliReleaseVersion, CliVendor, CliVendorListA0, CliVendorOutput, CliVendorOutputFormat,
    CliVendorOutputKind, SchemaId,
};
use std::collections::BTreeMap;
use std::fmt;

/// A vendor error: a stable code and a message without a host path.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Error {
    /// The `finding.code` the CLI writes.
    pub code: &'static str,
    /// One sentence for people.
    pub message: String,
}

impl Error {
    /// An input that does not match its contract.
    #[must_use]
    pub fn input(message: impl Into<String>) -> Self {
        Self {
            code: "input-invalid",
            message: message.into(),
        }
    }

    /// An internal failure.
    #[must_use]
    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            code: "internal",
            message: message.into(),
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for Error {}

/// One file a run writes.
#[derive(Clone, Debug)]
pub struct VendorFile {
    /// Path relative to the output directory.
    pub path: String,
    /// Its bytes.
    pub bytes: Vec<u8>,
}

/// One component a run left out, and why (`CliVendorExcludedComponent`).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Excluded {
    /// `<documentPath>#<uuid>`, or `<reference>` for a schematic-only part.
    pub key: String,
    /// Its reference, when it has one.
    pub reference: Option<String>,
    /// `excluded-from-bom` or `excluded-from-position`.
    pub code: &'static str,
    /// One sentence.
    pub message: String,
}

/// The result of one vendor run.
#[derive(Clone, Debug)]
pub struct Run {
    /// The files to write.
    pub files: Vec<VendorFile>,
    /// Row counts by table (`bom`, `cpl`).
    pub rows: BTreeMap<String, u64>,
    /// Excluded components.
    pub excluded: Vec<Excluded>,
}

/// The inputs one vendor run reads from a bundle.
pub struct VendorInput {
    /// `projections/occurrences.json`.
    pub occurrences: prism_kicad_contracts::generated::prism_occurrences_a0::OccurrencesA0,
    /// `projections/placements.json`.
    pub placements: prism_kicad_contracts::generated::prism_placements_a1::PlacementsA1,
    /// The board's footprint fields, when the bundle carries the board source.
    pub board: Option<design::BoardFacts>,
}

/// A registered vendor.
pub trait Vendor: Sync {
    /// Its id, the `<vendor-id>` of `vendor run`.
    fn id(&self) -> &'static str;
    /// Its human name.
    fn name(&self) -> &'static str;
    /// Its files, sorted by kind then format.
    fn outputs(&self) -> &'static [VendorOutput];
    /// The schema id of its configuration.
    fn config_schema(&self) -> &'static str;
    /// Map the normalised design to the vendor's files.
    fn run(
        &self,
        input: &VendorInput,
        config: &serde_json::Value,
        variant: Option<&str>,
    ) -> Result<Run, Error>;
}

/// One output a vendor declares.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct VendorOutput {
    /// `bom` or `cpl`.
    pub kind: CliVendorOutputKind,
    /// `csv` or `xlsx`.
    pub format: CliVendorOutputFormat,
    /// The format's version.
    pub version: &'static str,
}

impl VendorOutput {
    /// The contract type of this declaration.
    #[must_use]
    pub fn document(&self) -> CliVendorOutput {
        CliVendorOutput {
            kind: self.kind,
            format: self.format,
            version: CliReleaseVersion::from(self.version.to_string()),
        }
    }
}

const REGISTRY: [&dyn Vendor; 1] = [&jlcpcb::JLCPCB];

/// Every registered vendor, sorted by id.
#[must_use]
pub fn registry() -> &'static [&'static dyn Vendor] {
    &REGISTRY
}

/// The vendor with `id`.
#[must_use]
pub fn find(id: &str) -> Option<&'static dyn Vendor> {
    REGISTRY.iter().copied().find(|vendor| vendor.id() == id)
}

/// `vendor list`'s document (`CliVendorListA0`).
#[must_use]
pub fn list() -> CliVendorListA0 {
    CliVendorListA0 {
        schema: "prism.cli.vendor_list.a0".to_string(),
        vendors: REGISTRY
            .iter()
            .map(|vendor| CliVendor {
                id: vendor.id().to_string(),
                name: vendor.name().to_string(),
                outputs: vendor
                    .outputs()
                    .iter()
                    .map(VendorOutput::document)
                    .collect(),
                config_schema: SchemaId::from(vendor.config_schema().to_string()),
            })
            .collect(),
    }
}
