#!/usr/bin/env python3
"""Check the catalog decomposition guardrails.

This is intentionally a small, dependency-free static check.  It makes the two
contracts that make catalog moves safe observable:

* code added below ``app.services.catalog`` cannot import the legacy catalog
  facades or domain module; and
* private catalog members used outside their implementation modules are
  tracked by a stable path/symbol/count ratchet.

The production-module line policy is a separate gate,
``scripts/check_module_size.py``; both keep their ratchets in
``scripts/catalog_architecture_baseline.json`` (``architecture_baseline.py``).

Usage::

    python3 scripts/check_catalog_architecture.py
    python3 scripts/check_catalog_architecture.py --update-baseline

``--update-baseline`` is deliberately explicit.  It records only private-use
reductions/removals and leaves the module-line ceilings as they are.  New or
increased private uses and import-boundary violations are refused; the option
is not part of the normal CI command.
"""

from __future__ import annotations

import argparse
import ast
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
import sys
from typing import Iterable, Iterator, Mapping, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent))

from architecture_baseline import (  # noqa: E402
    BASELINE_FILENAME,
    describe_path,
    load_baseline,
    load_baseline_at_ref,
    write_baseline,
)


REPO_ROOT = Path(__file__).resolve().parents[1]

LEGACY_CATALOG_MODULES = frozenset(
    {
        "app.services.component_catalog_service",
        "app.services.component_catalog_service_postgres",
        "app.services.component_catalog_domain",
    }
)
CATALOG_PACKAGE = "app.services.catalog"


def _is_private_name(name: str) -> bool:
    """Return true for a conventional private name, excluding dunder names."""

    return name.startswith("_") and not name.startswith("__")


def _path_key(path: Path, repo_root: Path) -> str:
    return path.resolve().relative_to(repo_root.resolve()).as_posix()


def _iter_python_files(repo_root: Path) -> Iterator[Path]:
    """Yield repository Python files in deterministic order, including tests and scripts."""

    ignored_parts = {
        ".git",
        ".mypy_cache",
        ".pytest_cache",
        ".venv",
        "__pycache__",
        "node_modules",
        "venv",
    }
    paths: list[Path] = []
    for path in repo_root.rglob("*.py"):
        if any(part in ignored_parts for part in path.parts):
            continue
        paths.append(path)
    yield from sorted(paths, key=lambda item: item.as_posix())


def _source_module_name(path: Path, repo_root: Path) -> str | None:
    """Resolve a source file to its importable ``app.*`` module name."""

    try:
        relative = path.resolve().relative_to(repo_root.resolve())
    except ValueError:
        return None
    parts = relative.parts
    try:
        app_index = parts.index("app")
    except ValueError:
        return None
    if app_index == 0 or parts[app_index - 1] != "backend":
        return None
    source_parts = list(parts[app_index:])
    filename = source_parts.pop()
    if not filename.endswith(".py"):
        return None
    stem = filename[:-3]
    if stem != "__init__":
        source_parts.append(stem)
    return ".".join(source_parts)


def _relative_import_module(path: Path, node: ast.ImportFrom, repo_root: Path) -> str:
    """Resolve an ``ImportFrom`` node to an absolute module name."""

    if node.level == 0:
        return node.module or ""
    current = _source_module_name(path, repo_root) or ""
    if current.rsplit(".", 1)[-1] == path.stem and path.stem != "__init__":
        package_parts = current.split(".")[:-1]
    else:
        package_parts = current.split(".") if current else []
    if node.level:
        package_parts = package_parts[: max(0, len(package_parts) - node.level + 1)]
    if node.module:
        package_parts.extend(node.module.split("."))
    return ".".join(part for part in package_parts if part)


def _legacy_module_name(name: str) -> str | None:
    for module in LEGACY_CATALOG_MODULES:
        if name == module or name.startswith(module + "."):
            return module
    return None


@dataclass(frozen=True)
class ImportViolation:
    path: str
    line: int
    module: str


