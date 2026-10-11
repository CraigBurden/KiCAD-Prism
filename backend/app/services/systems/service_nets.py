"""The occurrence hierarchy (P2 §11) and system nets (SB2-31, SB2-33)."""

from __future__ import annotations

from typing import Optional

from app.services.systems import system_nets
from app.services.systems.service_base import Caller
from app.services.systems.store import Invalid, NotFound


class NetsMixin:
    def hierarchy(self, caller: Caller, system_id: str) -> dict:
        """``GET …/hierarchy`` (§11): every occurrence, redacted for the reader (§5.4)."""

        with self._tx() as store:
            return self._hierarchy_view(store, caller, system_id, self._load(store, system_id, caller).tree)

    def _net_groups(self, caller: Caller, system_id: str) -> tuple[list[dict], dict]:
        """Every system net of the tree, redacted for the reader, plus the occurrence index."""
        import hashlib

        with self._tx(consistent=True) as store:
            loaded = self._load(store, system_id, caller)  # SB2-95: one resolve, one read of the system
            occurrences = {o["path"]: o for o in self._hierarchy_view(store, caller, system_id, loaded.tree)["occurrences"]}
            root = loaded.level
        visible = {path for path, o in occurrences.items() if not o["restricted"]}

        def shown(path: Optional[str]) -> bool:
            return path in visible

        def side(point: dict) -> dict:
            # An unmated harness end has no board: nothing to hide, and no path to show.
            path = point["occurrence"]
            return {**point, "displayPath": occurrences[path]["displayPath"] if path else None}

        out = []
        for group in system_nets.build(root):
            members = [({"occurrence": m["occurrence"], "displayPath": occurrences[m["occurrence"]]["displayPath"],
                         "net": m["net"], "redacted": False} if shown(m["occurrence"])
                        else {"occurrence": None, "displayPath": None, "net": None, "redacted": True})
                       for m in group.members]
            hops = []
            for hop in group.hops:
                if not all(hop[s]["occurrence"] is None or shown(hop[s]["occurrence"]) for s in ("from", "to")):
                    continue
                hops.append({**hop, "from": side(hop["from"]), "to": side(hop["to"])})
            if not any(not m["redacted"] for m in members):
                continue  # nothing of it is visible to this reader
            aliases = sorted({system_nets.leaf(m["net"]) for m in members if m["net"] and not system_nets.is_auto(m["net"])})
            out.append({
                "groupId": hashlib.sha1(group.group_id.encode()).hexdigest()[:16],
                "name": aliases[0] if aliases else next((m["net"] for m in members if m["net"]), "unconnected"),
                "aliases": aliases, "pinCount": group.pin_count, "large": group.pin_count > system_nets.LARGE_GROUP_PINS,
                "members": members, "hops": hops,
            })
        return out, occurrences

    def nets(self, caller: Caller, system_id: str, *, search: str = "", occurrence: Optional[str] = None,
             net: Optional[str] = None, members: bool = False, limit: int = 50, offset: int = 0) -> dict:
        """``GET …/nets``: system nets matching ``search`` (any alias), optionally touching one board occurrence.

        ``net`` (with ``occurrence``) keeps only the group holding exactly that board net (SB2-32).
        ``members`` adds each group's visible board nets, ``{occurrence, net}`` (SB2-33's search).
        """
        if net is not None and not occurrence:
            raise Invalid("net needs occurrence")
        groups, _occurrences = self._net_groups(caller, system_id)
        needle = search.strip().casefold()
        found = []
        for group in groups:
            if needle and not any(needle in alias.casefold() for alias in group["aliases"]) and not any(
                    needle in (m["net"] or "").casefold() for m in group["members"]):
                continue
            if occurrence and not any(m["occurrence"] == occurrence and (net is None or m["net"] == net)
                                      for m in group["members"]):
                continue
            summary = {k: group[k] for k in ("groupId", "name", "aliases", "pinCount", "large")} \
                | {"boards": len({m["occurrence"] for m in group["members"] if m["occurrence"]})}
            if members:
                summary["members"] = [{"occurrence": m["occurrence"], "net": m["net"]} for m in group["members"]
                                      if m["occurrence"] and m["net"]]
            found.append(summary)
        found.sort(key=lambda g: (g["name"].casefold(), g["groupId"]))
        return {"systemId": system_id, "groups": found[offset:offset + limit], "total": len(found), "offset": offset}

    def net(self, caller: Caller, system_id: str, group_id: str) -> dict:
        """``GET …/nets/{groupId}``: one system net with its members and hops."""
        groups, _occurrences = self._net_groups(caller, system_id)
        found = next((g for g in groups if g["groupId"] == group_id), None)
        if found is None:
            raise NotFound("System net not found")
        return found
