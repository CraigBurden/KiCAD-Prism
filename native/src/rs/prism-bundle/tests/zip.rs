//! The canonical zip subset of bundle-format.md §4 (writer, reader) and the
//! streaming digest check of §9 step 6.

use prism_bundle::zip::{ZipIndex, ZipWriter, check_body, crc32};
use prism_bundle::{Limits, Work};

fn archive(members: &[(&str, &[u8])]) -> Vec<u8> {
    let limits = Limits::defaults(Work::Verify);
    let mut writer = ZipWriter::new(Vec::new(), &limits);
    for (name, data) in members {
        writer.add(name, data, &limits).unwrap();
    }
    writer.finish(&limits).unwrap().0
}

#[test]
fn crc_matches_the_check_value() {
    assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
}

#[test]
fn round_trips_and_is_deterministic() {
    let text = "(kicad_pcb (net 1 \"GND\"))\n".repeat(2000);
    let members: [(&str, &[u8]); 3] = [
        ("bundle.json", b"{}\n"),
        ("sources/a.kicad_pcb", text.as_bytes()),
        ("e", b""),
    ];
    let bytes = archive(&members);
    assert_eq!(bytes, archive(&members));
    let limits = Limits::defaults(Work::Verify);
    let index = ZipIndex::open(bytes.as_slice(), &limits).unwrap();
    assert_eq!(index.entries.len(), 3);
    for (entry, (name, data)) in index.entries.iter().zip(members) {
        assert_eq!(entry.name, name);
        assert_eq!(index.read(bytes.as_slice(), entry).unwrap(), data);
    }
    assert!(index.entries[1].is_deflated() && !index.entries[2].is_deflated());
}

#[test]
fn streaming_check_matches_read_and_catches_damage() {
    let limits = Limits::defaults(Work::Verify);
    let text = "(kicad_pcb (net 1 \"GND\"))\n".repeat(4000);
    let members: [(&str, &[u8]); 3] = [
        ("bundle.json", b"{}\n"),
        ("sources/a.kicad_pcb", text.as_bytes()),
        ("e", b""),
    ];
    let bytes = archive(&members);
    let index = ZipIndex::open(bytes.as_slice(), &limits).unwrap();
    for entry in &index.entries {
        let body = index.body(bytes.as_slice(), entry).unwrap();
        let mut streamed = Vec::new();
        check_body(entry, &body, &mut |chunk| streamed.extend_from_slice(chunk)).unwrap();
        assert_eq!(streamed, index.read(bytes.as_slice(), entry).unwrap());
        if !body.is_empty() {
            let mut damaged = body.clone();
            damaged[0] ^= 0xFF;
            assert!(check_body(entry, &damaged, &mut |_| {}).is_err());
        }
    }
}

#[test]
fn copying_an_entry_reproduces_the_archive() {
    let limits = Limits::defaults(Work::Verify);
    let text = "(kicad_pcb (net 1 \"GND\"))\n".repeat(4000);
    let members: [(&str, &[u8]); 3] = [
        ("bundle.json", b"{}\n"),
        ("sources/a.kicad_pcb", text.as_bytes()),
        ("e", b""),
    ];
    let bytes = archive(&members);
    let index = ZipIndex::open(bytes.as_slice(), &limits).unwrap();
    let mut writer = ZipWriter::new(Vec::new(), &limits);
    for entry in &index.entries {
        let body = index.body(bytes.as_slice(), entry).unwrap();
        writer
            .add_copied(
                &entry.name,
                entry.size,
                entry.crc,
                entry.is_deflated(),
                &body,
                &limits,
            )
            .unwrap();
    }
    assert_eq!(writer.finish(&limits).unwrap().0, bytes);
}

#[test]
fn rejects_a_trailing_comment_and_a_gap() {
    let limits = Limits::defaults(Work::Verify);
    let mut bytes = archive(&[("a", b"hello")]);
    bytes.push(0);
    let error = ZipIndex::open(bytes.as_slice(), &limits).unwrap_err();
    assert_eq!(error.finding().code, "zip-malformed");
}
