"""The system scene descriptor ``prism.system_scene.a0`` (CONTRACTS_P2 §20).

Pure: the service hands in the occurrence tree, the reader's redaction, each
board's interface and each bundle's status; this module places every
occurrence and lists the board bundles the renderer needs, one per
(project, commit), however many occurrences share it.
"""

from __future__ import annotations

import hashlib
from collections import defaultdict
from typing import Any, Callable, Mapping, Optional, Sequence

from app.services.systems import system_nets
from app.services.systems.hierarchy import Occurrence
from app.services.systems.mating import is_stale
from app.services.systems.placement import poses, solve

SCHEMA = "prism.system_scene.a0"


def asset_id(project_id: str, commit: str) -> str:
    return "sba_" + hashlib.sha256(f"{project_id}\0{commit}".encode()).hexdigest()[:16]


def board_bounds(interface: Optional[Mapping[str, Any]]) -> Optional[dict]:
    """A board's box in its own frame (§14.2): the outline in x/y, ±t/2 in z."""
    outline = (interface or {}).get("boardOutlineMm")
    if not outline:
        return None
    half = float(interface.get("boardThicknessMm") or 0.0) / 2.0
    return {"minMm": [*outline["minMm"], -half], "maxMm": [*outline["maxMm"], half]}


def bundle_to_board(mid_plane_mm: Optional[float]) -> Optional[list[float]]:
    """Column-major map from a bundle's runtime frame (metres, z from the board's
    bottom face) to the board frame (mm, z = 0 at the mid-plane): scale by 1000,
    then lower by the mid-plane height."""
    if mid_plane_mm is None:
        return None
    return [1000.0, 0.0, 0.0, 0.0, 0.0, 1000.0, 0.0, 0.0, 0.0, 0.0, 1000.0, 0.0,
            0.0, 0.0, poses._clean(-mid_plane_mm), 1.0]


Component = Callable[[Occurrence, str], Optional[Mapping[str, Any]]]


def _levels(root: Optional[system_nets.Level]) -> dict[str, system_nets.Level]:
    out: dict[str, system_nets.Level] = {}

    def walk(level: system_nets.Level) -> None:
        out[level.prefix] = level
        for child in level.children.values():
            walk(child)

    if root is not None:
        walk(root)
    return out


def _link_rows(link: Mapping[str, Any]) -> int:
    return len(link.get("rows") or [])


def _stack_height(link: Mapping[str, Any]) -> Optional[float]:
    value = link.get("stack_height_mm", link.get("stackHeightMm"))
    return float(value) if value is not None else None


