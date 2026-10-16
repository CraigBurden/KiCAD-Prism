# native/parity/ — goldens and the parity runner (WP-G)

Today's output of every bundle projection on the committed fixtures, in each contract's shape, and the runner that diffs a bundle against them (ADR §7). Start with `README.md`.

- `fixtures.json`: the committed cases.
- `goldens/<case>/`: the goldens. They are captured, never hand-edited: recapture with `python -m prism_parity capture` (backend environment, `README.md`).
- `prism_parity/compare.py`: the runner (`python3 -m prism_parity compare`, stdlib only).
  - `prism_parity/jsonvalue.py`: the value equality of conventions.md §14.
  - `prism_parity/members.py`: the members and their non-semantic fields.
  - `prism_parity/divergences.py`: how accepted divergences apply.
- `prism_parity/capture/<member>.py`: one golden producer per member, following that member's field map ("How a golden is produced from today's code").
- `prism_parity/oracle.py`: the KiCad oracle.
- `prism_parity/corpus.py`: the private corpus. Its manifests and goldens never enter the repository.
- `divergences/<member>.md` and `.json`: each belongs to the member's producer WP (P1–P5, V1). `divergences.md` is the index.
- Checks: `python3 -m unittest discover -s tests`, `python3 -m prism_parity inputs`, `python3 -m prism_parity selftest`, and `node parity/validate.mjs parity/goldens` (from `native/`). CI's `native-parity` job runs them.
