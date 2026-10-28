# Divergences: component-models

- Member: `viewer/models/components.glb`, role `component-models`, stage `models` (bundle-format.md §2.1)
- Producer: WP-V1. The backend exports it (`backend/app/services/design_bundle/stage_models.py`, cached by board blob, 3D-model blobs, KiCad version and models procedure); `prism-kicad bundle build --stage models --models-glb` checks it, canonicalizes `generated_at` and copies it (cli-spec.md §5.2.4, §9.3).
- Today: the topology compiler's component export (`kicad-prism-viewer/pipeline/topology_compiler/kicad_cli_export.py:135-143`), the same `kicad-cli pcb export glb --force --no-board-body`.
- Check: `native/parity/component_models_check.py` exports each board both ways, from two copies of its sources, and compares the GLBs' binary chunks and their JSON chunks without `asset.extras.generated_at`.

**No divergences.** The GLB equals today's for the same KiCad.

## Acceptance run (2026-10-18)

KiCad 10.0.6 (the generator's), macOS arm64, on the prepared parity sources:

| Case | Result | Bytes | Meshes | Member SHA-256 | Model paths |
|---|---|---|---|---|---|
| `rs-usb-pd` | identical | 1,360,412 | 41 | `ec4b495a…` | `${KICAD9_3DMODEL_DIR}`, `${KIPRJMOD}` (3 files in the repository), embedded |
| `rs-cynthion` | identical | 3,788,952 | 51 | `6d96088f…` | `${KICAD6_3DMODEL_DIR}`, `$(KIPRJMOD)` (4 files in the repository) |
| `dv-oracle` | identical | 285,680 | 16 | `d2dbe40d…` | `${KICAD10_3DMODEL_DIR}` |
| `rs-synthetic`, `sb-mini_obc-F0`, `sb-mini_power-F0` | identical | 376 | 0 | `0c71008f…` | none (the boards have no models) |

`rs-usb-pd`'s member digest is the one the manifest example records (`examples/BundleManifestA2.example.json`), measured independently when the contract was written.

The private corpus's EDA-04903 also exports identically, but its prepared copy holds none of its 1,485 referenced model files, so both GLBs are empty and the run proves nothing about it. A board whose models are missing is covered by `model-unavailable` (bundle-format.md §2.2): the export builds without those bodies, as KiCad does.

## The 3D tab's other inputs

The reference branch's analytic 3D tab (`feature/analytic-pack-spike`: `kicad-prism-viewer/viewer/src/analytic-*.js`) reads five inputs. Each is a bundle member or derived from one, so C5 needs no new member:

| Input | Today (reference branch) | Bundle |
|---|---|---|
| board body, copper and layer slices | `board.kmpack` from `prism-kicad-native emit-pack` | `materialization/board.kmpack` (stage board) |
| solder mask colour per side | `semantic_geometry.json` `board_looks.soldermask`, from `board_looks.py` | `projections/stackup.json` `maskColors` (P3; stackup.md field map) |
| paste colour | `board_looks.paste`, a constant (`PASTE_COLOR`) | the same constant, in the renderer |
| component bodies | `geometry/components.glb` | `viewer/models/components.glb` |
| board frame shift (`boardZOffsetMm`), which aligns the analytic board with the GLB | the compiler's manifest, from the stackup's copper layers (`semantic_gltf.py` `_set_canonical_board_y_range`, `board_frame`) | the same function over `projections/stackup.json`'s copper layers, ported with the renderer in C5 |
