use super::*;

fn options(prefixes: &[&str], refs: &[&str]) -> LoadOptions {
    LoadOptions {
        prefixes: prefixes.iter().map(|value| (*value).to_owned()).collect(),
        refs: refs.iter().map(|value| (*value).to_owned()).collect(),
        exclude_prefixes: vec!["JP".to_owned()],
        exclude_refs: Vec::new(),
        model_dirs: BTreeMap::new(),
    }
}

#[test]
fn a_solder_jumper_is_not_a_connector() {
    let mut selection = options(&["J", "P"], &[]);
    assert!(selection.selects("J3"));
    assert!(!selection.selects("JP3"));
    selection.exclude_refs = vec!["J4".to_owned()];
    assert!(!selection.selects("J4"));
    assert!(selection.selects("J40"));
    selection.exclude_prefixes.clear();
    assert!(selection.selects("JP3"));
}

#[test]
fn the_selection_is_prefixes_or_exact_references() {
    let prefixes = options(&["J", "CN"], &[]);
    assert!(prefixes.selects("J1"));
    assert!(prefixes.selects("CN3"));
    assert!(!prefixes.selects("R1"));
    let refs = options(&["J", "CN"], &["J2"]);
    assert!(refs.selects("J2"));
    assert!(!refs.selects("J1"));
}

#[test]
fn the_identification_keeps_only_fields_with_values() {
    let fields = RecordString(BTreeMap::from([
        ("Description".to_owned(), "A connector".to_owned()),
        ("Manufacturer".to_owned(), String::new()),
        ("Part Number".to_owned(), "ABC-1".to_owned()),
    ]));
    assert_eq!(field(&fields, &DESCRIPTION), Some("A connector"));
    assert_eq!(field(&fields, &MANUFACTURER), None);
    assert_eq!(field(&fields, &PART_NUMBER), Some("ABC-1"));
}

#[test]
fn a_missing_model_is_reported_with_its_reason() {
    assert_eq!(
        ModelState::Unavailable { reference: None }.reason(),
        Some("model-unavailable")
    );
    assert_eq!(
        ModelState::NotStep {
            reference: "a.wrl".to_owned()
        }
        .reason(),
        Some("model-not-step")
    );
}

#[test]
fn the_view_plan_puts_the_mating_face_in_front() {
    let plan = views_plan(MatingFace::PosX);
    assert_eq!(plan[0].0, ViewRole::Top);
    assert_eq!(plan[1].1, [1.0, 0.0, 0.0]);
    assert_eq!(plan[2].1, [0.0, -1.0, 0.0]);
}

#[test]
fn a_pinout_continues_after_the_first_sheets_rows() {
    assert_eq!(pages(sheet::ROWS_FIRST), 1);
    assert_eq!(pages(sheet::ROWS_FIRST + 1), 2);
    assert_eq!(pages(sheet::ROWS_FIRST + sheet::ROWS_CONTINUATION + 1), 3);
}

#[test]
fn an_unreadable_bundle_reports_the_path() {
    assert!(Bundle::open(std::path::Path::new("/nonexistent/board.prism")).is_err());
}
