---
name: prism-viewer-rebuild
description: Rebuild the vendored ECAD viewer bundle and kicad-parser from the sibling ecad-viewer checkout. Use after changing ecad-viewer sources, or when viewer behavior does not match the source you just edited.
---

# Rebuild the vendored ECAD viewer and parser

Prism commits two build artifacts from the sibling `ecad-viewer` repository:

- `frontend/public/ecad-viewer.js` — the viewer custom element
- `scripts/vendor/kicad-sexpr-parser.mjs` — the parser, bundled for the Node
  already present in backend and worker images (no `node_modules` there)

**The silent failure:** editing `ecad-viewer` sources changes nothing in Prism
until you rebuild. Tests pass against the old bundle and report success. If
viewer behavior contradicts the source you are reading, suspect a stale build
before suspecting a bug.

## Preconditions

Both scripts expect the sibling checkout at `../ecad-viewer`, overridable with
`ECAD_VIEWER_DIR`. Both verify that `scripts/ecad-viewer-upstream.lock` is an
ancestor of the checkout's `HEAD`, and both **refuse to publish from a dirty
source tree**.

That refusal is deliberate: a committed artifact is only honest if it can be
regenerated. If you hit it, commit the ecad-viewer change first. `ECAD_ALLOW_DIRTY=1`
exists for local iteration only — never use it for anything you intend to commit.

## Rebuild

```bash
./scripts/build-ecad-viewer.sh
```

```bash
./scripts/build-ecad-parser.sh
```

Run both when parser sources changed, since the viewer bundles its own copy.

## After rebuilding

Both artifacts are committed. Include them in the same commit as the
`ecad-viewer` bump so the two never disagree.

If you advanced the upstream commit, update `scripts/ecad-viewer-upstream.lock`
in the same change.

Then run the `prism-quality-gate` skill. Frontend failures that appeared before
the rebuild and persist after it are real.

## Scope note

`kicad-prism-viewer/` is a different thing — Prism's own semantic viewer package,
built with esbuild and tested via `npm run test:gltf` / `npm run test:viewer`.
This skill does not cover it.
