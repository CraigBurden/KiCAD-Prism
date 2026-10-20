//! The tree solve: driving mates, mate-derived poses and mate checks
//! (CONTRACTS §8.9; ADR §2.6).
//!
//! Each connected group of mated members gets a root (the most-connected
//! member not held by an override, then the first in item order). The root
//! keeps its stored pose or takes its slot in the default row; every other
//! member is placed through the best mate from the placed part of its group
//! (most rows, then the far end's reference in natural order, then the mate
//! id), unless a positioning override names the mate. Mates that do not
//! drive are checked against the placed members.
//!
//! Ported from the kept TypeScript twin
//! `frontend/src/features/system-builder/placement/solve.ts`, whose shared
//! goldens (`placement_cases.json` `solves`) replay here. Two rules differ
//! between the first and second System Builder and are [`SolveRules`]: the
//! first needed confirmed connector frames and kept a manual pose on a mated
//! member; the second infers frames and derives every mated member's pose.

use crate::natural;
use crate::placement::mate::{MateEnd, MateResult, Orientation, inverse, mate_oriented, residual};
use crate::placement::poses::{
    Bounds, DEFAULT_GAP_MM, PlacedPose, Pose, PoseSource, canonical_rotation, clean, compose,
    default_row,
};
use serde::Serialize;
use std::cmp::Ordering;
use std::collections::{BTreeMap, BTreeSet, VecDeque};

/// A non-driving mate further than this across the mating plane is a mismatch.
pub const MISMATCH_MM: f64 = 0.2;
/// A non-driving mate turned further than this is a mismatch.
pub const MISMATCH_DEG: f64 = 0.5;

const IDENTITY: Pose = Pose {
    translation_mm: [0.0, 0.0, 0.0],
    rotation: [0.0, 0.0, 0.0, 1.0],
};

/// One end of a mate in the solve.
#[derive(Debug, Clone)]
pub struct SolveEnd {
    /// The member (occurrence) the connector is on.
    pub member: String,
    /// The connector's reference, for the driving-mate tie-break.
    pub reference: Option<String>,
    /// The connector geometry, thickness and any stored frame.
    pub end: MateEnd,
    /// The connector's board in its member; identity for a board.
    pub in_member: Option<Pose>,
}

/// One mate in the solve.
#[derive(Debug, Clone)]
pub struct SolveMate {
    /// The mate's id.
    pub link_id: String,
    /// Pad rows (the driving tie-break prefers more).
    pub rows: Option<u32>,
    /// The stack height; `None` uses the clearance fallback.
    pub stack_height_mm: Option<f64>,
    /// Side A.
    pub a: SolveEnd,
    /// Side B.
    pub b: SolveEnd,
    /// Extra quarter turns, flip and offset.
    pub orientation: Orientation,
}

/// The mate that placed a member.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrivingMate {
    /// The mate's id.
    pub link_id: String,
    /// The member it was placed from.
    pub from: String,
    /// Where the mate puts it.
    pub auto_pose: PlacedPose,
    /// The member kept its own stored pose instead (first-System-Builder rule).
    pub overridden: bool,
}

/// A non-driving mate that does not meet.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Mismatch {
    /// The mate's id.
    pub link_id: String,
    /// B's connector origin minus its mated position, on A's connector axes.
    pub offset_mm: [f64; 3],
    /// The offset across the mating plane.
    pub lateral_mm: f64,
    /// The offset along the mating axis.
    pub axial_mm: f64,
    /// The rotation between the two, in degrees.
    pub angle_deg: f64,
}

/// Why a positioning override was not used.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum IgnoredReason {
    /// It names no usable mate of the member.
    NotAUsableMate,
    /// The member is its group's root.
    Root,
    /// The mate is only reachable through the member itself.
    Unreachable,
}

/// A positioning override the solve did not use.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IgnoredOverride {
    /// The member.
    pub member: String,
    /// The mate it named.
    pub link_id: String,
    /// Why it was ignored.
    pub reason: IgnoredReason,
}

/// What the solve decided.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SolveResult {
    /// Every member's pose, with its source.
    pub poses: BTreeMap<String, PlacedPose>,
    /// The mate that placed each non-root mated member.
    pub driving: BTreeMap<String, DrivingMate>,
    /// Each mated group's root, in item order of discovery.
    pub roots: Vec<String>,
    /// Non-driving mates that do not meet.
    pub mismatches: Vec<Mismatch>,
    /// Mates the solve could not use (unknown frames).
    pub unusable: Vec<String>,
    /// Overrides it did not use.
    pub ignored_overrides: Vec<IgnoredOverride>,
    /// Each usable mate's transform, B's board frame in A's.
    #[serde(skip)]
    pub results: BTreeMap<String, MateResult>,
}

