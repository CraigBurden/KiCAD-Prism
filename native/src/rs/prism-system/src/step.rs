//! The STEP assembly (`docs/system-builder/CONTRACTS.md` §18): arrange the
//! system exactly as [`crate::build::build`] does and describe its product
//! tree for [`prism_step::write`].
//!
//! The root product is the system; each occurrence is a product at its pose.
//! A board's model is lifted by half its thickness, a body's part model sits
//! under its alignment with its connectors at their mounts, a published entry
//! holds its own model, and every routed harness is a `Harness <label>` product
//! with a tube per segment and each end's housing at its pose. A
//! model the manifest lacks leaves an empty product and is listed as missing.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use prism_step::Matrix4;
use prism_step::p21::File;
use prism_step::{Assembly, Content, ForeignStep, IDENTITY, Mesh, Product, tube};

use crate::arrangement::{self, Arranged};
use crate::build;
use crate::context::Context;
use crate::input::{Document, EntryFacts, Members, Occurrence, Source, part_key};
use crate::natural;
use crate::nets;
use crate::output::{HarnessOut, HarnessRouteOut};
use crate::placement::poses::{self, Pose};
use crate::routing;
use crate::wiring;

/// A board model from the `--models` manifest.
#[derive(Clone, Debug)]
pub struct BoardModel {
    /// The parsed STEP file.
    pub step: Arc<File>,
    /// Where it was read from.
    pub path: PathBuf,
    /// The board's thickness, in millimetres.
    pub thickness_mm: f64,
}

/// A catalog part model from the `--models` manifest.
#[derive(Clone, Debug)]
pub struct PartModel {
    /// The parsed STEP file.
    pub step: Arc<File>,
    /// Where it was read from.
    pub path: PathBuf,
    /// The model's alignment into the part's frame, column-major.
    pub alignment: Matrix4,
}

