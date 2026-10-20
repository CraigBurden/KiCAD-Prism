use prism_kicad_core::{
    SchematicBundleLimits, SourceBundleErrorKind, parse_symbol_library_symbols,
};

const CONNECTOR: &str = r#"(kicad_symbol_lib
  (version 20241209)
  (generator "kicad_symbol_editor")
  (generator_version "9.0")
  (symbol "Conn_01x04"
    (pin_names (offset 1.016) hide)
    (in_bom yes)
    (on_board yes)
    (property "Reference" "J" (at 0 5.08 0) (effects (font (size 1.27 1.27))))
    (property "Value" "Conn_01x04" (at 0 -7.62 0) (effects (font (size 1.27 1.27))))
    (symbol "Conn_01x04_0_1"
      (rectangle (start -1.27 3.81) (end 1.27 -3.81)
        (stroke (width 0.254) (type default))
        (fill (type background)))
      (pin passive line (at -5.08 2.54 0) (length 3.81)
        (name "Pin_1" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin passive line (at -5.08 0 0) (length 3.81)
        (name "Pin_2" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27))))))
    (symbol "Conn_01x04_1_1"
      (pin passive line (at -5.08 -2.54 0) (length 3.81)
        (name "Pin_3" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27)))))
      (pin power_in line (at -5.08 -5.08 0) (length 3.81)
        (name "VCC" (effects (font (size 1.27 1.27))))
        (number "4" (effects (font (size 1.27 1.27)))))))
)
"#;

#[test]
fn two_unit_connector_library_reads_every_pin_once_in_order() {
    let symbols = parse_symbol_library_symbols(CONNECTOR, "Conn_01x04.kicad_sym", limits())
        .expect("connector library");
    assert_eq!(symbols.len(), 1);
    let symbol = &symbols[0];
    assert_eq!(symbol.name, "Conn_01x04");
    assert_eq!(symbol.extends, None);
    assert_eq!(symbol.subsymbols.len(), 2);
    assert_eq!(
        (symbol.subsymbols[0].unit, symbol.subsymbols[0].style),
        (0, 1)
    );
    assert_eq!(
        (symbol.subsymbols[1].unit, symbol.subsymbols[1].style),
        (1, 1)
    );

    let pins = symbol.unique_pins();
    let actual = pins
        .iter()
        .map(|pin| {
            (
                pin.number.as_str(),
                pin.name.as_str(),
                pin.electrical_type.as_str(),
            )
        })
        .collect::<Vec<_>>();
    assert_eq!(
        actual,
        vec![
            ("1", "Pin_1", "passive"),
            ("2", "Pin_2", "passive"),
            ("3", "Pin_3", "passive"),
            ("4", "VCC", "power_in"),
        ]
    );
}

#[test]
fn library_with_two_symbols_returns_both_by_name() {
    let source = r#"(kicad_symbol_lib
  (version 20241209)
  (generator "kicad_symbol_editor")
  (symbol "Device:R"
    (property "Reference" "R")
    (symbol "Device:R_1_1"
      (pin passive line (at 0 3.81 270) (length 1.27)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin passive line (at 0 -3.81 90) (length 1.27)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))))
  (symbol "Device:C"
    (property "Reference" "C")
    (symbol "Device:C_1_1"
      (pin passive line (at 0 3.81 270) (length 2.54)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin passive line (at 0 -3.81 90) (length 2.54)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))))
)
"#;
    let symbols = parse_symbol_library_symbols(source, "Device.kicad_sym", limits())
        .expect("two-symbol library");
    assert_eq!(
        symbols
            .iter()
            .map(|symbol| symbol.name.as_str())
            .collect::<Vec<_>>(),
        vec!["Device:R", "Device:C"]
    );
    assert_eq!(symbols[0].unique_pins().len(), 2);
    assert_eq!(symbols[1].unique_pins().len(), 2);
}

#[test]
fn derived_symbol_keeps_its_extends_target() {
    let source = r#"(kicad_symbol_lib
  (version 20241209)
  (generator "kicad_symbol_editor")
  (symbol "Base"
    (symbol "Base_1_1"
      (pin input line (at 0 0 0) (length 2.54)
        (name "A" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))))
  (symbol "Derived"
    (extends "Base"))
)
"#;
    let symbols =
        parse_symbol_library_symbols(source, "Derived.kicad_sym", limits()).expect("derived");
    assert_eq!(symbols.len(), 2);
    assert_eq!(symbols[0].extends, None);
    assert_eq!(symbols[1].name, "Derived");
    assert_eq!(symbols[1].extends.as_deref(), Some("Base"));
    assert!(symbols[1].subsymbols.is_empty());
}

#[test]
fn duplicate_pin_numbers_keep_the_first_seen_pin() {
    let source = r#"(kicad_symbol_lib
  (version 20241209)
  (generator "kicad_symbol_editor")
  (symbol "R"
    (symbol "R_1_1"
      (pin passive line (at 0 3.81 270) (length 1.27)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin passive line (at 0 -3.81 90) (length 1.27)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27))))))
    (symbol "R_1_2"
      (pin passive line (at 0 3.81 270) (length 1.27)
        (name "ALT_1" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin passive line (at 0 -3.81 90) (length 1.27)
        (name "ALT_2" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))))
)
"#;
    let symbols = parse_symbol_library_symbols(source, "R.kicad_sym", limits()).expect("styles");
    let pins = symbols[0].unique_pins();
    assert_eq!(
        pins.iter()
            .map(|pin| (pin.number.as_str(), pin.name.as_str()))
            .collect::<Vec<_>>(),
        vec![("1", "~"), ("2", "~")]
    );
}

#[test]
fn empty_library_returns_no_symbols() {
    let source = r#"(kicad_symbol_lib
  (version 20241209)
  (generator "kicad_symbol_editor")
)
"#;
    let symbols =
        parse_symbol_library_symbols(source, "Empty.kicad_sym", limits()).expect("empty library");
    assert!(symbols.is_empty());
}

#[test]
fn file_that_is_not_a_symbol_library_is_an_error() {
    let schematic = r#"(kicad_sch (version 20231120) (generator eeschema))"#;
    assert_eq!(
        parse_symbol_library_symbols(schematic, "board.kicad_sch", limits())
            .expect_err("schematic source")
            .kind,
        SourceBundleErrorKind::Schematic
    );

    let two_roots = r#"(kicad_symbol_lib) (kicad_symbol_lib)"#;
    assert_eq!(
        parse_symbol_library_symbols(two_roots, "Twice.kicad_sym", limits())
            .expect_err("two roots")
            .kind,
        SourceBundleErrorKind::Schematic
    );
}

fn limits() -> SchematicBundleLimits {
    SchematicBundleLimits::default()
}
