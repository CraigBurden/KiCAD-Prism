---
name: prism-viewer-rebuild
description: Rebuild and verify KiCAD Prism's committed ECAD viewer and parser outputs from the sibling ecad-viewer checkout. Use after upstream viewer/parser changes or when committed artifacts appear stale.
---

# Rebuild vendored ECAD artifacts

This playbook covers the sibling `../ecad-viewer` checkout, overridable with
`ECAD_VIEWER_DIR`. It does not cover Prism's separate
`kicad-prism-viewer/` semantic viewer package.

## Preconditions

The build script requires the commit in
`scripts/ecad-viewer-upstream.lock` to be an ancestor of the sibling checkout.
It refuses relevant dirty source trees unless `ECAD_ALLOW_DIRTY=1` is set.
That override is for local iteration only; do not commit artifacts whose
provenance reports dirty input.

## Build outputs

```bash
./scripts/build-ecad-viewer.sh
```

This updates:

- `frontend/public/ecad-viewer.js`;
- `frontend/public/parser.worker.js`;
- `frontend/public/ecad-renderer.js` and its generated cache key in
  `frontend/src/lib/ecad-renderer-build.ts`;
- `frontend/public/ecad-viewer.manifest.json`; and
- the artifact digest in `frontend/index.html`.

Run the viewer build when parser sources change: the browser viewer bundles its
own parser copy. A viewer-only source change needs the same build.

## Verify provenance

Review every generated diff. Confirm the manifest/provenance source commit,
source-tree digest, artifact digests, and dirty flag match the intended sibling
checkout. If the accepted upstream baseline changed, update
`scripts/ecad-viewer-upstream.lock` deliberately in the same change.

Commit the generated outputs with the source/baseline change that requires
them. Then use `.agents/skills/prism-quality-gate/SKILL.md`; persistent frontend
failures after a clean rebuild should be treated as real regressions rather
than stale-artifact symptoms.
