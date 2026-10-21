//! STEP (ISO 10303-21) export: an AP242 product structure, assemblies,
//! names, colours and tessellated geometry.
//!
//! The writer is adapted from SolidCraft's `crates/kernel/src/step_out.rs` (MIT
//! OR Apache-2.0, commit a0c1a67; see the repository's `NOTICE`): one header
//! and context, a product per part with its shape representation, named
//! solids, surface colours, and assemblies as next-assembly-usage occurrences
//! placed by item-defined transformations. A foreign model read back with
//! [`crate::p21`] is copied into the output with its own product tree, every
//! entity renumbered and the foreign contexts replaced by ours. Identical
//! entities are written once and referenced; ids are dense from `#1`.

mod brep;
mod copy;

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fmt::Write as _;
use std::sync::Arc;

use crate::p21::File;

/// A rigid placement, column-major: `matrix[column][row]`. Columns 0..3 are
/// the x, y and z axes and the translation.
pub type Matrix4 = [[f64; 4]; 4];

/// The identity placement.
pub const IDENTITY: Matrix4 = [
    [1.0, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 1.0, 0.0],
    [0.0, 0.0, 0.0, 1.0],
];

/// A named assembly: a root product and every product it reaches.
#[derive(Clone, Debug, Default)]
pub struct Assembly {
    /// The root product's name (the system's name).
    pub name: String,
    /// The products; index 0 is the root.
    pub products: Vec<Product>,
}

/// A product: its own geometry and its placed child products.
#[derive(Clone, Debug, Default)]
pub struct Product {
    /// Its name, on the product and its representation.
    pub name: String,
    /// Its own geometry.
    pub content: Content,
    /// `(child product index, placement in this product, occurrence name)`.
    pub children: Vec<(usize, Matrix4, String)>,
}

/// A product's own geometry.
#[derive(Clone, Debug, Default)]
pub enum Content {
    /// Nothing beyond the child products.
    #[default]
    Empty,
    /// A STEP model read back with [`crate::p21`]; its root product becomes
    /// this product's own shape and its children become ours.
    Foreign(ForeignStep),
    /// Triangle meshes, written as faceted B-rep solids (`brep.rs`): every
    /// STEP reader loads them, where AP242 tessellated shells are often skipped.
    Tessellated(Vec<Mesh>),
}

/// A parsed STEP file used as a product's geometry.
#[derive(Clone, Debug)]
pub struct ForeignStep {
    /// The parsed file.
    pub file: Arc<File>,
}

impl ForeignStep {
    /// A foreign model from a parsed file.
    #[must_use]
    pub fn new(file: File) -> Self {
        Self {
            file: Arc::new(file),
        }
    }

    /// A foreign model whose parse is shared between products.
    #[must_use]
    pub fn shared(file: Arc<File>) -> Self {
        Self { file }
    }
}

/// A triangle mesh in the product's frame, millimetres.
#[derive(Clone, Debug, Default)]
pub struct Mesh {
    /// Its name; a segment id for a harness tube.
    pub name: String,
    /// The vertices.
    pub positions: Vec<[f64; 3]>,
    /// Triangles as indices into `positions`.
    pub triangles: Vec<[u32; 3]>,
    /// A surface colour, 0..1 per channel.
    pub colour: Option<[f32; 3]>,
}

/// One assembly occurrence to write after every product exists.
pub(super) struct Link {
    pub(super) parent_pd: u64,
    pub(super) child_pd: u64,
    pub(super) target: u64,
    pub(super) name: String,
}

/// The products reachable from the root, in index order.
fn reachable(assembly: &Assembly) -> Vec<usize> {
    let mut seen = vec![false; assembly.products.len()];
    let mut stack = vec![0usize];
    while let Some(index) = stack.pop() {
        let Some(seen) = seen.get_mut(index) else {
            continue;
        };
        if *seen {
            continue;
        }
        *seen = true;
        if let Some(product) = assembly.products.get(index) {
            stack.extend(
                product
                    .children
                    .iter()
                    .map(|(child, _, _)| *child)
                    .filter(|child| *child < assembly.products.len()),
            );
        }
    }
    seen.iter()
        .enumerate()
        .filter_map(|(index, seen)| seen.then_some(index))
        .collect()
}

fn name_of(name: &str) -> String {
    let name = name.trim();
    if name.is_empty() {
        "Part".to_owned()
    } else {
        name.to_owned()
    }
}

fn occurrence_name(child: &Product, index: usize, given: &str) -> String {
    let given = given.trim();
    if given.is_empty() {
        format!("{}:{}", name_of(&child.name), index + 1)
    } else {
        given.to_owned()
    }
}

