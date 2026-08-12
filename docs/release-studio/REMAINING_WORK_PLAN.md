# Release Studio — remaining work

Branch `feature/release-studio` · reconciled 2026-08-12 after the sheet-quality
and build-latency pass

---

## Open / deferred

### The Release Studio UI

One 1507-line `ReleaseStudioPanel.tsx` holding candidate creation, the
candidate list, build detail, evidence, evaluation, approvals, waivers,
release, verification, sharing, and the audit trail. It is the next thing to
work on and has not been designed, only accreted.

### Detail / zone sheets for dense boards

Density is scale-invariant: a 400+ part side cannot show every designator
legibly on one sheet. Builds now **warn**, and the assembly population table
states that `positions.csv` is authoritative. Template-driven detail/zone
sheets remain future drafting automation.

### Upstream: Cruncher `${KIPRJMOD}` HLR resolution

Components whose 3D models are *referenced* rather than embedded still resolve
no model on OBC, so they draw as bounding boxes. The config now asks for the
model outline and Cruncher degrades per component on its own — model bounds,
then hole bounds, then pad bounds — and the sheet states the mix it got.
Making Geometer resolve `${KIPRJMOD}` paths belongs upstream in Cruncher.

### Live Stage-2 exit matrix

The unit scale oracle (`50.000 mm` board → `50.000 mm` sheet) runs in CI.
A live `kicad-cli` reproducibility matrix across separate checkouts is still
a manual / nightly gate.

---

## Closed in this pass

- **Schedules no longer truncate.** The stackup, drill schedule and board
  characteristics list every row. Two defects, one symptom: the scale factor
  was computed from *unscaled* heights and never re-measured, so shrinking —
  which narrows columns and therefore re-wraps cells — could overshoot the
  area by a millimetre and be answered by deleting nine rows; and the note
  block reserved a flat 30 mm whatever it actually needed. The fit is now
  found by measuring candidates, the reserve is the notes' real height, and
  anything that still does not fit continues on its own sheet (`(CONTINUED)`
  in the heading) instead of being dropped. `Table.truncated` and "and N
  more" are gone. On JTYU-OBC all 49 rows now draw on one sheet.
- **The cover is three columns** — released members, revision history, then
  board characteristics and release summary — with the note block measured
  and pinned above the title block rather than allowed to run into it.
- **Assembly views ask for the model outline.** `default_projection` was
  `bounding_box`; it is now `outline`. Cruncher already degrades per
  component, so this costs nothing on a part with no 3D model. The
  fallback warning also read the wrong attribute: `data-projection` is the
  *configured* mode and is identical on every component, so it could never
  report a fallback. It now reads `data-bounds-kind`, which is the outcome,
  and the population table states it in words ("3D model outline 41 · pad
  bounds 6").
- **Build wall clock.** Measured on JTYU-OBC (35 MB `.kicad_pcb`, 982
  components): the step catalogue ran nine `kicad-cli` processes one at a
  time, Cruncher loaded the board once per assembly side, and the stackup and
  variant projections each parsed the same file separately. Fixed by running
  the catalogue concurrently, asking Cruncher for both views in one
  invocation, acquiring all artwork concurrently, and sharing one board parse
  between the projections.

- **A.** `pad_bounds` fallback is no longer silent — projection mix warnings.
- **B.** Dense boards (≥400 placements/side) warn; population table notes it.
- **C.** Compose reproducibility unit test (byte-identical files).
- **D.** `PublicReleaseView` shows `expires_at` and polls for revoke/expiry;
  duplicate `policy_key` → 400; conformance sibling path safe in container;
  cookie-secure and compare-root tests isolated from deployment env;
  build warnings shown in the Release Studio UI.

Earlier: place-as-is Cruncher assembly, fab dimensions (`d10`), lean manifests,
bundle provenance (`BUNDLE.md`), admin override, migration collapse, etc.
