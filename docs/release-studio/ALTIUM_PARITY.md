# Release Studio vs Altium's Design Project Release

Assessed 2026-08-12 against `feature/release-studio`, discounting PLM
integration as instructed.

**Short answer: yes on the release *object*, and ahead of Altium on
verifiability — but not at parity on the *scope* of what one release can
cover, nor on the drawing tooling Altium ships beside it.** Three of the gaps
are architectural rather than unfinished work, so they are worth stating
plainly before anyone plans around them.

---

## What Altium's Design Project Release actually is

Not one feature. Three things a project release touches, which Altium bundles
and which are worth separating when comparing:

1. **The Project Releaser** — the wizard that validates a project, executes its
   OutJobs, and records the result as an immutable, revisioned item.
2. **The managed content model** — Item / Revision / Lifecycle State, applied
   uniformly to components, PCBs, assemblies, and released packages.
3. **The generated package** — fabrication data, assembly data, BOM, and (via
   Draftsman) the drawing set that goes with it.

Release Studio implements (1) fully and (3) partially; it deliberately
implements a *different* thing than (2), and that difference is the largest
item on the list below.

---

## At parity

| Altium capability | Release Studio |
|---|---|
| Release wizard that validates before generating | Candidate → policy evaluation → build, with `unsupported` distinct from `pass` |
| Executes the project's output configuration | Runs the project's `.kicad_jobset` through the hermetic step catalogue |
| Immutable released package | `ws_release_records` with a `BEFORE UPDATE` trigger allowing only `superseded_by` |
| Release notes / audit of who released what | Hash-chained `ws_release_audit_events`, verified by `GET /audit/verify` |
| Validation gates the release | Rule catalogue, typed params, severities, and a release gate that refuses on unwaived blockers |
| Variant-aware release | Variants unioned from `.kicad_pcb` and `.kicad_pro`, with divergence reported rather than silently resolved |
| Compare a released revision against the design | Prism's existing Design Compare, plus per-domain scope fingerprints |
| Released data snapshot bound to a source revision | Commit SHA plus a typed input closure — submodule trees, LFS OIDs, resolved external libraries, env bindings |

## Ahead of Altium

These are not "Altium does it worse"; they are things Altium's model does not
attempt, because it assumes the vault is the trust anchor.

- **Offline cryptographic attribution.** The release archive carries an Ed25519
  signature over the attestation, and the standalone verifier runs with no
  Prism, no database, and no network. Altium's released package is
  authoritative because it is *in the vault*; take it out of the vault and it
  is a folder of files. A Prism release is verifiable in a CM's hands.
- **Reproducibility as a checked property.** `build_key` binds the technical
  configuration, the input closure, and the toolchain identity — the OCI image
  digest, not a version string. Two builds of the same commit are provably the
  same release. Altium records *that* a release was generated, not that it can
  be regenerated.
- **Technical / governance separation.** A policy change invalidates approvals
  without touching `manifest_digest`, and re-evaluation runs zero KiCad steps.
  In Altium, re-validating generally means re-releasing.
- **Signed audit head.** The attestation carries the audit chain head and
  sequence, so post-release truncation of the audit trail is detectable from
  the archive alone.
- **Canonicalization with a semantic-null obligation.** Every canonicalizer has
  a per-type test proving it removes only non-manufacturing metadata. Altium
  has no equivalent because it does not need one — it never claims two
  generations are byte-comparable.

## Behind Altium — and why

### 1. One board per release configuration (architectural)

Altium releases a **project**, which may be a multi-board assembly with a
harness, and the release object spans them. Release Studio is explicitly
single-board (plan §"What this feature IS NOT"), monorepo-aware but one
`.kicad_pcb` per configuration. A product built from three boards is three
release records with nothing binding them.

This is the biggest real gap. It is not a missing feature so much as a missing
*level*: there is no "assembly release" above the board release. Closing it
means a parent record type and a fingerprint that composes children.

### 2. No item/revision model for anything but releases (architectural)

Altium's power comes from applying one Item/Revision/Lifecycle model to
components, footprints, PCBs, and releases alike, so a release can state "built
from component revisions X, Y, Z, all in state Released". Prism has Library
Manager and Release Studio as separate systems; a release records *which
components*, but not *which controlled revision of each component*, and cannot
refuse to release against a component in a Prototype state.

### 3. Draftsman (feature depth)

Altium's Draftsman is an interactive drawing editor: user-placed views,
dimensions, callouts, detail and section views, layer stack legends, drill
tables — all editable on a canvas. Release Studio's Documentation Engine is
deliberately not an editor (plan: "No canvas, no drag-and-drop, no transform
handles, no snapping, no undo/redo"). It generates five sheets from templates.

What that costs concretely, discovered while building the JTYU-OBC sheets:

- **No detail or zoned views.** A 982-component 285 mm board cannot show every
  designator legibly on one sheet at any ratio — density is scale-invariant.
  Prism now omits the 374 designators that fall below 1.0 mm and states the
  count; Draftsman would let a drafter place magnified detail views of the
  dense regions. This is the honest-but-inferior outcome.
- **No dimensions or callouts.** Prism draws no dimension lines at all. A
  fabrication drawing without dimensions relies entirely on the Gerber/Excellon
  set being authoritative — which the note block says explicitly, but which is
  weaker than a dimensioned drawing.
- **No user-placed views.** Sheet composition is by template only.

### 4. Lifecycle states and approval routing (feature depth)

Altium has configurable lifecycle definitions with state transitions and
per-transition permissions. Release Studio has a fixed candidate status enum
plus role→domain approvals. It covers two-person review and audited exceptions
well; it does not model "Prototype → Production → Obsolete" as a first-class
state machine an organization configures.

### 5. Where-used and impact analysis (feature depth)

Altium answers "which releases used this component revision?" Prism's semantic
fingerprints could support this — the data is captured — but no query surfaces
it.

---

## Verdict

For the question *"can we issue a controlled, gated, immutable, auditable
manufacturing release of one KiCad board, and prove six months later exactly
what we authorized?"* — **Release Studio is at parity and, on independent
verifiability, ahead.**

For *"can we manage a product as Altium manages a project"* — **no**, and the
two architectural gaps (multi-board releases, component revision control) are
the reason, not the drawing tooling.

The Draftsman gap is the one most likely to be raised by a user, and the most
tractable: dimensions and a detail-view mechanism would close most of the
practical distance without becoming an editor.

## Suggested order, if this is worth closing

1. **Dimensions on the fabrication sheet** — highest value per unit of work,
   and the one omission a fabricator will notice first.
2. **Detail views for dense assembly regions** — template-driven (grid the
   board, emit a magnified sheet per zone above a density threshold), not a
   canvas. Removes the "374 designators omitted" notice honestly.
3. **Multi-board release records** — a parent record whose fingerprint composes
   its children's, releasing them as one governed object.
4. **Component revision binding** — bind Library Manager's controlled revisions
   into the assembly-domain fingerprint, and add a rule that refuses to release
   against an uncontrolled component.