/// Write `assembly` as AP242 STEP text. Deterministic: a fixed header
/// timestamp, entity order by construction and dense ids from `#1`.
#[must_use]
pub fn write(assembly: &Assembly) -> String {
    let mut out = Out::default();
    out.header();
    let reachable = reachable(assembly);
    let mut own: Vec<Option<Own>> = (0..assembly.products.len()).map(|_| None).collect();
    for &index in &reachable {
        let product = &assembly.products[index];
        let name = name_of(&product.name);
        let record = out.product(&name);
        own[index] = Some(Own {
            pd: record.0,
            pds: record.1,
            name,
        });
    }
    let mut links = Vec::new();
    for &index in &reachable {
        let (Some(record), Some(product)) = (own[index].as_ref(), assembly.products.get(index))
        else {
            continue;
        };
        let mut items = Vec::new();
        let tessellated = false;
        match &product.content {
            Content::Empty => {}
            Content::Foreign(foreign) => {
                let mut copier = copy::Copier::new(&mut out, &foreign.file, record.pd);
                items.extend(copier.content());
                links.extend(copier.links());
            }
            Content::Tessellated(meshes) => {
                for mesh in meshes {
                    if let Some(solid) = out.brep(mesh) {
                        items.push(solid);
                    }
                }
            }
        }
        for (position, (child, matrix, given)) in product.children.iter().enumerate() {
            let Some(child_record) = own.get(*child).and_then(Option::as_ref) else {
                continue;
            };
            let Some(child_product) = assembly.products.get(*child) else {
                continue;
            };
            let target = out.placement(matrix);
            items.push(target);
            links.push(Link {
                parent_pd: record.pd,
                child_pd: child_record.pd,
                target,
                name: occurrence_name(child_product, position, given),
            });
        }
        let representation = out.representation(&record.name, &items, tessellated);
        out.definition_representation(record.pds, representation);
        out.pd_srep.insert(record.pd, representation);
    }
    out.occurrences(&links);
    out.presentation();
    out.finish(assembly)
}

/// A product's own entities.
struct Own {
    pd: u64,
    pds: u64,
    name: String,
}

/// The DATA section under construction.
#[derive(Default)]
pub(crate) struct Out {
    lines: Vec<String>,
    /// Entity text → id, so identical entities are written once.
    shared: HashMap<String, u64>,
    /// `STYLED_ITEM`s to list in the presentation representation.
    pub(crate) styled: BTreeSet<u64>,
    pub(crate) app: u64,
    pub(crate) protocol: u64,
    pub(crate) pctx: u64,
    pub(crate) pdctx: u64,
    pub(crate) mm: u64,
    pub(crate) rad: u64,
    pub(crate) sr: u64,
    pub(crate) unc: u64,
    pub(crate) ctx: u64,
    origin: u64,
    /// Each product definition's shape representation.
    pub(crate) pd_srep: BTreeMap<u64, u64>,
    /// Every product entity, for the product category.
    products: Vec<u64>,
}

impl Out {
    /// Append an entity; return its id.
    pub(crate) fn add(&mut self, text: impl Into<String>) -> u64 {
        self.lines.push(text.into());
        self.lines.len() as u64
    }

    /// Append an entity, or reuse an identical earlier one.
    pub(crate) fn add_shared(&mut self, text: String) -> u64 {
        if let Some(id) = self.shared.get(&text) {
            return *id;
        }
        let id = self.add(text.clone());
        self.shared.insert(text, id);
        id
    }

    pub(crate) fn point(&mut self, point: [f64; 3]) -> u64 {
        self.add_shared(format!(
            "CARTESIAN_POINT('',({},{},{}))",
            real(point[0]),
            real(point[1]),
            real(point[2])
        ))
    }

    pub(crate) fn direction(&mut self, direction: [f64; 3]) -> u64 {
        self.add_shared(format!(
            "DIRECTION('',({},{},{}))",
            real(direction[0]),
            real(direction[1]),
            real(direction[2])
        ))
    }

    /// An `AXIS2_PLACEMENT_3D` for a column-major rigid placement.
    pub(crate) fn placement(&mut self, matrix: &Matrix4) -> u64 {
        let translation = [matrix[3][0], matrix[3][1], matrix[3][2]];
        let z = unit([matrix[2][0], matrix[2][1], matrix[2][2]]).unwrap_or([0.0, 0.0, 1.0]);
        let x = perpendicular(unit([matrix[0][0], matrix[0][1], matrix[0][2]]), z);
        let (point, down, across) = (
            self.point(translation),
            self.direction(z),
            self.direction(x),
        );
        self.add_shared(format!("AXIS2_PLACEMENT_3D('',#{point},#{down},#{across})"))
    }