def catalog_import_violations(repo_root: Path = REPO_ROOT) -> list[ImportViolation]:
    """Find imports from legacy catalog modules below the target package."""

    catalog_root = (repo_root / "backend" / "app" / "services" / "catalog").resolve()
    violations: list[ImportViolation] = []
    if not catalog_root.is_dir():
        return violations
    for path in sorted(catalog_root.rglob("*.py"), key=lambda item: item.as_posix()):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except (OSError, SyntaxError) as exc:
            line = getattr(exc, "lineno", 1) or 1
            violations.append(
                ImportViolation(_path_key(path, repo_root), line, f"syntax error: {exc}")
            )
            continue
        for node in ast.walk(tree):
            module_names: list[str] = []
            if isinstance(node, ast.Import):
                module_names.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                resolved = _relative_import_module(path, node, repo_root)
                if resolved:
                    module_names.append(resolved)
                    # ``from app.services import component_catalog_domain``
                    # resolves the imported name one level below the ``from``
                    # module, so inspect each imported module too.
                    if node.module is None or not _legacy_module_name(resolved):
                        module_names.extend(
                            f"{resolved}.{alias.name}" for alias in node.names
                        )
            for module_name in module_names:
                legacy = _legacy_module_name(module_name)
                if legacy:
                    violations.append(
                        ImportViolation(_path_key(path, repo_root), node.lineno, module_name)
                    )
    return sorted(violations, key=lambda item: (item.path, item.line, item.module))


@dataclass(frozen=True)
class LegacyMembers:
    """Private names exposed by legacy and new-package catalog code."""

    module_members: Mapping[str, frozenset[str]]
    class_members: Mapping[str, frozenset[str]]

    @property
    def all_members(self) -> frozenset[str]:
        values: set[str] = set()
        for members in self.module_members.values():
            values.update(members)
        for members in self.class_members.values():
            values.update(members)
        return frozenset(values)


def _assignment_names(node: ast.AST) -> Iterator[str]:
    if isinstance(node, ast.Name):
        yield node.id
    elif isinstance(node, ast.Attribute):
        yield node.attr
    elif isinstance(node, (ast.Tuple, ast.List)):
        for element in node.elts:
            yield from _assignment_names(element)


def _class_private_members(class_node: ast.ClassDef) -> set[str]:
    members: set[str] = set()
    for node in class_node.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if _is_private_name(node.name):
                members.add(node.name)
        elif isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
            targets: Iterable[ast.AST]
            if isinstance(node, ast.Assign):
                targets = node.targets
            else:
                targets = (node.target,)
            for target in targets:
                members.update(
                    name for name in _assignment_names(target) if _is_private_name(name)
                )
    # Instance fields are part of the service's private surface too.  Restrict
    # this to conventional ``self``/``cls`` receivers so local object internals
    # do not become catalog members by accident.
    for node in ast.walk(class_node):
        if not isinstance(node, ast.Attribute) or not _is_private_name(node.attr):
            continue
        receiver = node.value
        if isinstance(receiver, ast.Name) and receiver.id in {"self", "cls"}:
            members.add(node.attr)
    return members


def _catalog_member_paths(repo_root: Path) -> dict[str, Path]:
    """Return catalog module names and paths in deterministic order."""

    paths: dict[str, Path] = {}
    for module in sorted(LEGACY_CATALOG_MODULES):
        relative = Path("backend") / Path(*module.split("."))
        paths[module] = (repo_root / relative).with_suffix(".py")

    catalog_root = repo_root / "backend" / "app" / "services" / "catalog"
    if catalog_root.is_dir():
        for path in sorted(catalog_root.rglob("*.py"), key=lambda item: item.as_posix()):
            if "__pycache__" in path.parts:
                continue
            module = _source_module_name(path, repo_root)
            if module:
                paths[module] = path
    return dict(sorted(paths.items()))


