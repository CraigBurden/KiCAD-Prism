# Parity: goldens and the parity runner (WP-G)

The bundle's projections must reproduce what Prism's code produces today (ADR §7, `docs/architecture/adr-native-design-bundle.md`). This directory holds:

- the goldens: today's output for every ADR §6 projection on every committed fixture, in each contract's shape;
- the runner, which compares a bundle with them;
- the KiCad oracle;
- the corpus tooling for the private projects, which are never committed.

Rules: `native/contracts/prism/conventions.md` §14 (parity semantics) and each field map's section "How a golden is produced from today's code".

## Layout

| Path | What |
|---|---|
| `fixtures.json` | the committed cases (`prism.parity.fixtures.a0`): id, `sourceRoot` (the directory that stands for the repository root, as `prism-kicad bundle build --source-root`), `project` (the anchor `RepoPath`), plus the revision `pairs` the board-objects digest check uses |
| `goldens/<case>/<member>.json` | one golden per projection: the contract document (validates against `contracts/generated/schema/`), e.g. `goldens/rs-usb-pd/stackup.json` |
| `goldens/<case>/<member>.<name>.json` | sidecars a check needs: `board-objects.today-hash.json` maps each `ObjectRef` to today's index `hash` |
| `goldens/<case>/capture.json` | `prism.parity.capture.a0`: the inputs (sha256 of every committed source and, for upgraded files, of the upgraded bytes), the producers (today's commit, the reference branch commit, kicad_monkey, KiCad, Python, Node, platform) and each member's status (`captured`, or `today-failed` with today's error) and its consumer checks |
| `divergences.md`, `divergences/<member>.md` | accepted divergences in prose: the index here, each member's file owned by its producer WP (ownership item 11) |
| `divergences/<member>.json` | the same divergences in the form the runner applies (`prism.parity.divergences.a0`) |
| `oracle-known.json` | explained disagreements between KiCad and the goldens |
| `corpus.example.json` | the corpus manifest format (`prism.parity.corpus.a0`) with placeholder paths |
| `prism_parity/` | the runner (stdlib Python 3.12) and the capture code (`capture/`, which needs the backend environment) |
| `validate.mjs` | validates goldens or members against the contracts (Node 24.22.0, ajv) |
| `tests/` | the runner's unit tests |

## The golden format

A golden is exactly a member: the JSON document the contract describes. Its text is one-space-indented UTF-8 with a trailing LF. It is compared by value, never by bytes.

Goldens come from today's code (dev's `backend/`, plus the reference branch where a field map says so):

1. **Prepare.** The case's source root is copied to a scratch directory. Every `.kicad_sch` and `.kicad_pcb` older than KiCad 10.0.6's format is upgraded exactly as stage parse's inputs are (`kicad-seeded-upgrade-a0`, cli-spec.md §9.4): boards through pcbnew with the fixed `KIID` seed, schematics through `kicad-cli sch upgrade`, file by file in code point order. Today's code and the bundle therefore read the same bytes. `capture.json` records each upgraded file's original version and upgraded sha256, and the runner warns when a bundle's `sources/` hold other bytes. The upgrade is deterministic: two preparations give identical bytes.
2. **Run today's producer** on the prepared copy and **transform** its output as the member's field map says. The code is `prism_parity/capture/<member>.py`, one module per member, whose docstrings cite the field map.
3. **Check consumers.** Some contracts are new shapes: stackup, placements, project, occurrences, and the board-objects rebuild. For those, the field map's reader adapters re-derive today's own consumer outputs from the golden, and the result is compared with what today's code wrote. A golden whose check differs without a documented divergence is refused. The results are in `capture.json` (`checks`).

Paths in goldens are `RepoPath`s relative to the source root (conventions.md §8). For every committed fixture the source root is the project directory, so they equal today's project-relative paths. Corpus projects in subdirectories get the prefix.

## Comparing a bundle

From `native/parity` (any Python ≥ 3.11, no dependencies):

```sh
python3 -m prism_parity compare --bundles <dir>              # <dir>/<case>.prism or <dir>/<case>/ per case
python3 -m prism_parity compare <bundle> --case rs-usb-pd    # one bundle: .prism, unpacked, or a dir of <member>.json
  [--members stackup,placements] [--cases a,b] [--require-all] [--validate] [--json report.json] [--quiet]
python3 -m prism_parity bundles --prism-kicad <bin> --out <dir> [--cases a,b] [--no-upgrade]
```

`bundles` builds every fixture's parse-stage bundle into `<dir>/<case>.prism`, preparing each case as `capture` does. With KiCad found (or without `--no-upgrade`), old-format sources are upgraded first. Without KiCad, a case whose golden came from upgraded sources (`rs-cynthion`, `rs-usb-pd`, `rs-synthetic`, `dv-legacy_in_bom`) is skipped and named, and `compare` lists it as missing.

For each case and member the runner:

1. applies the member's accepted divergences;
2. runs the member's extra check:
   - board-objects: every `contentDigest` equals G's reference implementation;
   - system-interface: `digest` is the sha256 of its own body;
3. removes the contract's non-semantic fields (`prism_parity/members.py`: the semantic index's `sourceRevisionKey`, board-objects' `contentDigest`, which the check above covers);
4. compares by JSON value: objects as key sets, absent differs from `null`, arrays in order, numbers as IEEE-754 doubles, strings by code point, `true` is not `1`.

It reports each member as `equal`, `equal-with-divergences` (naming the divergences that changed the outcome), `differs` (listing JSON pointers with both values), `missing`, `expected-refusal` (today's code refuses the sources, as on `dv-malformed`, so stage parse must fail and the bundle must not have the member; `capture.json` records today's error), `unexpected-member` (such a refusal, but the bundle has the member: a failure) or `invalid` (`--validate`).

- With several board-objects bundles it also checks the field map's step 4 on the `pairs` of `fixtures.json`: `contentDigest` is equal exactly when today's `hash` is equal.
- If the bundle has a `bundle.json`, its `sources/` hashes are compared with the golden's inputs. A mismatch is a warning, not a failure.
- **Exit status:** 0 when nothing is unexplained; 1 on any difference, failed check or invalid member, or on any missing case or member with `--require-all`; 2 on a usage error.

`python3 -m prism_parity selftest [--work <dir>]` proves the runner on hand-made bundles:

- every golden as a bundle (one case as a `.prism` archive): every member `equal`, exit 0;
- one number changed and one key removed: exit 1, naming exactly those pointers;
- the same change accepted through a temporary divergence file: `equal-with-divergences`, exit 0;
- a changed `sourceRevisionKey`: still equal;
- route-metrics D7 applied by a member: passes, while a member without it fails.

`python3 -m prism_parity inputs` fails when a committed fixture changed after its goldens were captured.

## Accepted divergences

A divergence is accepted only when `divergences/<member>.md` names the case, says why the new output is right, and names the affected consumer (ADR §7). `divergences/<member>.json` says how the runner applies it. Each entry has an `id` and `cases`, and one or more of:

- `rule`: a built-in transform of the golden, in `prism_parity/divergences.py`, e.g. `route-metrics/via-spans-used-layers` for route-metrics D7;
- `patches`: exact RFC 6902 edits of the golden for one case;
- `ignore`: JSON-pointer patterns removed on both sides, where `*` matches any key or index. Prefer patches: an ignore also hides regressions.

A producer WP that finds a new divergence adds the prose and the entry in its own two files and never edits a golden. If a member's intended output changes, its golden is updated in the same pull request and reviewed like any other change; recapture from Python is no longer possible (below).

## Capturing goldens

> **Frozen since Wave 4 (2026-10-22).** The committed goldens were captured from the Python producers that WP-R1, R2 and R4 then removed, so the capture modules below import code (`app.services.systems`, `semantic_index_variants`, `design_compare_nodes`, `kicad_cruncher`) that no longer exists on this branch. They can only be rerun from a checkout of the baseline commit recorded in each case's `capture.json`. The goldens are now the reference; a deliberate change to a member's output updates its golden and is reviewed like any other change. This section records how they were made.

Capture runs in the backend environment, from `backend/`:

```sh
cd backend
uv run --no-project --python <backend venv python> --with-requirements ../requirements/test.txt \
  env PYTHONPATH=../native/parity python -m prism_parity capture [--cases <ids>] [--members <stems>] [--keep --scratch <dir>]
```

- It needs Node 24.22.0 (`PRISM_PARITY_NODE`, default `/opt/homebrew/opt/node@24/bin/node`), KiCad 10.0.6's `kicad-cli` (`KICAD_CLI_PATH`) and KiCad's Python with `pcbnew` (`PRISM_KICAD_PYTHON`). On macOS both are found in `/Applications/KiCad`.
- It needs the reference branch checkout `feature/analytic-pack-spike` (`--reference`), which the stackup board-looks check uses.
- Today's code is the checkout `--today` points at, by default this one. `capture.json` records its commit.
- A capture rewrites only the members it is asked for.
- KiCad's version is pinned in `prism_parity/fixtures.py` (`CURRENT_FORMAT`), so another KiCad cannot silently produce other upgraded bytes.
- **Platform.** The system-interface digest is byte-exact over floats computed with the platform's `libm` (field map, "Platform"). The committed goldens were captured on macOS arm64. If P5's Linux output differs only in a last-place rounding, recapture system-interface in the worker image and say so in P5's PR.

## The KiCad oracle

```sh
uv run … python -m prism_parity oracle [--cases <ids>] [--corpus <manifest>] [--json report.json]
```

On each case's prepared sources, KiCad 10.0.6 writes `kicad-cli sch export netlist` and `kicad-cli pcb export stats`. The oracle then checks the goldens against KiCad itself:

- netlist components and each net's (reference, pin) nodes, against the semantic index;
- board thickness and via counts by type, against stackup;
- pad counts by type, components per side and outline size, against placements.

Disagreements that the contracts explain are listed in `oracle-known.json` with the reason. Anything else fails.

## The private corpus

The corpus is the projects on a developer instance (ADR §7). It is never committed: not its manifest, not its goldens, not its reports.

1. **Write a manifest outside the repository**, in the format of `corpus.example.json`:
   - `id`;
   - `repository`, an absolute path to a git checkout, which is only read;
   - `commit`;
   - `project`, the anchor `RepoPath`;
   - optional `paths` to export and `excludedDirs`.
2. **Capture its goldens into a directory outside the repository.** The runner refuses a path inside it.

   ```sh
   cd backend
   uv run --no-project --python <venv python> --with-requirements ../requirements/test.txt env PYTHONPATH=../native/parity \
     python -m prism_parity corpus /path/outside/corpus.json --out /path/outside/goldens --scratch /path/outside/prep
   ```

   Each project's commit is exported with `git archive`, with no checkout and no write to the repository. It is upgraded and captured like a fixture. LFS pointers and submodules are not hydrated; hydrate them by hand where a project needs them.
3. **Compare bundles of the same commits:**

   ```sh
   python3 -m prism_parity compare --bundles <dir> --goldens /path/outside/goldens
   ```

4. **Run the oracle:** `python -m prism_parity oracle --corpus /path/outside/corpus.json --goldens /path/outside/goldens`.

On the development machine the corpus is the eight projects under the live instance's `data/projects`, read-only (`type1/*` and `type2/wren-hw/hw/*`, including EDA-04903).

## CI

The `native-parity` job (`.github/workflows/dev-quality-gate.yml`) runs on every PR that touches `native/` or the committed fixtures:

- the unit tests;
- `inputs`;
- `validate.mjs` on every golden;
- `selftest`.

The projections' own parity runs in the `native-workspace` job ("Projection parity on the committed fixtures"): `bundles --no-upgrade` with its debug `prism-kicad`, then `compare --members $PARITY_MEMBERS`. Each Wave 2 producer adds its members to `PARITY_MEMBERS`. The four upgraded cases and the corpus are a local or nightly job: run `bundles` with KiCad installed.
