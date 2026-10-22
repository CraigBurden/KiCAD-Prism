//! Sheet geometry: the A3 frame, the standard scale that fits and the three
//! orthographic cells in third-angle order (top above front, right side to
//! the right of front).

use prism_artwork::artwork::geometry::{Bounds, Point};

use super::board::{Board, Part};

/// A3 landscape, millimetres.
pub const SHEET_W: f64 = 420.0;
/// A3 landscape, millimetres.
pub const SHEET_H: f64 = 297.0;
/// The inner drawing frame's margin.
pub const FRAME: f64 = 10.0;
/// The drawing area's bottom, above the notes and title block.
pub const DRAWING_BOTTOM: f64 = 241.0;
/// The title block's width.
pub const TITLE_W: f64 = 142.0;
/// The title block's height.
pub const TITLE_H: f64 = 46.0;

/// A drawing scale, `num : den`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Scale {
    /// Numerator.
    pub num: u32,
    /// Denominator.
    pub den: u32,
}

/// The standard scales the prototype tries, largest first.
pub const STANDARD: [Scale; 7] = [
    Scale { num: 5, den: 1 },
    Scale { num: 4, den: 1 },
    Scale { num: 3, den: 1 },
    Scale { num: 5, den: 2 },
    Scale { num: 2, den: 1 },
    Scale { num: 3, den: 2 },
    Scale { num: 1, den: 1 },
];

impl Scale {
    /// Millimetres on the sheet per millimetre on the board.
    pub fn factor(self) -> f64 {
        f64::from(self.num) / f64::from(self.den)
    }

    /// `3:1`.
    pub fn label(self) -> String {
        format!("{}:{}", self.num, self.den)
    }
}

/// An axis-aligned rectangle in sheet millimetres, y down.
#[derive(Clone, Copy, Debug)]
pub struct Rect {
    /// Left.
    pub x: f64,
    /// Top.
    pub y: f64,
    /// Width.
    pub w: f64,
    /// Height.
    pub h: f64,
}

impl Rect {
    /// A rectangle from two corners.
    pub fn new(x: f64, y: f64, w: f64, h: f64) -> Self {
        Self { x, y, w, h }
    }

    /// The bottom edge.
    pub fn bottom(self) -> f64 {
        self.y + self.h
    }

    /// The right edge.
    pub fn right(self) -> f64 {
        self.x + self.w
    }

    /// The centre.
    pub fn centre(self) -> Point {
        Point {
            x: self.x + self.w / 2.0,
            y: self.y + self.h / 2.0,
        }
    }
}

/// The three view mappings and the rectangles the sheet draws in.
pub struct Views {
    /// The chosen scale.
    pub scale: Scale,
    /// The board-frame extent the top view covers, overhang included.
    pub content: Bounds,
    /// The top view's content-min corner on the sheet.
    pub top_x: f64,
    /// The top view's content-min corner on the sheet.
    pub top_y: f64,
    /// The front elevation's cell.
    pub front: Rect,
    /// The right-side elevation's cell.
    pub side: Rect,
    /// The board mid-plane's sheet y in the front elevation.
    pub front_mid: f64,
    /// The board mid-plane's sheet y in the side elevation.
    pub side_mid: f64,
    /// The board rectangle in the front elevation.
    pub front_board: Rect,
    /// The board rectangle in the side elevation.
    pub side_board: Rect,
}

impl Views {
    /// A board point in the top view.
    pub fn top(&self, point: Point) -> Point {
        let factor = self.scale.factor();
        Point {
            x: self.top_x + factor * (point.x - self.content.min_x),
            y: self.top_y + factor * (point.y - self.content.min_y),
        }
    }

    /// A front-view point `(u, v)` on the sheet.
    ///
    /// Geometer's front view looks along world `+Y`, so `u = -world x` and
    /// `v = world z`. The footprint's world x is `board x - anchor x`, which
    /// puts the part back at its `at` without asking Geometer for a new
    /// projection per placement.
    pub fn front(&self, at: Point, point: Point) -> Point {
        let board_x = at.x - point.x;
        Point {
            x: self
                .top(Point {
                    x: board_x,
                    y: self.content.min_y,
                })
                .x,
            y: self.front_mid - self.scale.factor() * point.y,
        }
    }

    /// A side-view point `(u, v)` on the sheet.
    ///
    /// Geometer's `-X` view has `u = -world y = board y - anchor y`; the
    /// sheet places the board's `y = max` edge against the front view, as
    /// third angle folds it.
    pub fn side(&self, at: Point, point: Point) -> Point {
        let factor = self.scale.factor();
        let board_y = at.y + point.x;
        Point {
            x: self.side_board.x + factor * (self.content.max_y - board_y),
            y: self.side_mid - factor * point.y,
        }
    }

