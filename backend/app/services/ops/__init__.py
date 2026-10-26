"""The ops seam's services (ADR scripting-and-mcp §11, OPS-03).

``workers`` keeps each worker's heartbeat and ``app.core.runtime_logging``
reads and applies the time-boxed debug-logging setting. Routes and MCP tools
live elsewhere: OPS-06 adds the actions and OPS-04c reads the workers.
"""

from __future__ import annotations

__all__: list[str] = []
