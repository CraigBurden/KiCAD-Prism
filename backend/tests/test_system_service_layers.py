"""AC-22: SystemService is one mixin per concept over three layers; no concept calls another's privates.

A concept mixin may call its own private methods and those of the layers below every concept
(``ServiceCore``, ``ReadingCore``, ``RenderingCore``). A layer may call only itself and the layers
under it. Public methods may be called from anywhere.
"""

from __future__ import annotations

import ast
import inspect
import unittest

from app.services.systems import service as service_module
from app.services.systems.service_base import ServiceCore
from app.services.systems.service_reading import ReadingCore
from app.services.systems.service_rendering import RenderingCore


def _members(cls: type) -> set[str]:
    """Names a class defines, plus the attributes its ``__init__`` sets on ``self``."""
    names = set(vars(cls))
    init = vars(cls).get("__init__")
    if init is not None:
        for node in ast.walk(ast.parse(inspect.getsource(cls))):
            if isinstance(node, ast.Attribute) and isinstance(node.ctx, ast.Store) \
                    and isinstance(node.value, ast.Name) and node.value.id == "self":
                names.add(node.attr)
    return names


def _private_calls(cls: type) -> set[str]:
    """``self._name`` reads in the class body (dunders excluded)."""
    tree = ast.parse(inspect.getsource(inspect.getmodule(cls)))
    body = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == cls.__name__)
    return {node.attr for node in ast.walk(body)
            if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and node.value.id == "self"
            and node.attr.startswith("_") and not node.attr.startswith("__")}


class ServiceLayers(unittest.TestCase):
    def test_the_service_is_the_concepts_over_the_layers(self) -> None:
        self.assertEqual(service_module.LAYERS, (RenderingCore, ReadingCore, ServiceCore))
        self.assertEqual(service_module.SystemService.__bases__, (*service_module.CONCEPTS, *service_module.LAYERS))

    def test_layers_call_only_themselves_and_the_layers_under_them(self) -> None:
        below: set[str] = set()
        for layer in reversed(service_module.LAYERS):
            allowed = below | _members(layer)
            with self.subTest(layer.__name__):
                self.assertEqual(sorted(_private_calls(layer) - allowed), [])
            below = allowed

    def test_no_concept_calls_another_concepts_privates(self) -> None:
        shared = set().union(*(_members(layer) for layer in service_module.LAYERS))
        for concept in service_module.CONCEPTS:
            with self.subTest(concept.__name__):
                self.assertEqual(sorted(_private_calls(concept) - shared - _members(concept)), [])

    def test_no_concept_redefines_a_layer_or_another_concept(self) -> None:
        seen: dict[str, str] = {}
        for cls in (*service_module.CONCEPTS, *service_module.LAYERS):
            for name in vars(cls):
                if name.startswith("__"):
                    continue
                with self.subTest(f"{cls.__name__}.{name}"):
                    self.assertNotIn(name, seen, f"also defined on {seen.get(name)}")
                seen[name] = cls.__name__


if __name__ == "__main__":
    unittest.main()
