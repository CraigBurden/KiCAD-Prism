//! A single-sheet XLSX writer, matching Cruncher 2026.9.7's
//! `simple_xlsx.py` (`write_xlsx_table`).
//!
//! Every cell is text: values are written as inline strings (`t="inlineStr"`),
//! so `0603` stays visibly unchanged and openpyxl reads the same value and
//! type as the goldens. An empty string is written as an empty inline cell,
//! exactly as openpyxl writes it. The zip is the bundle crate's deterministic
//! writer (`prism_bundle::zip`).

use crate::Error;
use prism_bundle::zip::ZipWriter;
use prism_bundle::{Limits, Work};

const ILLEGAL_XML: [char; 20] = [
    '\u{0}', '\u{1}', '\u{2}', '\u{3}', '\u{4}', '\u{5}', '\u{6}', '\u{7}', '\u{8}', '\u{b}',
    '\u{c}', '\u{e}', '\u{f}', '\u{10}', '\u{11}', '\u{12}', '\u{13}', '\u{14}', '\u{15}',
    '\u{16}',
];

/// One workbook with one sheet.
pub fn table(sheet: &str, columns: &[String], rows: &[Vec<String>]) -> Result<Vec<u8>, Error> {
    let limits = Limits::defaults(Work::Other);
    let mut writer = ZipWriter::new(Vec::new(), &limits);
    let parts = [
        ("[Content_Types].xml", content_types()),
        ("_rels/.rels", root_relationships()),
        ("xl/workbook.xml", workbook(sheet)),
        ("xl/_rels/workbook.xml.rels", workbook_relationships()),
        ("xl/worksheets/sheet1.xml", worksheet(columns, rows)),
        ("xl/styles.xml", styles()),
    ];
    for (name, data) in parts {
        writer
            .add(name, data.as_bytes(), &limits)
            .map_err(|error| Error::internal(format!("the xlsx zip failed: {error:?}")))?;
    }
    writer
        .finish(&limits)
        .map(|(bytes, _)| bytes)
        .map_err(|error| Error::internal(format!("the xlsx zip failed: {error:?}")))
}

fn xml_text(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        if ILLEGAL_XML.contains(&ch) {
            continue;
        }
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(ch),
        }
    }
    out
}

fn column_letter(mut index: usize) -> String {
    let mut letters = String::new();
    while index > 0 {
        let remainder = (index - 1) % 26;
        letters.insert(0, (b'A' + remainder as u8) as char);
        index = (index - 1) / 26;
    }
    letters
}

fn worksheet(columns: &[String], rows: &[Vec<String>]) -> String {
    let last_column = column_letter(columns.len());
    let last_row = rows.len() + 1;
    let mut out = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
         <worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">",
    );
    out.push_str(&format!("<dimension ref=\"A1:{last_column}{last_row}\"/>"));
    out.push_str("<sheetData>");
    out.push_str(&row_xml(1, columns));
    for (index, row) in rows.iter().enumerate() {
        out.push_str(&row_xml(index + 2, row));
    }
    out.push_str("</sheetData></worksheet>");
    out
}

fn row_xml(row: usize, values: &[String]) -> String {
    let mut out = format!("<row r=\"{row}\">");
    for (index, value) in values.iter().enumerate() {
        let reference = format!("{}{}", column_letter(index + 1), row);
        if value.is_empty() {
            out.push_str(&format!("<c r=\"{reference}\" t=\"inlineStr\"></c>"));
        } else {
            out.push_str(&format!(
                "<c r=\"{reference}\" t=\"inlineStr\"><is><t>{}</t></is></c>",
                xml_text(value)
            ));
        }
    }
    out.push_str("</row>");
    out
}

fn workbook(sheet: &str) -> String {
    let sheet = xml_text(sheet);
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
         <workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" \
         xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">\
         <bookViews><workbookView visibility=\"visible\" minimized=\"0\" showHorizontalScroll=\"1\" \
         showVerticalScroll=\"1\" showSheetTabs=\"1\" tabRatio=\"600\" firstSheet=\"0\" \
         activeTab=\"0\" autoFilterDateGrouping=\"1\"/></bookViews>\
         <sheets><sheet name=\"{sheet}\" sheetId=\"1\" state=\"visible\" r:id=\"rId1\"/></sheets>\
         </workbook>"
    )
}

fn content_types() -> String {
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
     <Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">\
     <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\
     <Default Extension=\"xml\" ContentType=\"application/xml\"/>\
     <Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>\
     <Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>\
     <Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>\
     </Types>"
        .to_string()
}

fn root_relationships() -> String {
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
     <Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\
     <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>\
     </Relationships>"
        .to_string()
}

fn workbook_relationships() -> String {
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
     <Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\
     <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>\
     <Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>\
     </Relationships>"
        .to_string()
}

fn styles() -> String {
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
     <styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">\
     <fonts count=\"1\"><font/></fonts>\
     <fills count=\"1\"><fill><patternFill patternType=\"none\"/></fill></fills>\
     <borders count=\"1\"><border/></borders>\
     <cellStyleXfs count=\"1\"><xf/></cellStyleXfs>\
     <cellXfs count=\"1\"><xf xfId=\"0\"/></cellXfs>\
     </styleSheet>"
        .to_string()
}
