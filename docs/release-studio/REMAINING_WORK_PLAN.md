# Release Studio — remaining work

Branch `feature/release-studio` · reconciled 2026-08-12 after place-as-is + dimensions

Everything from the previous revision of this plan has landed except where
noted below.

---

## Open

### A. Assembly views fall back to pad bounds instead of model HLR

**Observed.** `kicad-cruncher pcb-svg` renders the assembly views correctly and
the sheets are legible, but on JTYU-OBC every component is drawn as its
`pad_bounds` rectangle: 478 of 478 components report
`data-projection="pad_bounds"`, and Geometer computed **zero** HLR STEP
projections. On the USB-PD fixture, Geometer *does* run —

```
Computing Geometer HLR STEP projection: kicad-embed://IRF9358TRPBF.stp (hash=1e11c0c44b9e, side=top)
```

**The difference is embedded vs referenced 3D models.** USB-PD embeds its
models (`kicad-embed://…`); OBC references them as
`${KIPRJMOD}/packages3D/*.stp`. Tested with the models present beside the
board, and again with `OBC.kicad_pro` as the input so `${KIPRJMOD}` resolves:
Geometer still did not run. (40 of the 60 unique referenced models exist in
`packages3D/`; the other 20 are missing from the project.)

Model-derived HLR outlines are what make these drawings distinctive — pad-bound
rectangles are a fair fallback but they are not the same drawing.

**Work.** Establish whether Cruncher resolves `${KIPRJMOD}` model paths for
Geometer at all, or only embedded models. If it is a resolution gap, it belongs
upstream in Cruncher. Either way the *fallback must stop being silent*: record
the projection mix per view and raise a build warning when a view falls back to
`pad_bounds`, the same way the kicad_monkey stackup fallback now does.

### B. Dense boards omit designators rather than zoning the drawing

A 982-component 285 mm board cannot show every designator legibly at any ratio;
density is scale-invariant. The real answer is template-driven detail views —
grid the board, emit a magnified sheet per dense zone — which is drafting
automation, not a canvas editor. Cruncher already fits designators; Prism
places that view as-is and no longer re-filters them.

### C. Stage 2 exit criteria not yet run

The 50.000 mm scale oracle still skips without a live `kicad-cli`, and there is
no reproducibility matrix over composed sheets across separate checkouts.

### D. Smaller

- **`PublicReleaseView` never renders `expires_at`** though it types and
  fetches it, and a revoked share stays visible until reload.
- **Duplicate `policy_key`** surfaces a raw `UniqueViolation` as 500, not 400.
- **Conformance drift check self-skips** without `PRISM_KICAD_SOURCE_ROOT`. The
  recorded-fixture half always runs, which is the mitigation, but the half that
  catches a KiCad upgrade only runs on a developer machine.
- **Two suite failures are environmental**, not code:
  `test_cookie_secure_follows_public_base_url` and
  `test_the_compare_roots_sit_under_the_platform_temporary_directory` both read
  env vars the backend container sets (`SESSION_COOKIE_SECURE=false`,
  `PRISM_DESIGN_COMPARE_CACHE=/app/projects/...`). They pass on a clean env.

---

## Landed in this pass

**P0-1 — Cruncher assembly views, place-as-is.** Assembly sheets place
`kicad-cruncher pcb-svg` output as opaque artwork (SVG + cairo PDF). The ingest
layer (`documents/vector.py`) is gone.

**P0-2 — Lean manifests.** Manifest carries `projection_digests` only; full
projection text lives in build-evidence / `ws_release_build_projections`.

**P0-3 — Fabrication dimensions.** Overall width (below) and height (left) are
drawn from board statistics, using KiCad's own millimetre labels so they match
the characteristics table. Renderer `d10`.

**P0-4 — Bundle provenance.** `docs/release-studio/BUNDLE.md` documents the
signed archive layout and where `released_by` / `released_at` live (attestation
only; never inside technical digests).

**Also earlier on this branch.** Admin blocker override; migration ladder
collapse; candidate policy-snapshot immutability; kicad_monkey fallback
logging; public archive verification cache; policy authoring audit stream;
font subsetting; `executor_image()` fails closed; one scale for the whole set;
table columns claim width the board does not need.
