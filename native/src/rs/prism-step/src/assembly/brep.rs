//! A triangle mesh as a faceted B-rep solid (§18).
//!
//! Every STEP reader handles a `MANIFOLD_SOLID_BREP` of planar faces, while
//! AP242 tessellated shells are skipped by OpenCASCADE-based tools by default.
//! Each triangle is an `ADVANCED_FACE` on its `PLANE`, bounded by one
//! `EDGE_LOOP`; vertices and edges are shared between faces, so a closed mesh
//! is a closed shell.

use std::collections::BTreeMap;

use super::{Mesh, Out, string, unit};

fn sub(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

fn cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

impl Out {
    /// The mesh as a `MANIFOLD_SOLID_BREP`; `None` without a usable triangle.
    pub(crate) fn brep(&mut self, mesh: &Mesh) -> Option<u64> {
        let count = mesh.positions.len();
        let mut vertices: BTreeMap<u32, u64> = BTreeMap::new();
        let mut edges: BTreeMap<(u32, u32), u64> = BTreeMap::new();
        let mut faces = Vec::new();
        for triangle in &mesh.triangles {
            if triangle.iter().any(|index| *index as usize >= count) {
                continue;
            }
            let [a, b, c] = triangle.map(|index| mesh.positions[index as usize]);
            let (Some(normal), Some(across)) = (unit(cross(sub(b, a), sub(c, a))), unit(sub(b, a)))
            else {
                continue; // a degenerate triangle has no plane
            };
            let mut oriented = Vec::with_capacity(3);
            for (from, to) in [
                (triangle[0], triangle[1]),
                (triangle[1], triangle[2]),
                (triangle[2], triangle[0]),
            ] {
                let key = (from.min(to), from.max(to));
                let edge = match edges.get(&key) {
                    Some(edge) => *edge,
                    None => {
                        let edge = self.edge(mesh, key, &mut vertices);
                        edges.insert(key, edge);
                        edge
                    }
                };
                let sense = if from < to { ".T." } else { ".F." };
                oriented.push(self.add(format!("ORIENTED_EDGE('',*,*,#{edge},{sense})")));
            }
            let list = oriented
                .iter()
                .map(|id| format!("#{id}"))
                .collect::<Vec<_>>()
                .join(",");
            let edge_loop = self.add(format!("EDGE_LOOP('',({list}))"));
            let bound = self.add(format!("FACE_OUTER_BOUND('',#{edge_loop},.T.)"));
            let (origin, axis, direction) = (
                self.point(a),
                self.direction(normal),
                self.direction(across),
            );
            let placement = self.add(format!(
                "AXIS2_PLACEMENT_3D('',#{origin},#{axis},#{direction})"
            ));
            let plane = self.add(format!("PLANE('',#{placement})"));
            faces.push(self.add(format!("ADVANCED_FACE('',(#{bound}),#{plane},.T.)")));
        }
        if faces.is_empty() {
            return None;
        }
        let list = faces
            .iter()
            .map(|id| format!("#{id}"))
            .collect::<Vec<_>>()
            .join(",");
        let shell = self.add(format!("CLOSED_SHELL('',({list}))"));
        let solid = self.add(format!(
            "MANIFOLD_SOLID_BREP({},#{shell})",
            string(&mesh.name)
        ));
        if let Some(colour) = mesh.colour {
            self.style(solid, colour);
        }
        Some(solid)
    }

    /// The straight edge between two mesh vertices, from the lower index.
    fn edge(
        &mut self,
        mesh: &Mesh,
        (from, to): (u32, u32),
        vertices: &mut BTreeMap<u32, u64>,
    ) -> u64 {
        let start = self.vertex(mesh, from, vertices);
        let end = self.vertex(mesh, to, vertices);
        let (a, b) = (mesh.positions[from as usize], mesh.positions[to as usize]);
        let delta = sub(b, a);
        let length = (delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2]).sqrt();
        let direction = self.direction(unit(delta).unwrap_or([1.0, 0.0, 0.0]));
        let vector = self.add(format!("VECTOR('',#{direction},{})", super::real(length)));
        let origin = self.point(a);
        let line = self.add(format!("LINE('',#{origin},#{vector})"));
        self.add(format!("EDGE_CURVE('',#{start},#{end},#{line},.T.)"))
    }

    fn vertex(&mut self, mesh: &Mesh, index: u32, vertices: &mut BTreeMap<u32, u64>) -> u64 {
        if let Some(vertex) = vertices.get(&index) {
            return *vertex;
        }
        let point = self.point(mesh.positions[index as usize]);
        let vertex = self.add(format!("VERTEX_POINT('',#{point})"));
        vertices.insert(index, vertex);
        vertex
    }
}
