use super::*;
use crate::p21::{Param, parse};

const FOREIGN: &str = "\
ISO-10303-21;
HEADER;FILE_DESCRIPTION((''),'2;1');FILE_NAME('part','1970-01-01T00:00:00',(''),(''),'','test','');FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));ENDSEC;
DATA;
#1=APPLICATION_CONTEXT('automotive design');
#2=PRODUCT_CONTEXT('',#1,'mechanical');
#3=PRODUCT_DEFINITION_CONTEXT('part definition',#1,'design');
#4=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));
#5=(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.));
#6=(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT());
#7=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-06),#4,'','');
#8=(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#7))GLOBAL_UNIT_ASSIGNED_CONTEXT((#4,#5,#6))REPRESENTATION_CONTEXT('',''));
#10=CARTESIAN_POINT('',(0.,0.,0.));
#11=DIRECTION('',(0.,0.,1.));
#12=DIRECTION('',(1.,0.,0.));
#13=AXIS2_PLACEMENT_3D('',#10,#11,#12);
#14=PLANE('',#13);
#15=ADVANCED_FACE('',(),#14,.T.);
#16=CLOSED_SHELL('',(#15));
#17=MANIFOLD_SOLID_BREP('Body',#16);
#20=PRODUCT('part','Part 1','',(#2));
#21=PRODUCT_DEFINITION_FORMATION('','',#20);
#22=PRODUCT_DEFINITION('design','',#21,#3);
#23=PRODUCT_DEFINITION_SHAPE('','',#22);
#24=SHAPE_REPRESENTATION('Part 1',(#17,#13),#8);
#25=SHAPE_DEFINITION_REPRESENTATION(#23,#24);
#30=COLOUR_RGB('',1.,0.,0.);
#31=FILL_AREA_STYLE_COLOUR('',#30);
#32=FILL_AREA_STYLE('',(#31));
#33=SURFACE_STYLE_FILL_AREA(#32);
#34=SURFACE_SIDE_STYLE('',(#33));
#35=SURFACE_STYLE_USAGE(.BOTH.,#34);
#36=PRESENTATION_STYLE_ASSIGNMENT((#35));
#37=STYLED_ITEM('color',(#36),#17);
#38=MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('',(#37),#8);
ENDSEC;
END-ISO-10303-21;
";

const WITH_CHILD: &str = "\
ISO-10303-21;
HEADER;FILE_DESCRIPTION((''),'2;1');FILE_NAME('assy','1970-01-01T00:00:00',(''),(''),'','test','');FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));ENDSEC;
DATA;
#1=APPLICATION_CONTEXT('automotive design');
#2=PRODUCT_CONTEXT('',#1,'mechanical');
#3=PRODUCT_DEFINITION_CONTEXT('part definition',#1,'design');
#4=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));
#5=(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.));
#6=(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT());
#7=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-06),#4,'','');
#8=(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#7))GLOBAL_UNIT_ASSIGNED_CONTEXT((#4,#5,#6))REPRESENTATION_CONTEXT('',''));
#10=CARTESIAN_POINT('',(0.,0.,0.));
#11=DIRECTION('',(0.,0.,1.));
#12=DIRECTION('',(1.,0.,0.));
#13=AXIS2_PLACEMENT_3D('',#10,#11,#12);
#14=PLANE('',#13);
#15=ADVANCED_FACE('',(),#14,.T.);
#16=CLOSED_SHELL('',(#15));
#17=MANIFOLD_SOLID_BREP('Body',#16);
#20=PRODUCT('root','Root','',(#2));
#21=PRODUCT_DEFINITION_FORMATION('','',#20);
#22=PRODUCT_DEFINITION('design','',#21,#3);
#23=PRODUCT_DEFINITION_SHAPE('','',#22);
#24=SHAPE_REPRESENTATION('Root',(#17,#13),#8);
#25=SHAPE_DEFINITION_REPRESENTATION(#23,#24);
#40=PRODUCT('child','Child','',(#2));
#41=PRODUCT_DEFINITION_FORMATION('','',#40);
#42=PRODUCT_DEFINITION('design','',#41,#3);
#43=PRODUCT_DEFINITION_SHAPE('','',#42);
#44=SHAPE_REPRESENTATION('Child',(#17),#8);
#45=SHAPE_DEFINITION_REPRESENTATION(#43,#44);
#50=NEXT_ASSEMBLY_USAGE_OCCURRENCE('1','Child:1','',#22,#42,$);
#51=PRODUCT_DEFINITION_SHAPE('','',#50);
#52=ITEM_DEFINED_TRANSFORMATION('','',#13,#53);
#53=AXIS2_PLACEMENT_3D('',#54,#11,#12);
#54=CARTESIAN_POINT('',(1.,2.,3.));
#55=(REPRESENTATION_RELATIONSHIP('','',#44,#24)REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(#52)SHAPE_REPRESENTATION_RELATIONSHIP());
#56=CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#55,#51);
ENDSEC;
END-ISO-10303-21;
";