    /// A board z in either elevation's sheet y.
    pub fn elevation_y(&self, z: f64, side: bool) -> f64 {
        let mid = if side { self.side_mid } else { self.front_mid };
        mid - self.scale.factor() * z
    }

    /// The top surface's sheet y in either elevation.
    pub fn top_surface(&self, side: bool) -> f64 {
        self.elevation_y(0.0, side)
    }

    /// True when `part` has any elevation geometry to draw.
    pub fn has_elevation(part: &Part) -> bool {
        !part.front_lines.is_empty() || !part.side_lines.is_empty()
    }
}

/// The sheet furniture that does not move with the scale.
pub struct Frame {
    /// The notes block.
    pub notes: Rect,
    /// The title block.
    pub title: Rect,
    /// The table column on sheet 1, when the tables fit there.
    pub table: Option<Rect>,
}

impl Frame {
    /// The furniture for a sheet whose tables are (or are not) on sheet 1.
    pub fn new(tables_on_sheet: bool) -> Self {
        let title = Rect::new(
            SHEET_W - FRAME - TITLE_W,
            SHEET_H - FRAME - TITLE_H,
            TITLE_W,
            TITLE_H,
        );
        let notes = Rect::new(
            FRAME,
            SHEET_H - FRAME - TITLE_H,
            SHEET_W - 2.0 * FRAME - TITLE_W,
            TITLE_H,
        );
        let table = tables_on_sheet.then(|| {
            Rect::new(
                SHEET_W - FRAME - 150.0,
                FRAME,
                150.0,
                DRAWING_BOTTOM - FRAME,
            )
        });
        Self {
            notes,
            title,
            table,
        }
    }
}

/// True when the two tables fit the right-hand column of sheet 1.
pub fn tables_fit_on_sheet_one(height_rows: usize, hole_rows: usize) -> bool {
    height_rows + hole_rows <= 44
}

/// Choose the largest standard scale that fits the drawing area and lay the
/// three views out in third angle.
pub fn choose(board: &Board, tables_on_sheet: bool) -> Views {
    let content = content_bounds(board);
    let area = drawing_area(tables_on_sheet);
    let above = board.tallest_above();
    let below = board.deepest_below();
    for scale in STANDARD {
        if let Some(views) = try_scale(board, content, area, scale, above, below) {
            return views;
        }
    }
    // A board too large for 1:1 still has to produce a sheet; keep 1:1 and
    // let it run into the furniture rather than silently omit a view.
    try_scale(board, content, area, Scale { num: 1, den: 1 }, above, below)
        .unwrap_or_else(|| fallback(board, content, area))
}

fn drawing_area(tables_on_sheet: bool) -> Rect {
    let right = if tables_on_sheet { 258.0 } else { 410.0 };
    Rect::new(FRAME, FRAME, right - FRAME, DRAWING_BOTTOM - FRAME)
}

/// The sheet space the top view's ordinate dimensions need below or left of
/// it: one line per distinct mounting-hole coordinate, staggered 5 mm apart.
fn ordinate_space(board: &Board, horizontal: bool) -> f64 {
    let mut values: Vec<i64> = board
        .holes
        .iter()
        .filter(|hole| hole.mounting)
        .map(|hole| {
            let value = if horizontal { hole.at.x } else { hole.at.y };
            (value * 1000.0).round() as i64
        })
        .collect();
    values.sort_unstable();
    values.dedup();
    let lines = values.len().saturating_sub(1) as f64;
    let base = if horizontal { 18.0 } else { 20.0 };
    base + lines * 5.0 + 8.0
}

/// The board plus every body, so an overhanging connector is inside the top
/// view and every elevation fits.
fn content_bounds(board: &Board) -> Bounds {
    let mut bounds = board.bounds;
    bounds.include(board.origin.at);
    for part in &board.parts {
        if !part.body_bounds.is_empty() {
            bounds.include_bounds(part.body_bounds);
        }
        if let Some(pad) = part.pad_bounds {
            bounds.include_bounds(pad);
        }
    }
    bounds
}

