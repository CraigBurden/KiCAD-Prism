---
name: prism-comparison-change-kind
description: Add or modify a design-comparison change kind across the backend parse/group pipeline and the frontend review surface. Use when a new kind of PCB or schematic difference must become reviewable.
---

# Add a design-comparison change kind

A change kind must be parsed, grouped, typed, presented, and focused. Skipping a
hop produces a change that is detected but invisible, or visible but unreviewable.

Read `frontend/src/components/design-comparison/AGENTS.md` before starting. The
correctness principle there governs every decision here.

## The hops, in order

### 1. Parse — `backend/app/services/design_compare_nodes.py`

Emit the change with the geometry and layers **each revision actually carries**.
Never populate one revision's fields from the other's objects. If a revision does
not have the object, its side is absent, not inherited.

### 2. Group — `backend/app/services/design_compare_semantics.py`

Decide what the change belongs to: a net, a part, a sheet. This determines
whether a reviewer sees one row or twenty.

### 3. Persist — `backend/app/services/design_compare_artifacts.py`

Only if the kind needs a durable artifact beyond the result payload.

### 4. Type — `frontend/src/components/design-comparison/types.ts`

Add the kind to `KiCadChangeKind` and any affected union. Types here are
intentionally narrow; widening one to `string` to avoid an error defeats the
exhaustiveness checks downstream.

### 5. Vocabulary — `comparison-change-vocabulary.ts`, `comparison-change-facts.ts`

Give it a reviewer-facing name and the facts shown in the property panel.

### 6. Review shaping — `comparison-review-groups.ts`, `comparison-review-noise.ts`

Decide whether it groups with others and whether it is noise by default. A kind
that floods the queue without grouping makes the tool unusable; a kind
suppressed as noise by default may never be seen.

### 7. Layer focus — `comparison-layer-focus.ts`

Only if the kind occupies layers. A selection is shown on exactly the layers it
occupies. A change that names no layer does not veto a focus — it contributes
nothing to it.

### 8. Presentation — `differences-pane.tsx`, `comparison-property-panel.tsx`

## Rules

- Derive each revision independently at every hop.
- Do not emit bounds. See `docs/design-comparison/m5-stop-emitting-bounds.md`.
- Do not require a selection to be all-copper to earn a focus.
- Follow the state hierarchy in the root `AGENTS.md`. New review state belongs
  in the URL or the lifecycle reducer, not in fresh `useState`.

## Tests

Backend: add to the design-compare suites in `backend/tests/`.
Frontend: `comparison-review-groups.test.ts` and
`comparison-presentation-shell.test.tsx` are the load-bearing ones.

Finish by running the `prism-quality-gate` skill.
