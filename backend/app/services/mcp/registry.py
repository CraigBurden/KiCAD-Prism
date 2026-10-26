"""The MCP tool registry (ADR scripting-and-mcp §3.7).

A tool is declared once, beside the route it reads: its name, the JSON Schema
an MCP client sees, the typed ``/api/v1`` route it calls, and how its arguments
become that route's path and query. The registry is deliberately plain module
API — the supply tools register into the same list later — and ``tools()``
returns declarations in registration order so ``tools/list`` is deterministic.

``output_schema`` is the route's ``200`` response schema from ``app.openapi()``
with ``$ref``s inlined. The resolver is small and depth-capped on purpose:
OpenAPI schemas are shallow, and a self-referential model must not loop.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

#: Every tool here reads. MCP clients never get a write tool (v5.1), and the
#: annotations say so rather than leaving a client to infer it.
READ_ONLY_ANNOTATIONS: dict[str, bool] = {
    "readOnlyHint": True,
    "idempotentHint": True,
    "openWorldHint": False,
}

_MAX_REF_DEPTH = 32


@dataclass(frozen=True)
class Tool:
    """One task-level read, and the route that answers it."""

    name: str
    title: str
    description: str
    input_schema: dict[str, Any]
    #: ``(method, path template)`` under ``/api/v1``, template parameters
    #: filled from the ``path_params`` ``args`` returns.
    route: tuple[str, str]
    #: ``arguments -> (path_params, query)``; ``None`` values are dropped.
    args: Callable[[dict[str, Any]], tuple[dict[str, Any], dict[str, Any]]]
    annotations: dict[str, bool]
    output_schema: dict[str, Any] | None = None


_TOOLS: list[Tool] = []


def register(tool: Tool) -> Tool:
    """Add ``tool`` to the registry. Duplicate names are a programming error."""

    if any(existing.name == tool.name for existing in _TOOLS):
        raise ValueError(f"a tool named {tool.name!r} is already registered")
    _TOOLS.append(tool)
    return tool


def tools() -> tuple[Tool, ...]:
    """Every registered tool, in registration order."""

    return tuple(_TOOLS)


def tool_named(name: str) -> Tool | None:
    for tool in _TOOLS:
        if tool.name == name:
            return tool
    return None


def _inline(node: Any, schemas: dict[str, Any], depth: int) -> Any:
    """``node`` with local component ``$ref``s replaced by their schemas."""

    if depth <= 0:
        return {}
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str):
            target = schemas.get(ref.rsplit("/", 1)[-1])
            if target is None:
                return {}
            resolved = _inline(target, schemas, depth - 1)
            siblings = {key: value for key, value in node.items() if key != "$ref"}
            if siblings and isinstance(resolved, dict):
                resolved = {**resolved, **_inline(siblings, schemas, depth - 1)}
            return resolved
        return {key: _inline(value, schemas, depth - 1) for key, value in node.items()}
    if isinstance(node, list):
        return [_inline(value, schemas, depth - 1) for value in node]
    return node


def response_schema(app: Any, route: tuple[str, str]) -> dict[str, Any] | None:
    """The route's JSON ``200`` response schema, or ``None`` when untyped.

    ``app`` is the FastAPI application the tool will call, so this reads the
    same document ``/api/v1/openapi.json`` publishes.
    """

    method, path = route
    document = app.openapi()
    operation = (document.get("paths") or {}).get(path, {}).get(method.lower()) or {}
    schema = (
        ((operation.get("responses") or {}).get("200") or {})
        .get("content", {})
        .get("application/json", {})
        .get("schema")
    )
    if not isinstance(schema, dict) or not schema:
        return None
    schemas = (document.get("components") or {}).get("schemas") or {}
    return _inline(schema, schemas, _MAX_REF_DEPTH)


def tool_definition(tool: Tool, app: Any | None = None) -> dict[str, Any]:
    """The MCP ``tools/list`` entry for ``tool``."""

    definition: dict[str, Any] = {
        "name": tool.name,
        "title": tool.title,
        "description": tool.description,
        "inputSchema": tool.input_schema,
        "annotations": dict(tool.annotations),
    }
    output_schema = tool.output_schema
    if output_schema is None and app is not None:
        output_schema = response_schema(app, tool.route)
    if output_schema is not None:
        definition["outputSchema"] = output_schema
    return definition


def tool_definitions(app: Any | None = None) -> list[dict[str, Any]]:
    return [tool_definition(tool, app) for tool in _TOOLS]


__all__ = [
    "READ_ONLY_ANNOTATIONS",
    "Tool",
    "register",
    "response_schema",
    "tool_definition",
    "tool_definitions",
    "tool_named",
    "tools",
]