    /// The fixed header and the shared contexts.
    fn header(&mut self) {
        self.app = self.add("APPLICATION_CONTEXT('managed model based 3d engineering')");
        self.protocol = self.add(format!(
            "APPLICATION_PROTOCOL_DEFINITION('international standard','ap242_managed_model_based_3d_engineering',2014,#{})",
            self.app
        ));
        self.pctx = self.add(format!("PRODUCT_CONTEXT('',#{},'mechanical')", self.app));
        self.pdctx = self.add(format!(
            "PRODUCT_DEFINITION_CONTEXT('part definition',#{},'design')",
            self.app
        ));
        self.mm = self.add("(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))");
        self.rad = self.add("(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))");
        self.sr = self.add("(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())");
        self.unc = self.add(format!(
            "UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-06),#{},'distance_accuracy_value','confusion accuracy')",
            self.mm
        ));
        self.ctx = self.add(format!(
            "(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#{}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#{},#{},#{}))REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY'))",
            self.unc, self.mm, self.rad, self.sr
        ));
        self.origin = self.placement(&IDENTITY);
    }

    /// A product's `PRODUCT`, formation, definition and definition shape.
    pub(crate) fn product(&mut self, name: &str) -> (u64, u64) {
        let text = string(name);
        let pctx = self.pctx;
        let product = self.add(format!("PRODUCT({text},{text},'',(#{pctx}))"));
        let formation = self.add(format!("PRODUCT_DEFINITION_FORMATION('','',#{product})"));
        let definition = self.add(format!(
            "PRODUCT_DEFINITION('design','',#{formation},#{})",
            self.pdctx
        ));
        let shape = self.add(format!("PRODUCT_DEFINITION_SHAPE('','',#{definition})"));
        self.products.push(product);
        (definition, shape)
    }

    /// Link a product definition shape to its representation.
    pub(crate) fn definition_representation(&mut self, shape: u64, representation: u64) {
        self.add(format!(
            "SHAPE_DEFINITION_REPRESENTATION(#{shape},#{representation})"
        ));
    }

    /// The product's shape representation, with the origin and `items`.
    pub(crate) fn representation(&mut self, name: &str, items: &[u64], tessellated: bool) -> u64 {
        let context = self.ctx;
        self.representation_in(name, items, tessellated, context)
    }

    /// A shape representation in a given representation context (a copied model's own).
    pub(crate) fn representation_in(
        &mut self,
        name: &str,
        items: &[u64],
        tessellated: bool,
        context: u64,
    ) -> u64 {
        let mut list = format!("#{}", self.origin);
        for item in items {
            let _ = write!(list, ",#{item}");
        }
        let kind = if tessellated {
            "TESSELLATED_SHAPE_REPRESENTATION"
        } else {
            "SHAPE_REPRESENTATION"
        };
        self.add(format!("{kind}({},({list}),#{context})", string(name)))
    }

    /// A surface colour for `item` (`STYLED_ITEM` chain).
    pub(crate) fn style(&mut self, item: u64, colour: [f32; 3]) {
        let component = |value: f32| real((f64::from(value) * 1e6).round() / 1e6);
        let rgb = self.add_shared(format!(
            "COLOUR_RGB('',{},{},{})",
            component(colour[0]),
            component(colour[1]),
            component(colour[2])
        ));
        let fill_colour = self.add_shared(format!("FILL_AREA_STYLE_COLOUR('',#{rgb})"));
        let fill = self.add_shared(format!("FILL_AREA_STYLE('',(#{fill_colour}))"));
        let fill_area = self.add_shared(format!("SURFACE_STYLE_FILL_AREA(#{fill})"));
        let side = self.add_shared(format!("SURFACE_SIDE_STYLE('',(#{fill_area}))"));
        let usage = self.add_shared(format!("SURFACE_STYLE_USAGE(.BOTH.,#{side})"));
        let assignment = self.add_shared(format!("PRESENTATION_STYLE_ASSIGNMENT((#{usage}))"));
        let styled = self.add(format!("STYLED_ITEM('color',(#{assignment}),#{item})"));
        self.styled.insert(styled);
    }

