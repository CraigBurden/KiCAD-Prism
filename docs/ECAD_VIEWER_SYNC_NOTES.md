# ecad-viewer Sync Notes

This document tracks the current upstream sync reference for the vendored visualizer assets.

## Canonical repository and branch

- canonical repository: `krishna-swaroop/ecad-viewer`
- integration branch: `feature/prism-host-adapter-v2`
- upstream base: the commit in `scripts/ecad-viewer-upstream.lock`
- performance-source reference: `Keybored02/ecad-viewer@kicad-prism-perf`

The Keybored02 branch is an input for reviewed cherry-picks, not a second release
line. Shared performance or interaction fixes must land on the canonical adapter
branch first. Prism then vendors only the artifacts produced by
`scripts/build-ecad-viewer.sh`; direct edits to `frontend/public/ecad-viewer.js` or
`parser.worker.js` are not accepted.

The host-facing TypeScript contract is exported from the `ecad-viewer-app` package
root. Prism's global custom-element declaration mirrors that public contract only;
viewer internals and prototype patches are not integration APIs.

## Vendored Artifacts

The build manifest records the upstream base, adapter commit, whether the source
tree was dirty, the worktree patch digest, and both artifact digests. Clean source
trees are required by default. `ECAD_ALLOW_DIRTY=1` exists only for local validation.
The browser cache key is generated from the final bundle SHA-256.

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