/// The rules that differ between the first and second System Builder.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SolveRules {
    /// A mate is usable only when both ends carry a stored (confirmed) frame.
    pub require_stored_frames: bool,
    /// A mated member keeps its own stored pose (shown as overridden).
    pub keep_stored_on_mated: bool,
}

impl SolveRules {
    /// The first System Builder, as its goldens describe.
    pub const FIRST: SolveRules = SolveRules {
        require_stored_frames: true,
        keep_stored_on_mated: true,
    };
    /// System Builder v2 (CONTRACTS §2.1: a mated occurrence's stored pose is ignored).
    pub const V2: SolveRules = SolveRules {
        require_stored_frames: false,
        keep_stored_on_mated: false,
    };
}

fn end_world(member_pose: &Pose, end: &SolveEnd) -> Pose {
    compose(member_pose, end.in_member.as_ref().unwrap_or(&IDENTITY))
}

/// The pose of the far member in the near member's frame.
fn relative(link: &SolveMate, result: &MateResult, near_is_a: bool) -> Pose {
    let a_in = link.a.in_member.unwrap_or(IDENTITY);
    let b_in = link.b.in_member.unwrap_or(IDENTITY);
    let a_to_b = compose(&compose(&a_in, &result.pose), &inverse(&b_in));
    if near_is_a { a_to_b } else { inverse(&a_to_b) }
}

fn clean_pose(pose: &Pose, source: PoseSource) -> PlacedPose {
    PlacedPose {
        pose: Pose {
            translation_mm: pose.translation_mm.map(clean),
            rotation: canonical_rotation(pose.rotation),
        },
        source,
    }
}

/// Rows first (more wins), then the far reference naturally, then the mate id.
fn compare_rank(p: &(i64, String, String), q: &(i64, String, String)) -> Ordering {
    p.0.cmp(&q.0)
        .then_with(|| natural::cmp(&p.1, &q.1))
        .then_with(|| p.2.cmp(&q.2))
}

/// A mate the solve can place by, with its transform.
struct UsableMate<'a> {
    link: &'a SolveMate,
    result: MateResult,
}

/// The best next member to place in a group.
struct Choice<'a> {
    rank: (i64, String, String),
    link: &'a SolveMate,
    result: MateResult,
    near_is_a: bool,
    near: &'a str,
    far: &'a str,
}

/// The inputs and outputs of placing one mated group.
struct GroupState<'a> {
    usable: &'a [UsableMate<'a>],
    stored: &'a BTreeMap<String, PlacedPose>,
    defaults: &'a BTreeMap<String, Pose>,
    overrides: &'a mut BTreeMap<String, String>,
    ignored: &'a mut Vec<IgnoredOverride>,
    poses: &'a mut BTreeMap<String, PlacedPose>,
    designed: &'a mut BTreeMap<String, Pose>,
    driving: &'a mut BTreeMap<String, DrivingMate>,
    rules: SolveRules,
}

/// A member's item index, or one past the end when it is not an item.
fn item_index(order: &BTreeMap<&str, usize>, key: &str) -> usize {
    order.get(key).copied().unwrap_or(order.len())
}

/// A member's own stored pose, cleaned.
fn own_pose(stored: &BTreeMap<String, PlacedPose>, key: &str) -> Option<PlacedPose> {
    stored
        .get(key)
        .map(|pose| clean_pose(&pose.pose, pose.source))
}

/// Count each member's connections.
fn degrees<'a>(
    items: &'a [(String, Option<Bounds>)],
    connections: &[(String, String)],
) -> BTreeMap<&'a str, usize> {
    let mut degree: BTreeMap<&str, usize> =
        items.iter().map(|(key, _)| (key.as_str(), 0)).collect();
    for (a, b) in connections {
        if let Some(count) = degree.get_mut(a.as_str()) {
            *count += 1;
        }
        if b != a
            && let Some(count) = degree.get_mut(b.as_str())
        {
            *count += 1;
        }
    }
    degree
}

