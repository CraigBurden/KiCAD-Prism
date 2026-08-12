# Release Studio — remaining work

Branch `feature/release-studio` · reconciled 2026-08-12 after the P0/P1/P2 pass

Everything from the previous revision of this plan has landed except where
noted below. What follows is what is *left*, plus one finding discovered while
implementing P0-1 that changes what the assembly sheets can currently show.

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

### B. Fabrication sheets carry no dimensions

Prism draws no dimension lines. The note block states that the Gerber/Excellon
set is authoritative, which is honest, but a fabrication drawing without
dimensions is weaker than one with them. See `ALTIUM_PARITY.md` — this is the
single most visible gap against Draftsman and the most tractable to close.

### C. Dense boards omit designators rather than zoning the drawing

A 982-component 285 mm board cannot show every designator legibly at any ratio;
density is scale-invariant. The sheet now drops designators below 1.0 mm and
states the count (374 omitted on JTYU-OBC top). The real answer is
template-driven detail views — grid the board, emit a magnified sheet per dense
zone — which is drafting automation, not a canvas editor.

### D. Stage 2 exit criteria not yet run

The 50.000 mm scale oracle still skips without a live `kicad-cli`, and there is
no reproducibility matrix over composed sheets across separate checkouts.

### E. Smaller

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

**P0-1 — Cruncher assembly views.** `assembly-top`/`assembly-bottom` no longer
plot KiCad's `F.Fab` layer. They come from `kicad-cruncher pcb-svg` through a
checked-in Prism-owned `pcb-svg.config.json`, and are *ingested* into the
layout model rather than inlined, so the SVG and PDF renderings cannot diverge
and designators are set in the bundled, digest-checked face instead of the
reader's `Consolas, monospace`. New `documents/vector.py` parses a deliberately
closed SVG vocabulary and refuses anything outside it. Cruncher's config digest
feeds `toolchain_digest` via `renderer_resource_digest()`.

**P0-2 — manifest bloat.** The manifest carried 10.5 MB of raw projections
(99.9% of it). It now carries `projection_digests` only; the full text lives in
build-evidence, and the facts a re-evaluation needs are recorded once per build
in `ws_release_build_projections` rather than three times inside fingerprint
inputs. `GENERATOR_BUILD` bumped to `r23` so the build key moves with it.

**P1 — five sheet defects.** Proportional cell gutter; table columns claim the
width the placed artwork does not need; one scale for the whole set; the cover
no longer claims to list bytes it omits; an empty VARIANTS table states the
fact instead of drawing a header over nothing.

**P2** — migration ladder collapsed to a single M8 (verified by diffing the
`pg_dump` catalog of M1–M12 against M1–M8: the only differences are the two
intentional additions); candidate policy-snapshot immutability trigger;
kicad_monkey fallback now logs what it stepped over; public archive
verification cached by `attestation_digest`; policy authoring writes its own
hash-chained audit stream with a linkage verifier; embedded fonts subset to the
glyphs each sheet sets (sheets went from ~400 KB to ~60–74 KB);
`executor_image()` fails instead of returning `""`.

**Admin blocker override.** Documentation always builds regardless of
evaluation. Releasing over open blockers is admin-only, refuses without a
stated reason, refuses on a clean build, names every finding it steps over
inside the *signed* attestation, and emits its own `release.blockers_overridden`
audit event. The offline verifier surfaces it as a NOTE — the archive is
genuinely signed, so failing it would be false; what a recipient needs is to be
told.

Renderer `d9`; goldens re-recorded and verified stable across two runs under
the 2026.8.11 image.
