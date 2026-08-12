# Release Studio — remaining work

Branch `feature/release-studio` · baseline `cc5da17` · reconciled 2026-08-12

Everything here is evidence-backed: each item names what was observed, on which
artifact, and what "done" looks like. Ordered by what blocks a merge.

---

## P0 — blocks the PR

### P0-1 Assembly drawings are unreadable; use Cruncher's assembly view

**Observed.** `documentation/assembly-top.pdf` for JTYU-OBC (982 components)
renders KiCad's `F.Fab` layer as an illegible mass of overlapping designators
and values. Prism plots it faithfully — the overlap is authored into the
footprints, where each `F.Fab` text sits at whatever size and offset the library
chose. No scale fixes this, because density is scale-invariant.

**The answer is a different renderer, not a different KiCad layer.**
`kicad-cruncher pcb-svg` already emits exactly the drawing this needs. From the
generated `pcb.svg.config` template:

> Default assembly views include cutouts, drills, slots, pin-1 markers,
> Geometer outline HLR, and bold monospace assembly designators.

and the `assembly_designators` style block:

```jsonc
"assembly_designators": {
  "box_fill_ratio": 0.8,          // fit the designator inside the component's own bounds
  "min_font_size_mm": 0.35,
  "max_font_size_mm": 2.5,
  "rotation_aspect_threshold": 1.5,   // rotate to run along a tall part
  "rotation_direction": "ccw"
},
"assembly": {
  "default_projection": "pad_bounds",   // clean outline, not F.Fab graphics
  "dnp_projection": "bounding_box",
  "designator_color": "#111111",
  "dnp_designator_color": "#FF0000"     // DNP called out in red
}
```

That is one designator per component, centred and scaled to that component,
rotated when the part is tall, over an HLR outline — the clean assembly drawing.

**Work.**
1. Replace the `assembly-top` / `assembly-bottom` acquisition in
   `documents/engine.py:ARTWORK_LAYERS` with a Cruncher `pcb-svg` acquirer for
   the `assembly_top_view` / `assembly_bottom_view` views. Plan §2 requires one
   authoritative artifact per purpose, so this *replaces* the kicad-cli plot
   rather than sitting beside it under the same name.
2. Check in the Prism-owned `pcb.svg.config` so the view is part of the
   technical configuration and feeds `technical_config_digest`. Do not let
   Cruncher write a template next to the board at build time — that would make
   the closure depend on a file the build created.
3. Record Cruncher as the provenance for these members; surface any fallback to
   kicad-cli as a persistent build warning, never a silent substitution.
4. Keep `pcb-svg` off the fabrication and drill sheets. Those are review-grade
   renders; Gerber/Excellon/STEP stay canonical from `kicad-cli`.

**Done when** the JTYU-OBC assembly sheets show one legible designator per
component, DNP parts in red, and the manifest attributes them to Cruncher.

> Note the cost: `pcb-svg` took **41.5 s** just to load `OBC.kicad_pcb`. Budget
> for it in the job timeout and mention it in the progress stage.

### P0-2 Manifest carries 10.5 MB of raw projections

**Observed.** JTYU-OBC `manifest.json` is 10,509,107 B, of which `projections`
is 10,493,663 B — **99.9%**. The manifest is ~65% of the 14.4 MB dossier, and
`ws_release_scope_fingerprints.inputs` holds another ~10.5 MB per build
(bare_board 3.4 MB, assembly 1.8 MB, documentation 5.3 MB).

Every recipient downloads 10 MB of Prism-internal projection data, and
`manifest_digest` is pinned to the full semantic index verbatim.

**Work.** Hash rather than embed. Put `H(canonical(projection))` per domain into
both the manifest and `inputs`; keep the full text in the build-evidence
artifact, where forensics can reach it. `scope_fingerprints` itself is already
lean (327 B) — this is only about the inputs.

**Done when** the JTYU manifest is under ~100 KB, fingerprints still change when
a projection changes, and build-evidence still contains the full text.

---

## P1 — sheet defects visible on the released drawing

### P1-1 Thickness runs into material in the stackup table

**Observed.** Fabrication sheet: `0.0895I-TERA MT40`, `0.1016I-TERA MT40`,
`0.0254Epoxy`. A right-aligned numeric column ends flush against a left-aligned
text column; `layout._CELL_GUTTER` (1.0 mm) is too small at the scaled font.

**Work.** Make the gutter proportional to the drawn font size rather than a
fixed millimetre value, applied to the *trailing* edge of every cell, and add a
regression test that two adjacent columns never produce touching ink.

### P1-2 Tables truncate while two thirds of the sheet is blank

**Observed.** On A3 at 1:1 the fabrication sheet shows "and 4 more" on a
12-layer stackup, "and 3 more" on characteristics, and a drill marker that was
itself ellipsized to `and 2 ...`. Meanwhile the artwork window is far larger
than the 132×90 mm board.

**Work.** Let the table column claim the width the board does not need:
after `select_sheet_size` picks the sheet and the scale is known, give
`table_area` the slack between the placed artwork extent and the window. Also
exempt the truncation marker from `fit_text`, since a truncated "n more" notice
is worse than none.

### P1-3 One board, three scales in one package

**Observed.** fabrication 1:1, drill 1:1, assembly 2:1 — because each sheet's
table width changes its window and therefore its preferred scale.