/// The mates the solve can use, and the ids it cannot (unknown frames).
fn usable_mates<'a>(
    order: &BTreeMap<&str, usize>,
    mates: &'a [SolveMate],
    rules: SolveRules,
) -> (Vec<UsableMate<'a>>, Vec<String>) {
    let mut usable = Vec::new();
    let mut unusable = Vec::new();
    for link in mates {
        let (a, b) = (&link.a, &link.b);
        if !order.contains_key(a.member.as_str())
            || !order.contains_key(b.member.as_str())
            || a.member == b.member
        {
            continue;
        }
        let confirmed =
            !rules.require_stored_frames || (a.end.stored.is_some() && b.end.stored.is_some());
        let result = if confirmed {
            mate_oriented(&a.end, &b.end, link.stack_height_mm, &link.orientation)
        } else {
            None
        };
        match result {
            Some(result) => usable.push(UsableMate { link, result }),
            None => unusable.push(link.link_id.clone()),
        }
    }
    (usable, unusable)
}

/// Drop the overrides that name no usable mate of their member.
fn validate_overrides(
    overrides: &mut BTreeMap<String, String>,
    order: &BTreeMap<&str, usize>,
    by_id: &BTreeMap<&str, &UsableMate<'_>>,
    at: impl Fn(&str) -> usize,
) -> Vec<IgnoredOverride> {
    let mut ignored = Vec::new();
    let mut pending: Vec<(String, String)> = overrides
        .iter()
        .map(|(member, link)| (member.clone(), link.clone()))
        .collect();
    pending.sort_by_key(|(member, _)| at(member));
    for (member, link_id) in pending {
        let valid = order.contains_key(member.as_str())
            && by_id.get(link_id.as_str()).is_some_and(|entry| {
                entry.link.a.member == member || entry.link.b.member == member
            });
        if valid {
            continue;
        }
        ignored.push(IgnoredOverride {
            member: member.clone(),
            link_id,
            reason: IgnoredReason::NotAUsableMate,
        });
        overrides.remove(&member);
    }
    ignored
}

/// The mated neighbours of every item, from the usable mates.
fn neighbours<'a>(
    items: &'a [(String, Option<Bounds>)],
    usable: &[UsableMate<'a>],
) -> BTreeMap<&'a str, BTreeSet<&'a str>> {
    let mut neighbours: BTreeMap<&str, BTreeSet<&str>> = items
        .iter()
        .map(|(key, _)| (key.as_str(), BTreeSet::new()))
        .collect();
    for entry in usable {
        neighbours
            .get_mut(entry.link.a.member.as_str())
            .map(|set| set.insert(entry.link.b.member.as_str()));
        neighbours
            .get_mut(entry.link.b.member.as_str())
            .map(|set| set.insert(entry.link.a.member.as_str()));
    }
    neighbours
}

/// The connected group starting at `start`, discovered in item order.
fn group_from<'a>(
    start: &'a str,
    neighbours: &BTreeMap<&'a str, BTreeSet<&'a str>>,
    at: impl Fn(&str) -> usize,
    seen: &mut BTreeSet<&'a str>,
) -> Vec<&'a str> {
    let mut group = vec![start];
    let mut queue = VecDeque::from([start]);
    seen.insert(start);
    while let Some(current) = queue.pop_front() {
        let mut next: Vec<&str> = neighbours[current].iter().copied().collect();
        next.sort_by_key(|key| at(key));
        for other in next {
            if seen.insert(other) {
                group.push(other);
                queue.push_back(other);
            }
        }
    }
    group
}

/// The group's root: the most-connected member not overridden, then item order.
fn group_root<'a>(
    group: &[&'a str],
    degree: &BTreeMap<&'a str, usize>,
    overrides: &BTreeMap<String, String>,
    at: impl Fn(&str) -> usize,
) -> &'a str {
    let free: Vec<&str> = group
        .iter()
        .copied()
        .filter(|member| !overrides.contains_key(*member))
        .collect();
    let mut candidates = if free.is_empty() {
        group.to_vec()
    } else {
        free
    };
    candidates.sort_by(|p, q| degree[q].cmp(&degree[p]).then_with(|| at(p).cmp(&at(q))));
    candidates[0]
}

/// Drop the overrides of unmatched members, recording them as unreachable.
fn ignore_stuck<'a>(
    group: &[&'a str],
    placed: &BTreeSet<&'a str>,
    at: impl Fn(&str) -> usize,
    overrides: &mut BTreeMap<String, String>,
    ignored: &mut Vec<IgnoredOverride>,
) -> bool {
    let mut stuck: Vec<&str> = group
        .iter()
        .copied()
        .filter(|member| !placed.contains(member) && overrides.contains_key(*member))
        .collect();
    if stuck.is_empty() {
        return false;
    }
    stuck.sort_by_key(|key| at(key));
    for member in stuck {
        if let Some(link_id) = overrides.remove(member) {
            ignored.push(IgnoredOverride {
                member: member.to_owned(),
                link_id,
                reason: IgnoredReason::Unreachable,
            });
        }
    }
    true
}