def load_legacy_members(repo_root: Path = REPO_ROOT) -> LegacyMembers:
    """Parse private members from legacy modules and the new catalog package."""

    module_members: dict[str, frozenset[str]] = {}
    class_members: dict[str, frozenset[str]] = {}
    for module, path in _catalog_member_paths(repo_root).items():
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except (OSError, SyntaxError):
            # Import-boundary failures will give the actionable parse error;
            # keeping the member set empty here avoids a second traceback.
            module_members[module] = frozenset()
            continue
        module_values: set[str] = set()
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                if _is_private_name(node.name):
                    module_values.add(node.name)
                if isinstance(node, ast.ClassDef):
                    class_members[f"{module}:{node.name}"] = frozenset(
                        _class_private_members(node)
                    )
            elif isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
                targets: Iterable[ast.AST]
                if isinstance(node, ast.Assign):
                    targets = node.targets
                else:
                    targets = (node.target,)
                for target in targets:
                    module_values.update(
                        name for name in _assignment_names(target) if _is_private_name(name)
                    )
        module_members[module] = frozenset(module_values)
    return LegacyMembers(module_members=module_members, class_members=class_members)


def _dotted_expression(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = _dotted_expression(node.value)
        return f"{parent}.{node.attr}" if parent else None
    return None


def _target_expression(node: ast.AST) -> str | None:
    return _dotted_expression(node) if isinstance(node, (ast.Name, ast.Attribute)) else None


@dataclass
class _CatalogBindings:
    """Conservative, intrafile provenance for catalog service expressions."""

    module_aliases: dict[str, str]
    class_aliases: set[str]
    object_expressions: set[str]
    private_aliases: dict[str, tuple[str, str]]
    catalog_self_attribute_ids: set[int]
    factory_names: set[str] = field(default_factory=set)

    def is_catalog_class(self, expression: str | None) -> bool:
        """Return whether an expression names a catalog class or subclass."""

        if not expression:
            return False
        return expression in self.class_aliases or expression.rsplit(".", 1)[-1] in self.class_aliases

    def is_module_expression(self, expression: str | None) -> bool:
        if not expression:
            return False
        return any(
            expression == alias or expression.startswith(alias + ".")
            for alias in self.module_aliases
        )

    def is_catalog_object(self, node: ast.AST) -> bool:
        if isinstance(node, ast.Await):
            return self.is_catalog_object(node.value)
        expression = _dotted_expression(node)
        if expression and expression in self.object_expressions:
            return True
        if self.is_catalog_class(expression):
            return True
        if expression and any(
            expression in {alias, module}
            for alias, module in self.module_aliases.items()
        ):
            return True
        if expression and any(
            expression in {f"{alias}.catalog_service", f"{module}.catalog_service"}
            for alias, module in self.module_aliases.items()
        ):
            return True
        if isinstance(node, ast.Call):
            function = _dotted_expression(node.func)
            if function and (
                function in self.factory_names or function.rsplit(".", 1)[-1] in self.factory_names
            ):
                return True
            if self.is_catalog_class(function):
                return True
            if function and function.endswith(".__new__"):
                receiver = function.rsplit(".", 1)[0]
                if self.is_catalog_class(receiver) or any(
                    self.is_catalog_class(_dotted_expression(argument))
                    for argument in node.args
                ):
                    return True
            # Scripts load the class lazily and assign it to this stable alias.
            if function in {"ComponentCatalogService", "ComponentCatalogPostgresService"}:
                return True
        return False


def _legacy_import_kind(module_name: str, imported_name: str) -> tuple[str, str] | None:
    legacy = _legacy_module_name(module_name)
    if not legacy:
        return None
    if imported_name in {"ComponentCatalogDomainService", "ComponentCatalogPostgresService", "ComponentCatalogService"}:
        return "class", legacy
    if imported_name == "catalog_service":
        return "object", legacy
    if _is_private_name(imported_name):
        return "private", legacy
    return "module", legacy


def _is_catalog_module_name(name: str) -> bool:
    return name == CATALOG_PACKAGE or name.startswith(CATALOG_PACKAGE + ".")


def _catalog_import_kind(
    module_name: str,
    imported_name: str,
    members: LegacyMembers,
) -> tuple[str, str] | None:
    """Classify an import from a module in the new catalog package."""

    if not _is_catalog_module_name(module_name):
        return None
    if f"{module_name}:{imported_name}" in members.class_members:
        return "class", module_name
    if imported_name in members.module_members.get(module_name, frozenset()):
        return "private", module_name
    imported_module = f"{module_name}.{imported_name}"
    if imported_module in members.module_members:
        return "module", imported_module
    return None


def _register_module_alias(
    bindings: _CatalogBindings,
    bound: str,
    module_name: str,
    members: LegacyMembers,
) -> None:
    bindings.module_aliases[bound] = module_name
    for qualified_name in members.class_members:
        class_module, _, class_name = qualified_name.partition(":")
        if class_module != module_name:
            continue
        bindings.class_aliases.update(
            {class_name, f"{module_name}.{class_name}", f"{bound}.{class_name}"}
        )


def _collect_catalog_bindings(
    tree: ast.AST,
    path: Path,
    repo_root: Path,
    members: LegacyMembers | None = None,
) -> _CatalogBindings:
    members = members or load_legacy_members(repo_root)
    bindings = _CatalogBindings({}, set(), set(), {}, set())
    # Import provenance.
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                legacy = _legacy_module_name(alias.name)
                if not legacy and not _is_catalog_module_name(alias.name):
                    continue
                bound = alias.asname or alias.name.split(".", 1)[0]
                _register_module_alias(bindings, bound, alias.name, members)
        elif isinstance(node, ast.ImportFrom):
            module_name = _relative_import_module(path, node, repo_root)
            for alias in node.names:
                imported_module = module_name
                if node.module is None:
                    imported_module = f"{module_name}.{alias.name}" if module_name else alias.name
                kind = _legacy_import_kind(imported_module, alias.name)
                if kind is not None:
                    category, target_module = kind
                    bound = alias.asname or alias.name
                    if category == "class":
                        bindings.class_aliases.add(bound)
                    elif category == "object":
                        bindings.object_expressions.add(bound)
                    elif category == "private":
                        bindings.private_aliases[bound] = (target_module, alias.name)
                    else:
                        _register_module_alias(bindings, bound, imported_module, members)
                    continue

                # ``from app.services import component_catalog_domain`` and
                # ``from app.services.catalog import thing`` bind the imported
                # child module itself, so classify that candidate as well.
                package_kind = _catalog_import_kind(module_name, alias.name, members)
                imported_child = f"{module_name}.{alias.name}" if module_name else alias.name
                if package_kind is None and _legacy_module_name(imported_child):
                    _register_module_alias(
                        bindings, alias.asname or alias.name, imported_child, members
                    )
                    continue
                if package_kind is None:
                    if imported_child in members.module_members:
                        _register_module_alias(
                            bindings, alias.asname or alias.name, imported_child, members
                        )
                    continue

                category, target_module = package_kind
                bound = alias.asname or alias.name
                if category == "class":
                    bindings.class_aliases.add(bound)
                elif category == "object":
                    bindings.object_expressions.add(bound)
                elif category == "private":
                    bindings.private_aliases[bound] = (target_module, alias.name)
                else:
                    _register_module_alias(bindings, bound, target_module, members)

    # Importers assign the lazily loaded class to this stable alias.
    for node in ast.walk(tree):
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets: Iterable[ast.AST]
            if isinstance(node, ast.Assign):
                targets = node.targets
            else:
                targets = (node.target,)
            target_names = set().union(*(_assignment_names(target) for target in targets))
            if "ComponentCatalogService" in target_names:
                bindings.class_aliases.add("ComponentCatalogService")
            if "ComponentCatalogPostgresService" in target_names:
                bindings.class_aliases.add("ComponentCatalogPostgresService")

    # Preserve simple class aliases used by maintenance scripts and tests.
    for target, value in _iter_assignments(tree):
        value_name = _dotted_expression(value)
        if not value_name or value_name.rsplit(".", 1)[-1] not in bindings.class_aliases:
            continue
        bindings.class_aliases.update(_assignment_names(target))

    # Local subclasses share the catalog private surface; a short fixed point
    # covers Child then Grandchild without executing application code.
    class_nodes = [node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
    for _ in range(max(1, len(class_nodes) + 1)):
        changed = False
        for class_node in class_nodes:
            if class_node.name in bindings.class_aliases:
                continue
            if any(
                bindings.is_catalog_class(_dotted_expression(base))
                for base in class_node.bases
            ):
                bindings.class_aliases.add(class_node.name)
                changed = True
        if not changed:
            break

    # ``self``/``cls``/``super()`` are catalog provenance only inside a known subclass.
    for class_node in class_nodes:
        if class_node.name not in bindings.class_aliases:
            continue
        for node in ast.walk(class_node):
            if not isinstance(node, ast.Attribute) or not _is_private_name(node.attr):
                continue
            receiver = node.value
            if isinstance(receiver, ast.Name) and receiver.id in {"self", "cls"}:
                bindings.catalog_self_attribute_ids.add(id(node))
            elif isinstance(receiver, ast.Call) and _dotted_expression(receiver.func) == "super":
                bindings.catalog_self_attribute_ids.add(id(node))

    _discover_catalog_factories(tree, bindings)
    return bindings


def _iter_direct_return_values(function: ast.FunctionDef | ast.AsyncFunctionDef) -> Iterator[ast.AST]:
    stack: list[ast.AST] = list(function.body)
    while stack:
        node = stack.pop()
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)):
            continue
        if isinstance(node, ast.Return) and node.value is not None:
            yield node.value
        else:
            stack.extend(ast.iter_child_nodes(node))


