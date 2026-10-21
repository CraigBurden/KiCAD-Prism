//! Copying a foreign STEP model into the output (adapted from SolidCraft's
//! `step_out.rs`, MIT OR Apache-2.0, commit a0c1a67; see `NOTICE`).
//!
//! The foreign file's product tree is kept: a single root product supplies the
//! owning product's own shape representation and its children become child
//! products of it; several roots each become a child product. Every copied
//! entity is renumbered, and the foreign contexts (unit, angle, uncertainty,
//! representation and product contexts) are replaced by ours, so the output
//! stays in millimetres.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::Arc;

use super::{IDENTITY, Link, Out, real, string};
use crate::p21::{Entity, File, Param};

/// The most entity references one copied entity may nest through.
const MAX_DEPTH: usize = 512;

/// One foreign assembly usage.
#[derive(Clone, Debug)]
struct Nauo {
    id: u64,
    child: u64,
    name: String,
    target: Option<u64>,
}

/// The product-index maps built in one pass over the foreign file.
#[derive(Default)]
struct Maps {
    definitions: BTreeMap<u64, u64>,
    relationships: BTreeMap<u64, u64>,
    products: BTreeMap<u64, String>,
    formations: BTreeMap<u64, u64>,
    definition_formation: BTreeMap<u64, u64>,
    usage_relationship: BTreeMap<u64, u64>,
    /// `(shape, relationship)` of each CONTEXT_DEPENDENT_SHAPE_REPRESENTATION,
    /// resolved after the scan: its shape may come later in the file (KiCad's do).
    usage_shapes: Vec<(u64, u64)>,
    child_of: BTreeSet<u64>,
    edges: BTreeMap<u64, Vec<u64>>,
}

/// A foreign model, copied lazily as its representation is reached.
pub(super) struct Copier<'a> {
    out: &'a mut Out,
    file: &'a File,
    /// The product that receives the foreign content.
    parent: u64,
    map: HashMap<u64, u64>,
    pd_rep: BTreeMap<u64, u64>,
    pd_name: BTreeMap<u64, String>,
    children: BTreeMap<u64, Vec<Nauo>>,
    roots: Vec<u64>,
    related: BTreeMap<u64, Vec<u64>>,
    styled_by_item: BTreeMap<u64, Vec<u64>>,
    links: Vec<Link>,
    /// The file's units are ours (millimetre, radian): its contexts are replaced by
    /// ours. Otherwise they are copied, so an inch model stays an inch model and
    /// the reader converts across the placement, as STEP allows.
    native_units: bool,
}

impl<'a> Copier<'a> {
    /// A copier for `file`, whose content goes under `parent`.
    pub(super) fn new(out: &'a mut Out, file: &'a Arc<File>, parent: u64) -> Self {
        let mut copier = Self {
            out,
            file,
            parent,
            map: HashMap::new(),
            pd_rep: BTreeMap::new(),
            pd_name: BTreeMap::new(),
            children: BTreeMap::new(),
            roots: Vec::new(),
            related: BTreeMap::new(),
            styled_by_item: BTreeMap::new(),
            links: Vec::new(),
            native_units: native_units(file),
        };
        copier.index();
        copier
    }

    /// The representation items the owning product inherits.
    pub(super) fn content(&mut self) -> Vec<u64> {
        let roots = self.roots.clone();
        let mut items = Vec::new();
        match roots.as_slice() {
            [] => {}
            // A model in our units is adopted; one in other units stays a child
            // product, so its shape keeps its own context.
            [root] if self.native_units => {
                items = self.representation_items(*root);
                self.attach_children(*root, self.parent, &mut items);
            }
            _ => {
                for root in roots {
                    let name = self.name_of(root, "Part");
                    let child = self.copy_product(root, &name);
                    let target = self.out.placement(&IDENTITY);
                    items.push(target);
                    self.links.push(Link {
                        parent_pd: self.parent,
                        child_pd: child,
                        target,
                        name,
                    });
                }
            }
        }
        items
    }

    /// The assembly occurrences the copied products added.
    pub(super) fn links(&mut self) -> Vec<Link> {
        std::mem::take(&mut self.links)
    }

    // ------------------------------------------------------------------ index

