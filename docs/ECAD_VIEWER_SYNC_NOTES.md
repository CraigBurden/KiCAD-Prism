# ecad-viewer Sync Notes

This document tracks the current upstream sync reference for the vendored visualizer assets.

## Current Reference

- sync date: 2026-07-10
- local integration branch: `feature/prism-selection-adapter`
- local integration base: `7b442967613115e47ac7c9d492edd3d506ea2794`
- local upstream snapshot: `krishna-swaroop/ecad-viewer@a85abd4`
- official KiCanvas revision reviewed manually: `theacodes/kicanvas@b031159`
- generated browser bundle SHA-256: `0d685c32b097c1dc85199a9ad82df1b3bd65ebe1391d1373944bdb78b09f19e8`

## Vendored Artifacts

The current sync updated `frontend/public/ecad-viewer.js`. The exact source diff is
stored in `docs/ecad-viewer-prism-selection-adapter.patch`; it applies to the local
integration base above.

The focused adapter patch adds:

- normalized, immutable semantic selection snapshots on `kicanvas:select`;
- SCH/PCB/3D/BOM cross-probe source contexts;
- programmatic PCB net and UUID focus;
- normal-schematic multi-UUID highlighting;
- normal-view label picking;
- KiCad 10 name-only PCB net parsing with deterministic in-memory net numbers;
- WebGPU-inspired PCB selection treatment that keeps board context visible;
- comment anchors on elements and PCB whitespace.
- an opt-in `show-selection-panel="false"` embedding flag so Prism can own the
  shared inspector without changing standalone ecad-viewer behavior.
- persistent programmatic PCB highlights that are not overwritten by pointer hover;
- previous/next/parent schematic page navigation methods for host keyboard shortcuts;
- nested source-item type inference so Prism can show meaningful selection types.
- standards-compliant source custom elements that apply hidden attributes only
  after connection, avoiding Chromium constructor failures during blob hydration.
- sheet-instance-aware previous/next/parent navigation that preserves exact
  hierarchical project paths, including repeated filenames and deep nesting.
- active-sheet-aware project reloads, preventing the generic change listener from
  racing a requested child sheet and restoring the root schematic.

It intentionally excludes the local schematic-world renderer and does not embed
Prism UIDs in ecad rendering primitives.

## Scope Notes

Visualizer code is intentionally treated as a higher-risk surface than the rest of the app.

That means:
- general frontend cleanup should avoid changing vendored visualizer assets unless the task is explicitly a visualizer/vendor sync
- performance or bundle work outside the visualizer should isolate viewer-specific chunks rather than rewriting the viewer surface itself

If you need to update visualizer behavior, treat it as a dedicated task with explicit validation.
