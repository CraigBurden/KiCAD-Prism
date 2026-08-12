# Release Studio — remaining work

Branch `feature/release-studio` · reconciled 2026-08-12 after open-point closeout

---

## Open / deferred

### Detail / zone sheets for dense boards

Density is scale-invariant: a 400+ part side cannot show every designator
legibly on one sheet. Builds now **warn**, and the assembly population table
states that `positions.csv` is authoritative. Template-driven detail/zone
sheets remain future drafting automation.

### Upstream: Cruncher `${KIPRJMOD}` HLR resolution

Referenced (non-embedded) 3D models on OBC still fall back to `pad_bounds`.
Prism now **warns** when that happens. Fixing Geometer resolution for
`${KIPRJMOD}` paths belongs upstream in Cruncher when confirmed.

### Live Stage-2 exit matrix

The unit scale oracle (`50.000 mm` board → `50.000 mm` sheet) runs in CI.
A live `kicad-cli` reproducibility matrix across separate checkouts is still
a manual / nightly gate.

---

## Closed in this pass

- **A.** `pad_bounds` fallback is no longer silent — projection mix warnings.
- **B.** Dense boards (≥400 placements/side) warn; population table notes it.
- **C.** Compose reproducibility unit test (byte-identical files).
- **D.** `PublicReleaseView` shows `expires_at` and polls for revoke/expiry;
  duplicate `policy_key` → 400; conformance sibling path safe in container;
  cookie-secure and compare-root tests isolated from deployment env;
  build warnings shown in the Release Studio UI.

Earlier: place-as-is Cruncher assembly, fab dimensions (`d10`), lean manifests,
bundle provenance (`BUNDLE.md`), admin override, migration collapse, etc.
