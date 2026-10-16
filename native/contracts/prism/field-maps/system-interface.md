# Field map: projections/system-interface.json (`prism.system_interface.v1`)

Root model `SystemInterfaceV1` in `tsp/prism/system-interface-v1.tsp`. Example `examples/SystemInterfaceV1.example.json`.
Written by: P5, `native/src/rs/prism-projections/src/system_interface.rs`. Stage: parse.

This is a parity document (conventions.md §4, §5, §14). The contract is the payload of `EXTRACTOR_VERSION` 8 of today's extractor (`ie:37-38`), as `SB` §2-§4, `SB2` §8.4 and §14.6 specify it. Every field keeps today's name, unit, rounding, frame, order and null-versus-absent behaviour. The one change is the envelope: `projectId`, `commit` and `extractor` are absent from the bundle member and added by the System Builder reader (C4), see "Expected divergences" and the W0 report's open question. They are outside the digest, so the digest is identical in both forms. P5's acceptance (ADR §9.5) is identical `digest` values, defined byte for byte in "Digest" below.

ADR §6 describes this member as adding "schematic-only pin nets, pin names/types". v1 already carries all three: `nets` is captured from the schematic netlist before any board overlay (`ie:12-14`, `SB` §3), and `pinNames`/`pinTypes` are per-pin sets since extractor version 1 (`ie:141-144`, `:427-428`). The Rust producer emits nothing v1 lacks, so no v2 is needed.

