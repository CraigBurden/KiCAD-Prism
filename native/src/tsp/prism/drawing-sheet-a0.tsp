import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * The input of `prism-kicad drawing-sheet --request` (`prism.drawing_sheet.request.a0`,
 * ADR amendment C3 §3.4): one page and title block to draw the core's default
 * worksheet on. Its fields are exactly the arguments Release Studio passes to
 * Python kicad_monkey's `drawing_sheet_to_ops(load_default_drawing_sheet(), …)`
 * (`backend/app/release_studio/documents/worksheet.py:47-65`).
 *
 * Page dimensions are integer nanometres, as that call takes them; the title
 * block and the sheet identifiers are text. Field-by-field sources are in
 * `field-maps/release-studio-tools.md`.
 */
namespace Prism.Contracts.DrawingSheetA0;

// ------------------------------------------------------------------- models

/**
 * The title block drawn in the sheet's lower-right corner, matching the four
 * standard fields and KiCad's comments 1 to 4.
 */
model DrawingSheetTitleBlock {
  /** The `Title` field. */
  title: string;

  /** The `Date` field, as written. */
  date: string;

  /** The `Rev` field, as written. */
  rev: string;

  /** The `Company` field. */
  company: string;

  /**
   * The keys are the comment numbers `"1"` to `"4"` as decimal strings,
   * serialized in code point order. A value is the comment's text, which may be
   * empty.
   */
  comments: Record<string>;
}

// --------------------------------------------------------------------- root

/**
 * The page and title block `prism-kicad drawing-sheet --request` draws the
 * default worksheet on.
 */
@jsonSchema
@id("urn:prism:schema:prism.drawing_sheet.request:a0")
@extension("title", "Prism drawing-sheet request a0")
model DrawingSheetRequestA0 {
  /** Document schema id. */
  schema: "prism.drawing_sheet.request.a0";

  /** Page width in nanometres. */
  paper_width_nm: NonNegativeNanometres;

  /** Page height in nanometres. */
  paper_height_nm: NonNegativeNanometres;

  /** The title block drawn on the page. */
  title_block: DrawingSheetTitleBlock;

  /** One-based index of this sheet among `sheet_count`. */
  @minValue(1)
  sheet_index: safeint;

  /** How many sheets the document has. */
  @minValue(1)
  sheet_count: safeint;

  /** The paper's name, for example `A4` or `A3`. */
  paper_name: string;

  /** The file name the sheet is drawn as, for example `doc.pdf`. */
  file_name: string;

  /** The schematic sheet path, for example `/key`. */
  sheet_path: string;

  /** The sheet's own name, for example `key`. */
  sheet_name: string;

  /**
   * The KiCad version string recorded on the sheet, for example `10.0.6`, or
   * the literal `KiCad` when the version is unknown.
   */
  kicad_version: string;
}
