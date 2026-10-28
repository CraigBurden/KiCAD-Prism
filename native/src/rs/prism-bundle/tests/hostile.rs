//! Hand-made hostile archives are rejected with the codes of cli-spec.md
//! §6.2 (§11 item 5), before anything is inflated where the spec says so.

use prism_bundle::verify::{Depth, verify};
use prism_bundle::zip::{ZipIndex, ZipWriter};
use prism_bundle::{BundleReader, Limits, Work};

fn limits() -> Limits {
    Limits::defaults(Work::Verify)
}

fn archive(members: &[(&str, &[u8])]) -> Vec<u8> {
    let limits = limits();
    let mut writer = ZipWriter::new(Vec::new(), &limits);
    for (name, data) in members {
        writer.add(name, data, &limits).unwrap();
    }
    writer.finish(&limits).unwrap().0
}

fn u32_at(bytes: &[u8], at: usize) -> u32 {
    u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap())
}

fn put_u32(bytes: &mut [u8], at: usize, value: u32) {
    bytes[at..at + 4].copy_from_slice(&value.to_le_bytes());
}

/// Offset of the central directory and of the end record.
fn directory(bytes: &[u8]) -> (usize, usize) {
    let end = bytes.len() - 22;
    (u32_at(bytes, end + 16) as usize, end)
}

fn first_code(bytes: &[u8]) -> String {
    let report = verify(bytes, &limits(), b"{}", Depth::Full);
    assert!(BundleReader::open(bytes.to_vec(), &limits()).is_err());
    report
        .findings
        .first()
        .map(|finding| finding.code.clone())
        .unwrap_or_default()
}

const MANIFEST: &[u8] = b"{}\n";

#[test]
fn a_zip_bomb_is_refused_before_inflating() {
    let mut bytes = archive(&[("bundle.json", MANIFEST), ("big", &[0u8; 4096])]);
    let (central, _) = directory(&bytes);
    let local = u32_at(&bytes, central + 46 + 11 + 42) as usize;
    let second_central = central + 46 + "bundle.json".len();
    for (header, size_at) in [(local, 22), (second_central, 24)] {
        put_u32(&mut bytes, header + size_at, 0xFFFF_FFFE);
    }
    assert_eq!(first_code(&bytes), "limit-exceeded");
}

#[test]
fn names_that_escape_or_collide_are_refused() {
    assert_eq!(
        first_code(&archive(&[("bundle.json", MANIFEST), ("../x", b"1")])),
        "zip-path-invalid"
    );
    assert_eq!(
        first_code(&archive(&[("bundle.json", MANIFEST), ("a\u{1}b", b"1")])),
        "zip-path-invalid"
    );
    assert_eq!(
        first_code(&archive(&[
            ("bundle.json", MANIFEST),
            ("sources/Board.kicad_pcb", b"1"),
            ("sources/board.KICAD_PCB", b"2")
        ])),
        "zip-path-collision"
    );
    assert_eq!(
        first_code(&archive(&[
            ("bundle.json", MANIFEST),
            ("x", b"1"),
            ("x", b"2")
        ])),
        "zip-duplicate-member"
    );
}

#[test]
fn trailing_data_comments_and_zip64_are_refused() {
    let base = archive(&[("bundle.json", MANIFEST)]);
    let mut commented = base.clone();
    let end = commented.len() - 22;
    commented[end + 20..end + 22].copy_from_slice(&4u16.to_le_bytes());
    commented.extend_from_slice(b"note");
    assert_eq!(first_code(&commented), "zip-malformed");
    let mut trailing = base.clone();
    trailing.push(0);
    assert_eq!(first_code(&trailing), "zip-malformed");
    let mut zip64 = base.clone();
    let end = zip64.len() - 22;
    let mut locator = vec![0u8; 20];
    locator[..4].copy_from_slice(&0x0706_4b50u32.to_le_bytes());
    zip64.splice(end..end, locator);
    assert_eq!(first_code(&zip64), "zip-unsupported");
}

#[test]
fn disagreeing_headers_and_gaps_are_refused() {
    let base = archive(&[("bundle.json", MANIFEST), ("x", b"hello")]);
    let mut disagree = base.clone();
    put_u32(&mut disagree, 14, u32_at(&base, 14) ^ 1);
    assert_eq!(first_code(&disagree), "zip-malformed");
    let mut gap = base.clone();
    let (central, _) = directory(&base);
    let second = central + 46 + "bundle.json".len();
    put_u32(&mut gap, second + 42, u32_at(&base, second + 42) + 1);
    assert_eq!(first_code(&gap), "zip-malformed");
    let mut descriptor = base.clone();
    descriptor[6] |= 0x08;
    descriptor[central + 8] |= 0x08;
    assert_eq!(first_code(&descriptor), "zip-unsupported");
}

#[test]
fn high_ratios_and_bad_crcs_are_found() {
    let zeros = vec![0u8; 3 << 20];
    assert_eq!(
        first_code(&archive(&[("bundle.json", MANIFEST), ("z", &zeros)])),
        "zip-ratio-exceeded"
    );
    let mut bytes = archive(&[("bundle.json", MANIFEST), ("x", b"hello world, stored")]);
    let index = ZipIndex::open(bytes.as_slice(), &limits()).unwrap();
    let at = bytes
        .windows(19)
        .position(|window| window == b"hello world, stored")
        .unwrap();
    bytes[at] = b'H';
    let entry = &index.entries[1];
    assert_eq!(
        index
            .read(bytes.as_slice(), entry)
            .unwrap_err()
            .finding()
            .code,
        "zip-crc-mismatch"
    );
}