**Work.** Choose one scale for the set from the narrowest window, the way
`select_sheet_size` already chooses one size. A controlled drawing package where
the same board measures differently per sheet is a defect.

### P1-4 Cover claims to list bytes it omits

**Observed.** The cover lists 42 of 53 members and states "The files listed
above are the released bytes". The 11 documentation members cannot be listed —
the cover precedes them — but a recipient reconciling the list against the
dossier finds extras.

**Work.** Either reword the note to say the sheet lists the members produced
before it and points at `manifest.json` for the whole set, or emit the cover in
a second pass once every other member exists. Rewording is cheaper and honest.

### P1-5 Empty VARIANTS table

**Observed.** JTYU-OBC declares no variants; the cover draws a header row with
no rows under it, which reads as missing data.

**Work.** Omit the table and state "no variants declared" in its place.

---

## P2 — governance, schema, and hygiene

### P2-1 R23: collapse the migration ladder

M8–M12 are all Release Studio, and no database outside this branch has seen M8.
Plan §13a requires a single `(8, "release_studio", _release_studio)` before the
merge into `dev`. Delete the intermediates and any preflight that guards against
rows a never-deployed migration could not have created. **Must land before the
`dev` merge**, after which the ladder becomes append-only.

### P2-2 Candidate policy snapshot has no database guard

`ws_release_candidates.policy_document` has no `BEFORE UPDATE` trigger, while
approvals, records, policy versions and audit events all do. In-code writes only
touch `status`, so it holds by convention. Add the trigger rejecting changes to
`policy_document`, `policy_snapshot_captured`, `commit_sha`, and `build_key`.

### P2-3 kicad_monkey fallback is silent

`projections._load_pcb_projection_model` catches `(IndexError, TypeError,
ValueError)` and re-parses. It cannot tell "this Monkey release rejects the
`unlocked` token" from "this board is corrupt", and either way the projection
succeeds with no log line, no warning, and a `semantic`-fidelity fingerprint.
Return `source="kicad_monkey.fallback"` (the field already exists) and raise it
as a build warning naming the underlying exception.

### P2-4 Public routes re-verify the whole archive per request

`_verified_public_archive` rebuilds and fully verifies the release archive on
every unauthenticated request, including each member fetch — an unbounded
gzip+SHA-256 sweep as a free amplification primitive. Cache the verification by
`attestation_digest`; it is deterministic per record.

### P2-5 Policy authoring writes no audit events

`create_policy`, `create_version`, `update_draft`, `publish`, `retire` record
nothing, yet publishing a version invalidates approvals across every project
that binds it. `ws_release_audit_events` is keyed `(project_id, config_key)`, so
this needs a scope decision first: nullable `project_id` with its own chain, or
a separate `ws_release_policy_audit_events`.

### P2-6 Un-subsetted font embedding

All three faces embed whole into every Geist sheet (92.5 + 144.9 + 146.0 =
383 KiB), ~1.9 MiB duplicated per five-sheet set. Subset with
`fontTools.subset` against the `used_glyphs` the writer already accumulates.

### P2-7 `executor_image()` degrades silently

Returns `""` when `/etc/prism/kicad-base-image` is absent, so `toolchain_digest`
quietly becomes a constant on an unpinned host. Fail the build instead.

---

## P3 — smaller

- **D10 is absent.** No `GET /builds/{id}/sheets` or `/sheets/{key}.svg`, and no
  frontend sheet preview. Stage 2 lists it; nothing depends on it.
- **`PublicReleaseView` never renders `expires_at`** though it types and fetches
  it, and a revoked share stays visible until reload.
- **Duplicate `policy_key`** surfaces a raw `UniqueViolation` as 500, not 400.
- **Stage 2 exit criteria not run:** the 50.000 mm scale oracle skips without a
  live `kicad-cli`, and there is no reproducibility matrix over composed sheets.

---

## Test gaps

1. **No frontend tests for Stage 3** — `PublicReleaseView` and
   `PolicyAuthoringCard` have none. Revocation, expiry, error states and a
   failed-verification badge are all untested.
2. **The documented test command hides 46 PostgreSQL tests.** Without
   `TEST_POSTGRES_URL` the suite reports `OK (skipped=48)` and migration 12, the
   immutability triggers, and token expiry never execute. Put the variable in
   the documented command.
3. **Conformance drift check self-skips** without `PRISM_KICAD_SOURCE_ROOT`. The
   recorded-fixture half always runs, which is the mitigation, but the half that
   catches a KiCad upgrade only runs on a developer machine.
4. **No test asserts the manifest stays small** — add one, so P0-2 cannot
   regress quietly.

---

## Suggested order

1. P0-1 (Cruncher assembly) and P0-2 (manifest) — both change released bytes, so
   land them together with one `RENDERER_VERSION` bump and one golden re-record.
2. P1-1…P1-5 — same, a second bump and re-record.
3. P2-1 (ladder collapse) immediately before the `dev` merge.
4. P2-2…P2-7 and the test gaps, in any order.
5. P3 last.

Every step that changes composed output must bump `RENDERER_VERSION` and
re-record the goldens **in the same commit**, and must be re-recorded under the
2026.8.11 image — six of eleven digests moved between 2026.6.13 and 2026.8.11,
so values from another runtime cannot be trusted.