/// The `--models` manifest of §18.
#[derive(Clone, Debug, Default)]
pub struct ModelManifest {
    /// Board models by occurrence id.
    pub boards: BTreeMap<String, BoardModel>,
    /// Part models by the reference the document spells.
    pub parts: BTreeMap<String, PartModel>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawManifest {
    #[serde(default)]
    boards: BTreeMap<String, RawBoard>,
    #[serde(default)]
    parts: BTreeMap<String, RawPart>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawBoard {
    step: String,
    #[serde(default)]
    thickness_nm: i64,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPart {
    step: String,
    #[serde(default)]
    alignment: Option<[f64; 16]>,
}

impl ModelManifest {
    /// Read and validate `path`; each referenced STEP file is parsed once.
    pub fn load(path: &Path) -> Result<Self, String> {
        let bytes = std::fs::read(path)
            .map_err(|error| format!("{} could not be read: {error}", path.display()))?;
        let raw: RawManifest = serde_json::from_slice(&bytes)
            .map_err(|error| format!("{} is not the models manifest: {error}", path.display()))?;
        let base = path.parent().unwrap_or_else(|| Path::new("."));
        let mut cache: BTreeMap<PathBuf, Arc<File>> = BTreeMap::new();
        let mut manifest = Self::default();
        for (occurrence, board) in raw.boards {
            let step_path = resolve(base, &board.step)?;
            let step = parse_once(&step_path, &mut cache)?;
            manifest.boards.insert(
                occurrence,
                BoardModel {
                    step,
                    path: step_path,
                    thickness_mm: board.thickness_nm as f64 / 1e6,
                },
            );
        }
        for (reference, part) in raw.parts {
            let step_path = resolve(base, &part.step)?;
            let step = parse_once(&step_path, &mut cache)?;
            manifest.parts.insert(
                reference,
                PartModel {
                    step,
                    path: step_path,
                    alignment: part.alignment.map_or(IDENTITY, matrix_from_flat),
                },
            );
        }
        Ok(manifest)
    }
}

fn resolve(base: &Path, step: &str) -> Result<PathBuf, String> {
    if step.trim().is_empty() {
        return Err("the models manifest has an empty step path".to_owned());
    }
    let path = Path::new(step);
    Ok(if path.is_absolute() {
        path.to_path_buf()
    } else {
        base.join(path)
    })
}

fn parse_once(path: &Path, cache: &mut BTreeMap<PathBuf, Arc<File>>) -> Result<Arc<File>, String> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|error| format!("{} could not be read: {error}", path.display()))?;
    if let Some(file) = cache.get(&canonical) {
        return Ok(Arc::clone(file));
    }
    let text = std::fs::read_to_string(&canonical)
        .map_err(|error| format!("{} could not be read: {error}", canonical.display()))?;
    let file = prism_step::p21::parse(&text)
        .map_err(|error| format!("{} is not a STEP file: {error}", canonical.display()))?;
    let file = Arc::new(file);
    cache.insert(canonical, Arc::clone(&file));
    Ok(file)
}

fn matrix_from_flat(flat: [f64; 16]) -> Matrix4 {
    let mut matrix = IDENTITY;
    for column in 0..4 {
        for row in 0..4 {
            matrix[column][row] = flat[column * 4 + row];
        }
    }
    matrix
}

fn pose_matrix(pose: &Pose) -> Matrix4 {
    matrix_from_flat(poses::matrix(pose))
}

fn translation(offset: [f64; 3]) -> Matrix4 {
    let mut matrix = IDENTITY;
    matrix[3] = [offset[0], offset[1], offset[2], 1.0];
    matrix
}

/// `left · right`: `right`'s frame in `left`'s parent.
fn multiply(left: &Matrix4, right: &Matrix4) -> Matrix4 {
    let mut product = IDENTITY;
    for column in 0..4 {
        for row in 0..4 {
            product[column][row] = (0..4)
                .map(|step| left[step][row] * right[column][step])
                .sum();
        }
    }
    product
}

fn source_key(source: &Source) -> Option<String> {
    let component = source.component_id.as_deref()?;
    Some(part_key(component, source.revision_id.as_deref()))
}

/// Arrange the system and describe its STEP product tree. Returns the
/// assembly and the product names whose model is missing.
#[must_use]
pub fn step_assembly(
    document: &Document,
    members: &Members,
    models: &ModelManifest,
) -> (Assembly, Vec<String>) {
    let prepared = build::prepare(document, members);
    let mut context = Context::new(document, &prepared);
    let named = build::named_connectors(document);
    let mut edges = Vec::new();
    for mate in &document.mates {
        let _ = build::map_mate(&mut context, mate, &mut edges);
    }
    let wired = wiring::wire(&mut context, &mut edges);
    let nets = nets::system_nets(&mut context, &named, &edges);
    let mut harnesses = crate::harness::resolve(&mut context, &wired.links, &nets);
    let arranged = arrangement::arrange(&mut context, document);
    routing::route_all(&mut context, document, &arranged, &mut harnesses);
    let mut builder = Builder::new(document, &prepared, &arranged, models);
    builder.occurrences();
    builder.harnesses(&context, &harnesses);
    builder.finish()
}

struct Builder<'a> {
    document: &'a Document,
    members: &'a Members,
    arranged: &'a Arranged,
    models: &'a ModelManifest,
    assembly: Assembly,
    missing: Vec<String>,
}

impl<'a> Builder<'a> {
    fn new(
        document: &'a Document,
        members: &'a Members,
        arranged: &'a Arranged,
        models: &'a ModelManifest,
    ) -> Self {
        let name = if document.name.trim().is_empty() {
            "System".to_owned()
        } else {
            document.name.trim().to_owned()
        };
        Self {
            document,
            members,
            arranged,
            models,
            assembly: Assembly {
                name: name.clone(),
                products: vec![Product {
                    name,
                    content: Content::Empty,
                    children: Vec::new(),
                }],
            },
            missing: Vec::new(),
        }
    }

