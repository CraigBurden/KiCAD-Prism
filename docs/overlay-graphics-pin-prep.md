# Prism pin prep — Overlay Graphics API

Follow these steps **after** `feature/prism-overlay-graphics` is merged (or
force-pushed cleanly) onto the host-adapter lineage and the working tree is
clean.

## 1. Lock upstream commit

In KiCAD-Prism, update `scripts/ecad-viewer-upstream.lock` to the merge commit
SHA of the overlay-graphics branch (must be an ancestor of the checkout HEAD).

## 2. Build with dirty=false

```bash
# From KiCAD-Prism — point at the overlay-graphics worktree/checkout:
export ECAD_VIEWER_DIR=/Users/Swaroop/Personal-Projects/KiCAD-Platform/ecad-viewer-overlay-graphics
./scripts/build-ecad-viewer.sh
```

The script refuses a dirty `packages/ecad-viewer-app/src` tree unless
`ECAD_ALLOW_DIRTY=1`. Commit viewer changes first so the published bundle has
`dirty: false` in the provenance sidecar.

## 3. Sync TypeScript contract

`frontend/src/types/ecad-viewer.d.ts` already includes Phase 1 overlay fields
(`arc` / `circle`, `hatch`, `outline`, `lineCap`, `hitPadding`, scene `page`).
Re-diff against
`ecad-viewer/.../viewers/base/overlay-scene.ts` if the API evolves further.

## 4. Smoke

- Comments channel still places markers / area bboxes
- Demo: `cd $ECAD_VIEWER_DIR/packages/ecad-viewer-app && npm run serve` →
  http://127.0.0.1:8012/overlay-graphics-demo.html
- Unit tests: `npm test` in `packages/ecad-viewer-app`

See also: `ecad-viewer-overlay-graphics/docs/OVERLAY_SCENE.md`