def _discover_catalog_factories(tree: ast.AST, bindings: _CatalogBindings) -> None:
    functions = [
        node for node in ast.walk(tree) if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]
    assignments = list(_iter_assignments(tree))
    _propagate_object_bindings(tree, bindings)
    for _ in range(max(1, len(functions) + len(assignments) + 1)):
        changed = False
        for function in functions:
            if function.name not in bindings.factory_names and any(
                bindings.is_catalog_object(value) for value in _iter_direct_return_values(function)
            ):
                bindings.factory_names.add(function.name)
                changed = True
        for target, value in assignments:
            expression = _dotted_expression(value)
            if expression in bindings.factory_names:
                added = set(_assignment_names(target)) - bindings.factory_names
                if added:
                    bindings.factory_names.update(added)
                    changed = True
        if not changed:
            break


def _iter_assignments(tree: ast.AST) -> Iterator[tuple[ast.AST, ast.AST]]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                yield target, node.value
        elif isinstance(node, ast.AnnAssign) and node.value is not None:
            yield node.target, node.value
        elif isinstance(node, ast.NamedExpr):
            yield node.target, node.value


def _propagate_object_bindings(tree: ast.AST, bindings: _CatalogBindings) -> None:
    # A bounded fixed point handles ordinary aliases and ``self.service``
    # assignments while staying deterministic for intentionally dynamic code.
    assignments = list(_iter_assignments(tree))
    for _ in range(max(1, len(assignments) + 1)):
        changed = False
        for target, value in assignments:
            if not bindings.is_catalog_object(value):
                continue
            expression = _target_expression(target)
            if expression and expression not in bindings.object_expressions:
                bindings.object_expressions.add(expression)
                changed = True
        if not changed:
            break