    fn push(&mut self, product: Product) -> usize {
        let index = self.assembly.products.len();
        self.assembly.products.push(product);
        index
    }

    fn occurrences(&mut self) {
        let mut order: Vec<usize> = (0..self.document.occurrences.len()).collect();
        order.sort_by(|a, b| {
            self.document.occurrences[*a]
                .id
                .cmp(&self.document.occurrences[*b].id)
        });
        for index in order {
            let occurrence = self.document.occurrences[index].clone();
            let pose = self
                .arranged
                .poses
                .get(&occurrence.id)
                .map_or(poses::IDENTITY, |pose| *pose);
            let (product, placement) = self.occurrence(&occurrence, pose_matrix(&pose));
            let name = occurrence.label.clone();
            let product = self.push(product);
            self.assembly.products[0]
                .children
                .push((product, placement, name));
        }
    }

    fn occurrence(&mut self, occurrence: &Occurrence, pose: Matrix4) -> (Product, Matrix4) {
        match occurrence.source.kind.as_str() {
            "body" => (self.body(&occurrence.id), pose),
            "entry" => self.entry(occurrence, pose),
            _ => self.board(occurrence, pose),
        }
    }

    fn board(&mut self, occurrence: &Occurrence, pose: Matrix4) -> (Product, Matrix4) {
        let name = occurrence.label.clone();
        let Some(model) = self.models.boards.get(&occurrence.id) else {
            self.missing.push(name.clone());
            return (empty(name), pose);
        };
        let placement = multiply(&pose, &translation([0.0, 0.0, -model.thickness_mm / 2.0]));
        let content = Content::Foreign(ForeignStep::shared(Arc::clone(&model.step)));
        (
            Product {
                name,
                content,
                children: Vec::new(),
            },
            placement,
        )
    }

    /// A placed entry: its child's occurrences where the child placed them —
    /// boards from `boards["<entry>/<child>"]`, bodies and exported body
    /// connectors from their parts — or, for an entry without placed contents,
    /// the entry part's own model.
    fn entry(&mut self, occurrence: &Occurrence, pose: Matrix4) -> (Product, Matrix4) {
        let facts = self.members.entries.get(&occurrence.id).cloned();
        if let Some(facts) = facts.filter(|facts| !facts.contents.is_empty()) {
            let product = self.entry_contents(occurrence, &facts);
            return (product, pose);
        }
        self.entry_model(occurrence, pose)
    }

    fn entry_contents(&mut self, occurrence: &Occurrence, facts: &EntryFacts) -> Product {
        let mut children = Vec::new();
        for content in &facts.contents {
            let at = pose_matrix(&content.pose);
            let label = format!("{} · {}", occurrence.label, content.label);
            let placed = match content.kind.as_str() {
                "board" => self
                    .models
                    .boards
                    .get(&format!("{}/{}", occurrence.id, content.occurrence))
                    .map(|model| {
                        let lift = translation([0.0, 0.0, -model.thickness_mm / 2.0]);
                        (
                            Content::Foreign(ForeignStep::shared(Arc::clone(&model.step))),
                            multiply(&at, &lift),
                        )
                    }),
                "body" => content
                    .part
                    .as_ref()
                    .and_then(|part| self.models.parts.get(part))
                    .map(|model| {
                        (
                            Content::Foreign(ForeignStep::shared(Arc::clone(&model.step))),
                            multiply(&at, &model.alignment),
                        )
                    }),
                _ => None,
            };
            self.child(&mut children, label, placed);
        }
        for connector in &facts.connectors {
            let label = format!("{} · {}", occurrence.label, connector.name);
            let placed = self.models.parts.get(&connector.part).map(|model| {
                let at = pose_matrix(&connector.mount);
                (
                    Content::Foreign(ForeignStep::shared(Arc::clone(&model.step))),
                    multiply(&at, &model.alignment),
                )
            });
            self.child(&mut children, label, placed);
        }
        Product {
            name: occurrence.label.clone(),
            content: Content::Empty,
            children,
        }
    }