fn try_scale(
    board: &Board,
    content: Bounds,
    area: Rect,
    scale: Scale,
    above: f64,
    below: f64,
) -> Option<Views> {
    let factor = scale.factor();
    let top_w = factor * content.width();
    let top_h = factor * content.height();
    let side_w = factor * content.height();
    let elevation_h = factor * (above + below + board.thickness);
    let bottom_space = ordinate_space(board, true);
    let left_space = ordinate_space(board, false);
    let block_w = left_space + top_w + 14.0 + side_w;
    let block_h = 8.0 + top_h + bottom_space + elevation_h + 16.0;
    if block_w > area.w || block_h > area.h {
        return None;
    }
    let block_x = area.x + (area.w - block_w) / 2.0;
    let block_y = area.y + 2.0 + (area.h - block_h) / 2.0;
    let top_x = block_x + left_space;
    let top_y = block_y + 8.0;
    let front_y = top_y + top_h + bottom_space;
    let side_x = top_x + top_w + 14.0;
    let front_mid = front_y + 10.0 + factor * above;
    let side_mid = front_mid;
    let board_x = top_x + factor * (board.bounds.min_x - content.min_x);
    let front_board = Rect::new(
        board_x,
        front_mid - factor * board.thickness / 2.0,
        factor * board.bounds.width(),
        factor * board.thickness,
    );
    let side_board = Rect::new(
        side_x,
        side_mid - factor * board.thickness / 2.0,
        factor * board.bounds.height(),
        factor * board.thickness,
    );
    Some(Views {
        scale,
        content,
        top_x,
        top_y,
        front: Rect::new(
            board_x,
            front_y,
            factor * board.bounds.width(),
            elevation_h + 20.0,
        ),
        side: Rect::new(
            side_x,
            front_y,
            factor * content.height(),
            elevation_h + 20.0,
        ),
        front_mid,
        side_mid,
        front_board,
        side_board,
    })
}

/// A last-resort layout that still puts every view on the sheet.
fn fallback(board: &Board, content: Bounds, area: Rect) -> Views {
    let scale = Scale { num: 1, den: 1 };
    let top_w = content.width();
    let top_h = content.height();
    let top_x = area.x + 24.0;
    let top_y = area.y + 12.0;
    let front_mid = top_y + top_h + 30.0;
    let side_x = top_x + top_w + 14.0;
    Views {
        scale,
        content,
        top_x,
        top_y,
        front: Rect::new(top_x, front_mid - 10.0, top_w, 40.0),
        side: Rect::new(side_x, front_mid - 10.0, top_h, 40.0),
        front_mid,
        side_mid: front_mid,
        front_board: Rect::new(
            top_x,
            front_mid - board.thickness / 2.0,
            board.bounds.width(),
            board.thickness,
        ),
        side_board: Rect::new(
            side_x,
            front_mid - board.thickness / 2.0,
            board.bounds.height(),
            board.thickness,
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mech::board::{Board, Origin};
    use crate::mech::board::{Body, Height, HeightSource, Part, Side};

    fn part(above: f64) -> Part {
        Part {
            index: 0,
            reference: "U1".to_owned(),
            library: String::new(),
            side: Side::Top,
            mechanical: false,
            at: Point { x: 20.0, y: 15.0 },
            angle: 0.0,
            body: Body::Envelope(Vec::new()),
            body_bounds: Bounds {
                min_x: 10.0,
                min_y: 5.0,
                max_x: 30.0,
                max_y: 25.0,
            },
            courtyard: None,
            pad_bounds: None,
            overhang: None,
            model: None,
            fallback_height: None,
            height: Some(Height { above, below: 0.0 }),
            height_source: HeightSource::ModelBounds,
            height_note: String::new(),
            front_lines: Vec::new(),
            side_lines: Vec::new(),
        }
    }

    fn board(above: f64) -> Board {
        let bounds = Bounds {
            min_x: 0.0,
            min_y: 0.0,
            max_x: 40.0,
            max_y: 30.0,
        };
        Board {
            name: "test".to_owned(),
            file: "test.kicad_pcb".to_owned(),
            thickness: 1.6,
            outline: bounds.ring(),
            cutouts: Vec::new(),
            bounds,
            origin: Origin {
                at: Point { x: 0.0, y: 30.0 },
                from_aux_axis: false,
            },
            parts: vec![part(above)],
            holes: Vec::new(),
        }
    }

    #[test]
    fn a_small_flat_board_takes_the_largest_scale_that_fits() {
        let views = choose(&board(0.0), false);
        assert_eq!(views.scale, Scale { num: 5, den: 1 });
        assert!(views.front.y > views.top_y + views.scale.factor() * 30.0);
        assert!(views.side.x > views.front.x);
    }

    #[test]
    fn a_tall_part_and_a_wide_board_choose_a_smaller_scale() {
        let mut board = board(60.0);
        board.bounds.max_x = 200.0;
        assert!(choose(&board, false).scale.factor() < 5.0);
    }

    #[test]
    fn the_side_view_sits_to_the_right_of_the_front_view() {
        let views = choose(&board(3.0), false);
        assert!(views.side.x > views.front.right());
        assert!(views.front.y > views.top_y);
    }

    #[test]
    fn the_tables_claim_the_right_hand_column() {
        assert!(!tables_fit_on_sheet_one(30, 30));
        assert!(tables_fit_on_sheet_one(2, 3));
        let frame = Frame::new(true);
        assert!(frame.table.is_some());
        let frame = Frame::new(false);
        assert!(frame.table.is_none());
    }
}