/// The best mate that places an unplaced member from a placed one.
fn best_choice<'a>(
    placed: &BTreeSet<&str>,
    usable: &'a [UsableMate<'a>],
    overrides: &BTreeMap<String, String>,
) -> Option<Choice<'a>> {
    let mut best: Option<Choice<'a>> = None;
    for entry in usable {
        for near_is_a in [true, false] {
            let (near, far) = if near_is_a {
                (&entry.link.a, &entry.link.b)
            } else {
                (&entry.link.b, &entry.link.a)
            };
            let (x, y) = (near.member.as_str(), far.member.as_str());
            if !placed.contains(x) || placed.contains(y) {
                continue;
            }
            if overrides
                .get(y)
                .is_some_and(|wanted| *wanted != entry.link.link_id)
            {
                continue;
            }
            let rank = (
                -i64::from(entry.link.rows.unwrap_or(0)),
                far.reference.clone().unwrap_or_default(),
                entry.link.link_id.clone(),
            );
            if best
                .as_ref()
                .is_none_or(|current| compare_rank(&rank, &current.rank) == Ordering::Less)
            {
                best = Some(Choice {
                    rank,
                    link: entry.link,
                    result: entry.result,
                    near_is_a,
                    near: x,
                    far: y,
                });
            }
        }
    }
    best
}

/// Place one member through its chosen mate.
fn place_member(
    choice: &Choice<'_>,
    poses: &mut BTreeMap<String, PlacedPose>,
    designed: &mut BTreeMap<String, Pose>,
    driving: &mut BTreeMap<String, DrivingMate>,
    stored: &BTreeMap<String, PlacedPose>,
    rules: SolveRules,
) {
    let step = relative(choice.link, &choice.result, choice.near_is_a);
    let auto = compose(&poses[choice.near].pose, &step);
    designed.insert(
        choice.far.to_owned(),
        compose(&designed[choice.near], &step),
    );
    let kept = if rules.keep_stored_on_mated {
        own_pose(stored, choice.far)
    } else {
        None
    };
    poses.insert(
        choice.far.to_owned(),
        kept.unwrap_or_else(|| clean_pose(&auto, PoseSource::Auto)),
    );
    driving.insert(
        choice.far.to_owned(),
        DrivingMate {
            link_id: choice.link.link_id.clone(),
            from: choice.near.to_owned(),
            auto_pose: clean_pose(&auto, PoseSource::Auto),
            overridden: rules.keep_stored_on_mated && stored.contains_key(choice.far),
        },
    );
}

/// Place one mated group from its root.
fn place_group<'a>(
    group: &[&'a str],
    root: &'a str,
    at: impl Fn(&str) -> usize,
    state: &mut GroupState<'a>,
) {
    let root_pose = own_pose(state.stored, root)
        .unwrap_or_else(|| clean_pose(&state.defaults[root], PoseSource::Default));
    state.designed.insert(root.to_owned(), root_pose.pose);
    state.poses.insert(root.to_owned(), root_pose);

    let usable = state.usable;
    let mut placed: BTreeSet<&str> = BTreeSet::from([root]);
    while placed.len() < group.len() {
        let Some(choice) = best_choice(&placed, usable, state.overrides) else {
            if !ignore_stuck(group, &placed, &at, state.overrides, state.ignored) {
                break;
            }
            continue;
        };
        place_member(
            &choice,
            state.poses,
            state.designed,
            state.driving,
            state.stored,
            state.rules,
        );
        placed.insert(choice.far);
    }
}

/// Place every mated group, in item order.
fn place_groups<'a>(
    items: &'a [(String, Option<Bounds>)],
    neighbours: &BTreeMap<&'a str, BTreeSet<&'a str>>,
    degree: &BTreeMap<&'a str, usize>,
    at: impl Fn(&str) -> usize,
    roots: &mut Vec<String>,
    state: &mut GroupState<'a>,
) {
    let mut seen: BTreeSet<&str> = BTreeSet::new();
    for (start, _) in items {
        let start = start.as_str();
        if seen.contains(start) || neighbours[start].is_empty() {
            continue;
        }
        let group = group_from(start, neighbours, &at, &mut seen);
        let root = group_root(&group, degree, state.overrides, &at);
        roots.push(root.to_owned());
        if let Some(link_id) = state.overrides.remove(root) {
            state.ignored.push(IgnoredOverride {
                member: root.to_owned(),
                link_id,
                reason: IgnoredReason::Root,
            });
        }
        place_group(&group, root, &at, state);
    }
}