    /// One child product, or a missing entry when it has no model.
    fn child(
        &mut self,
        children: &mut Vec<(usize, Matrix4, String)>,
        name: String,
        placed: Option<(Content, Matrix4)>,
    ) {
        let Some((content, placement)) = placed else {
            self.missing.push(name);
            return;
        };
        let index = self.push(Product {
            name: name.clone(),
            content,
            children: Vec::new(),
        });
        children.push((index, placement, name));
    }

    fn entry_model(&mut self, occurrence: &Occurrence, pose: Matrix4) -> (Product, Matrix4) {
        let name = occurrence.label.clone();
        let model = source_key(&occurrence.source)
            .and_then(|key| self.models.parts.get(&key))
            .cloned();
        match model {
            Some(model) => {
                let content = Content::Foreign(ForeignStep::shared(model.step));
                (
                    Product {
                        name,
                        content,
                        children: Vec::new(),
                    },
                    multiply(&pose, &model.alignment),
                )
            }
            None => {
                self.missing.push(name.clone());
                (empty(name), pose)
            }
        }
    }

    fn body(&mut self, occurrence: &str) -> Product {
        let name = self
            .document
            .occurrences
            .iter()
            .find(|candidate| candidate.id == occurrence)
            .map_or_else(
                || occurrence.to_owned(),
                |candidate| candidate.label.clone(),
            );
        let mut children = Vec::new();
        self.body_model(occurrence, &name, &mut children);
        self.body_connectors(occurrence, &name, &mut children);
        Product {
            name,
            content: Content::Empty,
            children,
        }
    }

    /// The body's own part model under its alignment.
    fn body_model(
        &mut self,
        occurrence: &str,
        name: &str,
        children: &mut Vec<(usize, Matrix4, String)>,
    ) {
        let source = self
            .document
            .occurrences
            .iter()
            .find(|candidate| candidate.id == occurrence)
            .map(|candidate| &candidate.source);
        let model = source
            .and_then(source_key)
            .and_then(|key| self.models.parts.get(&key))
            .cloned();
        let child_name = format!("{name} model");
        let (content, alignment) = match model {
            Some(model) => (
                Content::Foreign(ForeignStep::shared(model.step)),
                model.alignment,
            ),
            None => {
                self.missing.push(child_name.clone());
                (Content::Empty, IDENTITY)
            }
        };
        let product = self.push(Product {
            name: child_name.clone(),
            content,
            children: Vec::new(),
        });
        children.push((product, alignment, child_name));
    }

    /// Each body connector's part model at its mount under its alignment.
    fn body_connectors(
        &mut self,
        occurrence: &str,
        name: &str,
        children: &mut Vec<(usize, Matrix4, String)>,
    ) {
        let mut order: Vec<usize> = self
            .document
            .body_connectors
            .iter()
            .enumerate()
            .filter(|(_, connector)| connector.occurrence == occurrence)
            .map(|(index, _)| index)
            .collect();
        order.sort_by(|a, b| {
            natural::cmp(
                &self.document.body_connectors[*a].refdes,
                &self.document.body_connectors[*b].refdes,
            )
        });
        for index in order {
            let connector = self.document.body_connectors[index].clone();
            let child_name = format!("{name} {}", connector.refdes);
            let mount = self
                .members
                .mounted
                .get(occurrence)
                .and_then(|facts| facts.mounts.get(&connector.refdes))
                .map_or(poses::IDENTITY, |mount| *mount);
            let model = self.models.parts.get(&connector.part.key()).cloned();
            let (content, alignment) = match model {
                Some(model) => (
                    Content::Foreign(ForeignStep::shared(model.step)),
                    model.alignment,
                ),
                None => {
                    self.missing.push(child_name.clone());
                    (Content::Empty, IDENTITY)
                }
            };
            let product = self.push(Product {
                name: child_name.clone(),
                content,
                children: Vec::new(),
            });
            children.push((
                product,
                multiply(&pose_matrix(&mount), &alignment),
                child_name,
            ));
        }
    }

