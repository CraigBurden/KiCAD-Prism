# native/parity/ — goldens and the parity runner (WP-G)

Today's output of every bundle projection on the committed fixtures, in each contract's shape, and the runner that diffs a bundle against them (ADR §7). Start with `README.md`.

- `fixtures.json`: the committed cases.
- `goldens/<case>/`: the goldens. They were captured from the removed Python producers and are frozen: `python -m prism_parity capture` only runs from a checkout of the baseline commit (`README.md`, "Capturing goldens"). A deliberate output change updates the golden in the same PR.
- `prism_parity/compare.py`: the runner (`python3 -m prism_parity compare`, stdlib only).
  - `prism_parity/jsonvalue.py`: the value equality of conventions.md §14.
  - `prism_parity/members.py`: the members and their non-semantic fields.
  - `prism_parity/divergences.py`: how accepted divergences apply.
- `prism_parity/capture/<member>.py`: one golden producer per member, following that member's field map ("How a golden is produced from today's code").
- `prism_parity/oracle.py`: the KiCad oracle.
- `prism_parity/corpus.py`: the private corpus. Its manifests and goldens never enter the repository.
- `divergences/<member>.md` and `.json`: each belongs to the member's producer WP (P1–P5, V1). `divergences.md` is the index.
- `component_models_check.py`: V1's acceptance check, the models stage's GLB against today's export with the same `kicad-cli` (`divergences/component-models.md`). It needs KiCad, so CI does not run it.
- `hlr/capture_hlr.py` and `hlr/compare_hlr.py`: the assembly HLR parity harness (amendment C3 §4). The capture runs today's `kicad-cruncher pcb-svg` in-process and records each footprint's projected geometry; the compare builds each case's stage `models` with `--geometer` and diffs the member against the golden (1e-6 mm), with a same-runtime re-capture proving any difference is the Geometer runtime change. Goldens are `goldens/<case>/assembly-hlr.today.json` with a `goldens/<case>/assembly-hlr.today.capture.json` sidecar for both runtime versions. It needs Cruncher, which this tree no longer installs, so it runs only from the baseline checkout; the committed HLR goldens are the reference.
- `artwork/check_artwork.py`: chunk E's acceptance check. It builds each case's `parse -> board -> models` chain, runs `prism-kicad artwork` on every view of both configs twice, and checks byte-identical output, body containment inset by half the outline stroke, minimum fonts and selector coverage. `--cruncher` also runs today's `pcb-svg` and renders both SVGs to PNG side by side. It needs Geometer (and Cruncher for the visual pass), so CI does not run it.
- Checks: `python3 -m unittest discover -s tests`, `python3 -m prism_parity inputs`, `python3 -m prism_parity selftest`, and `node parity/validate.mjs parity/goldens` (from `native/`). CI's `native-parity` job runs them.