def _seed_service_parameters(tree: ast.AST, bindings: _CatalogBindings) -> None:
    """Recognize the importer helper convention ``(service, ...)``.

    The bulk import scripts pass their lazily-created catalog service through
    several helpers.  Their type is intentionally ``Any`` at runtime, so AST
    provenance cannot infer it from annotations.  Only seed conventional
    parameter names, and only in files that already have a catalog binding.
    """

    if not (bindings.class_aliases or bindings.object_expressions or bindings.module_aliases):
        return
    conventional = {"service", "catalog_service", "catalog"}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for argument in (*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs):
                if argument.arg in conventional:
                    bindings.object_expressions.add(argument.arg)


@dataclass(frozen=True)
class PrivateUse:
    path: str
    symbol: str
    count: int


def private_catalog_uses(
    repo_root: Path = REPO_ROOT,
    members: LegacyMembers | None = None,
) -> list[PrivateUse]:
    """Count private catalog references outside the legacy implementation.

    Counts are AST occurrences, not lines or grep matches.  A method call and a
    reference passed as a callback each count once.  Internal implementation
    references in the legacy modules and the target package are excluded.
    """

    members = members or load_legacy_members(repo_root)
    private_names = members.all_members
    if not private_names:
        return []
    counts: Counter[tuple[str, str]] = Counter()
    for path in _iter_python_files(repo_root):
        module = _source_module_name(path, repo_root)
        if module in LEGACY_CATALOG_MODULES or (
            module and module.startswith(CATALOG_PACKAGE + ".")
        ) or module == CATALOG_PACKAGE:
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except (OSError, SyntaxError):
            continue
        bindings = _collect_catalog_bindings(tree, path, repo_root, members)
        _seed_service_parameters(tree, bindings)
        _propagate_object_bindings(tree, bindings)
        relative = _path_key(path, repo_root)
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr in private_names:
                if (
                    id(node) in bindings.catalog_self_attribute_ids
                    or bindings.is_catalog_object(node.value)
                ):
                    counts[(relative, node.attr)] += 1
            elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                if (
                    node.id in bindings.private_aliases
                    and bindings.private_aliases[node.id][1] in private_names
                ):
                    counts[(relative, bindings.private_aliases[node.id][1])] += 1
    return [
        PrivateUse(path=path, symbol=symbol, count=count)
        for (path, symbol), count in sorted(counts.items())
    ]