/// Give every unplaced member its stored pose or its default slot.
fn fill_poses(
    items: &[(String, Option<Bounds>)],
    stored: &BTreeMap<String, PlacedPose>,
    defaults: &BTreeMap<String, Pose>,
    poses: &mut BTreeMap<String, PlacedPose>,
) {
    for (key, _) in items {
        if !poses.contains_key(key) {
            let pose = own_pose(stored, key)
                .unwrap_or_else(|| clean_pose(&defaults[key], PoseSource::Default));
            poses.insert(key.clone(), pose);
        }
    }
}

/// The non-driving mates that do not meet.
fn mismatches(
    usable: &[UsableMate<'_>],
    driving: &BTreeMap<String, DrivingMate>,
    designed: &BTreeMap<String, Pose>,
) -> Vec<Mismatch> {
    let driving_links: BTreeSet<&str> = driving
        .values()
        .map(|entry| entry.link_id.as_str())
        .collect();
    let mut mismatches = Vec::new();
    for entry in usable {
        let link = entry.link;
        if driving_links.contains(link.link_id.as_str()) {
            continue;
        }
        let (Some(a_pose), Some(b_pose)) =
            (designed.get(&link.a.member), designed.get(&link.b.member))
        else {
            continue;
        };
        let Some(got) = residual(
            &end_world(a_pose, &link.a),
            &end_world(b_pose, &link.b),
            &link.a.end,
            &link.b.end,
            &entry.result,
        ) else {
            continue;
        };
        let axial = got.offset_mm[2];
        if got.lateral_mm > MISMATCH_MM
            || got.angle_deg > MISMATCH_DEG
            || (link.stack_height_mm.is_some() && axial.abs() > MISMATCH_MM)
        {
            mismatches.push(Mismatch {
                link_id: link.link_id.clone(),
                offset_mm: got.offset_mm,
                lateral_mm: got.lateral_mm,
                axial_mm: clean(axial),
                angle_deg: got.angle_deg,
            });
        }
    }
    mismatches
}

/// Every member's pose with its source, the driving mates and the mate checks.
pub fn solve(
    items: &[(String, Option<Bounds>)],
    stored: &BTreeMap<String, PlacedPose>,
    connections: &[(String, String)],
    mates: &[SolveMate],
    overrides_in: &BTreeMap<String, String>,
    rules: SolveRules,
) -> SolveResult {
    let mut overrides = overrides_in.clone();
    let order: BTreeMap<&str, usize> = items
        .iter()
        .enumerate()
        .map(|(index, (key, _))| (key.as_str(), index))
        .collect();
    let at = |key: &str| item_index(&order, key);
    let defaults = default_row(items, DEFAULT_GAP_MM);
    let degree = degrees(items, connections);
    let (usable, unusable) = usable_mates(&order, mates, rules);
    let by_id: BTreeMap<&str, &UsableMate<'_>> = usable
        .iter()
        .map(|entry| (entry.link.link_id.as_str(), entry))
        .collect();
    let mut ignored = validate_overrides(&mut overrides, &order, &by_id, at);
    let neighbours = neighbours(items, &usable);

    let mut poses: BTreeMap<String, PlacedPose> = BTreeMap::new();
    // Every mated member where its mates put it, ignoring manual moves below the root.
    let mut designed: BTreeMap<String, Pose> = BTreeMap::new();
    let mut driving: BTreeMap<String, DrivingMate> = BTreeMap::new();
    let mut roots = Vec::new();
    {
        let mut state = GroupState {
            usable: &usable,
            stored,
            defaults: &defaults,
            overrides: &mut overrides,
            ignored: &mut ignored,
            poses: &mut poses,
            designed: &mut designed,
            driving: &mut driving,
            rules,
        };
        place_groups(items, &neighbours, &degree, at, &mut roots, &mut state);
    }

    fill_poses(items, stored, &defaults, &mut poses);
    // The mated design is judged: a board moved by hand shows as overridden, never as a mismatch.
    let mismatches = mismatches(&usable, &driving, &designed);
    let results = usable
        .iter()
        .map(|entry| (entry.link.link_id.clone(), entry.result))
        .collect();
    SolveResult {
        poses,
        driving,
        roots,
        mismatches,
        unusable,
        ignored_overrides: ignored,
        results,
    }
}
