//! The index page: every sheet in order, a table of contents, and the print
//! rules that make the PDF one sheet per page.

use std::fmt::Write;

use crate::html::{document, escape};
use crate::theme::Theme;

use super::board::Icd;

/// One rendered sheet, ready to inline.
pub struct RenderedSheet {
    /// The connector's reference.
    pub reference: String,
    /// Zero-based page within the connector.
    pub page: usize,
    /// The connector's page count.
    pub pages: usize,
    /// The SVG file's name, relative to the output directory.
    pub file: String,
    /// The sheet's markup.
    pub svg: String,
}

impl RenderedSheet {
    /// A DOM id unique across the document.
    pub fn anchor(&self) -> String {
        format!("{}-{}", slug(&self.reference), self.page + 1)
    }
}

/// A reference as a DOM id: letters, digits and dashes only.
fn slug(reference: &str) -> String {
    reference
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' {
                character
            } else {
                '-'
            }
        })
        .collect()
}

/// The whole document.
pub fn index_page(icd: &Icd, sheets: &[RenderedSheet], theme: Theme) -> String {
    let mut body = String::new();
    body.push_str("<div class=\"lab icd\">\n");
    masthead(&mut body, icd);
    contents(&mut body, icd, sheets);
    body.push_str("<div class=\"sheets\">\n");
    for sheet in sheets {
        let _ = writeln!(
            body,
            "<section class=\"sheet-page\" id=\"{}\" data-ref=\"{}\" data-page=\"{}\">\n{}\n\
<p class=\"sheet-caption\">{} \u{00b7} sheet {} of {} \u{00b7} {}</p>\n</section>",
            escape(&sheet.anchor()),
            escape(&sheet.reference),
            sheet.page + 1,
            sheet.svg,
            escape(&sheet.reference),
            sheet.page + 1,
            sheet.pages,
            escape(&sheet.file)
        );
    }
    body.push_str("</div>\n</div>\n");
    document(
        &format!("Connector ICDs \u{2014} {}", icd.board_name),
        "data-prototype=\"connector-icd\"",
        CSS,
        &body,
        "",
        theme,
    )
}

fn masthead(body: &mut String, icd: &Icd) {
    let _ = writeln!(
        body,
        "<header class=\"masthead\">\n<p class=\"eyebrow\">Prism docs lab \u{00b7} prototype</p>\n\
<h1>Connector ICDs <span class=\"light\">{}</span></h1>\n\
<p class=\"subtitle\">One interface control sheet per connector: identification, views of \
the part from its STEP model, the board locator and the pinout with the nets it reaches.</p>\n\
<dl class=\"meta\">\n\
<div><dt>Board</dt><dd>{}</dd></div>\n\
<div><dt>{}</dt><dd>{}</dd></div>\n\
<div><dt>Source</dt><dd>{}</dd></div>\n\
<div><dt>Geometer</dt><dd>{}</dd></div>\n</dl>\n\
<div class=\"stats\">\n\
<div class=\"stat\"><span class=\"value\">{}</span><span class=\"label\">Connectors</span></div>\n\
<div class=\"stat\"><span class=\"value\">{}</span><span class=\"label\">Sheets</span></div>\n\
<div class=\"stat\"><span class=\"value\">{}</span><span class=\"label\">With STEP views</span></div>\n\
<div class=\"stat\"><span class=\"value\">{}</span><span class=\"label\">Footprint only</span></div>\n\
</div>\n</header>",
        escape(&icd.board_name),
        escape(&icd.board_name),
        escape(icd.identity_label),
        escape(&icd.identity),
        escape(&icd.board_file),
        escape(icd.geometer.as_deref().unwrap_or("not running")),
        icd.connectors.len(),
        icd.sheets,
        icd.with_views,
        icd.footprint_only,
    );
}

fn contents(body: &mut String, icd: &Icd, sheets: &[RenderedSheet]) {
    body.push_str("<nav class=\"toc\">\n<p class=\"toc-title\">Contents</p>\n<ol>\n");
    let mut first_sheet = 1;
    for connector in &icd.connectors {
        let anchor = sheets
            .iter()
            .find(|sheet| sheet.reference == connector.reference)
            .map(RenderedSheet::anchor)
            .unwrap_or_default();
        let last_sheet = first_sheet + connector.pages - 1;
        let pages = if connector.pages > 1 {
            format!("sheets {first_sheet}\u{2013}{last_sheet}")
        } else {
            format!("sheet {first_sheet}")
        };
        let _ = writeln!(
            body,
            "<li><a href=\"#{}\"><span class=\"toc-ref\">{}</span>\
<span class=\"toc-value\">{}</span></a><span class=\"toc-pages\">{}</span></li>",
            escape(&anchor),
            escape(&connector.reference),
            escape(&connector.value),
            pages
        );
        first_sheet = last_sheet + 1;
    }
    body.push_str("</ol>\n</nav>\n");
}

const CSS: &str = r#"
.icd {
  max-width: 1720px;
  padding-top: 40px;
}

.icd .masthead h1 {
  font-size: 32px;
}

.icd .stats {
  margin-top: 24px;
}

.toc {
  margin: 34px 0 10px;
  border: 1px solid #dfe2e7;
  border-radius: 8px;
  overflow: hidden;
}

.toc-title {
  margin: 0;
  padding: 11px 16px;
  border-bottom: 1px solid #dfe2e7;
  background: #eef0f3;
  color: #6b6b70;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.toc ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.toc li {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 7px 16px;
  border-bottom: 1px solid #e8eaee;
  font-size: 13px;
}

.toc li:last-child {
  border-bottom: 0;
}

.toc a {
  display: flex;
  flex: 1 1 auto;
  gap: 12px;
  min-width: 0;
  color: #1d1d1f;
  text-decoration: none;
}

.toc a:hover .toc-ref {
  text-decoration: underline;
}

.toc-ref {
  min-width: 52px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.toc-value {
  overflow: hidden;
  color: #6b6b70;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toc-pages {
  color: #6b6b70;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.sheets {
  display: grid;
  gap: 30px;
  margin-top: 30px;
}

.sheet-page {
  background: #ffffff;
  box-shadow:
    0 1px 2px rgb(0 0 0 / 8%),
    0 16px 40px rgb(0 0 0 / 7%);
}

.sheet-page svg {
  display: block;
  width: 100%;
  height: auto;
}

.sheet-caption {
  margin: 0;
  padding: 8px 12px 10px;
  color: #6b6b70;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

@page {
  size: A3 landscape;
  margin: 0;
}

@media print {
  html,
  body {
    background: #ffffff;
  }

  .icd {
    max-width: none;
    margin: 0;
    padding: 0;
  }

  .masthead,
  .toc,
  .sheet-caption {
    display: none;
  }

  .sheets {
    display: block;
    margin: 0;
  }

  .sheet-page {
    width: 420mm;
    height: 297mm;
    overflow: hidden;
    box-shadow: none;
    break-after: page;
    page-break-after: always;
  }

  .sheet-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  .sheet-page svg {
    width: 420mm;
    height: 297mm;
  }
}
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_reference_becomes_a_stable_anchor() {
        assert_eq!(slug("J1"), "J1");
        assert_eq!(slug("J/1"), "J-1");
    }

    #[test]
    fn the_print_rules_make_one_sheet_per_page() {
        assert!(CSS.contains("@page"));
        assert!(CSS.contains("size: A3 landscape"));
        assert!(CSS.contains("page-break-after: always"));
    }
}
