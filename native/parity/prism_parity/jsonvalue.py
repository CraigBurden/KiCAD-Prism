"""JSON value equality and JSON-pointer helpers (conventions.md §14).

- Objects compare as key sets with no order; a key absent on one side differs
  from a key holding ``null``.
- Arrays compare element by element, in order.
- Numbers compare as IEEE-754 doubles, so ``1 == 1.0`` and ``1e-05 == 1e-5``.
  Booleans are not numbers (Python's ``True == 1`` is not used).
- Strings compare by code points; booleans and ``null`` by identity.

Pointers are RFC 6901. Patterns used for non-semantic fields and ignore rules
add one extension: a ``*`` segment matches every array element or object key.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterator

MISSING = object()


@dataclass(frozen=True)
class Difference:
    """One difference between the expected (golden) and the actual (member) value."""

    pointer: str
    kind: str  # value | type | missing | extra | length
    expected: Any = None
    actual: Any = None

    def describe(self, limit: int = 160) -> str:
        def short(value: Any) -> str:
            if value is MISSING:
                return "(absent)"
            text = repr(value)
            return text if len(text) <= limit else text[: limit - 3] + "..."

        pointer = self.pointer or "/"
        if self.kind == "missing":
            return f"{pointer}: absent in member (golden {short(self.expected)})"
        if self.kind == "extra":
            return f"{pointer}: only in member ({short(self.actual)})"
        if self.kind == "length":
            return f"{pointer}: array length golden {self.expected} != member {self.actual}"
        return f"{pointer}: golden {short(self.expected)} != member {short(self.actual)}"

    def as_json(self) -> dict:
        out: dict[str, Any] = {"pointer": self.pointer, "kind": self.kind}
        if self.expected is not MISSING:
            out["golden"] = self.expected
        if self.actual is not MISSING:
            out["member"] = self.actual
        return out


def escape(segment: str) -> str:
    return segment.replace("~", "~0").replace("/", "~1")


def unescape(segment: str) -> str:
    return segment.replace("~1", "/").replace("~0", "~")


def split(pointer: str) -> list[str]:
    if pointer == "":
        return []
    if not pointer.startswith("/"):
        raise ValueError(f"not a JSON pointer: {pointer!r}")
    return [unescape(part) for part in pointer[1:].split("/")]


def join(parts: list[str]) -> str:
    return "".join("/" + escape(part) for part in parts)


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def numbers_equal(a: float | int, b: float | int) -> bool:
    try:
        return float(a) == float(b)
    except OverflowError:  # integers beyond the double range: compare exactly
        return a == b


def scalar_equal(a: Any, b: Any) -> bool:
    if _is_number(a) and _is_number(b):
        return numbers_equal(a, b)
    if type(a) is not type(b):
        return False
    return a == b


def diff(expected: Any, actual: Any, pointer: str = "") -> Iterator[Difference]:
    """Yield every difference, depth first, in key order then array order."""

    if isinstance(expected, dict) and isinstance(actual, dict):
        for key in sorted(set(expected) | set(actual)):
            child = pointer + "/" + escape(key)
            if key not in actual:
                yield Difference(child, "missing", expected[key], MISSING)
            elif key not in expected:
                yield Difference(child, "extra", MISSING, actual[key])
            else:
                yield from diff(expected[key], actual[key], child)
        return
    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            yield Difference(pointer, "length", len(expected), len(actual))
        for index, (left, right) in enumerate(zip(expected, actual)):
            yield from diff(left, right, f"{pointer}/{index}")
        return
    if isinstance(expected, (dict, list)) or isinstance(actual, (dict, list)):
        yield Difference(pointer, "type", expected, actual)
        return
    if not scalar_equal(expected, actual):
        kind = "value" if (_is_number(expected) and _is_number(actual)) or type(expected) is type(actual) else "type"
        yield Difference(pointer, kind, expected, actual)


def equal(expected: Any, actual: Any) -> bool:
    return next(diff(expected, actual), None) is None


# ---------------------------------------------------------------- patterns


def pattern_matches(pattern: str, pointer: str) -> bool:
    """True when ``pointer`` is matched by ``pattern`` or lies below a match."""

    want = split(pattern)
    have = split(pointer)
    if len(have) < len(want):
        return False
    return all(w == "*" or w == h for w, h in zip(want, have))


def expand(document: Any, pattern: str) -> list[list[str]]:
    """Concrete paths (as segment lists) that ``pattern`` names in ``document``."""

    results: list[list[str]] = []

    def walk(node: Any, rest: list[str], done: list[str]) -> None:
        if not rest:
            results.append(done)
            return
        head, tail = rest[0], rest[1:]
        if isinstance(node, dict):
            keys = sorted(node) if head == "*" else ([head] if head in node else [])
            for key in keys:
                walk(node[key], tail, done + [key])
        elif isinstance(node, list):
            if head == "*":
                indexes = range(len(node))
            elif head.isdigit() and int(head) < len(node):
                indexes = [int(head)]
            else:
                indexes = []
            for index in indexes:
                walk(node[index], tail, done + [str(index)])

    walk(document, split(pattern), [])
    return results


def remove_pattern(document: Any, pattern: str) -> int:
    """Delete every value ``pattern`` names, in place. Returns how many were removed.

    Array elements are removed from the highest index down, so a pattern that
    names whole elements keeps the remaining order. A pattern of ``""`` is refused.
    """

    paths = expand(document, pattern)
    if any(not path for path in paths):
        raise ValueError("cannot remove the whole document")
    removed = 0
    for path in sorted(paths, key=lambda p: [int(s) if s.isdigit() else -1 for s in p], reverse=True):
        parent = resolve(document, path[:-1])
        key = path[-1]
        if isinstance(parent, dict) and key in parent:
            del parent[key]
            removed += 1
        elif isinstance(parent, list):
            del parent[int(key)]
            removed += 1
    return removed


def resolve(document: Any, parts: list[str]) -> Any:
    node = document
    for part in parts:
        if isinstance(node, list):
            node = node[int(part)]
        else:
            node = node[part]
    return node


# ------------------------------------------------------------------ patches


def apply_patch(document: Any, operation: dict) -> Any:
    """Apply one RFC 6902 operation (add, remove, replace) in place; returns the document.

    ``add`` with a final ``-`` segment appends to an array.
    """

    op = operation["op"]
    parts = split(operation["path"])
    if not parts:
        if op in ("add", "replace"):
            return operation["value"]
        raise ValueError("cannot remove the whole document")
    parent = resolve(document, parts[:-1])
    key = parts[-1]
    if isinstance(parent, list):
        if op == "add":
            if key == "-":
                parent.append(operation["value"])
            else:
                parent.insert(int(key), operation["value"])
        elif op == "remove":
            del parent[int(key)]
        elif op == "replace":
            parent[int(key)] = operation["value"]
        else:
            raise ValueError(f"unsupported patch op {op!r}")
    elif isinstance(parent, dict):
        if op in ("add", "replace"):
            if op == "replace" and key not in parent:
                raise KeyError(f"replace of an absent key: {operation['path']}")
            parent[key] = operation["value"]
        elif op == "remove":
            del parent[key]
        else:
            raise ValueError(f"unsupported patch op {op!r}")
    else:
        raise TypeError(f"{operation['path']}: parent is not a container")
    return document
