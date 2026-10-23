use crate::{
    CompiledSchematicGraphLimits, KiCadNetlist, KiCadNetlistJsonMetadata, KiCadNetlistLimits,
    PcbView, ProjectDocument, ProjectLimits, ProjectView, SchematicBundleIndex, SourceBundle,
    SourceBundleError, SourceBundleErrorKind, build_compiled_schematic_graph, build_kicad_netlist,
    build_kicad_netlist_json,
};
use prism_kicad_contracts::generated::compiled_schematic_graph::CompiledSchematicGraphA0;
use serde::Serialize;
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;
use std::fmt;
use std::io::{self, Write};

mod components;
mod hierarchy;
mod indexes;
mod pnp;
mod resource;
mod schematic_instances;
mod variants;

pub use schematic_instances::KiCadSchematicInstance;

pub const KICAD_DESIGN_JSON_SCHEMA: &str = "kicad_monkey.design.a0";
pub const KICAD_DESIGN_JSON_GENERATOR: &str = "kicad_monkey";

#[derive(Debug)]
pub struct KiCadDesignFacts<'index> {
    index: &'index SchematicBundleIndex,
    project: Option<ProjectDocument>,
    graph: CompiledSchematicGraphA0,
    netlist: KiCadNetlist,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct KiCadDesignFactsBuildProfile {
    pub project_parse_ns: u64,
    pub compiled_graph_ns: u64,
    pub netlist_ns: u64,
}

impl KiCadDesignFacts<'_> {
    pub fn project(&self) -> Option<ProjectView<'_>> {
        self.project.as_ref().map(ProjectDocument::view)
    }

    pub fn graph(&self) -> &CompiledSchematicGraphA0 {
        &self.graph
    }

    pub fn netlist(&self) -> &KiCadNetlist {
        &self.netlist
    }

    pub fn into_parts(self) -> (CompiledSchematicGraphA0, KiCadNetlist) {
        (self.graph, self.netlist)
    }

    pub fn schematic_instances(&self) -> Result<Vec<KiCadSchematicInstance>, KiCadDesignJsonError> {
        schematic_instances::schematic_instances(self)
    }
}

pub fn build_kicad_design_facts<'index>(
    index: &'index SchematicBundleIndex,
    bundle: &SourceBundle,
    project_limits: ProjectLimits,
    graph_limits: CompiledSchematicGraphLimits,
    netlist_limits: KiCadNetlistLimits,
) -> Result<KiCadDesignFacts<'index>, SourceBundleError> {
    build_kicad_design_facts_internal(
        index,
        bundle,
        project_limits,
        graph_limits,
        netlist_limits,
        false,
    )
    .map(|(facts, _profile)| facts)
}

pub fn build_kicad_design_facts_profiled<'index>(
    index: &'index SchematicBundleIndex,
    bundle: &SourceBundle,
    project_limits: ProjectLimits,
    graph_limits: CompiledSchematicGraphLimits,
    netlist_limits: KiCadNetlistLimits,
) -> Result<(KiCadDesignFacts<'index>, KiCadDesignFactsBuildProfile), SourceBundleError> {
    build_kicad_design_facts_internal(
        index,
        bundle,
        project_limits,
        graph_limits,
        netlist_limits,
        true,
    )
}