    fn index(&mut self) {
        let mut maps = Maps::default();
        let file = self.file;
        for (&id, entity) in &file.entities {
            self.scan(id, entity, &mut maps);
        }
        for (shape, relationship) in std::mem::take(&mut maps.usage_shapes) {
            if let Some(usage) = maps.definitions.get(&shape) {
                maps.usage_relationship.insert(*usage, relationship);
            }
        }
        self.pd_name = maps
            .definition_formation
            .into_iter()
            .filter_map(|(definition, formation)| {
                let product = maps.formations.get(&formation)?;
                maps.products
                    .get(product)
                    .map(|name| (definition, name.clone()))
            })
            .collect();
        self.pd_rep = maps
            .relationships
            .into_iter()
            .filter_map(|(shape, representation)| {
                maps.definitions
                    .get(&shape)
                    .map(|definition| (*definition, representation))
            })
            .collect();
        self.related = maps.edges;
        self.attach_targets(&maps.usage_relationship);
        let mut roots: BTreeSet<u64> = self.pd_name.keys().copied().collect();
        roots.extend(self.pd_rep.keys().copied());
        self.roots = roots
            .into_iter()
            .filter(|definition| !maps.child_of.contains(definition))
            .collect();
    }

    /// Read one entity into the foreign product index.
    fn scan(&mut self, id: u64, entity: &Entity, maps: &mut Maps) {
        self.scan_product(id, entity, maps);
        self.scan_representation(id, entity, maps);
        self.scan_assembly(id, entity, maps);
    }

    /// The product structure: products, formations, definitions and their
    /// representations.
    fn scan_product(&mut self, id: u64, entity: &Entity, maps: &mut Maps) {
        match entity.name() {
            "PRODUCT" => {
                let name = text(entity.params(), 1);
                maps.products.insert(
                    id,
                    if name.trim().is_empty() {
                        text(entity.params(), 0)
                    } else {
                        name
                    },
                );
            }
            "PRODUCT_DEFINITION_FORMATION"
            | "PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE" => {
                if let Some(product) = reference(entity.params(), 2) {
                    maps.formations.insert(id, product);
                }
            }
            "PRODUCT_DEFINITION" => {
                if let Some(formation) = reference(entity.params(), 2) {
                    maps.definition_formation.insert(id, formation);
                }
            }
            "PRODUCT_DEFINITION_SHAPE" => {
                if let Some(definition) = reference(entity.params(), 2) {
                    maps.definitions.insert(id, definition);
                }
            }
            _ => {}
        }
    }

    /// A product definition's representations and the relations between them.
    fn scan_representation(&mut self, _id: u64, entity: &Entity, maps: &mut Maps) {
        match entity.name() {
            "SHAPE_DEFINITION_REPRESENTATION" => {
                if let (Some(shape), Some(representation)) =
                    (reference(entity.params(), 0), reference(entity.params(), 1))
                {
                    maps.relationships.insert(shape, representation);
                }
            }
            "SHAPE_REPRESENTATION_RELATIONSHIP" => {
                if let (Some(a), Some(b)) =
                    (reference(entity.params(), 2), reference(entity.params(), 3))
                {
                    maps.edges.entry(a).or_default().push(b);
                    maps.edges.entry(b).or_default().push(a);
                }
            }
            _ => {}
        }
    }

    /// The assembly structure and presentation: usages, styles and their
    /// transformations.
    fn scan_assembly(&mut self, id: u64, entity: &Entity, maps: &mut Maps) {
        match entity.name() {
            "NEXT_ASSEMBLY_USAGE_OCCURRENCE" => {
                if let (Some(parent), Some(child)) =
                    (reference(entity.params(), 3), reference(entity.params(), 4))
                {
                    maps.child_of.insert(child);
                    self.children.entry(parent).or_default().push(Nauo {
                        id,
                        child,
                        name: text(entity.params(), 1),
                        target: None,
                    });
                }
            }
            "STYLED_ITEM" => {
                if let Some(item) = reference(entity.params(), 2) {
                    self.styled_by_item.entry(item).or_default().push(id);
                }
            }
            "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION" => {
                if let (Some(relationship), Some(shape)) =
                    (reference(entity.params(), 0), reference(entity.params(), 1))
                {
                    maps.usage_shapes.push((shape, relationship));
                }
            }
            _ => {}
        }
    }

    /// Fill each assembly usage's target placement from its transformation.
    fn attach_targets(&mut self, relationships: &BTreeMap<u64, u64>) {
        for children in self.children.values_mut() {
            for nauo in children {
                nauo.target = relationships
                    .get(&nauo.id)
                    .and_then(|relationship| self.file.get(*relationship))
                    .and_then(|relationship| {
                        relationship.record("REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION")
                    })
                    .and_then(|params| params.first())
                    .and_then(Param::as_ref_id)
                    .and_then(|transform| self.file.get(transform))
                    .and_then(|transform| reference(transform.params(), 3));
            }
        }
    }