def place_tree(
    occurrences: Sequence[Occurrence],
    interface: Callable[[Occurrence], Optional[Mapping[str, Any]]],
    stored: Optional[Mapping[str, Mapping[str, Any]]] = None,
    root: Optional[system_nets.Level] = None,
    component: Optional[Component] = None,
) -> dict:
    """Place every occurrence in its parent's frame (§14.3, §14.9).

    Each system level is solved on its own: its members, its B2B links (ends on an
    assembly followed down to the board through exports), its stored frames and
    driving overrides, and its stored poses (the root's from ``stored``; a child
    system's frozen in its snapshot, so it moves as a rigid group). Without
    ``root``/``component`` there are no mates and every member takes its stored
    pose or default slot.

    Returns ``{placed, local, results}``: each occurrence's pose (with ``source``)
    by path, its bounds in its own frame, and each solved level's solve result by
    prefix (``unusable`` also lists B2B links whose end connector can't be read).
    """

    children: dict[str, list[Occurrence]] = defaultdict(list)
    by_path = {o.path: o for o in occurrences}
    for occurrence in occurrences:
        children[occurrence.path.rsplit("/", 1)[0]].append(occurrence)
    for members in children.values():
        members.sort(key=lambda o: (o.labels[-1].casefold(), o.instance_id))
    levels = _levels(root)

    local: dict[str, Optional[dict]] = {}
    placed: dict[str, dict] = {}
    results: dict[str, dict] = {}

    def in_member(member_path: str, board_path: str) -> Optional[dict]:
        """The board's pose inside the member it belongs to (None when it is the member)."""
        if board_path == member_path:
            return None
        pose, path = poses.IDENTITY, member_path
        for segment in board_path[len(member_path) + 1:].split("/"):
            path = f"{path}/{segment}"
            pose = poses.compose(pose, placed[path])
        return {"translationMm": pose["translationMm"], "rotation": pose["rotation"]}

    def mate_end(level: system_nets.Level, prefix: str, end: tuple[str, str, str]) -> Optional[dict]:
        instance_id, key, reference = end
        member_path = f"{prefix}/{instance_id}"
        if level.kinds.get(instance_id, "board") in ("board", "module"):  # a module's connectors mate like a board's
            located: Optional[tuple[str, str, str]] = (member_path, key, reference)
        else:
            child = level.children.get(instance_id)
            located = system_nets._resolve_export(child, key) if child else None
        if located is None or component is None:
            return None
        board_path, port_key, board_reference = located
        board = by_path.get(board_path)
        found = component(board, port_key) if board is not None else None
        if not found or not found.get("geometry"):
            return None
        record = levels.get(board_path.rsplit("/", 1)[0], level).mating.get(board.instance_id, {}).get(port_key)
        frame = found.get("matingFrame") or (None if record is None or is_stale(found, record) else
                                             {"axis": record["axis"], "quarterTurns": int(record.get("quarterTurns") or 0)})
        thickness = found.get("boardThicknessMm")
        if thickness is None:
            thickness = (interface(board) or {}).get("boardThicknessMm")
        out = {"member": member_path, "reference": board_reference or found.get("reference") or "",
               "end": {"geometry": found["geometry"], "thicknessMm": thickness, "stored": frame}}
        inside = in_member(member_path, board_path)
        if found.get("footprintPose"):
            # A module port (§5.6): the connector's footprint on a zero-thickness board at its pose on the module.
            inside = poses.compose(inside or poses.IDENTITY, found["footprintPose"])
        if inside is not None:
            out["inMember"] = {"translationMm": inside["translationMm"], "rotation": inside["rotation"]}
        return out

    def layout(prefix: str, kept: Mapping[str, Mapping[str, Any]]) -> Optional[dict]:
        """Place the members of the system at ``prefix``; return their union in its frame."""
        members = children.get(prefix, [])
        for member in members:
            if member.kind == "board":
                local[member.path] = board_bounds(interface(member))
            elif member.kind in ("module", "part"):  # its model's aligned bounds (§5.6, §24.1)
                local[member.path] = (interface(member) or {}).get("boundsMm")
            else:
                frozen = {p["instanceId"]: p for p in (member.child.poses if member.child else ())}
                local[member.path] = layout(member.path, frozen)
        items = [(m.path, local[m.path]) for m in members]
        own = {m.path: kept[m.instance_id] for m in members if m.instance_id in kept}
        level = levels.get(prefix)
        b2b = [link for link in (level.links if level else ()) if link.get("type") == "b2b"]
        if not b2b:
            row = poses.place(items, own)
        else:
            mates, unreadable = [], []
            for link in b2b:
                a = mate_end(level, prefix, system_nets._end(link, "a"))
                b = mate_end(level, prefix, system_nets._end(link, "b"))
                if a is None or b is None:
                    unreadable.append(link["id"])
                    continue
                mates.append({"linkId": link["id"], "rows": _link_rows(link), "stackHeightMm": _stack_height(link),
                              "a": a, "b": b})
            connections = [(f"{prefix}/{system_nets._end(link, 'a')[0]}", f"{prefix}/{system_nets._end(link, 'b')[0]}")
                           for link in level.links]
            overrides = {f"{prefix}/{instance_id}": link_id for instance_id, link_id in level.driving.items()}
            result = solve.solve(items, own, connections, mates, overrides)
            result["unusable"] = sorted(result["unusable"] + unreadable)
            results[prefix] = result
            row = result["poses"]
        placed.update(row)
        return poses.union([poses.transform_bounds(row[m.path], local[m.path]) for m in members])

    layout("", stored or {})
    return {"placed": placed, "local": local, "results": results}


def world_poses(occurrences: Sequence[Occurrence], placed: Mapping[str, Mapping[str, Any]]) -> dict[str, dict]:
    """Each occurrence's pose in the root system's frame (parents come before their members)."""
    world: dict[str, dict] = {}
    for occurrence in occurrences:
        parent = occurrence.path.rsplit("/", 1)[0]
        pose = {key: placed[occurrence.path][key] for key in ("translationMm", "rotation")}
        world[occurrence.path] = poses.compose(world[parent] if parent else poses.IDENTITY, pose)
    return world