def baseline_monotonic_failures(
    head_private: Mapping[tuple[str, str], int],
    base_private: Mapping[tuple[str, str], int],
) -> list[str]:
    """Reject private-use baseline additions/growth relative to a trusted base ref.

    The ordinary source-vs-baseline ratchet protects the current checkout.  A
    second comparison protects the ratchet file itself: a change may lower or
    remove an existing entry, but it cannot add an entry or raise its count to
    make newly introduced source look grandfathered.  The module-line ceilings
    in the same file are ``check_module_size.py``'s.
    """

    failures: list[str] = []
    for key in sorted(set(head_private) - set(base_private)):
        path, symbol = key
        failures.append(
            f"baseline adds private catalog use {path}::{symbol} "
            f"(head count {head_private[key]}, base ref has no entry)"
        )
    for key in sorted(set(head_private) & set(base_private)):
        if int(head_private[key]) > int(base_private[key]):
            path, symbol = key
            failures.append(
                f"baseline increases private catalog use {path}::{symbol}: "
                f"base {base_private[key]}, head {head_private[key]}"
            )
    return failures


def ratchet_failures(
    current: Iterable[PrivateUse],
    baseline: Mapping[tuple[str, str], int],
) -> list[str]:
    """Apply the private-use ratchet (new/increased/missing keys fail)."""

    current_counts = _private_use_counts(current)
    failures: list[str] = []
    for key in sorted(set(current_counts) - set(baseline)):
        path, symbol = key
        failures.append(
            f"new private catalog use {path}::{symbol} (count {current_counts[key]}); "
            "use a public API or explicitly update the ratchet"
        )
    for key in sorted(set(current_counts) & set(baseline)):
        if current_counts[key] > baseline[key]:
            path, symbol = key
            failures.append(
                f"private catalog use increased {path}::{symbol}: "
                f"baseline {baseline[key]}, current {current_counts[key]}"
            )
    for key in sorted(set(baseline) - set(current_counts)):
        path, symbol = key
        failures.append(
            f"baseline contains stale private catalog use {path}::{symbol} "
            f"(baseline count {baseline[key]}, current 0); run --update-baseline intentionally"
        )
    return failures


def _private_use_counts(current: Iterable[PrivateUse]) -> dict[tuple[str, str], int]:
    return {(item.path, item.symbol): item.count for item in current}