    // --------------------------------------------------------------- products

    fn representation_items(&mut self, definition: u64) -> Vec<u64> {
        let representations = self.representations(definition);
        let mut items = Vec::new();
        let mut seen = BTreeSet::new();
        for representation in representations {
            let Some(entity) = self.file.get(representation) else {
                continue;
            };
            let refs: Vec<u64> = entity
                .params()
                .get(1)
                .and_then(Param::as_list)
                .map(|items| items.iter().filter_map(Param::as_ref_id).collect())
                .unwrap_or_default();
            for item in refs {
                if let Some(copied) = self.entity(item, 0)
                    && seen.insert(copied)
                {
                    items.push(copied);
                }
            }
        }
        items
    }

    /// A product's representation and the representations related to it within
    /// the same product (not its assembly placements), sorted.
    fn representations(&self, definition: u64) -> Vec<u64> {
        let Some(start) = self.pd_rep.get(&definition).copied() else {
            return Vec::new();
        };
        let mut seen = BTreeSet::new();
        let mut pending = vec![start];
        while let Some(representation) = pending.pop() {
            if !seen.insert(representation) {
                continue;
            }
            if let Some(related) = self.related.get(&representation) {
                pending.extend(related);
            }
        }
        seen.into_iter().collect()
    }

    fn copy_product(&mut self, definition: u64, fallback: &str) -> u64 {
        let name = self.name_of(definition, fallback);
        let (_, shape) = self.out.product(&name);
        let mut items = self.representation_items(definition);
        self.attach_children(definition, shape, &mut items);
        let representation = match self.own_context(definition) {
            Some(context) => self.out.representation_in(&name, &items, false, context),
            None => self.out.representation(&name, &items, false),
        };
        self.out.definition_representation(shape, representation);
        self.out.pd_srep.insert(shape, representation);
        shape
    }

    /// The copied context of a model in other units than ours; None in ours.
    fn own_context(&mut self, definition: u64) -> Option<u64> {
        if self.native_units {
            return None;
        }
        let representation = *self.representations(definition).first()?;
        let context = self
            .file
            .get(representation)?
            .params()
            .get(2)
            .and_then(Param::as_ref_id)?;
        self.entity(context, 0)
    }

    fn attach_children(&mut self, definition: u64, parent: u64, items: &mut Vec<u64>) {
        let children = self.children.get(&definition).cloned().unwrap_or_default();
        for nauo in children {
            let fallback = self.name_of(nauo.child, "Part");
            let name = if nauo.name.trim().is_empty() {
                fallback
            } else {
                nauo.name
            };
            let child = self.copy_product(nauo.child, &name);
            let target = self.target(nauo.target, items);
            self.links.push(Link {
                parent_pd: parent,
                child_pd: child,
                target,
                name,
            });
        }
    }

    fn target(&mut self, target: Option<u64>, items: &mut Vec<u64>) -> u64 {
        if let Some(target) = target
            && let Some(copied) = self.entity(target, 0)
        {
            if !items.contains(&copied) {
                items.push(copied);
            }
            return copied;
        }
        let placement = self.out.placement(&IDENTITY);
        items.push(placement);
        placement
    }

    fn name_of(&self, definition: u64, fallback: &str) -> String {
        self.pd_name
            .get(&definition)
            .map(String::as_str)
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .unwrap_or(fallback)
            .to_owned()
    }

    // ---------------------------------------------------------------- entities

    fn entity(&mut self, id: u64, depth: usize) -> Option<u64> {
        if let Some(copied) = self.map.get(&id) {
            return Some(*copied);
        }
        if depth > MAX_DEPTH {
            return None;
        }
        if let Some(context) = self.context(id) {
            self.map.insert(id, context);
            return Some(context);
        }
        let entity = self.file.get(id)?.clone();
        let text = self.entity_text(&entity, depth);
        let copied = self.out.add_shared(text);
        self.map.insert(id, copied);
        if let Some(styles) = self.styled_by_item.get(&id).cloned() {
            for style in styles {
                if let Some(style) = self.entity(style, depth + 1) {
                    self.out.styled.insert(style);
                }
            }
        }
        Some(copied)
    }

