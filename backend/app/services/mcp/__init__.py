"""The read-only MCP server's tool registry, invocation, policy and audit (ADR §3.7, §3.11).

``registry`` holds the tool declarations, ``tools`` registers the v5.1 read
set, ``tools_compare`` registers the two comparison tools, and ``invoke`` runs
one tool through the same typed ``/api/v1`` route a browser or SDK calls, so
policy, folder visibility and response shapes are the API's. ``governance``
decides which projects and tools an administrator has made reachable, and
``audit`` records every finished call. No tool here writes a design or calls a
model.
"""

from __future__ import annotations

__all__: list[str] = []
