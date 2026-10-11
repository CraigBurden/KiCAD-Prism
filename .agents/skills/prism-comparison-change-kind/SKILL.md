---
name: prism-comparison-change-kind
description: Extend KiCAD Prism design-comparison parsing, semantics, review grouping, facts, focus, or presentation across backend and frontend. Use when a PCB or schematic difference is missing, misclassified, or not reviewable.
---

# Extend design-comparison semantics

Read `frontend/src/components/design-comparison/AGENTS.md` first. Trace one real
change payload through the current pipeline before editing; the visible row,
facts, and focus target may be produced by different modules.

## Preserve the lifecycle kind

`KiCadChangeKind` in `frontend/src/components/design-comparison/types.ts` is the
small lifecycle union (`added`, `removed`, `modified`, `collision`, and
`duplicate_uuid`). Most new electrical or graphical distinctions should be a
reason, category, fact, or review-group policy—not a new lifecycle kind. Extend
the union only when the change genuinely has different lifecycle behavior at
every consumer.

## Trace the affected hops

A new object kind is three hops:

1. Parse it in `scripts/ecad-parse.mjs` (the parser owns kind names). If the
   parser's spelling is not the canonical one, map it once in
   `_PARSER_KIND_NAMES` in `backend/app/services/design_compare_nodes.py`;
   nothing downstream knows raw spellings. Derive the base and comparison
   revisions independently; absence on one side remains absence.
2. Classify it in `_node_classification` in the same file: category and
   primary/secondary are the backend's.
3. Add one row to
   `frontend/src/components/design-comparison/comparison-change-kinds.ts`
   (domain, reviewer noun, traits) and its expectation row in
   `frontend/src/components/design-comparison/comparison-change-kinds.test.ts`.
   The traits decide grouping, noise,
   presentation policy, layer focus and the property panel; the test row shows
   what each of those answers for the new kind.

Only when the change needs it:

- A net, bus or sheet-instance meaning (not a stored object):
  `backend/app/services/design_compare_semantics.py`.
- Components, their fields, DNP / in-BOM flags or BOM rows:
  `backend/app/services/design_compare_occurrences.py`.
- Durable output beyond the result payload:
  `backend/app/services/design_compare_artifacts.py`.
- A new visual-target role: the `role` union in
  `frontend/src/components/design-comparison/types.ts`.
- A new reason code: reviewer verbs in
  `frontend/src/components/design-comparison/comparison-change-vocabulary.ts`
  and facts in
  `frontend/src/components/design-comparison/comparison-change-facts.ts`.

Do not add `bbox` to Prism's PROJECT_DIFF item payload. The ECAD viewer resolves
identities and measures painted bounds; native KiCad input keeps its separate
strict-bounds contract.

## Tests and verification

Add the smallest backend fixture that proves parsing and classification on
both revision sides. The kind-table test covers the frontend modules; add a
focused test only for behaviour the table row cannot express. The broad presentation contracts live in
`frontend/src/components/design-comparison/comparison-presentation-shell.test.tsx`.
Finish with `.agents/skills/prism-quality-gate/SKILL.md`.