    /// Every occurrence: an assembly usage, its transformation and the
    /// context-dependent shape representation.
    fn occurrences(&mut self, links: &[Link]) {
        for link in links {
            let (Some(&parent), Some(&child)) = (
                self.pd_srep.get(&link.parent_pd),
                self.pd_srep.get(&link.child_pd),
            ) else {
                continue;
            };
            if link.target == 0 {
                continue;
            }
            let name = string(&link.name);
            let usage = self.add(format!(
                "NEXT_ASSEMBLY_USAGE_OCCURRENCE({name},{name},'',#{},#{},$)",
                link.parent_pd, link.child_pd
            ));
            let shape = self.add(format!("PRODUCT_DEFINITION_SHAPE('','',#{usage})"));
            let transform = self.add(format!(
                "ITEM_DEFINED_TRANSFORMATION('','',#{},#{})",
                self.origin, link.target
            ));
            let relationship = self.add(format!(
                "(REPRESENTATION_RELATIONSHIP('','',#{child},#{parent})REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(#{transform})SHAPE_REPRESENTATION_RELATIONSHIP())"
            ));
            self.add(format!(
                "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#{relationship},#{shape})"
            ));
        }
    }

    /// The product category and the surface styles.
    fn presentation(&mut self) {
        if !self.products.is_empty() {
            let list = self
                .products
                .iter()
                .map(|product| format!("#{product}"))
                .collect::<Vec<_>>()
                .join(",");
            self.add(format!(
                "PRODUCT_RELATED_PRODUCT_CATEGORY('part','',({list}))"
            ));
        }
        if !self.styled.is_empty() {
            let list = self
                .styled
                .iter()
                .map(|style| format!("#{style}"))
                .collect::<Vec<_>>()
                .join(",");
            self.add(format!(
                "MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('',({list}),#{})",
                self.ctx
            ));
        }
    }

    fn finish(&self, assembly: &Assembly) -> String {
        let file_name = name_of(&assembly.name);
        let mut text = String::new();
        text.push_str("ISO-10303-21;\nHEADER;\n");
        let _ = writeln!(
            text,
            "FILE_DESCRIPTION(('KiCAD Prism system assembly'),'2;1');"
        );
        let _ = writeln!(
            text,
            "FILE_NAME({},'1970-01-01T00:00:00',(''),(''),'prism-kicad','KiCAD Prism','');",
            string(&format!("{file_name}.step"))
        );
        text.push_str("FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF { 1 0 10303 442 1 1 4 }'));\nENDSEC;\nDATA;\n");
        for (index, line) in self.lines.iter().enumerate() {
            let _ = writeln!(text, "#{}={line};", index + 1);
        }
        text.push_str("ENDSEC;\nEND-ISO-10303-21;\n");
        text
    }
}

/// A finite real in STEP's syntax (`1.`, `1.5`, `1.E-6`).
pub(crate) fn real(value: f64) -> String {
    if !value.is_finite() {
        return "0.".to_owned();
    }
    let value = if value == 0.0 { 0.0 } else { value };
    let text = format!("{value:?}");
    match text.split_once(['e', 'E']) {
        Some((mantissa, exponent)) => {
            let mantissa = if mantissa.contains('.') {
                mantissa.to_owned()
            } else {
                format!("{mantissa}.")
            };
            format!("{mantissa}E{exponent}")
        }
        None if text.contains('.') => text,
        None => format!("{text}."),
    }
}

/// A STEP string literal (quotes doubled, non-ASCII as `\X2\` UTF-16 runs).
pub(crate) fn string(text: &str) -> String {
    let mut out = String::from("'");
    for character in text.chars() {
        match character {
            '\'' => out.push_str("''"),
            '\\' => out.push_str("\\\\"),
            character if character.is_ascii() && !character.is_ascii_control() => {
                out.push(character);
            }
            character if character.is_ascii_control() => {}
            character => {
                out.push_str("\\X2\\");
                let mut buffer = [0u16; 2];
                for unit in character.encode_utf16(&mut buffer) {
                    let _ = write!(out, "{unit:04X}");
                }
                out.push_str("\\X0\\");
            }
        }
    }
    out.push('\'');
    out
}

/// A unit vector, or `None` for a zero or non-finite one.
pub(crate) fn unit(vector: [f64; 3]) -> Option<[f64; 3]> {
    let length = (vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]).sqrt();
    (length > 1e-12 && length.is_finite())
        .then(|| [vector[0] / length, vector[1] / length, vector[2] / length])
}

/// A unit vector perpendicular to `z`, close to `x` when it is usable.
fn perpendicular(x: Option<[f64; 3]>, z: [f64; 3]) -> [f64; 3] {
    let projected = x.map(|x| {
        let dot = x[0] * z[0] + x[1] * z[1] + x[2] * z[2];
        [x[0] - z[0] * dot, x[1] - z[1] * dot, x[2] - z[2] * dot]
    });
    projected
        .and_then(unit)
        .or_else(|| unit(cross([0.0, 0.0, 1.0], z)))
        .or_else(|| unit(cross([0.0, 1.0, 0.0], z)))
        .unwrap_or([1.0, 0.0, 0.0])
}

pub(crate) fn cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

#[cfg(test)]
mod tests;