fn build_kicad_design_facts_internal<'index>(
    index: &'index SchematicBundleIndex,
    bundle: &SourceBundle,
    project_limits: ProjectLimits,
    graph_limits: CompiledSchematicGraphLimits,
    netlist_limits: KiCadNetlistLimits,
    profile: bool,
) -> Result<(KiCadDesignFacts<'index>, KiCadDesignFactsBuildProfile), SourceBundleError> {
    if !index.bundle_belongs_to(bundle) {
        return Err(SourceBundleError::new(
            SourceBundleErrorKind::Contract,
            None,
            "project source does not belong to the schematic index",
        ));
    }
    let project_started = profile.then(std::time::Instant::now);
    let project = bundle
        .project()
        .map(|source| ProjectDocument::from_reader(source.bytes(), project_limits))
        .transpose()
        .map_err(|error| {
            SourceBundleError::new(
                SourceBundleErrorKind::Project,
                bundle.project_path(),
                format!("project document is invalid: {error}"),
            )
        })?;
    let project_parse_ns = elapsed_ns(project_started);
    let project_view = project.as_ref().map(ProjectDocument::view);
    let graph_started = profile.then(std::time::Instant::now);
    let graph = build_compiled_schematic_graph(index, graph_limits)?;
    let compiled_graph_ns = elapsed_ns(graph_started);
    let netlist_started = profile.then(std::time::Instant::now);
    let netlist = build_kicad_netlist(index, project_view, netlist_limits)?;
    let netlist_ns = elapsed_ns(netlist_started);
    Ok((
        KiCadDesignFacts {
            index,
            project,
            graph,
            netlist,
        },
        KiCadDesignFactsBuildProfile {
            project_parse_ns,
            compiled_graph_ns,
            netlist_ns,
        },
    ))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct KiCadDesignJsonLimits {
    pub max_derived_items: usize,
    pub max_materialized_bytes: usize,
    pub max_output_bytes: usize,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct KiCadDesignJsonBuildProfile {
    pub binding_and_preflight_ns: u64,
    pub netlist_json_ns: u64,
    pub project_variants_options_ns: u64,
    pub sheets_ns: u64,
    pub components_ns: u64,
    pub hierarchy_and_nets_ns: u64,
    pub compiled_graph_value_ns: u64,
    pub pnp_ns: u64,
    pub classes_and_indexes_ns: u64,
    pub output_limit_serialization_ns: u64,
}

impl Default for KiCadDesignJsonLimits {
    fn default() -> Self {
        Self {
            max_derived_items: 256_000_000,
            max_materialized_bytes: 2_usize.saturating_mul(1024 * 1024 * 1024),
            max_output_bytes: 2_usize.saturating_mul(1024 * 1024 * 1024),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KiCadDesignSourcePath {
    pub filename: String,
    pub path: String,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct KiCadDesignJsonPaths {
    pub project_name: Option<String>,
    pub project_filename: Option<String>,
    pub project_path: Option<String>,
    pub schematic_paths: BTreeMap<String, KiCadDesignSourcePath>,
}

#[derive(Clone, Copy, Debug)]
pub struct KiCadDesignPcb<'a> {
    pub source_filename: &'a str,
    pub view: &'a PcbView<'a>,
}

#[derive(Debug)]
pub struct KiCadDesignJsonError {
    message: String,
}

impl KiCadDesignJsonError {
    fn context(context: &str, error: impl fmt::Display) -> Self {
        Self {
            message: format!("{context}: {error}"),
        }
    }
}

impl fmt::Display for KiCadDesignJsonError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for KiCadDesignJsonError {}

fn elapsed_ns(started: Option<std::time::Instant>) -> u64 {
    started.map_or(0, |started| {
        u64::try_from(started.elapsed().as_nanos()).unwrap_or(u64::MAX)
    })
}

impl From<SourceBundleError> for KiCadDesignJsonError {
    fn from(error: SourceBundleError) -> Self {
        Self::context("could not resolve design variant", error)
    }
}

pub fn build_kicad_design_json(
    index: &SchematicBundleIndex,
    facts: &KiCadDesignFacts<'_>,
    paths: &KiCadDesignJsonPaths,
    pcb: Option<KiCadDesignPcb<'_>>,
    include_indexes: bool,
) -> Result<Value, KiCadDesignJsonError> {
    build_kicad_design_json_with_limits(
        index,
        facts,
        paths,
        pcb,
        include_indexes,
        KiCadDesignJsonLimits::default(),
    )
}

pub fn build_kicad_design_json_with_limits(
    index: &SchematicBundleIndex,
    facts: &KiCadDesignFacts<'_>,
    paths: &KiCadDesignJsonPaths,
    pcb: Option<KiCadDesignPcb<'_>>,
    include_indexes: bool,
    limits: KiCadDesignJsonLimits,
) -> Result<Value, KiCadDesignJsonError> {
    build_kicad_design_json_internal(index, facts, paths, pcb, include_indexes, limits, false)
        .map(|(value, _profile)| value)
}

/// `design.json` as its member's bytes, with the `components` and `nets` the
/// semantic index reads out of it.
///
/// The document is written section by section in its final order: a section
/// is serialized and dropped before the next is built, and the compiled graph
/// is serialized from its typed form instead of a [`serde_json::Value`]
/// mirror of it. Peak memory is then one section plus the bytes, rather than
/// every section at once.
#[derive(Debug)]
pub struct KiCadDesignJsonBytes {
    /// The document's bytes, identical to `serde_json::to_vec` of
    /// [`build_kicad_design_json`] for the same inputs, without the member's
    /// trailing LF.
    pub bytes: Vec<u8>,
    /// `{"components": …, "nets": …}`, equal to those sections of
    /// [`build_kicad_design_json`]; what
    /// `projections/semantic-index.json` reads.
    pub semantic: Value,
}

pub fn build_kicad_design_json_bytes(
    index: &SchematicBundleIndex,
    facts: &KiCadDesignFacts<'_>,
    paths: &KiCadDesignJsonPaths,
    pcb: Option<KiCadDesignPcb<'_>>,
    include_indexes: bool,
) -> Result<KiCadDesignJsonBytes, KiCadDesignJsonError> {
    build_kicad_design_json_bytes_with_limits(
        index,
        facts,
        paths,
        pcb,
        include_indexes,
        KiCadDesignJsonLimits::default(),
    )
}

pub fn build_kicad_design_json_bytes_with_limits(
    index: &SchematicBundleIndex,
    facts: &KiCadDesignFacts<'_>,
    paths: &KiCadDesignJsonPaths,
    pcb: Option<KiCadDesignPcb<'_>>,
    include_indexes: bool,
    limits: KiCadDesignJsonLimits,
) -> Result<KiCadDesignJsonBytes, KiCadDesignJsonError> {
    let mut sink = BytesSink::new(limits.max_output_bytes);
    let semantic = assemble_design_json(
        &mut sink,
        DesignJsonInputs {
            index,
            facts,
            paths,
            pcb,
            include_indexes,
            limits,
        },
        None,
    )?;
    let bytes = sink.finish()?;
    let semantic = semantic.ok_or_else(|| {
        KiCadDesignJsonError::context("could not build design JSON", "semantic sections absent")
    })?;
    Ok(KiCadDesignJsonBytes { bytes, semantic })
}

pub fn build_kicad_design_json_profiled(
    index: &SchematicBundleIndex,
    facts: &KiCadDesignFacts<'_>,
    paths: &KiCadDesignJsonPaths,
    pcb: Option<KiCadDesignPcb<'_>>,
    include_indexes: bool,
) -> Result<(Value, KiCadDesignJsonBuildProfile), KiCadDesignJsonError> {
    build_kicad_design_json_internal(
        index,
        facts,
        paths,
        pcb,
        include_indexes,
        KiCadDesignJsonLimits::default(),
        true,
    )
}

/// The two parts of `design.json` the semantic index reads, `components` and
/// `nets`, equal to theirs in [`build_kicad_design_json`], without the rest:
/// no resource preflight, pick-and-place, hierarchy, compiled graph, indexes
/// or output-limit serialization. For a run that writes no `design.json`
/// (`prism-kicad compare`).
pub fn build_kicad_design_semantic_inputs(
    index: &SchematicBundleIndex,
    facts: &KiCadDesignFacts<'_>,
) -> Result<Value, KiCadDesignJsonError> {
    validate_facts_binding(index, facts)?;
    let netlist = facts.netlist();
    let mut netlist_json = build_kicad_netlist_json(netlist, KiCadNetlistJsonMetadata::default());
    let components = components::components_json(netlist, &netlist_json);
    let nets = netlist_json["nets"].take();
    Ok(json!({"components": components, "nets": nets}))
}

#[allow(
    clippy::too_many_lines,
    reason = "the profiled builder preserves one ordered Design JSON assembly flow"
)]
fn build_kicad_design_json_internal(
    index: &SchematicBundleIndex,
    facts: &KiCadDesignFacts<'_>,
    paths: &KiCadDesignJsonPaths,
    pcb: Option<KiCadDesignPcb<'_>>,
    include_indexes: bool,
    limits: KiCadDesignJsonLimits,
    profile: bool,
) -> Result<(Value, KiCadDesignJsonBuildProfile), KiCadDesignJsonError> {
    let mut sink = ValueSink::new();
    let mut profile = profile.then(KiCadDesignJsonBuildProfile::default);
    assemble_design_json(
        &mut sink,
        DesignJsonInputs {
            index,
            facts,
            paths,
            pcb,
            include_indexes,
            limits,
        },
        profile.as_mut(),
    )?;
    let result = sink.finish()?;
    let output_limit_started = profile.is_some().then(std::time::Instant::now);
    enforce_output_limit(&result, limits.max_output_bytes)?;
    let output_limit_serialization_ns = elapsed_ns(output_limit_started);
    let mut profile = profile.unwrap_or_default();
    profile.output_limit_serialization_ns = output_limit_serialization_ns;
    Ok((result, profile))
}

/// Where an assembly writes its sections: a [`Value`] tree, or the document's
/// bytes.
trait DesignJsonSink {
    type Output;

    /// Add a section already built as a value.
    fn add(&mut self, key: &str, value: Value) -> Result<(), KiCadDesignJsonError>;

    /// Add a section serialized from its typed form.
    fn add_serialized<T>(&mut self, key: &str, value: &T) -> Result<(), KiCadDesignJsonError>
    where
        T: Serialize + ?Sized;

    /// Add a section the semantic index also reads: the bytes sink writes it
    /// and hands it back, the value sink keeps it in the document and drops it
    /// here.
    fn add_kept(&mut self, key: &str, value: Value) -> Result<Option<Value>, KiCadDesignJsonError>;

    /// Close the document and take what the sink collected.
    fn finish(self) -> Result<Self::Output, KiCadDesignJsonError>;
}

/// The value sink: sections collected into the document's map, in order.
struct ValueSink {
    map: Map<String, Value>,
}

impl ValueSink {
    fn new() -> Self {
        Self { map: Map::new() }
    }
}

impl DesignJsonSink for ValueSink {
    type Output = Value;

    fn add(&mut self, key: &str, value: Value) -> Result<(), KiCadDesignJsonError> {
        self.map.insert(key.to_owned(), value);
        Ok(())
    }

    fn add_serialized<T>(&mut self, key: &str, value: &T) -> Result<(), KiCadDesignJsonError>
    where
        T: Serialize + ?Sized,
    {
        let value = serde_json::to_value(value)
            .map_err(|error| KiCadDesignJsonError::context("could not encode section", error))?;
        self.add(key, value)
    }

    fn add_kept(&mut self, key: &str, value: Value) -> Result<Option<Value>, KiCadDesignJsonError> {
        self.add(key, value)?;
        Ok(None)
    }

    fn finish(self) -> Result<Value, KiCadDesignJsonError> {
        Ok(Value::Object(self.map))
    }
}

/// The bytes sink: sections serialized straight into the member's bytes, under
/// the same output limit [`enforce_output_limit`] applies to the value form.
struct BytesSink {
    writer: LimitedBytes,
    sections: usize,
}

impl BytesSink {
    fn new(limit: usize) -> Self {
        Self {
            writer: LimitedBytes::new(limit),
            sections: 0,
        }
    }

    fn key(&mut self, key: &str) -> Result<(), KiCadDesignJsonError> {
        self.writer
            .write_all(if self.sections == 0 { b"{" } else { b"," })
            .map_err(limit_error)?;
        serde_json::to_writer(&mut self.writer, key).map_err(write_error)?;
        self.writer.write_all(b":").map_err(limit_error)?;
        self.sections += 1;
        Ok(())
    }
}

impl DesignJsonSink for BytesSink {
    type Output = Vec<u8>;

    fn add(&mut self, key: &str, value: Value) -> Result<(), KiCadDesignJsonError> {
        self.add_serialized(key, &value)
    }

    fn add_serialized<T>(&mut self, key: &str, value: &T) -> Result<(), KiCadDesignJsonError>
    where
        T: Serialize + ?Sized,
    {
        self.key(key)?;
        serde_json::to_writer(&mut self.writer, value).map_err(write_error)?;
        Ok(())
    }

    fn add_kept(&mut self, key: &str, value: Value) -> Result<Option<Value>, KiCadDesignJsonError> {
        self.add_serialized(key, &value)?;
        Ok(Some(value))
    }

    fn finish(mut self) -> Result<Vec<u8>, KiCadDesignJsonError> {
        self.writer.write_all(b"}").map_err(limit_error)?;
        Ok(self.writer.into_bytes())
    }
}

fn limit_error(error: io::Error) -> KiCadDesignJsonError {
    KiCadDesignJsonError::context("KiCad design JSON output limit exceeded", error)
}

fn write_error(error: serde_json::Error) -> KiCadDesignJsonError {
    if error.is_io() {
        limit_error(io::Error::other(error.to_string()))
    } else {
        KiCadDesignJsonError::context("could not encode design JSON section", error)
    }
}

/// The bytes the sink has written, refusing to grow past the output limit.
struct LimitedBytes {
    bytes: Vec<u8>,
    limit: usize,
}

impl LimitedBytes {
    fn new(limit: usize) -> Self {
        Self {
            bytes: Vec::new(),
            limit,
        }
    }

    fn into_bytes(self) -> Vec<u8> {
        self.bytes
    }
}

impl Write for LimitedBytes {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        if self
            .bytes
            .len()
            .checked_add(buffer.len())
            .is_none_or(|next| next > self.limit)
        {
            return Err(io::Error::other(format!(
                "output exceeds {} bytes",
                self.limit
            )));
        }
        self.bytes.extend_from_slice(buffer);
        Ok(buffer.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

fn profile_started(
    profile: &Option<&mut KiCadDesignJsonBuildProfile>,
) -> Option<std::time::Instant> {
    profile.as_ref().map(|_| std::time::Instant::now())
}

fn record_profile(
    profile: &mut Option<&mut KiCadDesignJsonBuildProfile>,
    field: impl FnOnce(&mut KiCadDesignJsonBuildProfile) -> &mut u64,
    started: Option<std::time::Instant>,
) {
    if let Some(profile) = profile.as_deref_mut() {
        *field(profile) = elapsed_ns(started);
    }
}

/// What one design JSON assembly reads.
#[derive(Clone, Copy)]
struct DesignJsonInputs<'a, 'f> {
    index: &'a SchematicBundleIndex,
    facts: &'a KiCadDesignFacts<'f>,
    paths: &'a KiCadDesignJsonPaths,
    pcb: Option<KiCadDesignPcb<'a>>,
    include_indexes: bool,
    limits: KiCadDesignJsonLimits,
}

/// Bind and preflight `inputs`, then build the netlist JSON the sections are
/// cut from.
fn prepare_design_json(
    inputs: DesignJsonInputs<'_, '_>,
    profile: &mut Option<&mut KiCadDesignJsonBuildProfile>,
) -> Result<Value, KiCadDesignJsonError> {
    let DesignJsonInputs {
        index,
        facts,
        paths,
        pcb,
        include_indexes,
        limits,
    } = inputs;
    let preflight_started = profile_started(profile);
    validate_facts_binding(index, facts)?;
    resource::preflight_design_json(
        index,
        facts.project(),
        facts.netlist(),
        facts.graph(),
        paths,
        pcb,
        include_indexes,
        limits,
    )?;
    record_profile(
        profile,
        |profile| &mut profile.binding_and_preflight_ns,
        preflight_started,
    );
    let netlist_json_started = profile_started(profile);
    let netlist_json =
        build_kicad_netlist_json(facts.netlist(), KiCadNetlistJsonMetadata::default());
    record_profile(
        profile,
        |profile| &mut profile.netlist_json_ns,
        netlist_json_started,
    );
    Ok(netlist_json)
}

/// The ordered document, written to `sink`. Returns `components` and `nets`
/// as the semantic index reads them when the sink keeps them.
fn assemble_design_json<S: DesignJsonSink>(
    sink: &mut S,
    inputs: DesignJsonInputs<'_, '_>,
    mut profile: Option<&mut KiCadDesignJsonBuildProfile>,
) -> Result<Option<Value>, KiCadDesignJsonError> {
    let mut netlist_json = prepare_design_json(inputs, &mut profile)?;
    let DesignJsonInputs {
        index,
        facts,
        paths,
        pcb,
        include_indexes,
        ..
    } = inputs;
    let project = facts.project();
    let graph = facts.graph();
    let netlist = facts.netlist();
    sink.add("schema", Value::String(KICAD_DESIGN_JSON_SCHEMA.to_owned()))?;
    sink.add(
        "generator",
        Value::String(KICAD_DESIGN_JSON_GENERATOR.to_owned()),
    )?;
    let project_started = profile_started(&profile);
    sink.add("project", project_json(project, paths)?)?;
    sink.add("variants", variants::variants_json(index, project)?)?;
    sink.add("options", options_json(project))?;
    record_profile(
        &mut profile,
        |profile| &mut profile.project_variants_options_ns,
        project_started,
    );
    let sheets_started = profile_started(&profile);
    sink.add("sheets", hierarchy::sheets_json(index, netlist, paths))?;
    record_profile(
        &mut profile,
        |profile| &mut profile.sheets_ns,
        sheets_started,
    );
    let components_started = profile_started(&profile);
    let components = components::components_json(netlist, &netlist_json);
    let kept_components = sink.add_kept("components", components)?;
    record_profile(
        &mut profile,
        |profile| &mut profile.components_ns,
        components_started,
    );
    let hierarchy_started = profile_started(&profile);
    sink.add(
        "schematic_hierarchy",
        hierarchy::schematic_hierarchy_json(index, paths),
    )?;
    let kept_nets = sink.add_kept("nets", netlist_json["nets"].take())?;
    record_profile(
        &mut profile,
        |profile| &mut profile.hierarchy_and_nets_ns,
        hierarchy_started,
    );
    let graph_started = profile_started(&profile);
    sink.add_serialized("compiled_schematic_graph", graph)?;
    record_profile(
        &mut profile,
        |profile| &mut profile.compiled_graph_value_ns,
        graph_started,
    );
    let pnp_started = profile_started(&profile);
    if let Some(pcb) = pcb
        && let Some(payload) = pnp::pnp_json(pcb, netlist, &netlist_json)?
    {
        sink.add("pnp", payload)?;
    }
    record_profile(&mut profile, |profile| &mut profile.pnp_ns, pnp_started);
    let indexes_started = profile_started(&profile);
    if !netlist.net_classes.is_empty() {
        sink.add("net_classes", netlist_json["net_classes"].take())?;
        sink.add("net_name_to_classes", indexes::net_name_to_classes(netlist))?;
    }
    if include_indexes {
        sink.add("indexes", indexes::indexes_json(netlist))?;
    }
    record_profile(
        &mut profile,
        |profile| &mut profile.classes_and_indexes_ns,
        indexes_started,
    );
    Ok(match (kept_components, kept_nets) {
        (Some(components), Some(nets)) => Some(json!({"components": components, "nets": nets})),
        _ => None,
    })
}

fn validate_facts_binding(
    index: &SchematicBundleIndex,
    bound: &KiCadDesignFacts<'_>,
) -> Result<(), KiCadDesignJsonError> {
    if !std::ptr::eq(index, bound.index) {
        return Err(KiCadDesignJsonError::context(
            "compiled schematic graph does not belong to the supplied bundle",
            "graph was built from a different schematic index",
        ));
    }
    Ok(())
}

fn enforce_output_limit(
    value: &Value,
    max_output_bytes: usize,
) -> Result<(), KiCadDesignJsonError> {
    let mut writer = LimitedWriter::new(max_output_bytes);
    serde_json::to_writer(&mut writer, value).map_err(|error| {
        KiCadDesignJsonError::context("KiCad design JSON output limit exceeded", error)
    })
}

struct LimitedWriter {
    written: usize,
    limit: usize,
}

impl LimitedWriter {
    const fn new(limit: usize) -> Self {
        Self { written: 0, limit }
    }
}

impl Write for LimitedWriter {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        let next = self
            .written
            .checked_add(buffer.len())
            .filter(|next| *next <= self.limit)
            .ok_or_else(|| io::Error::other(format!("output exceeds {} bytes", self.limit)))?;
        self.written = next;
        Ok(buffer.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

fn project_json(
    project: Option<ProjectView<'_>>,
    paths: &KiCadDesignJsonPaths,
) -> Result<Value, KiCadDesignJsonError> {
    let variables = project
        .map(|view| view.text_variables())
        .transpose()
        .map_err(|error| KiCadDesignJsonError::context("could not read text variables", error))?
        .unwrap_or_default()
        .into_iter()
        .collect::<BTreeMap<_, _>>();
    Ok(json!({
        "name": paths.project_name,
        "filename": paths.project_filename,
        "path": paths.project_path,
        "text_variables": variables,
    }))
}

fn options_json(project: Option<ProjectView<'_>>) -> Value {
    let first_id = project.and_then(|view| view.get_path("schematic.subpart_first_id"));
    let separator = project.and_then(|view| view.get_path("schematic.subpart_id_separator"));
    json!({
        "net_identifier_scope": "KICAD_PROJECT",
        "allow_ports_to_name_nets": true,
        "allow_sheet_entries_to_name_nets": true,
        "allow_single_pin_nets": true,
        "append_sheet_numbers_to_local_nets": false,
        "power_port_names_take_priority": true,
        "higher_level_names_take_priority": true,
        "auto_sheet_numbering": true,
        "kicad_schematic_format": "sexpr",
        "kicad_supported_oracle_versions": ["9", "10"],
        "kicad_subpart_first_id": first_id,
        "kicad_subpart_id_separator": separator,
    })
}

#[cfg(test)]
mod tests {
    use super::{LimitedWriter, enforce_output_limit};
    use serde_json::json;
    use std::io::Write;

    #[test]
    fn output_limit_accepts_exact_and_rejects_one_under() {
        let value = json!({"items": [1, 2, 3]});
        let encoded = serde_json::to_vec(&value).unwrap();
        enforce_output_limit(&value, encoded.len()).expect("exact output limit");
        let error = enforce_output_limit(&value, encoded.len() - 1).expect_err("one byte over");
        assert!(error.to_string().contains("output exceeds"));
    }

    #[test]
    fn limited_writer_rejects_counter_overflow() {
        let mut writer = LimitedWriter {
            written: usize::MAX,
            limit: usize::MAX,
        };
        assert!(writer.write(&[0]).is_err());
    }
}