def private_update_failures(
    current: Iterable[PrivateUse],
    baseline: Mapping[tuple[str, str], int],
) -> list[str]:
    """Return private-use changes that update mode is not allowed to record.

    Missing baseline keys are intentionally absent from this result: update mode
    removes stale records.  New keys and increases are unsafe because they would
    legalize a newly introduced private dependency or a larger existing one.
    """

    current_counts = _private_use_counts(current)
    failures: list[str] = []
    for key in sorted(set(current_counts) - set(baseline)):
        path, symbol = key
        failures.append(
            f"new private catalog use {path}::{symbol} (count {current_counts[key]}); "
            "--update-baseline refuses to add new private uses"
        )
    for key in sorted(set(current_counts) & set(baseline)):
        if current_counts[key] > baseline[key]:
            path, symbol = key
            failures.append(
                f"private catalog use increased {path}::{symbol}: "
                f"baseline {baseline[key]}, current {current_counts[key]}; "
                "--update-baseline refuses to record growth"
            )
    return failures


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--baseline", type=Path, default=None)
    parser.add_argument(
        "--update-baseline",
        action="store_true",
        help="record private-use reductions/removals",
    )
    parser.add_argument(
        "--base-ref",
        "--baseline-base-ref",
        "--compare-baseline-ref",
        dest="base_ref",
        default=None,
        help=(
            "compare the checked-in baseline with this trusted git ref; "
            "new or increased private uses are refused"
        ),
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    repo_root = args.repo_root.resolve()
    baseline_path = (args.baseline or (repo_root / "scripts" / BASELINE_FILENAME)).resolve()
    failures: list[str] = []
    try:
        baseline_private, baseline_ceilings = load_baseline(baseline_path)
    except ValueError as exc:
        print(f"Catalog architecture baseline error: {exc}", file=sys.stderr)
        return 1

    baseline_change_failures: list[str] = []
    if args.base_ref:
        try:
            base_baseline = load_baseline_at_ref(repo_root, args.base_ref, baseline_path)
        except ValueError as exc:
            print(f"Catalog architecture base-baseline error: {exc}", file=sys.stderr)
            return 1
        if base_baseline is None:
            print(
                f"Catalog architecture baseline monotonic comparison skipped: "
                f"{describe_path(baseline_path, repo_root)} "
                f"does not exist at base ref {args.base_ref!r} (bootstrap)",
                file=sys.stderr,
            )
        else:
            base_private, _base_ceilings = base_baseline
            baseline_change_failures = baseline_monotonic_failures(baseline_private, base_private)

    import_failures = catalog_import_violations(repo_root)
    for failure in import_failures:
        failures.append(
            f"{failure.path}:{failure.line}: catalog package imports legacy module {failure.module}"
        )

    current_uses = private_catalog_uses(repo_root)
    current_private = {(item.path, item.symbol): item.count for item in current_uses}

    if args.update_baseline:
        unsafe_private_failures = private_update_failures(current_uses, baseline_private)
        if import_failures or unsafe_private_failures or baseline_change_failures:
            failures.extend(unsafe_private_failures)
            failures.extend(baseline_change_failures)
            print(
                "Refusing to update catalog architecture baseline: update mode "
                "records only private-use reductions/removals.",
                file=sys.stderr,
            )
            for failure in failures:
                print(f"  - {failure}", file=sys.stderr)
            return 1
        write_baseline(baseline_path, current_private, baseline_ceilings)
        print(
            f"Catalog architecture baseline safely updated: {len(current_private)} private-use keys "
            f"(reductions/removals only) -> {describe_path(baseline_path, repo_root)}"
        )
        return 0

    failures.extend(baseline_change_failures)
    failures.extend(ratchet_failures(current_uses, baseline_private))
    if failures:
        print(f"Catalog architecture check failed ({len(failures)} issue(s)):", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    print(
        "Catalog architecture OK: "
        f"{len(import_failures)} legacy-import violations, "
        f"{len(current_uses)} private-use keys"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