    fn entity_text(&mut self, entity: &Entity, depth: usize) -> String {
        let mut text = String::new();
        if entity.is_complex() {
            text.push('(');
        }
        for record in &entity.records {
            text.push_str(&record.name);
            text.push('(');
            for (index, param) in record.params.iter().enumerate() {
                if index > 0 {
                    text.push(',');
                }
                self.param(param, depth + 1, &mut text);
            }
            text.push(')');
        }
        if entity.is_complex() {
            text.push(')');
        }
        text
    }

    fn param(&mut self, param: &Param, depth: usize, text: &mut String) {
        match param {
            Param::Int(value) => text.push_str(&value.to_string()),
            Param::Real(value) => text.push_str(&real(*value)),
            Param::Str(value) => text.push_str(&string(value)),
            Param::Enum(value) => {
                text.push('.');
                text.push_str(value);
                text.push('.');
            }
            Param::Ref(id) => self.reference(*id, depth, text),
            Param::List(values) => self.sequence(None, values, depth, text),
            Param::Typed(name, values) => self.sequence(Some(name), values, depth, text),
            Param::Binary(value) => {
                text.push('"');
                text.push_str(value);
                text.push('"');
            }
            Param::Null => text.push('$'),
            Param::Derived => text.push('*'),
        }
    }

    fn reference(&mut self, id: u64, depth: usize, text: &mut String) {
        match self.entity(id, depth + 1) {
            Some(copied) => {
                text.push('#');
                text.push_str(&copied.to_string());
            }
            None => text.push('$'),
        }
    }

    fn sequence(&mut self, name: Option<&str>, values: &[Param], depth: usize, text: &mut String) {
        if let Some(name) = name {
            text.push_str(name);
        }
        text.push('(');
        for (index, value) in values.iter().enumerate() {
            if index > 0 {
                text.push(',');
            }
            self.param(value, depth + 1, text);
        }
        text.push(')');
    }

    /// The output entity for a foreign context or unit, our own.
    fn context(&self, id: u64) -> Option<u64> {
        let entity = self.file.get(id)?;
        self.context_keyword(entity)
            .or_else(|| self.context_unit(entity))
    }

    fn context_keyword(&self, entity: &Entity) -> Option<u64> {
        if !self.native_units && entity.name() == "UNCERTAINTY_MEASURE_WITH_UNIT" {
            return None;
        }
        match entity.name() {
            "APPLICATION_CONTEXT" => Some(self.out.app),
            "APPLICATION_PROTOCOL_DEFINITION" => Some(self.out.protocol),
            "PRODUCT_CONTEXT" => Some(self.out.pctx),
            "PRODUCT_DEFINITION_CONTEXT" => Some(self.out.pdctx),
            "UNCERTAINTY_MEASURE_WITH_UNIT" => Some(self.out.unc),
            _ => None,
        }
    }

    fn context_unit(&self, entity: &Entity) -> Option<u64> {
        if !self.native_units {
            return None;
        }
        if entity.has("GEOMETRIC_REPRESENTATION_CONTEXT")
            || entity.has("GLOBAL_UNIT_ASSIGNED_CONTEXT")
            || entity.has("GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT")
            || entity.has("REPRESENTATION_CONTEXT")
        {
            return Some(self.out.ctx);
        }
        if entity.has("LENGTH_UNIT") {
            return Some(self.out.mm);
        }
        if entity.has("PLANE_ANGLE_UNIT") {
            return Some(self.out.rad);
        }
        if entity.has("SOLID_ANGLE_UNIT") {
            return Some(self.out.sr);
        }
        None
    }
}

/// Whether every length unit of `file` is the millimetre and every plane angle
/// unit the radian (SI units, as the output's own context declares them).
fn native_units(file: &File) -> bool {
    let si = |entity: &Entity, prefix: Option<&str>, name: &str| {
        entity.record("SI_UNIT").is_some_and(|params| {
            params.first().and_then(Param::as_enum) == prefix
                && params.get(1).and_then(Param::as_enum) == Some(name)
        })
    };
    file.entities.values().all(|entity| {
        if entity.has("LENGTH_UNIT") {
            si(entity, Some("MILLI"), "METRE")
        } else if entity.has("PLANE_ANGLE_UNIT") {
            si(entity, None, "RADIAN")
        } else {
            true
        }
    })
}

fn reference(params: &[Param], index: usize) -> Option<u64> {
    params.get(index).and_then(Param::as_ref_id)
}

fn text(params: &[Param], index: usize) -> String {
    params
        .get(index)
        .and_then(Param::as_str)
        .unwrap_or_default()
        .to_owned()
}