fn foreign(text: &str) -> ForeignStep {
    ForeignStep::new(parse(text).expect("the fixture parses"))
}

fn translation(x: f64, y: f64, z: f64) -> Matrix4 {
    let mut matrix = IDENTITY;
    matrix[3] = [x, y, z, 1.0];
    matrix
}

fn entities<'a>(file: &'a File, name: &str) -> Vec<&'a crate::p21::Entity> {
    file.entities
        .values()
        .filter(|entity| entity.name() == name)
        .collect()
}

fn text_param(entity: &crate::p21::Entity, index: usize) -> Option<&str> {
    entity.params().get(index).and_then(Param::as_str)
}

fn assert_dense(file: &File) {
    let last = file.entities.len() as u64;
    assert_eq!(
        file.entities.keys().copied().collect::<Vec<_>>(),
        (1..=last).collect::<Vec<_>>()
    );
}

fn root_with_copies() -> Assembly {
    Assembly {
        name: "System".to_owned(),
        products: vec![
            Product {
                name: "System".to_owned(),
                content: Content::Empty,
                children: vec![
                    (1, translation(0.0, 0.0, 0.0), "Copy 1".to_owned()),
                    (2, translation(100.0, 0.0, 0.0), "Copy 2".to_owned()),
                ],
            },
            Product {
                name: "Copy 1".to_owned(),
                content: Content::Foreign(foreign(FOREIGN)),
                children: Vec::new(),
            },
            Product {
                name: "Copy 2".to_owned(),
                content: Content::Foreign(foreign(FOREIGN)),
                children: Vec::new(),
            },
        ],
    }
}

#[test]
fn two_placed_copies_of_one_model_resolve() {
    let text = write(&root_with_copies());
    let file = parse(&text).expect("the output parses");
    assert_dense(&file);
    let usages = entities(&file, "NEXT_ASSEMBLY_USAGE_OCCURRENCE");
    assert_eq!(usages.len(), 2, "one usage per placed copy");
    let names: Vec<&str> = usages
        .iter()
        .filter_map(|usage| text_param(usage, 1))
        .collect();
    assert_eq!(names, ["Copy 1", "Copy 2"]);
    // The model's solid and colour are written once and shared.
    assert_eq!(entities(&file, "MANIFOLD_SOLID_BREP").len(), 1);
    assert_eq!(entities(&file, "STYLED_ITEM").len(), 1);
    // Every foreign context was replaced: the output has one representation
    // context, and the solid refers to our millimetre context.
    assert_eq!(
        file.entities
            .values()
            .filter(|entity| entity.has("GEOMETRIC_REPRESENTATION_CONTEXT"))
            .count(),
        1
    );
    assert!(text.contains("AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF"));
    assert!(text.contains("'1970-01-01T00:00:00'"));
    // Both occurrences' target placements are present (the model's own
    // identity placement is shared with the output origin).
    let placements = entities(&file, "AXIS2_PLACEMENT_3D");
    assert!(placements.len() >= 2, "the origin and the second copy");
}

#[test]
fn the_foreign_product_tree_is_kept() {
    let assembly = Assembly {
        name: "System".to_owned(),
        products: vec![
            Product {
                name: "System".to_owned(),
                content: Content::Empty,
                children: vec![(1, IDENTITY, "Assy".to_owned())],
            },
            Product {
                name: "Assy".to_owned(),
                content: Content::Foreign(foreign(WITH_CHILD)),
                children: Vec::new(),
            },
        ],
    };
    let text = write(&assembly);
    let file = parse(&text).expect("the output parses");
    assert_dense(&file);
    let usages = entities(&file, "NEXT_ASSEMBLY_USAGE_OCCURRENCE");
    assert_eq!(usages.len(), 2, "the assembly and its child");
    let products: Vec<&str> = entities(&file, "PRODUCT")
        .iter()
        .filter_map(|product| text_param(product, 1))
        .collect();
    assert!(products.contains(&"System"));
    assert!(products.contains(&"Assy"));
    assert!(
        products.contains(&"Child"),
        "the foreign child product is kept: {products:?}"
    );
}

