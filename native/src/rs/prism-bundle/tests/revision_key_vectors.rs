//! The Rust reference of the design revision key reproduces every vector of
//! `native/contracts/prism/revision-key-vectors.json` (revision-key.md §13,
//! ADR §9.3): 30 selection vectors, 7 hashing vectors and 13 relations.

use prism_bundle::generator::hex;
use prism_bundle::revision_key::{
    EffectiveConfig, Entry, KeySource, ListingRecord, ObjectFormat, Selection, canonical_config,
    config_digest, preimage, record, revision_key, select,
};
use serde_json::Value;
use std::collections::BTreeMap;

const VECTORS: &str = include_str!("../../../../contracts/prism/revision-key-vectors.json");

fn vectors() -> Value {
    serde_json::from_str(VECTORS).unwrap()
}

fn config_of(vector: &Value) -> Result<EffectiveConfig, String> {
    let text = serde_json::to_vec(&vector["config"]).unwrap();
    prism_bundle::revision_key::parse_config(&text).map_err(|error| error.code.to_owned())
}

fn listing(vector: &Value) -> Vec<ListingRecord> {
    vector["listing"]
        .as_array()
        .unwrap()
        .iter()
        .map(|record| ListingRecord {
            mode: record["mode"].as_str().unwrap().to_owned(),
            kind: record["type"].as_str().unwrap().to_owned(),
            object_id: record["object_id"].as_str().unwrap().to_owned(),
            path: record["path"].as_str().unwrap().as_bytes().to_vec(),
        })
        .collect()
}

fn format_of(vector: &Value) -> ObjectFormat {
    ObjectFormat::parse(vector["object_format"].as_str().unwrap()).unwrap()
}

/// The outcome of a selection vector: `Ok(key)` or `Err(code)`.
fn outcome(vector: &Value) -> Result<(String, Value), String> {
    let config = config_of(vector)?;
    let format = format_of(vector);
    match select(&listing(vector), &config, format).map_err(|error| error.code.to_owned())? {
        Selection::ProjectAbsent => Err("project-absent".to_owned()),
        Selection::Selected(entries) => {
            let record = record(format, &KeySource::Worktree, &config, &entries, &[]).unwrap();
            let value = serde_json::to_value(&record).unwrap();
            Ok((revision_key(format, &config, &entries), value))
        }
    }
}

#[test]
fn every_selection_vector_reproduces() {
    let vectors = vectors();
    let selection = vectors["selection"].as_array().unwrap();
    assert_eq!(selection.len(), 30);
    for vector in selection {
        let name = vector["name"].as_str().unwrap();
        let expected = &vector["expected"];
        match (outcome(vector), expected["kind"].as_str()) {
            (Ok((key, record)), Some("selected")) => {
                assert_eq!(key, expected["revision_key"], "{name}: revision key");
                assert_eq!(record["entries"], expected["entries"], "{name}: entries");
                assert_eq!(record["counts"], expected["counts"], "{name}: counts");
                assert_eq!(
                    record["config_digest"], expected["config_digest"],
                    "{name}: config digest"
                );
                let config = config_of(vector).unwrap();
                assert_eq!(
                    String::from_utf8(canonical_config(&config)).unwrap(),
                    expected["config_canonical"].as_str().unwrap(),
                    "{name}: canonical config"
                );
            }
            (Err(code), Some("error")) => {
                assert_eq!(code, expected["code"].as_str().unwrap(), "{name}")
            }
            (other, kind) => panic!("{name}: expected {kind:?}, got {other:?}"),
        }
    }
}

#[test]
fn every_hashing_vector_reproduces() {
    let vectors = vectors();
    let hashing = vectors["hashing"].as_array().unwrap();
    assert_eq!(hashing.len(), 7);
    for vector in hashing {
        let name = vector["name"].as_str().unwrap();
        let config = config_of(vector).unwrap();
        let entries: Vec<Entry> = vector["entries"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| serde_json::from_value::<prism_kicad_contracts::generated::prism_revision_key_record_a1::RevisionKeyEntry>(entry.clone()).unwrap())
            .map(|entry| Entry {
                path: entry.path.0,
                kind: entry.kind,
                object_id: entry.object_id.0,
                category: entry.category,
            })
            .collect();
        let format = format_of(vector);
        let expected = &vector["expected"];
        assert_eq!(
            hex(&preimage(format, &config, &entries)),
            expected["preimage_hex"],
            "{name}: preimage"
        );
        assert_eq!(
            config_digest(&config),
            expected["config_digest"],
            "{name}: config digest"
        );
        assert_eq!(
            revision_key(format, &config, &entries),
            expected["revision_key"],
            "{name}: key"
        );
    }
}

#[test]
fn every_relation_holds() {
    let vectors = vectors();
    let keys: BTreeMap<String, String> = vectors["selection"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|vector| {
            outcome(vector)
                .ok()
                .map(|(key, _)| (vector["name"].as_str().unwrap().to_owned(), key))
        })
        .collect();
    let relations = vectors["relations"].as_array().unwrap();
    assert_eq!(relations.len(), 13);
    for relation in relations {
        let names: Vec<&str> = relation["vectors"]
            .as_array()
            .unwrap()
            .iter()
            .map(|name| name.as_str().unwrap())
            .collect();
        let distinct: std::collections::BTreeSet<&String> =
            names.iter().map(|name| &keys[*name]).collect();
        match relation["relation"].as_str().unwrap() {
            "same-key" => assert_eq!(distinct.len(), 1, "{names:?}"),
            _ => assert_eq!(distinct.len(), names.len(), "{names:?}"),
        }
    }
}