def build(
    system_id: str,
    system_version: int,
    occurrences: Sequence[Occurrence],
    shown: Mapping[str, Mapping[str, Any]],
    interface: Callable[[Occurrence], Optional[Mapping[str, Any]]],
    asset: Callable[[Occurrence], dict],
    stored: Optional[Mapping[str, Mapping[str, Any]]] = None,
    placement: Optional[Mapping[str, Any]] = None,
) -> dict:
    """``shown`` is ``GET …/hierarchy``'s redacted entries by path (absent = hidden inside a
    restricted child system). ``asset(o)`` is the asset entry for a visible board.
    ``stored`` holds the root system's poses by instance ID; a child system's come
    frozen in its snapshot (a rigid group, §14.3). ``placement`` is ``place_tree``'s
    result when the caller solved mates; without it members take stored or default poses."""

    placement = placement or place_tree(occurrences, interface, stored)
    placed, local = placement["placed"], placement["local"]
    driving = {path: entry for result in placement["results"].values() for path, entry in result["driving"].items()}

    world = world_poses(occurrences, placed)
    assets: dict[str, dict] = {}
    out = []
    for occurrence in occurrences:
        parent = occurrence.path.rsplit("/", 1)[0]
        entry = shown.get(occurrence.path)
        if entry is None:
            continue
        item = {
            "path": occurrence.path, "parentPath": parent or None, "displayPath": entry["displayPath"],
            "labels": entry["labels"], "instanceId": occurrence.instance_id, "kind": occurrence.kind,
            "depth": occurrence.depth, "restricted": entry["restricted"], "assetId": None,
            "pose": placed[occurrence.path],
            "worldMatrix": poses.matrix(world[occurrence.path]),
            "boundsMm": local[occurrence.path],
            "mate": None,
        }
        mate = driving.get(occurrence.path)
        if mate is not None:
            item["mate"] = {"linkId": mate["linkId"], "from": mate["from"], "overridden": mate["overridden"],
                            "autoPose": {k: mate["autoPose"][k] for k in ("translationMm", "rotation")}}
        if occurrence.kind in ("module", "part") and not entry["restricted"]:
            model = (interface(occurrence) or {}).get("model")
            if model:  # §20.18: the viewer draws the module's GLB under its alignment
                from app.services.catalog.models import alignment_matrix

                item["model"] = {"glbKey": model["glbKey"], "matrixMm": alignment_matrix(model["alignment"]),
                                 "boundsMm": model["boundsMm"]}
        if occurrence.kind == "board" and not entry["restricted"]:
            found = asset(occurrence)
            assets.setdefault(found["assetId"], found)
            item["assetId"] = found["assetId"]
        out.append(item)
    return {
        "schema": SCHEMA, "systemId": system_id, "systemVersion": system_version, "units": "mm",
        "assets": sorted(assets.values(), key=lambda a: a["assetId"]),
        "occurrences": out,
    }


def harness_connectors(harnesses: Sequence[dict], occurrences: Sequence[Occurrence],
                       root: Optional[system_nets.Level], component: Component) -> None:
    """Attach each located end's ``connector`` (§17.6 inputs): ``{geometry, thicknessMm, stored}``, with
    ``stored`` the level's confirmed or override frame (null when there is none or it is stale; the browser
    then infers it). Ends whose connector can't be read get null."""
    by_path = {o.path: o for o in occurrences}
    levels = _levels(root)
    for harness in harnesses:
        for end in harness["ends"]:
            end["connector"] = None
            board = by_path.get(end["occurrence"] or "")
            if board is None or not end.get("portKey"):
                continue
            found = component(board, end["portKey"])
            if not found or not found.get("geometry"):
                continue
            level = levels.get(board.path.rsplit("/", 1)[0])
            record = level.mating.get(board.instance_id, {}).get(end["portKey"]) if level else None
            stored = found.get("matingFrame") or (None if record is None or is_stale(found, record) else
                                                  {"axis": record["axis"], "quarterTurns": int(record.get("quarterTurns") or 0)})
            end["connector"] = {"geometry": found["geometry"], "thicknessMm": found.get("boardThicknessMm"),
                                "stored": stored}
            if found.get("footprintPose"):  # a module's connector: where its footprint sits on the module (§5.6)
                end["connector"]["inOccurrence"] = found["footprintPose"]


def redact_harnesses(harnesses: Sequence[Mapping[str, Any]], shown: Mapping[str, Mapping[str, Any]]) -> list[dict]:
    """The scene's proxy harnesses (SB2-34) for this reader. A harness inside a child system the
    reader cannot open is left out. An end on a restricted board keeps the board (its box is drawn)
    but not the connector; an end on a board the reader cannot see at all has no occurrence."""
    out = []
    for harness in harnesses:
        level = harness["level"]
        if level and (level not in shown or shown[level]["restricted"]):
            continue
        ends = []
        for end in harness["ends"]:
            entry = shown.get(end["occurrence"]) if end["occurrence"] else None
            open_board = bool(entry) and not entry["restricted"]
            ends.append({"id": end["id"], "ordinal": end["ordinal"],
                         "occurrence": end["occurrence"] if entry else None,
                         "reference": end["reference"] if open_board else None,
                         # SB2-44: what the browser needs to pose the end (§17.6); never for a restricted board.
                         "part": end.get("part"), "partRevisionId": end.get("partRevisionId"),
                         "connector": end.get("connector") if open_board else None,
                         # SB2-47: the part's model (catalog data, not the board's).
                         "housing": end.get("housing")})
        out.append({"id": harness["id"], "level": level or None, "name": harness["name"], "ends": ends,
                    "wires": [dict(wire) for wire in harness["wires"]],
                    "nodes": [dict(node) for node in harness.get("nodes") or []]})
    return out
