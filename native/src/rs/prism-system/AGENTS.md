# prism-system — System Builder v2's system bundle (SB2 stage 1)

Derived state for a system — system nets, B2B mappings, placement and harness
geometry, findings — computed over design bundles, keyed by the document version
and each occurrence's bundle key (ADR `docs/architecture/adr-system-builder-v2.md`
§3.3). Built by a job like a design bundle, staged so connectivity is available
before geometry and geometry before outputs. The rules are
`docs/system-builder/CONTRACTS.md` §8–§9; `prism-kicad system build` runs them.

- `src/build.rs` — the entry point: occurrences, reference checks, mates, wiring,
  nets, suggestions and findings; `src/input.rs` / `src/output.rs` — the
  document subset read and the `prism.system_bundle.a0` shape written.
- `src/mapping.rs` — B2B pin mappings from geometry (§8.4); `src/wiring.rs` —
  harness wiring and splices; `src/nets.rs` — system nets; `src/suggestions.rs`
  — sub-port suggestions; `src/findings.rs` — the §9 catalogue and waivers.
- `tests/build_rules.rs` — the rules on synthetic boards and the frozen
  mezzanine geometry; end-to-end runs on real bundles are the CLI's
  `tests/system.rs`.

- `src/placement/frames.rs` — connector mating-frame inference (§15.1) and `F_c`
  (§14.4); `src/placement/poses.rs` — poses, transforms and the default row
  (§14.1, §14.3); `src/placement/mate.rs` — the mate transform, connector bodies
  and the clearance fallback (§14.5, §14.8).
- `src/placement/harness_*.rs` — the harness geometry maths (CONTRACTS_P2
  §17.5–§17.10: end poses, topology, curves, nodes, checks), ported from the
  v1 Python; `tests/harness_goldens.rs` replays its goldens. `src/routing/` —
  harness routes in the bundle (§16.6): posed ends, the stored or derived tree,
  curves through waypoints, lengths and the bend/clearance findings;
  `tests/routing.rs`.
- Every placement rule has a Python twin in `backend/app/services/systems/placement/` and
  a TypeScript twin in `frontend/src/features/system-builder/placement/`; change
  all three and the shared goldens together.
- `tests/placement_goldens.rs` replays `frames`, `poses` and `mates` from
  `backend/tests/fixtures/system_builder/placement_cases.json`, plus the
  datasheet mezzanine checks in
  `backend/tests/fixtures/system_builder/p2/goldens/`.