**Abbreviations.** Paths are in this repository (`dev`) unless prefixed `km:` (kicad_monkey 2026.9.7, the Python wheel today's extractor imports; `.../site-packages/kicad_monkey/`).

| Short | Path |
|---|---|
| `ie` | `backend/app/services/systems/interface_extractor.py` (the producer today) |
| `cd` | `backend/app/services/systems/connector_detection.py` |
| `siv` | `backend/app/services/semantic_index_variants.py` |
| `st` | `backend/app/services/systems/store_reviews.py` (artifact cache table) |
| `jobs` | `backend/app/services/systems/jobs.py` |
| `ic` | `backend/app/services/systems/interface_cache.py` |
| `si` | `backend/app/services/systems/service_instances.py` (`GET …/instances/{iid}/interface`) |
| `sr` | `backend/app/services/systems/service_rendering.py` (system document) |
| `exp` | `backend/app/services/systems/exposure.py` |
| `dr` | `backend/app/services/systems/drift.py` |
| `val` | `backend/app/services/systems/validation.py` |
| `rec` | `backend/app/services/systems/reconcile.py` |
| `ex` | `backend/app/services/systems/exports.py` |
| `gen` | `backend/app/services/systems/generators.py` |
| `icd` | `backend/app/services/systems/icd.py` |
| `csv` | `backend/app/services/systems/csv_import.py` |
| `har` | `backend/app/services/systems/harnesses.py` |
| `sh` | `backend/app/services/systems/service_harnesses.py` |
| `sc` | `backend/app/services/systems/scene.py` |
| `spl` | `backend/app/services/systems/service_placement.py` |
| `mat` | `backend/app/services/systems/mating.py` |
| `fr` | `backend/app/services/systems/placement/frames.py` |
| `mt` | `backend/app/services/systems/placement/mate.py` |
| `mc` | `backend/app/services/catalog/module_connectors.py` (reuses `_footprint_geometry` for module connectors, `mc:51`, `:67`) |
| `fts` | `frontend/src/types/system.ts` |
| `ffr` | `frontend/src/features/system-builder/placement/frames.ts` |
| `fmt` | `frontend/src/features/system-builder/placement/mate.ts` |
| `SB` | `docs/system-builder/CONTRACTS.md` |
| `SB2` | `docs/system-builder/CONTRACTS_P2.md` |

There is no JSON Schema or TypeScript type of the whole artifact today. The closest are the prose and example in `SB` §3 (extractor version 3, before `powerNet`, `mpn`, `geometry`, `boardThicknessMm` and `boardOutlineMm`), `SB2` §14.6 (the v6 geometry example), and partial frontend types: `fts:378-386` (`InstanceInterface`: `projectId`, `commit`, `digest`, `hasPcb`, `components`), `fts:372-375` (`InstanceComponent` pins), `fts:53-66` (`SystemPort`), `fts:164-169` (`PinObservation`) and `ffr:13-30` (`PadGeometry`, `ConnectorGeometry`). They agree with this contract. They type `diagnostics`, `extractor`, `boardThicknessMm` and `boardOutlineMm` nowhere, and `ffr:23` types `side` as `"top" | "bottom"`, as here.

## Fields

Pointers are RFC 6901 with two extensions: `*` is every element of an array, `{key}` is every key of a map. One row per leaf and per array. "Required" means the key is always present. "Digested" means the value is inside the `digest` (every field except the four named in `/digest`).

### Envelope

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.system_interface.v1"` | — | required | `ie:37`, `:453` | read through `drift.evaluate`'s contract (`dr:267`); no reader switches on it | digested; unchanged |
| `/projectId` | string, ≥ 1 char | — | optional: absent in the bundle member, present in every artifact `ie` writes | `ie:454` (`str(project.id)`, `ie:477`; ids are `prj_` + 12 hex, `backend/app/services/workspace_service.py:62-63`, `:312`) | `st:379` (cache key); `si:219-232` serves it; `fts:380` | not digested. Bundle: absent. C4 adds it when it stores or serves the artifact. Parity: ignored |
| `/commit` | `GitObjectId` \| null | — | optional: absent in the bundle member; null when `ie` ran with `commit=None` (working tree, tests) | `ie:455` (`extract_for_revision`, `ie:478`) | `st:379` (cache key; table check `^[0-9a-f]{40}$`, `backend/app/services/workspace_migrations/m026_system_builder.py:186`); `fts:381` | not digested. Bundle: absent. C4 adds the commit it serves. Parity: ignored |
| `/extractor` | `SystemInterfaceExtractor` | — | optional: absent in the bundle member | `ie:456` | `st:380` (cache key `extractor_version`) | not digested. Bundle: absent. C4 adds `{version: "8", kicadMonkeyVersion: <generator id from bundle.json>}`. Parity: ignored |
| `/extractor/version` | const `"8"` | — | required within `extractor` | `ie:38` | `st:380`; `jobs:24` (job artifact key) | — |
| `/extractor/kicadMonkeyVersion` | string, ≥ 1 char | — | required within `extractor` | `ie:78-82` (distribution version or `workspace`) | none | informational |
| `/hasPcb` | boolean | — | required | `ie:380-382`, `:457` (`pcb_path` set and the file exists) | `val:126-127` (SYS-V06 not evaluated), `val:197`; `sr:169` → `fts:48`; `fts:384` | digested |
| `/boardThicknessMm` | number \| null | mm, `_round` | required; null without a board or when `(general (thickness …))` is missing or 0 | `ie:458` | `st:342-346`, `:375`; `sc:32` (board box ±t/2), `sc:132-134`; `spl:39`, `:62` → `fts:876` | digested |
| `/boardOutlineMm` | `SystemInterfaceBoardOutline` \| null | — | required; null without a board, or when the board has no board-level Edge.Cuts graphic and `get_bounds()` is empty | `ie:304-321`, `:459` | `st:342-346`; `sc:27-33` (`board_bounds`, default poses `SB2` §14.3) | digested |
| `/boardOutlineMm/minMm` | `SystemInterfaceMmPair` | mm, `_round` | `[x, y]`; board frame (+y up) | `ie:320-321` (min of x, min of negated y) | `sc:33` | — |
| `/boardOutlineMm/maxMm` | `SystemInterfaceMmPair` | mm, `_round` | `[x, y]`; board frame (+y up) | `ie:320-321` | `sc:33` | — |
| `/boardOutlineMm/source` | enum `edge_cuts` \| `items` | — | required | `ie:314`, `:319` | none (diagnostic) | `items` depends on km `KiCadPcb.get_bounds()`; see "Producer notes" 8 and the W0 open question |
| `/components` | `SystemInterfaceComponent[]` | — | required; sorted by `reference` in natural order (conventions.md §9); may be empty | `ie:389-450` (`:391`) | `exp:54`, `:65-70`; `dr:270`; `si:178-181`, `:224-228`; `rec:90`, `:122`, `:194`; `ex:57`; `csv:228-231`; `ic:81-82` | digested; order is part of the digest |
| `/diagnostics` | `SystemInterfaceDiagnostic[]` | — | required; sorted by `code`, then `portKey`, then `pad` (null as `""`), code point order; may be empty | `ie:390`, `:402-420`, `:461-463` | served by `si:219-232`; no runtime reader (SYS-V07 is recomputed from `nets`, `val:194-196`) | digested |
| `/digest` | `SystemInterfaceDigest` (`sha256:` + 64 hex) | — | required | `ie:52-62`, `:465` | `sr:169` → `fts:47`, `fts:383`; `st:388` (`digest` column); `jobs:86` | **the P5 acceptance value**; see "Digest" |

### `/components/*`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/components/*/portKey` | `KiidPath`, schematic form | — | required; an element of `memberKeys` | `ie:392` (units sorted by `(unit, key)`), `:396`, key built at `ie:122` | `exp:31`, `:66-67`, `:77`; `dr:120`, `:159`, `:171`, `:281`; `ic:82`; `si:180`; `rec:122`; diagnostics `portKey` | key = `sheet_instance_path.rstrip("/") + "/" + symbol.uuid` (`ie:105`, `:122`); same spelling as `occurrences.kiidPath` |
| `/components/*/memberKeys` | `KiidPath[]`, ≥ 1, unique | — | sorted, code point order | `ie:437` | `dr:121`, `:132-133`, `:160`; `exp:33`, `:69`, `:78`; `rec:90`; `ex:57`; `csv:188` | resolution by intersection (`SB` §2.3) |
| `/components/*/memberKeys/*` | `KiidPath` | — | — | `ie:122` | as above | — |
| `/components/*/reference` | `Refdes` | — | required; unique in `components`; never starts with `#`; may contain `?` | `ie:118-120` (instance record whose `path` equals the sheet instance path) | `dr:122`, `:152`, `:183`, `:270` (drops `?`); `exp:19`, `:34`, `:79`; `csv:228`; `si:183` | — |
| `/components/*/libId` | `LibId` | — | required, non-empty | `ie:108` (symbols without `lib_id` skipped), `:398` (lowest unit's symbol) | `dr:123`, `:153`, `:184`, `:201`, `:229-231` (connected-interface digest); `exp:35`, `:80` | — |
| `/components/*/footprint` | string, may be `""` | — | required | `ie:397`, `:399` (netlist component's `footprint`; `""` without one) | `dr:124`, `:201`, `:229-231`; `exp:36`, `:81`; `fts:58` | netlist component by reference: the *last* netlist component with that reference wins (`ie:372-375` is a dict comprehension) |
| `/components/*/value` | string, may be `""` | — | required | `ie:441` | `exp:37`; `fts:59` | — |
| `/components/*/mpn` | string ≥ 1 char \| null | — | required; null when no MPN-style field has a value | `ie:339-345`, `:400`, `:443` (fields of the netlist component, `ie:348-350`) | `val:456-458`, `:461-466` (SYS-V18); `sh:162-167` (harness-end suggestions) | field names compared after `strip().lower()`; first match in the order `mpn`, `manufacturer_part_number`, `manufacturer part number`, `mfr_pn`, `mfr. no.`, `mfr no`; value stripped |
| `/components/*/dnp` | boolean | — | required | `ie:386-387`, `:444`; `siv:752-800` (default `components` map keyed by reference); `siv:115-122` | `exp:25` (exposure), `:38`; `fts:60` | **false for every reference ending in `?`**, even with `(dnp yes)`: the resolver skips them (`siv:115-122`). The example shows it (`R?` was `R6`, `(dnp yes)`). Same resolver as P1's `assembly` (before its key translation, `siv:978-979`) |
| `/components/*/candidate` | boolean | — | required | `cd:42-65` via `ie:401` | `exp:25`, `:39`; `fts:61` | — |
| `/components/*/candidateReason` | enum `field` \| `refdes` \| `library` \| `none` | — | required | `cd:42-65` | `exp:40`; `fts:62` | `module`/`export` in `fts:62` come from `modules.py:67`/`exports.py:41`, not from this artifact |
| `/components/*/pins` | `SystemInterfacePin[]`, ≥ 1 | — | sorted by `pad` in natural order; `pad` unique | `ie:393-395` (no pins: not a component), `:412-432` | `exp:43` (pinCount), `:86-87`; `dr:115`; `val:183`; `ex:83-86`; `csv:254`; `gen:113-139` | digested in order |
| `/components/*/geometry` | `SystemInterfaceGeometry` \| null | — | required; null without a board or when no footprint's `Reference` property equals `reference` | `ie:255-262` (first footprint in file order wins), `:384`, `:448` | `mat:18`, `:35-36`, `:49`; `sc:127-136`, `:270-276`; `spl:62`, `:66`; `fr` (inference, `F_c`); `mt:60-110`; `ffr:22-30`; `mc:51`, `:67` (same shape for module connectors) | KiCad 7 footprints (reference in `fp_text reference`) get null today; see "Expected divergences" |

### `/components/*/pins/*`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/pins/*/pad` | `PadNumber`, ≥ 1 char | — | required | `ie:136-138` (netlist terminal `pin`; empty skipped); km `kicad_netlist_compiler.py:406-408` (`~` read as empty) | `exp:86-87`; `dr:115`; `val:183-192`; `ex:83-85` | string, never coerced (`SB` §2.4) |
| `…/pins/*/nets` | `NetName[]`, unique | — | sorted, code point order; may be empty | `ie:47-49` (`normalized_nets`), `:139-140`, `:415` | `dr:115` (drift); `val:194-200` (SYS-V07, V06); `sr:220`; `gen:102`; `ex:85`; `csv:254` | removes `""` and `unconnected-(…)`; full hierarchical names from the schematic netlist before any board overlay |
| `…/pins/*/nets/*` | `NetName` | — | — | km netlist net `name` (`ie:133`) | as above | net naming must equal km 2026.9.7 `to_netlist()` (shared risk with P1) |
| `…/pins/*/pcbNets` | `NetName[]`, unique \| null | — | sorted, code point order; null without a board or when no footprint with this `Reference` property has a pad with this number | `ie:148-165` (all footprints with the reference, pads with a non-empty number, net name or `""`), `:421`, `:426` | `val:197-200` (SYS-V06 `pcb_out_of_sync`); `sr:220` → `fts:166` | same filtering as `nets` (the `""` of a no-net pad and `unconnected-(…)` are removed, giving `[]`) |
| `…/pins/*/pcbNets/*` | `NetName` | — | — | board pad `(net …)` name (`ie:162-164`) | as above | — |
| `…/pins/*/pinNames` | string[] (each ≥ 1 char), ≥ 1, unique \| null | — | sorted, code point order; null when no pin on this pad has a non-empty name | `ie:141-142`, `:427` | `sr:221` → `fts:167`; `ex:86`; `icd:90` (ICD pin-name column); `gen:139`; `csv:254` | kept as written: KiCad 9 files write `~` for "no name" (kept, `["~"]`), KiCad 10 files write `""` (dropped, null). Both occur in our fixtures (`fixtures/release-studio/usb-pd` vs the user's KiCad 10 copy) |
| `…/pins/*/pinNames/*` | `SystemInterfacePinName` | — | — | km netlist terminal `pin_name` | as above | — |
| `…/pins/*/pinTypes` | enum[] (12 KiCad tokens), ≥ 1, unique \| null | — | sorted by string value, code point order; null when no pin on this pad has a type | `ie:143-144`, `:428`; km `kicad_sch_enums.py:12-37`, `kicad_netlist_compiler.py:1086-1092` | `sr:221` → `fts:168`; `ex:86` | lower-case file tokens (`power_in`), not the semantic index's `POWER_IN` |
| `…/pins/*/pinTypes/*` | `SystemInterfacePinType` | — | — | as above | as above | seen in the fixtures: `passive`, `bidirectional`, `power_in`, `input`, `output`, `no_connect`, `power_out`, `unspecified`, `open_collector` |
| `…/pins/*/powerNet` | boolean | — | required | `ie:324-336` (power-flagged lib symbols' `Value`s over the whole hierarchy), `:430` | `val:226-227` (SYS-V10); `gen:102`; `har:175`; `ex:85`; nulled by redaction `si:209` | `SB2` §8.4 also names `#PWR`/`#FLG` references; the code checks only the lib symbol's `power` flag. P5 follows the code |

### `/components/*/geometry`

All numbers are `_round`ed (`ie:168-170`). Frames: "board" is `SB2` §14.2 (KiCad x, −KiCad y, page origin); "footprint" is the footprint's own frame with +y up, before rotation and flip.

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/geometry/side` | enum `top` \| `bottom` | — | required | `ie:243-245` (`bottom` when the layer starts with `B.`) | `fr:80`, `:205`; `mt:110`; `ffr:23` | not Common `Side` (parity) |
| `…/geometry/positionMm` | `SystemInterfaceMmPair` | mm | `[x, y]`, board frame | `ie:218`, `:246` (`[x, −y]`) | `fr:34-35`; `mt:108` | — |
| `…/geometry/rotationDeg` | `Degrees` | deg, rounded to 1e-4 | required | `ie:216`, `:247` (`at_angle or 0.0`) | `fr:34`, `:40`; `mt:107` | not normalized |
| `…/geometry/footprintName` | string | — | required; may be `""` | `ie:248` (`library_link.split(":")[-1]`) | `fr:81`; `ffr:136` (keyword inference) | — |
| `…/geometry/pads` | `SystemInterfacePad[]` | — | sorted by `pad` in natural order; equal numbers keep file order (stable sort); may be empty | `ie:226-236` | `fr:45`, `:54-55`, `:60`, `:131-135`, `:142-144`, `:197`; `mt:60-62`, `:104`; `mc:70`, `:185` | Rust must use a stable sort |
| `…/geometry/pads/*/pad` | `PadNumber`, may be `""` | — | required | `ie:230` | `fr:54`, `:131-135`; `mt:62`; `mc:185` | `""` for unnumbered pads (mounting/alignment holes) |
| `…/geometry/pads/*/positionMm` | `SystemInterfaceMmPair` | mm | `[x, y]`, board frame | `ie:220-224`, `:231` | `fr:45`, `:60`, `:142-144`, `:212`; `mt:62`, `:104` | formula in "Producer notes" 7 |
| `…/geometry/pads/*/sizeMm` | `SystemInterfaceMmPair` | mm | `[width, height]`, pad frame | `ie:232` (`size_x or 0.0`, `size_y or 0.0`) | none at runtime (`ffr:16` types it) | digested only |
| `…/geometry/pads/*/shape` | enum `circle` \| `rect` \| `oval` \| `trapezoid` \| `roundrect` \| `custom` | — | required | `ie:233`; km `kicad_base.py:93-99`, `kicad_pad.py:451` | none at runtime (`ffr:17`) | digested only |
| `…/geometry/pads/*/tht` | boolean | — | required | `ie:228`, `:234` (`thru_hole` or `np_thru_hole`) | none at runtime (`ffr:18`) | digested only |
| `…/geometry/courtyard` | `SystemInterfaceCourtyard` \| null | — | required; null without courtyard graphics | `ie:180-196`, `:237-242` | `fr:84-92`; `mt:100-102`; `ffr:139-150`; `fmt:135-137` | items on a layer whose name contains `CrtYd` |
| `…/geometry/courtyard/minMm` | `SystemInterfaceMmPair` | mm | `[x, y]`, footprint frame | `ie:240-242` | `fr:92`; `mt:101` | arcs by start/mid/end only (not true extent) |
| `…/geometry/courtyard/maxMm` | `SystemInterfaceMmPair` | mm | `[x, y]`, footprint frame | `ie:240-242` | `fr:92`; `mt:102` | — |
| `…/geometry/model` | `SystemInterfaceModelRef` \| null | — | required; null without a model | `ie:199-210`: the first model. `_model` skips a model whose `to_sexp()` holds `(hide)` / `(hide yes)`, but km `Model.to_sexp()` never writes `hide` (km `kicad_model.py:58-63`), so today a hidden model is never skipped (golden `rs-cynthion` U1) | none at runtime (`ffr:29`; "M1 never loads it", `SB2` §14.6) | digested only |
| `…/geometry/model/path` | string | — | required | `ie:205` | none | unresolved, variables kept |
| `…/geometry/model/offsetMm` | number[3] | mm | `[x, y, z]` | `ie:206` | none | — |
| `…/geometry/model/rotationDeg` | `Degrees`[3] | deg | `[x, y, z]` | `ie:207` | none | — |
| `…/geometry/model/scale` | number[3] | — | `[x, y, z]` | `ie:208` | none | — |

### `/diagnostics/*`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/diagnostics/*/code` | enum `unannotated_connector` \| `unannotated_component` \| `pin_net_ambiguous` | — | required | `ie:403-410` (`"?" in reference`; connector when `candidate`), `:416-420` (more than one net) | none at runtime; same names as `val:28`, `:295`, `frontend/src/features/system-builder/findings-ui.tsx:39` | snake_case kept (parity) |
| `/diagnostics/*/portKey` | `KiidPath` | — | required | `ie:405`, `:408`, `:418` | none | — |
| `/diagnostics/*/pad` | `PadNumber` ≥ 1 char \| null | — | required; null for `unannotated_*` | `ie:405`, `:408`, `:418` | none | — |
| `/diagnostics/*/detail` | string | — | required | `ie:406`, `:409`, `:419` | none | digested: the text must be reproduced exactly: `f"{reference} is not annotated"`, `f"{reference}.{pad} carries {n} schematic nets"` |

### Digest

`digest` is what P5 must reproduce. Today (`ie:42-44`, `:52-62`, `:465`):

1. **Body:** the top-level object without the keys `digest`, `extractor`, `projectId` and `commit`. The body therefore has exactly the keys `schema`, `hasPcb`, `boardThicknessMm`, `boardOutlineMm`, `components` and `diagnostics`. A bundle member lacks three of the four, so its body is the member without `digest`.
2. **Text:** Python `json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`:
   - objects: keys sorted in code point order at every level (all keys are ASCII); `{`, `}`, `:` and `,` with no whitespace;
   - arrays: in document order, so every order rule above is part of the digest;
   - strings: `"…"` with `"` → `\"`, `\` → `\\`, U+0008 → `\b`, U+000C → `\f`, U+000A → `\n`, U+000D → `\r`, U+0009 → `\t`, every other U+0000–U+001F → `\u00xx` (lower-case hex). Everything else is written raw, including non-ASCII (`±` occurs in `rs__cynthion`), U+007F, U+2028/U+2029 and `/`;
   - numbers: every number in the body is a Python `float` from `_round` (there is no integer field), written as Python's `repr`: the shortest digits that round-trip, decimal notation, at least one fractional digit (`1.6`, `100.0`, `-90.0`, `0.0`, `0.0001`). `repr` uses an exponent only below 1e-4 or at 1e16 and above (`1e-05`, `1e+16`), and `_round` makes both impossible: a non-zero value is at least 1e-4 in magnitude, and board coordinates are far below 1e16;
   - `true`, `false`, `null`.
3. **Hash:** SHA-256 of the UTF-8 bytes, lower-case hex, prefixed `sha256:`.

**Rust recipe.** Build the typed member, convert to `serde_json::Value`, remove `"digest"`, and hash `serde_json::to_vec(&value)` (compact). This matches Python only under these conditions, each of which P5 must test:

- `serde_json`'s `preserve_order` feature is **off** in the whole build. Its `Map` is then a `BTreeMap`, which sorts keys by bytes, which is code point order. Any crate in the workspace enabling `preserve_order` (feature unification) silently breaks the digest. Assert it in a test.
- `arbitrary_precision` is off. `f64` is then written by `ryu`: the same shortest digits as Python's `repr`, `1.0` for integral values. It differs from `repr` only in exponent form (`1e-5`/`0.00001` vs `1e-05`, `1e16` vs `1e+16`), which `_round` excludes (above). The producer asserts `x == 0.0 || 1e-4 <= |x| < 1e15` for every number it writes.
- Negative zero is folded **before** serializing (`v + 0.0`, as `_round` does). `serde_json` writes `-0.0` literally.
- `serde_json` escapes exactly the characters Python's `ensure_ascii=False` escapes, with the same short forms and lower-case `\u00xx`.

**`_round` in Rust.** Python's `round(v, 4)` rounds the exact binary value to 4 decimals with ties to even (`_Py_dg_dtoa` mode 3), then `+ 0.0`. A port is `format!("{:.4}", v).parse::<f64>().unwrap() + 0.0`, provided Rust's fixed-precision formatting rounds exact ties to even; P5 pins that with these vectors (Python 3.12):

| input | `round(v, 4) + 0.0` |
|---|---|
| `0.03125` | `0.0312` (exact tie, to even) |
| `0.09375` | `0.0938` (exact tie, to even) |
| `100.03125` | `100.0312` (exact tie) |
| `-0.03125` | `-0.0312` |
| `1.00005` | `1.0001` (binary value above the tie) |
| `123.45675` | `123.4567` (binary value below the tie) |
| `-0.00005` | `-0.0001` |
| `-0.00004` | `0.0` (negative zero folded) |
| `2.675` | `2.675` |

**Test vector.** `examples/SystemInterfaceV1.example.json` is self-consistent: its `digest` (`sha256:3b411eff…fcb7`, over 3,874 canonical bytes) is the digest of its own body. The example is written in the conventions' canonical text (`JSON.stringify`), which drops `.0` from integral floats, so read it with every number as a double to recompute the digest: Python `json.loads(text, parse_int=float)`, Rust `f64` fields. The real outputs listed under "How a golden is produced" are the main vectors.

### Producer notes (what P5 ports, in today's evaluation order)

1. **Occurrences** (`ie:95-124`): for each sheet instance in km `schematic_instances()` order, each symbol of that sheet with a non-empty `lib_id`, the symbol's `(instances … (path P …))` entry whose `P` equals the sheet instance path. Skip an empty reference or one starting with `#`. `unit = entry.unit or symbol.unit or 1`. Key = `P.rstrip("/") + "/" + symbol.uuid`. Group by reference.
2. **Schematic pins** (`ie:127-145`): over km `design.to_netlist()` nets and their terminals; skip a terminal with an empty designator or pin. Add the net name (`""` is removed later), the pin name if non-empty, and the pin type if non-empty. Virtual (`#`) designators are not netlist terminals (km `kicad_netlist_design.py:1246-1247`). A `(designator, pin)` appears at most once per net, but may appear on several nets (the `pin_net_ambiguous` case).
3. **Components** (`ie:391-450`): references with at least one schematic pin, in natural order. Units sorted by `(unit, key)`; the first gives `portKey` and `libId`. `footprint`, `value` and the MPN fields come from the netlist component with that reference. Detection and diagnostics are computed per component.
4. **Pins** (`ie:413-432`): pads in natural order; `nets` normalized; one `pin_net_ambiguous` per pad with more than one net; `pcbNets`; `pinNames` and `pinTypes` sorted, or null when empty; `powerNet`.
5. **Power nets** (`ie:324-336`): every placed symbol in the whole hierarchy (`walk_symbols`) whose library symbol has the `power` flag contributes its `Value` property, if non-empty.
6. **Board** (`ie:380-384`): `hasPcb` = the configured board path is set and is a file (`ie:483-505` resolves `.prism.json`; the bundle uses `revision.config.board`). Pad nets: every footprint with a `Reference` *property* (not `fp_text reference`), every pad with a non-empty number, the pad's net name or `""`. Geometry: the first footprint per `Reference` property.
7. **Board frame** (`ie:216-224`): `a = radians(angle) = angle * (π / 180)`, `c = cos(a)`, `s = sin(a)`. For a footprint-local point `(lx, ly)` and anchor `(fx, fy)`: `x = (fx + lx*c) + ly*s`, `y = (fy − lx*s) + ly*c`, result `[_round(x), _round(−y)]`. Keep this evaluation order, no fused multiply-add, and the platform's `cos`/`sin` (CPython calls the C library's; run goldens and P5 on the same platform, see below).
8. **Outline** (`ie:265-321`): points of every board-level (`owner_kind == "board"`) Edge.Cuts carrier: line and rectangle ends; circle centre ± radius (`math.hypot`); arc ends, mid point and every quarter-axis crossing in its sweep (`_arc_points`, Python float `%` semantics); polygon and curve points. With no point, fall back to km `KiCadPcb.get_bounds()` (km `kicad_pcb.py:980-1030`): every footprint (pads, all properties including hidden ones, texts estimated as `len(text) × size_x × 0.7` by `size_y`, km `kicad_property.py:77-110`, graphics), tracks, vias, arcs, zones and board graphics. `source: "items"`, unless that box is empty (null). All 14 P1 fixture boards with a board (`mini_obc` ×12, `mini_power` ×2) take this fallback. Reproducing it is the W0 open question.
9. **Arithmetic hazards**: `math.hypot` in CPython ≥ 3.8 is its own implementation, not the C library's `hypot`; Rust's `f64::hypot` calls the C library. Python `%` on floats takes the divisor's sign (use `rem_euclid` and check the `-0.0`/`== τ` edges). Values are rounded to 1e-4 afterwards, so these matter only at rounding boundaries, but the digest is byte-exact.
10. **Empty forms**: with no board, `hasPcb` is false and every board field is null. With no schematic, see "Expected divergences".

## How a golden is produced from today's code

On `dev` (or the reference branch, whose `interface_extractor.py` is identical), with the offline backend environment:

```sh
cd backend && uv run --offline --no-project \
  --python <venv>/bin/python --with-requirements ../requirements/test.txt \
  python <script.py>
```

`<script.py>` loads each design the way `extract_for_revision` does and runs the extractor:

```python
from types import SimpleNamespace
from app.services.systems import interface_extractor as ie
snapshot = SimpleNamespace(root=pro.parent.resolve(), project_file=pro.resolve(), commit=None)
payload = ie.extract_interface(pro, project_id="prj_x", commit=None, design=ie.load_configured_design(snapshot))
golden = {k: v for k, v in payload.items() if k not in ("projectId", "commit", "extractor")}
```

For git-backed corpus projects, use `ie.extract_for_revision(project, commit)` (`ie:469-480`) and drop the same three keys. `KiCadDesign.from_project_file` (the tests' path, `backend/tests/test_system_interface_extractor.py:37-43`) gave the same digest as `load_configured_design` on every fixture below.

**Comparison (P5 acceptance).** (1) `member.digest == golden.digest`. (2) For diagnosis, JSON value equality (conventions.md §14) of the member and the golden. Value equality is weaker than (1), because `1` equals `1.0` as a value but not in the digest. Nothing in the member is non-semantic: `generatedAt` does not exist, and the three envelope keys are absent on both sides.

**Platform.** Capture goldens in the worker image (Linux, glibc, the Python and kicad_monkey of `requirements/`), where P5 runs. The board-frame `cos`/`sin` and the outline's `atan2`/`hypot` come from the platform's math library, and a last-place difference flips a 1e-4 rounding boundary only rarely, but the digest is byte-exact. The digests below were computed on macOS (Python 3.12.13, kicad_monkey 2026.9.7).

### Reference digests (today's extractor, W0 run)

Every output below validates against `SystemInterfaceV1`, both as written (with `projectId`, `commit`, `extractor`) and in member form (without them).

| Project | Components | Pins | Board | Outline | Digest (prefix) |
|---|---|---|---|---|---|
| `backend/tests/fixtures/system_builder/sources/mini_obc/F0` | 6 | 36 | yes | items | `75911dfb0330a4cf…` |
| `…/mini_obc/F1` | 6 | 36 | yes | items | `6b6384698658604b…` |
| `…/mini_obc/F2` | 6 | 36 | yes | items | `99924a2772a88209…` |
| `…/mini_obc/F3` | 6 | 36 | yes | items | `8a907cd4e99bcabf…` |
| `…/mini_obc/F4` | 6 | 40 | yes | items | `fcae7bcb73136d89…` |
| `…/mini_obc/F5` | 6 | 36 | yes | items | `966f4309455ce829…` |
| `…/mini_obc/F6` | 6 | 36 | yes | items | `75911dfb0330a4cf…` (= F0: README-only step) |
| `…/mini_obc/F7` | 6 | 36 | yes | items | `88d37b27b7f20a37…` |
| `…/mini_obc/F8` | 6 | 36 | yes | items | `f2004566c1fd08b5…` |
| `…/mini_obc/F9` | 5 | 32 | yes | items | `d1c91fde7b390293…` |
| `…/mini_obc/F11.1` | 6 | 36 | yes | items | `6b6384698658604b…` (= F1) |
| `…/mini_obc/F11.2` | 6 | 36 | yes | items | `130341d7adfa9b62…` |
| `…/mini_payload/F0` | 5 | 27 | no | — | `bf30390149edf21e…` |
| `…/mini_power/F0` | 3 | 10 | yes | items | `06dc439db5ee97d1…` |
| `…/mini_power/F10` | 3 | 8 | yes | items | `583ec68a7a5b3030…` |
| `backend/tests/fixtures/system_builder/p2/sources/ambiguous/F0` | 1 | 10 | yes | edge_cuts | `092248b75cace8f3…` |
| `…/p2/sources/edge_a/F0` | 2 | 8 | yes | edge_cuts | `4bbc482c256e1a65…` |
| `…/p2/sources/edge_b/F0` | 2 | 8 | yes | edge_cuts | `82a0a646873f7317…` |
| `…/p2/sources/mezz_base/F0` | 2 | 240 | yes | edge_cuts | `3cea1cfc3f6adbae…` |
| `…/p2/sources/mezz_top/F0` | 2 | 240 | yes | edge_cuts | `260a32f3193d41f5…` |
| `…/p2/sources/mezz_top/F1` | 2 | 240 | yes | edge_cuts | `d7d45a050ac4965f…` |
| `fixtures/release-studio/usb-pd` | 37 | 133 | yes | edge_cuts | `1bb9e793e93dc7e5…` |
| `fixtures/release-studio/synthetic` | 2 | 4 | yes | edge_cuts | `fd672984113723d2…` (KiCad 7 references: no geometry) |
| `fixtures/release-studio/cynthion` | 344 | 1342 | yes | edge_cuts | `eec5e25bc8b45531…` (KiCad 7 board: no geometry, all `pcbNets` null) |
| `backend/tests/fixtures/design_variants/case_fold` | 2 | 4 | yes | edge_cuts | `6a3adcebcf1a2a1c…` |
| `…/design_variants/kicad11_tokens` | 1 | 2 | yes | edge_cuts | `e25210aa095c90e3…` |
| `…/design_variants/legacy_in_bom` | 2 | 4 | no | — | `52fb32ffe8ab6bb8…` |
| `…/design_variants/no_variants` | 1 | 2 | yes | edge_cuts | `333e7336484c93ab…` |
| `…/design_variants/oracle` | 13 | 29 | yes | edge_cuts | `a26c851cd5ac4362…` |
| `…/design_variants/oracle_rev2` | 13 | 29 | yes | edge_cuts | `a26c851cd5ac4362…` |
| `…/design_variants/rule_area` | 2 | 4 | no | — | `bc614f3a7589f446…` |
| `…/design_variants/sch_only` | 1 | 2 | no | — | `b52286e0d1bd261c…` |
| `…/design_variants/malformed` | — | — | — | — | extraction fails (`SexprTreeError`): stage parse fails, no member |
| user's `USB-PD-Trigger-Board` (KiCad 10, read-only) | 37 | 133 | yes | edge_cuts | `b9622a24741c6541…` (differs from the KiCad 9 fixture copy only in `pinNames`: `""` vs `~`) |

None of the committed fixtures produces a diagnostic. The diagnostics, `pcbNets: null` beside a board and the unannotated `dnp` behaviour were exercised on a scratch copy of `fixtures/release-studio/usb-pd` (see "Example provenance"). A project without a schematic made today's extractor raise (below).

## Expected divergences

| Case | Today | Bundle | Why the bundle is right | Consumer affected |
|---|---|---|---|---|
| Envelope | `projectId`, `commit` and `extractor` always present (`ie:454-456`) | absent from `projections/system-interface.json`; C4 adds them when it stores or serves the artifact (`projectId` and `commit` of the request; `extractor.version: "8"`, `kicadMonkeyVersion`: the bundle's generator id) | conventions.md §4.2: a projection carries no provenance, so a member whose sources did not change keeps its sha256 across commits; the producer does not know the project or the commit (the bundle is keyed by revision key) | none after C4: `st:379-380` and `fts:380-381` get them from C4. Outside the digest. **Pending the W0 open question** |
| Project without a schematic | `design.to_netlist()` raises `ValueError` (km `kicad_design.py:739`); the job fails permanently with `source_unavailable` (`jobs:77-80`); no artifact | the member in its empty form: `components: []`, `diagnostics: []`, board fields as usual (bundle-format.md §2.1: projections are never left out as not applicable) | there is no interface to report: zero components is the true answer, not an error | System Builder shows the board as ready with no ports instead of "failed". **Pending the W0 open question** |
| KiCad 7-format footprints (`(fp_text reference "R1")`, no `Reference` property) | `_reference` and `_board_pad_nets` read only the `Reference` property (`ie:153-155`, `:173-177`): every such footprint has `geometry: null` and every pin `pcbNets: null` although `hasPcb` is true (`fixtures/release-studio/cynthion`, 344 components; `…/synthetic`, 2) | *if accepted*: the footprint's reference designator as KiCad reads it (property, or `fp_text reference`); geometry and `pcbNets` present; digests change on those boards only | today every row on such a board raises SYS-V06 `pcb_out_of_sync` (`val:197-200`) and the connectors cannot mate or be placed | SYS-V06, mating, scene. No System Builder fixture is affected (all KiCad 10). **Pending the W0 open question**; until it is decided P5 reproduces today's behaviour |

These are **not** divergences. P5 reproduces them, and WP-G's runner flags them if they change:

- `pinNames` kept as written (`~` kept, `""` dropped);
- `dnp` false for references ending in `?`;
- the first footprint per reference for `geometry`, but every footprint for `pcbNets`;
- the last netlist component per reference for `footprint`, `value` and `mpn`;
- arcs in courtyards bounded by three points, but outline arcs by their true extent;
- `boardThicknessMm` null for a zero thickness;
- the `items` outline fallback's text-size estimate (unless the open question decides otherwise).
- the first model per footprint for `geometry/model`, hidden or not (see the row);
- **not reproduced:** a board `gr_text` box in the `items` fallback. km's `GrText` has no `get_bounds` of its own and inherits `ToPolyMixin.get_bounds`, which renders FreeType glyph outlines from a host font (km `kicad_text.KiCadTextRenderer`), so today's box depends on the machine's fonts. P5 uses the estimate of km's other board `GrText` (km `kicad_pcb_graphics.py:92-111`). On `rs-cynthion` this changes the board's `get_bounds` (`maxMm[0]` 200.16 today against 420.30), but its outline comes from Edge.Cuts, so no fixture's member changes. A board with no Edge.Cuts and board text would diverge; record it under this table if one appears.

## Example provenance

`examples/SystemInterfaceV1.example.json` is a trimmed real output of today's extractor (`EXTRACTOR_VERSION` 8, kicad_monkey 2026.9.7) on a scratch copy of the committed fixture `fixtures/release-studio/usb-pd`, with three edits so that every diagnostic code and every null case appears (no committed fixture produces a diagnostic):

1. `USB-PD-Trigger-Board.kicad_sch:1721`: library pin `A5` (CC1) of `Pixxel_Connectors:USB4056-03-A` renumbered `A4`, so J1 pad `A4` carries two schematic nets (`pin_net_ambiguous`; `pinNames` `["CC1", "VBUS_A"]`; `pcbNets` from the unchanged board).
2. `Subsheets/Output-Connector.kicad_sch:530`, `:655`: `J2` re-annotated `J?` (`unannotated_connector`; `geometry` and `pcbNets` null because the board still says `J2`; `mpn` null; a three-level `portKey`).
3. `USB-PD-Trigger-Board.kicad_sch:11744`, `:11834`: `R6` (`(dnp yes)`) re-annotated `R?` (`unannotated_component`; `dnp` false, see `/components/*/dnp`).

Trimmed to 4 of 37 components: `J1`, `J?`, `Q1` (two units, so `portKey` is the second of the sorted `memberKeys`), `R?`. Pins trimmed to J1 `A4` and `B8` (`nets: []`, `pcbNets: []`) and the first pin of the others. Pads trimmed to J1's first unnumbered pad (`pad: ""`) and Q1's first. `projectId` (`prj_` + 12 hex, the workspace id format) and `commit` (this worktree's `HEAD`) are placeholders, because the scratch copy has neither. The `digest` was recomputed over the trimmed document with `interface_digest`, so the example is a digest test vector (see "Digest"). Written in canonical form (`JSON.stringify(doc, null, 2)` + LF).

Not shown in the example, but covered by the real outputs above: `hasPcb: false` with every board field null (`mini_payload/F0`), `source: "items"` (`mini_obc`, `mini_power`), `side: "bottom"` (`p2/mezz_top`), `candidateReason` `field` (`mini_payload/F0` TP1 true, J9 false), `pinNames: null` (the user's KiCad 10 USB-PD board), `courtyard: null` and `model: null` (`mini_*`), `dnp: true` (`mini_power/F0` J8), `commit: null` (`extract_interface(..., commit=None)` on `p2/mezz_base/F0`).
