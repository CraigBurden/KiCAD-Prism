"""Depth-aware object digest for design comparison.

Replaces `_extract_geometry`'s eighteen per-kind `finditer` passes with one
projection scan per file. The digest answers exactly one question -- *which
objects changed* -- and deliberately answers nothing about where they are on
screen, because the viewer measures that from the painted scene far more
accurately than a backend regex can.

See docs/DESIGN_COMPARISON_REVAMP.md. Phase 1 runs this in shadow mode
alongside the geometry sidecar; nothing consumes it yet.

Four decisions the plan called out as traps, and how they are handled here:

*Parent-child cascade.* A footprint's hash covers only its own attributes;
every independently addressable child is replaced by a reference to that
child's id. Moving one pad therefore reports the pad, not the pad and its
footprint and its group.

*Authored vs generated.* `filled_polygon` and friends change whenever KiCad
regenerates a board, with no authored edit at all. Those subtrees are pruned
before hashing, so a zone reports a change when its outline or settings move
and stays quiet when only its fill was recomputed.

*Objects without UUIDs.* "Every kind" is not "every object is independently
addressable". An anonymous form stays inline in its parent's hash, so a
reorder is invisible while a real edit is not.

*Normalisation.* Whitespace is collapsed; the object's own uuid is excluded
(identity is carried separately, and including it would make every hash
trivially unique). Field order is preserved, because order is semantic in
several KiCad forms -- polygon points most obviously.

One field the plan asked for is deliberately absent: `instancePath`. A reused
hierarchical sheet is one file containing one symbol, and this digest
describes file contents, so `documentPath + sourceId` is already unambiguous
here. Instance multiplicity is the semantic index's concern -- which is
precisely where the KIID_PATH collision found in Phase 0B had to be fixed.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Mapping, Optional, Sequence

from app.services import semantic_index_service


DIGEST_SCHEMA = "prism.design_object_digest_v1"

# Heads that name an independently addressable design object. Anything else is
# either an attribute of one of these or generated output.
_SCHEMATIC_HEADS = frozenset({
    "symbol", "wire", "bus", "bus_entry", "junction", "no_connect",
    "label", "global_label", "hierarchical_label", "netclass_flag",
    "text", "text_box", "polyline", "rectangle", "arc", "circle",
    "sheet", "image", "table",
    # Instance pins carry the UUIDs that net terminals resolve against, and
    # Phase 0B found SCH_PIN to be the least reliable identity in the whole
    # diff -- so the digest must cover them rather than assume they are safe.
    "pin",
})

_PCB_HEADS = frozenset({
    "footprint", "segment", "arc", "via", "zone", "pad", "group",
    "gr_line", "gr_arc", "gr_circle", "gr_rect", "gr_poly", "gr_curve",
    "gr_text", "gr_text_box", "gr_bbox", "dimension", "image",
    "rule_area", "generated", "target",
})

# Generated content: recomputed by KiCad, not authored by a human. Pruning it
# keeps a board re-fill from reporting every zone as modified.
_GENERATED_HEADS = frozenset({
    "filled_polygon", "fill_segments", "filled_areas_thickness",
    "zone_connect_pads_generated",
})

# `lib_symbols` is a cache of library definitions, not placed design content.
# Scanning into it would emit thousands of phantom objects that no schematic
# item ever resolves to. It is pruned outright -- unlike generated content,
# which must still be *selected* so it can be cut out of its parent's text.
# Pruning only stops a form being yielded; it does not remove it from the
# enclosing form's source.
_PRUNED_HEADS = frozenset({"lib_symbols"})

_UUID_RE = re.compile(r'\(\s*(?:uuid|tstamp)\s+"?([0-9a-fA-F-]{8,})"?\s*\)')
_OWN_UUID_RE = re.compile(r'\(\s*(?:uuid|tstamp)\s+"?[0-9a-fA-F-]{8,}"?\s*\)')
_AT_RE = re.compile(r'\(\s*at\s+(-?[\d.]+)\s+(-?[\d.]+)')
_XY_RE = re.compile(r'\(\s*xy\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\)')
_START_END_RE = re.compile(r'\(\s*(?:start|end|mid|center)\s+(-?[\d.]+)\s+(-?[\d.]+)')
_LAYER_RE = re.compile(r'\(\s*layer\s+"([^"]+)"')
_WS_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class ObjectDigest:
    """One addressable design object, without any rendering geometry."""

    source_id: str
    kind: str
    document_path: str
    hash: str
    centroid: Optional[tuple[float, float]] = None
    layer: Optional[str] = None
    parent_source_id: Optional[str] = None

    def as_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {
            "sourceId": self.source_id,
            "kind": self.kind,
            "documentPath": self.document_path,
            "hash": self.hash,
        }
        if self.centroid is not None:
            # Two floats, not a point list. This is what keeps position_delta
            # working after the geometry sidecar is gone -- see
            # docs/design-comparison/geometry-sidecar-consumers.md.
            out["centroid"] = [round(self.centroid[0], 4), round(self.centroid[1], 4)]
        if self.layer:
            out["layer"] = self.layer
        if self.parent_source_id:
            out["parentSourceId"] = self.parent_source_id
        return out


@dataclass
class DigestDelta:
    """Add/remove/change sets between two digests, keyed by (document, id)."""

    added: List[ObjectDigest] = field(default_factory=list)
    removed: List[ObjectDigest] = field(default_factory=list)
    modified: List[tuple[ObjectDigest, ObjectDigest]] = field(default_factory=list)

    @property
    def counts(self) -> Dict[str, int]:
        return {
            "added": len(self.added),
            "removed": len(self.removed),
            "modified": len(self.modified),
        }


def _own_uuid(text: str) -> Optional[str]:
    match = _UUID_RE.search(text)
    return match.group(1) if match else None


def _centroid(text: str) -> Optional[tuple[float, float]]:
    """Mean of the form's own coordinates.

    `at` wins where present because it is the object's placement; otherwise the
    mean of the point list, which is what `_extract_geometry` fed into
    `position_delta`.
    """
    at = _AT_RE.search(text)
    if at:
        return (float(at.group(1)), float(at.group(2)))
    points = [
        (float(x), float(y))
        for x, y in (*_XY_RE.findall(text), *_START_END_RE.findall(text))
    ]
    if not points:
        return None
    return (
        sum(p[0] for p in points) / len(points),
        sum(p[1] for p in points) / len(points),
    )


def _own_regions(
    source: str,
    start: int,
    end: int,
    child_spans: Sequence[tuple[int, int, str]],
) -> tuple[str, str]:
    """Split a form into its own content and its content-with-child-references.

    Slicing the whole form and then splicing children out would copy every
    byte once per level of nesting: a pad's bytes would be copied for the pad,
    its footprint, and any enclosing group. Reading only the gaps between
    direct children copies each byte exactly once.

    Returns (raw own text, own text with children substituted). The first is
    used for identity and layer lookup, so a parent that has no uuid of its own
    can never inherit the first uuid it happens to contain from a child.
    """
    raw: List[str] = []
    shallow: List[str] = []
    cursor = start
    for child_start, child_end, reference in child_spans:
        gap = source[cursor:child_start]
        raw.append(gap)
        shallow.append(gap)
        shallow.append(reference)
        cursor = child_end
    tail = source[cursor:end]
    raw.append(tail)
    shallow.append(tail)
    return "".join(raw), "".join(shallow)


def _normalise(text: str) -> str:
    # Identity is carried in source_id; leaving the uuid in would make every
    # hash unique and every comparison useless.
    return _WS_RE.sub(" ", _OWN_UUID_RE.sub("", text)).strip()


def _hash(text: str) -> str:
    return hashlib.blake2b(text.encode("utf-8"), digest_size=8).hexdigest()


def _heads_for(document_path: str) -> frozenset[str]:
    return _PCB_HEADS if document_path.endswith(".kicad_pcb") else _SCHEMATIC_HEADS


@dataclass(frozen=True)
class _Span:
    head: str
    start_offset: int
    end_offset: int


_HEAD_PATTERNS: Dict[frozenset[str], re.Pattern[str]] = {}


def _head_pattern(heads: frozenset[str]) -> re.Pattern[str]:
    pattern = _HEAD_PATTERNS.get(heads)
    if pattern is None:
        alternation = "|".join(sorted(heads, key=len, reverse=True))
        pattern = re.compile(r"\((" + alternation + r")(?=[\s)])")
        _HEAD_PATTERNS[heads] = pattern
    return pattern


def _object_spans(text: str, heads: frozenset[str]) -> List[_Span]:
    """Locate every candidate object by regex, then bound it by paren balance.

    A depth-aware S-expression traversal is the obvious way to write this and
    it is the wrong one. Measured on a 34.9 MB board, a projection scan costs
    ~10 s regardless of how few forms it selects, because it walks the whole
    file in Python; one alternation regex finds the same 23,698 objects in
    0.06 s, because the walk happens inside the regex engine. Bounding each
    match reuses `_balanced_s_expression_end`, which drives its paren walk the
    same way for the same reason.
    """
    spans: List[_Span] = []
    # `lib_symbols` is a definition cache, not placed content. Skipping the
    # whole block is both faster and necessary: its pins carry UUIDs that no
    # placed schematic item ever resolves to.
    library_start, library_end = semantic_index_service._library_block_span(text)
    for match in _head_pattern(heads).finditer(text):
        start = match.start()
        if library_start <= start < library_end:
            continue
        end = semantic_index_service._balanced_s_expression_end(text, start)
        if end is None:
            continue
        spans.append(_Span(match.group(1), start, end))
    return spans


def digest_document(text: str, document_path: str) -> List[ObjectDigest]:
    """One projection scan; one digest entry per addressable object."""
    heads = _heads_for(document_path)
    spans = sorted(
        _object_spans(text, heads | _GENERATED_HEADS),
        key=lambda span: (span.start_offset, -span.end_offset),
    )

    # Direct-child edges by offset containment. Spans are sorted by start, so a
    # simple stack gives the nesting without a second pass over the source.
    stack: List[int] = []
    parent_of: Dict[int, Optional[int]] = {}
    children_of: Dict[int, List[int]] = {index: [] for index in range(len(spans))}
    for index, span in enumerate(spans):
        while stack and spans[stack[-1]].end_offset <= span.start_offset:
            stack.pop()
        parent = stack[-1] if stack else None
        parent_of[index] = parent
        if parent is not None:
            children_of[parent].append(index)
        stack.append(index)

    # One pass to split every form into its own content, so identity is known
    # before any parent needs to reference it.
    own_raw: List[str] = [""] * len(spans)
    own_shallow: List[str] = [""] * len(spans)
    uuids: List[Optional[str]] = [None] * len(spans)
    # Children first: a parent's reference text needs its children's uuids.
    for index in range(len(spans) - 1, -1, -1):
        span = spans[index]
        child_refs: List[tuple[int, int, str]] = []
        for child in children_of[index]:
            child_span = spans[child]
            if child_span.head in _GENERATED_HEADS:
                # Cut generated content out entirely: a re-fill must not read
                # as an authored edit to the zone that owns it.
                reference = ""
            elif uuids[child]:
                reference = f"(#ref {child_span.head} {uuids[child]})"
            else:
                # Anonymous: leave inline, it is part of this object. Its own
                # children were already substituted into its shallow text.
                reference = own_shallow[child]
            child_refs.append((
                child_span.start_offset,
                child_span.end_offset,
                reference,
            ))
        raw, shallow = _own_regions(
            text, span.start_offset, span.end_offset, child_refs
        )
        own_raw[index] = raw
        own_shallow[index] = shallow
        uuids[index] = _own_uuid(raw)

    results: List[ObjectDigest] = []
    for index, span in enumerate(spans):
        if span.head in _GENERATED_HEADS:
            # Selected only so the enclosing form can excise it; never a row.
            continue
        source_id = uuids[index]
        if not source_id:
            # Anonymous: stays inline in its parent's hash rather than becoming
            # a row that a file reorder would spuriously invalidate.
            continue
        shallow = _normalise(own_shallow[index])

        parent_index = parent_of[index]
        parent_uuid = None
        while parent_index is not None and parent_uuid is None:
            parent_uuid = uuids[parent_index]
            parent_index = parent_of[parent_index]

        layer_match = _LAYER_RE.search(own_raw[index])
        results.append(ObjectDigest(
            source_id=source_id,
            kind=span.head,
            document_path=document_path,
            hash=_hash(shallow),
            centroid=_centroid(shallow),
            layer=layer_match.group(1) if layer_match else None,
            parent_source_id=parent_uuid,
        ))
    return results


def _is_generated_path(path: Path, root: Path) -> bool:
    parts = {part.lower() for part in path.relative_to(root).parts}
    return bool(parts & {"design-outputs", "manufacturing-outputs", "archive"})


def digest_snapshot(
    snapshot: Path,
    *,
    domains: Optional[Iterable[str]] = None,
) -> Dict[str, ObjectDigest]:
    """Digest every authored design file under a revision snapshot."""
    requested = set(domains) if domains is not None else {"schematic", "pcb"}
    out: Dict[str, ObjectDigest] = {}

    paths: List[Path] = []
    if "schematic" in requested:
        paths.extend(sorted(snapshot.rglob("*.kicad_sch")))
    if "pcb" in requested:
        paths.extend(sorted(snapshot.rglob("*.kicad_pcb")))

    for path in paths:
        if _is_generated_path(path, snapshot):
            continue
        document_path = path.relative_to(snapshot).as_posix()
        text = path.read_text(encoding="utf-8", errors="replace")
        for entry in digest_document(text, document_path):
            # A UUID is unique per file, not per project: two reused sheets are
            # two files only if they are two files. Key on both.
            out[f"{entry.document_path}#{entry.source_id}"] = entry
    return out


def diff_digests(
    base: Mapping[str, ObjectDigest],
    head: Mapping[str, ObjectDigest],
) -> DigestDelta:
    """Set difference on identity, then hash comparison on the intersection."""
    delta = DigestDelta()
    for key, entry in head.items():
        previous = base.get(key)
        if previous is None:
            delta.added.append(entry)
        elif previous.hash != entry.hash:
            delta.modified.append((previous, entry))
    for key, entry in base.items():
        if key not in head:
            delta.removed.append(entry)
    return delta


def digest_payload(entries: Mapping[str, ObjectDigest]) -> Dict[str, Any]:
    """Serializable sidecar body."""
    return {
        "schema": DIGEST_SCHEMA,
        "objects": [entry.as_dict() for entry in entries.values()],
    }
