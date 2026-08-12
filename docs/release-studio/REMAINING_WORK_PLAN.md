# Release Studio — remaining work

Branch `feature/release-studio` · reconciled after the backend pipeline pass.
Current behaviour: `docs/release-studio/PIPELINE.md`.

---

## Open / deferred

### The Release Studio UI

One large `ReleaseStudioPanel.tsx` holding candidate creation, the candidate
list, build detail, evidence, evaluation, approvals, waivers, release,
verification, sharing, and the audit trail. It is the next thing to work on
and has not been designed, only accreted. The PDF preview URL change in this
pass is not that rewrite.

### Detail / zone sheets for dense boards

Density is scale-invariant: a 400+ part side cannot show every designator
legibly on one sheet. Builds now **warn**, and the assembly population table
states that `positions.csv` is authoritative. Template-driven detail/zone
sheets remain future drafting automation.

### Upstream: Cruncher `${KIPRJMOD}` HLR resolution

Components whose 3D models are *referenced* rather than embedded still resolve
no model on OBC, so they draw as bounding boxes. Making Geometer resolve
`${KIPRJMOD}` paths belongs upstream in Cruncher.

### Live Stage-2 exit matrix

The unit scale oracle (`50.000 mm` board → `50.000 mm` sheet) runs in CI.
A live `kicad-cli` reproducibility matrix across separate checkouts is still
a manual / nightly gate.

### Jobset-driven execution and board STEP

The catalogue is still a fixed set. A named jobset is parsed for presence, not
executed. Board STEP export is not a catalogue step.

---

## Closed in this pass

- **Typography is Git-owned.** Compose reads `typography` from the committed
  configuration. The panel selector only fills a YAML template. JTYU-OBC has
  no `typography` key, so Geist Pixel Square is the face that was generated.
- **Dossier documentation members are PDFs only.** Page SVGs are the same
  layout model and stay in memory for tests; in-app preview fetches the PDF.
- **Pipeline overlap.** Catalogue wave A (DRC/ERC/stats/BOM/PnP) runs beside
  the Cruncher assembly load. Wave B is gerbers, drill (no map), schematic PDF.
  Testpoint Cruncher is a second board load and runs after the plot pool.
- **One `KiCadPcb` parse** is shared with the semantic index.
- **Redundant plots dropped.** No extra Edge.Cuts+F.Cu overview; no catalogue
  `board.pdf`; catalogue drill no longer generates a gerber map (the drill
  sheet still acquires one). The three plots inside `acquire()` run together.
- **Compose failure** is a failed documents step, not a silently missing set.
- **Hermeticity** is classified on the catalogue that runs.
- **Timings** land in `build-evidence.json` only.

See `PIPELINE.md` for the sequence, RAM caps, and toolchain roles.
