"""The read-only MCP server's tool registry and invocation (ADR §3.7).

``registry`` holds the tool declarations, ``tools`` registers the v5.1 read
set, and ``invoke`` runs one tool through the same typed ``/api/v1`` route a
browser or SDK calls, so policy, folder visibility and response shapes are the
API's. Nothing here calls a model or writes anything.
"""

from __future__ import annotations

__all__: list[str] = []
