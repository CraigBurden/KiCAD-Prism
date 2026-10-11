"""Catalog field rules: when a metadata value is valid and an import is ready.

One module answers both questions for every surface that edits catalog
metadata:

* ``editor`` - the single-component metadata dialog. Only presence is checked:
  the PATCH stores free-form strings, so blocking a save on a legacy number or
  URL the user did not touch would trap the edit.
* ``bulk`` - the bulk-edit grid and metadata batches (grid, CSV). Presence and
  shape (number, HTTP(S) URL, boolean, configured enum option).
* ``import`` - folder and project import proposals. The fields a reviewer can
  remediate, with presence and shape, plus which scan findings still block.

Requiredness of a built-in field comes from its descriptor (built-in
requirements cannot be edited); a custom field carries its own flag. The
server enforces a custom field's flag on manual create, the single-component
PATCH, import acceptance and the bulk import scripts
(:func:`missing_custom_fields`, :func:`custom_field_errors`,
:func:`custom_import_problems`);
built-in fields are enforced by ``normalize_metadata`` and the rules above. A
provisional part has no manufacturer part number by definition, so ``mpn`` is
not required for it in any context.

The frontend renders the same verdicts from
``frontend/src/lib/catalog-field-rules.generated.ts``, which
``scripts/export_catalog_field_rules.py`` writes from
:func:`field_rules_contract`; ``backend/tests/test_catalog_field_rules.py``
fails when the committed contract is stale.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any, Iterable, Mapping

from app.services.catalog.metadata_descriptors import (
    BUILTIN_METADATA_DESCRIPTORS,
    read_builtin_metadata_value,
)
from app.services.catalog.metadata_normalization import (
    IDENTITY_KIND_MPN,
    IDENTITY_KIND_PROVISIONAL_IPN,
)


CONTEXT_EDITOR = "editor"
CONTEXT_BULK = "bulk"
CONTEXT_IMPORT = "import"
# Whether a context checks value shape as well as presence.
CONTEXT_SHAPE_CHECKS: dict[str, bool] = {
    CONTEXT_EDITOR: False,
    CONTEXT_BULK: True,
    CONTEXT_IMPORT: True,
}

# Fields an identity kind never requires, whatever their definition says.
IDENTITY_EXEMPT_FIELDS: dict[str, tuple[str, ...]] = {
    IDENTITY_KIND_MPN: (),
    IDENTITY_KIND_PROVISIONAL_IPN: ("mpn",),
}

# Both languages compile these patterns and the URL one case-insensitively.
NUMBER_PATTERN = r"^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$"
# An http or https scheme followed by a non-empty authority.
URL_PATTERN = r"^https?://[^/?#]+"
BOOLEAN_TOKENS: tuple[str, ...] = ("true", "false", "1", "0", "yes", "no")

# Verdict code -> message, for field-level surfaces (editor, bulk, batches).
FIELD_MESSAGES: dict[str, str] = {
    "required": "Required",
    "number": "Enter a valid number",
    "url": "Enter a valid HTTP(S) URL",
    "boolean": "Enter true or false",
    "enum": "Choose a configured enum value",
}
# Verdict code -> predicate, for import problems ("<label> <predicate>").
IMPORT_MESSAGES: dict[str, str] = {
    "required": "is required",
    "number": "must be a number",
    "url": "must be an HTTP(S) URL",
    "boolean": "must be true or false",
    "enum": "must be a configured option",
}


@dataclass(frozen=True)
class ImportField:
    """A proposal metadata field a reviewer can remediate before accepting."""

    key: str  # proposal / accept-request name
    descriptor_key: str
    label: str


# Order is the order of scan findings and of grid columns.
IMPORT_FIELDS: tuple[ImportField, ...] = (
    ImportField("value", "value", "Value"),
    ImportField("manufacturer", "manufacturer", "Manufacturer"),
    ImportField("manufacturer_part_number", "mpn", "MPN"),
    ImportField("description", "description", "Description"),
    ImportField("datasheet", "datasheet_url", "Datasheet"),
    ImportField("package_name", "package_name", "Package"),
)
# Scan findings with these code prefixes are answered by editing metadata, so
# they never block acceptance on their own; the metadata rules above do.
EDITABLE_FINDING_PREFIXES: tuple[str, ...] = ("missing_metadata_", "conflicting_")
# "<asset_type>_not_resolved" is answered by linking an existing catalog asset.
LINK_RESOLVED_FINDING_SUFFIX = "_not_resolved"

_DESCRIPTORS = {descriptor.key: descriptor for descriptor in BUILTIN_METADATA_DESCRIPTORS}
_NUMBER = re.compile(NUMBER_PATTERN)
_URL = re.compile(URL_PATTERN, re.IGNORECASE)


def _identity_kind(identity_kind: str | None) -> str:
    return str(identity_kind or IDENTITY_KIND_MPN)


def is_field_required(field: Mapping[str, Any], *, identity_kind: str | None = IDENTITY_KIND_MPN) -> bool:
    """Whether ``field`` must hold a value on a component of ``identity_kind``."""

    key = str(field.get("key") or "")
    if key in IDENTITY_EXEMPT_FIELDS.get(_identity_kind(identity_kind), ()):
        return False
    descriptor = _DESCRIPTORS.get(key)
    if descriptor is not None:
        return descriptor.required
    return bool(field.get("required"))


def field_verdict(
    field: Mapping[str, Any],
    value: Any,
    *,
    context: str,
    identity_kind: str | None = IDENTITY_KIND_MPN,
) -> str:
    """Return the verdict code for ``value`` in ``field`` (``""`` when valid)."""

    if context not in CONTEXT_SHAPE_CHECKS:
        raise ValueError(f"Unknown field-rules context: {context}")
    text = str(value or "").strip()
    if not text:
        return "required" if is_field_required(field, identity_kind=identity_kind) else ""
    if not CONTEXT_SHAPE_CHECKS[context]:
        return ""
    field_type = str(field.get("type") or "text")
    if field_type == "number":
        return "" if _NUMBER.fullmatch(text) else "number"
    if field_type == "url":
        return "" if _URL.match(text) else "url"
    if field_type == "boolean":
        return "" if text.casefold() in BOOLEAN_TOKENS else "boolean"
    if field_type == "enum":
        return "" if text in list(field.get("enum_values") or []) else "enum"
    return ""


def field_error(
    field: Mapping[str, Any],
    value: Any,
    *,
    context: str,
    identity_kind: str | None = IDENTITY_KIND_MPN,
) -> str:
    """Return the message for ``value`` in ``field`` (``""`` when valid)."""

    verdict = field_verdict(field, value, context=context, identity_kind=identity_kind)
    return FIELD_MESSAGES[verdict] if verdict else ""


def _import_field_definition(item: ImportField) -> dict[str, Any]:
    descriptor = _DESCRIPTORS[item.descriptor_key]
    return {"key": descriptor.key, "type": descriptor.field_type}


def import_metadata_verdicts(values: Mapping[str, Any]) -> list[tuple[ImportField, str]]:
    """Every import field whose value in ``values`` fails, with its verdict code.

    Import proposals always carry a manufacturer-part identity.
    """

    failures: list[tuple[ImportField, str]] = []
    for item in IMPORT_FIELDS:
        verdict = field_verdict(
            _import_field_definition(item),
            values.get(item.key),
            context=CONTEXT_IMPORT,
            identity_kind=IDENTITY_KIND_MPN,
        )
        if verdict:
            failures.append((item, verdict))
    return failures


def import_metadata_problems(values: Mapping[str, Any]) -> list[str]:
    """Readable reasons the proposal metadata in ``values`` cannot be accepted."""

    return [f"{item.label} {IMPORT_MESSAGES[verdict]}" for item, verdict in import_metadata_verdicts(values)]


def missing_metadata_findings(values: Mapping[str, Any]) -> list[dict[str, str]]:
    """Scan-time findings for required import metadata absent from ``values``."""

    return [
        {
            "code": f"missing_metadata_{item.key}",
            "severity": "error",
            "message": f"Required component metadata is missing: {item.key.replace('_', ' ')}.",
        }
        for item, verdict in import_metadata_verdicts(values)
        if verdict == "required"
    ]


def missing_builtin_fields(
    payload: Mapping[str, Any],
    *,
    identity_kind: str | None = IDENTITY_KIND_MPN,
) -> list[str]:
    """Labels of the built-in fields required for ``identity_kind`` that are blank in ``payload``.

    ``payload`` is raw (pre-normalization) metadata; aliases are read as
    ``normalize_metadata`` reads them.
    """

    return [
        descriptor.label
        for descriptor in BUILTIN_METADATA_DESCRIPTORS
        if is_field_required({"key": descriptor.key}, identity_kind=identity_kind)
        and not read_builtin_metadata_value(payload, descriptor)
    ]


def missing_custom_fields(
    fields: Iterable[Mapping[str, Any]],
    metadata: Mapping[str, Any],
    *,
    identity_kind: str | None = IDENTITY_KIND_MPN,
) -> list[Mapping[str, Any]]:
    """Active custom fields required for ``identity_kind`` that are blank in ``metadata``.

    ``metadata`` is normalized component metadata: column values at the top
    level and custom values in ``extra_fields``. Only presence is checked, as
    in the editor.
    """

    extras = metadata.get("extra_fields") or {}
    missing: list[Mapping[str, Any]] = []
    for field in fields:
        if field.get("built_in") or field.get("archived"):
            continue
        storage_key = str(field.get("storage_key") or field.get("key") or "")
        source = metadata if field.get("storage_kind") == "column" else extras
        if field_verdict(field, source.get(storage_key), context=CONTEXT_EDITOR, identity_kind=identity_kind):
            missing.append(field)
    return missing


def custom_field_errors(
    fields: Iterable[Mapping[str, Any]],
    metadata: Mapping[str, Any],
    *,
    identity_kind: str | None = IDENTITY_KIND_MPN,
) -> list[str]:
    """``"<label>: Required"`` for each custom required field blank in ``metadata``."""

    return [
        f"{field.get('label') or field.get('key')}: {FIELD_MESSAGES['required']}"
        for field in missing_custom_fields(fields, metadata, identity_kind=identity_kind)
    ]


def custom_import_problems(
    fields: Iterable[Mapping[str, Any]],
    metadata: Mapping[str, Any],
) -> list[str]:
    """``"<label> is required"`` for each custom required field an import leaves blank."""

    return [
        f"{field.get('label') or field.get('key')} {IMPORT_MESSAGES['required']}"
        for field in missing_custom_fields(fields, metadata, identity_kind=IDENTITY_KIND_MPN)
    ]


def blocking_import_findings(
    findings: Iterable[Mapping[str, Any]],
    linked_asset_types: Iterable[str] = (),
) -> list[Mapping[str, Any]]:
    """Error findings that metadata edits and asset links cannot resolve."""

    resolved_by_link = {f"{asset_type}{LINK_RESOLVED_FINDING_SUFFIX}" for asset_type in linked_asset_types}
    return [
        finding
        for finding in findings
        if finding.get("severity") == "error"
        and not str(finding.get("code") or "").startswith(EDITABLE_FINDING_PREFIXES)
        and str(finding.get("code") or "") not in resolved_by_link
    ]


def field_rules_contract() -> dict[str, Any]:
    """The JSON-able contract the frontend renders its verdicts from."""

    return {
        "contexts": {context: {"shapeChecks": shape} for context, shape in CONTEXT_SHAPE_CHECKS.items()},
        "builtinRequired": {
            descriptor.key: descriptor.required for descriptor in BUILTIN_METADATA_DESCRIPTORS
        },
        "identityExemptFields": {kind: list(keys) for kind, keys in IDENTITY_EXEMPT_FIELDS.items()},
        "numberPattern": NUMBER_PATTERN,
        "urlPattern": URL_PATTERN,
        "booleanTokens": list(BOOLEAN_TOKENS),
        "fieldMessages": dict(FIELD_MESSAGES),
        "import": {
            "fields": [
                {
                    "key": item.key,
                    "fieldKey": item.descriptor_key,
                    "type": _DESCRIPTORS[item.descriptor_key].field_type,
                    "label": item.label,
                }
                for item in IMPORT_FIELDS
            ],
            "messages": dict(IMPORT_MESSAGES),
            "editableFindingPrefixes": list(EDITABLE_FINDING_PREFIXES),
            "linkResolvedFindingSuffix": LINK_RESOLVED_FINDING_SUFFIX,
        },
    }


__all__ = [
    "CONTEXT_BULK",
    "CONTEXT_EDITOR",
    "CONTEXT_IMPORT",
    "IMPORT_FIELDS",
    "ImportField",
    "blocking_import_findings",
    "custom_field_errors",
    "custom_import_problems",
    "field_error",
    "field_rules_contract",
    "field_verdict",
    "import_metadata_problems",
    "import_metadata_verdicts",
    "is_field_required",
    "missing_builtin_fields",
    "missing_custom_fields",
    "missing_metadata_findings",
]
