//! STEP (ISO 10303-21/AP242) for System Builder's STEP assembly.
//!
//! [`p21`] parses a Part 21 file; [`assembly`] writes an AP242 product tree,
//! copying foreign models read back with the parser and writing tessellated
//! harness tubes; [`tube`] builds a tube mesh along a routed path.
//!
//! The Part 21 parser and the assembly/copy structure are adapted from
//! SolidCraft (`crates/kernel/src/step_in/p21.rs` and
//! `crates/kernel/src/step_out.rs`, MIT OR Apache-2.0, commit a0c1a67; see the
//! repository's `NOTICE` and `docs/architecture/native-provenance.md`).

pub mod assembly;
pub mod p21;
pub mod tube;

pub use assembly::{Assembly, Content, ForeignStep, IDENTITY, Matrix4, Mesh, Product, write};
pub use tube::tube;