#[test]
fn writing_twice_is_identical() {
    let assembly = root_with_copies();
    assert_eq!(write(&assembly), write(&assembly));
    let tube_assembly = Assembly {
        name: "Tubes".to_owned(),
        products: vec![Product {
            name: "Harness H1".to_owned(),
            content: Content::Tessellated(vec![crate::tube::tube(
                &[[0.0, 0.0, 0.0], [10.0, 0.0, 0.0], [10.0, 10.0, 0.0]],
                1.5,
                16,
            )]),
            children: Vec::new(),
        }],
    };
    assert_eq!(write(&tube_assembly), write(&tube_assembly));
}

#[test]
fn meshes_are_faceted_brep_solids() {
    let mut mesh = crate::tube::tube(&[[0.0, 0.0, 0.0], [0.0, 0.0, 10.0]], 2.0, 16);
    mesh.name = "harness/end_a~end_b".to_owned();
    mesh.colour = Some([0.6, 0.6, 0.6]);
    let triangles = mesh.triangles.len();
    let vertices = mesh.positions.len();
    let assembly = Assembly {
        name: "Tubes".to_owned(),
        products: vec![Product {
            name: "Harness H1".to_owned(),
            content: Content::Tessellated(vec![mesh]),
            children: Vec::new(),
        }],
    };
    let text = write(&assembly);
    let file = parse(&text).expect("the output parses");
    assert_dense(&file);
    assert_eq!(entities(&file, "MANIFOLD_SOLID_BREP").len(), 1);
    assert_eq!(entities(&file, "CLOSED_SHELL").len(), 1);
    assert_eq!(
        entities(&file, "ADVANCED_FACE").len(),
        triangles,
        "a face per triangle"
    );
    assert_eq!(
        entities(&file, "VERTEX_POINT").len(),
        vertices,
        "vertices shared"
    );
    // A closed triangle mesh has 3/2 edges per face, each shared by two faces.
    assert_eq!(entities(&file, "EDGE_CURVE").len() * 2, triangles * 3);
    assert_eq!(entities(&file, "TESSELLATED_SHELL").len(), 0);
    assert_eq!(
        entities(&file, "STYLED_ITEM").len(),
        1,
        "the tube is coloured"
    );
}

#[test]
fn an_inch_model_keeps_its_own_units() {
    let inch = FOREIGN.replace(
        "#4=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));",
        "#4=(CONVERSION_BASED_UNIT('INCH',#9)LENGTH_UNIT()NAMED_UNIT(#60));\n\
         #9=LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(25.4),#61);\n\
         #60=DIMENSIONAL_EXPONENTS(1.,0.,0.,0.,0.,0.,0.);\n\
         #61=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));",
    );
    let assembly = Assembly {
        name: "System".to_owned(),
        products: vec![
            Product {
                name: "System".to_owned(),
                content: Content::Empty,
                children: vec![(1, translation(0.0, 0.0, 0.0), "Part".to_owned())],
            },
            Product {
                name: "Part".to_owned(),
                content: Content::Foreign(foreign(&inch)),
                children: Vec::new(),
            },
        ],
    };
    let text = write(&assembly);
    let file = parse(&text).expect("the output parses");
    assert_dense(&file);
    // The part's own context (in inches) is copied beside ours, not replaced by it.
    assert!(text.contains("CONVERSION_BASED_UNIT('INCH'"));
    assert_eq!(
        file.entities
            .values()
            .filter(|entity| entity.has("GEOMETRIC_REPRESENTATION_CONTEXT"))
            .count(),
        2
    );
}

#[test]
fn a_usage_placement_resolves_when_its_shape_comes_later() {
    // KiCad writes each CONTEXT_DEPENDENT_SHAPE_REPRESENTATION before the
    // PRODUCT_DEFINITION_SHAPE of its usage: the placement must still be found.
    let later = WITH_CHILD
        .replace(
            "#51=PRODUCT_DEFINITION_SHAPE('','',#50);",
            "#99=PRODUCT_DEFINITION_SHAPE('','',#50);",
        )
        .replace(
            "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#55,#51)",
            "CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#55,#99)",
        );
    assert!(
        later.contains("CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#55,#99)"),
        "the fixture names its usage shape"
    );
    let assembly = Assembly {
        name: "System".to_owned(),
        products: vec![
            Product {
                name: "System".to_owned(),
                content: Content::Empty,
                children: vec![(1, translation(0.0, 0.0, 0.0), "Assy".to_owned())],
            },
            Product {
                name: "Assy".to_owned(),
                content: Content::Foreign(foreign(&later)),
                children: Vec::new(),
            },
        ],
    };
    let text = write(&assembly);
    // The child's (1, 2, 3) placement is carried into the output (not the identity).
    assert!(
        text.contains("(1.0,2.0,3.0)"),
        "the usage keeps its placement"
    );
}