    fn harnesses(&mut self, context: &Context<'_>, harnesses: &[HarnessOut]) {
        for out in harnesses {
            let Some(route) = &out.route else {
                continue;
            };
            let Some(harness) = self
                .document
                .harnesses
                .iter()
                .find(|harness| harness.id == out.harness)
                .cloned()
            else {
                continue;
            };
            let name = format!("Harness {}", harness.label);
            let mut children = Vec::new();
            for end in &route.ends {
                if let Some((product, placement, child_name)) =
                    self.housing(context, &harness, &name, &end.end)
                {
                    children.push((product, placement, child_name));
                }
            }
            let product = Product {
                name: name.clone(),
                content: Content::Tessellated(tubes(route)),
                children,
            };
            let product = self.push(product);
            self.assembly.products[0]
                .children
                .push((product, IDENTITY, name));
        }
    }

    /// An end's housing model at its mating frame under its alignment.
    fn housing(
        &mut self,
        context: &Context<'_>,
        harness: &crate::input::Harness,
        harness_name: &str,
        end_id: &str,
    ) -> Option<(usize, Matrix4, String)> {
        let end = harness.ends.iter().find(|end| end.id == end_id)?;
        let housing = end.housing.as_ref()?;
        let site = end.site.as_ref()?;
        let boot = end.boot_length_nm.map(|length| length as f64 / 1e6);
        let pose = arrangement::harness_end_pose(
            context,
            self.arranged,
            &site.occurrence,
            &site.connector,
            boot,
        )?;
        let label = self
            .document
            .occurrences
            .iter()
            .find(|occurrence| occurrence.id == site.occurrence)
            .map_or(site.occurrence.as_str(), |occurrence| {
                occurrence.label.as_str()
            });
        let child_name = format!("{harness_name} · {} {label} housing", site.connector);
        let model = self.models.parts.get(&housing.key()).cloned();
        let (content, alignment) = match model {
            Some(model) => (
                Content::Foreign(ForeignStep::shared(model.step)),
                model.alignment,
            ),
            None => {
                self.missing.push(child_name.clone());
                (Content::Empty, IDENTITY)
            }
        };
        let product = self.push(Product {
            name: child_name.clone(),
            content,
            children: Vec::new(),
        });
        Some((
            product,
            multiply(&pose_matrix(&pose.pose), &alignment),
            child_name,
        ))
    }

    fn finish(mut self) -> (Assembly, Vec<String>) {
        self.missing.sort();
        self.missing.dedup();
        (self.assembly, self.missing)
    }
}

fn empty(name: String) -> Product {
    Product {
        name,
        content: Content::Empty,
        children: Vec::new(),
    }
}

/// One tube per routed segment, in the harness's neutral grey.
fn tubes(route: &HarnessRouteOut) -> Vec<Mesh> {
    let mut meshes = Vec::new();
    for segment in &route.segments {
        let samples: Vec<[f64; 3]> = segment
            .samples_nm
            .as_chunks::<3>()
            .0
            .iter()
            .map(|point| {
                [
                    point[0] as f64 / 1e6,
                    point[1] as f64 / 1e6,
                    point[2] as f64 / 1e6,
                ]
            })
            .collect();
        let radius = segment.diameter_nm as f64 / 2e6;
        let mut mesh = tube(&samples, radius, prism_step::tube::DEFAULT_SIDES);
        if mesh.positions.is_empty() {
            continue;
        }
        mesh.name = segment.id.clone();
        mesh.colour = Some([0.6, 0.6, 0.6]);
        meshes.push(mesh);
    }
    meshes
}

#[cfg(test)]
mod tests;
