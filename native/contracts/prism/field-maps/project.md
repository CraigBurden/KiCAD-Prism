# Field map: `projections/project.json` (`prism.project.a0`)

Root model `ProjectA0` in `tsp/prism/project-a0.tsp`. Example `examples/ProjectA0.example.json`.
Written by: WP-P4, `native/src/rs/prism-projections/src/project.rs`. Stage: parse.

The member holds the project-level facts of one KiCad project:
- the `.kicad_pro`'s name, text variables and net classes;
- one header record per schematic file of the hierarchy and per board;
- every path reference those files make, raw and resolved.

It replaces four readers of the same files:

| Today's reader | What it reads | Re-derived from this member by |
|---|---|---|
| **Card**: the project properties panel. `backend/app/services/project_metadata_service.py:157-205` calls `project_properties_service.py:260-338`, stores the row, and `backend/app/api/projects.py:1155-1185` serves it | root schematic and board: `(version)`, `(generator)`, `(generator_version)`, title and date of the title block expanded with the project's text variables | project metadata (flag `PROJECT_METADATA`), rules "Card" below |
| **Closure**: Release Studio's input closure. `backend/app/release_studio/closure.py:1003-1082` (`_resolve_project_paths`), `closure_models.py:120-235` (`resolve_model`), `closure_references.py:25-126` | every path reference of the design files: 3D models, library-table URIs and `${VAR}` path text | C3, rules "Closure" below |
| **3D**: the 3D pipeline's net classes. `kicad-prism-viewer/pipeline/topology_compiler/board_metadata.py:52-87`, copied at `:129` | `.kicad_pro` `net_settings.classes[]` | C5, rules "3D" below |
| **Catalog import** model lookup. `backend/app/services/project_component_asset_extractor.py:188-215` (`_resolve_model_path`), `:322-336` (`_embedded_model`) | one footprint's `(model …)` path, resolved by hand, with an embedded fallback | C7, joined through `placements` ("Relations") |

New consumers that nothing serves today:
- **V1/K, components GLB cache key.** cli-spec.md §9.3 keys the GLB by "the blob ids of the repository model files it references". These are the `model-3d` references whose target is `repository` with `inSources` true, mapped to their revision-key entries.
- **Revision-key audit (K, B).** A `repository` target with `inSources: false` is a file KiCad would read that the key does not hash ("Cross-contract notes").

On every committed fixture tried, the three re-derivable readers (Card, Closure, 3D) re-derive from a prototype of this member. The only differences are the documented divergences ("How a golden is produced").

Sources for the Rust producer:
- `.kicad_pro`:
  - text variables: fork `src/rs/kicad-monkey-core/src/project.rs:180-198` (`ProjectView::text_variables`);
  - net classes: `:307-316` and `:603-657` (`net_settings`, `net_classes`; values are `f64` millimetres);
  - non-string values: `:945-952` (`project_string`).
- S-expression files: fork `src/rs/kicad-monkey-core/src/sexpr.rs:293-330` (`parse_with_limits`).
- Headers:
  - fork `plotter_ir.rs:106-168` and `schematic_plotter_ir.rs:1024` read `version`/`generator`/`generator_version`;
  - title blocks: `document_metadata.rs:20-28` (`KiCadTitleBlock`), `schematic_bundle/title_block.rs`, `pcb/extended.rs`.
- Sheet files: fork `schematic_bundle.rs:570` (`Sheetfile` / `Sheet file`; the first property wins).
- Embedded files:
  - shared metadata: fork `embedded_resource.rs:14-45` (owner, name, type);
  - board and footprint owners: `pcb/indexing.rs:226-250`, `:410-440`, `pcb/view_resources.rs:10-45`;
  - schematic: `schematic_embedded.rs:52-60`.
- KiCad's own behaviour, which the resolution rules follow (KiCad source checked at master `1be56ef5`, 10.99; the same code paths `closure_models.py:32-34` cites for 10.0.4):
  - `common/filename_resolver.cpp:242-500` (`ResolvePath`);
  - `common/common.cpp:520-786` (`KIwxExpandEnvVars`, `ExpandEnvVarSubstitutions`);
  - `common/env_vars.cpp:38-100`, `:158-161` (predefined and deprecated variables);
  - `common/project.cpp:81-122` (`PROJECT::TextVarResolver`);
  - `common/libraries/library_manager.cpp:989-996` (`GetFullURI`);
  - `pcbnew/exporters/step/exporter_step.cpp:576-582` (embedded lookup: footprint first, then board);
  - `eeschema/eeschema_config.cpp:102-104` (schematic drawing sheet: project directory, schematic's embedded files).

## Fields

Pointers are RFC 6901 with two extensions: `*` is every element of an array,
`{key}` is every key of a map. One row per leaf and per array/map.

Abbreviations:
- `pms:` `backend/app/services/project_metadata_service.py`;
- `pps:` `backend/app/services/project_properties_service.py`;
- `ktv:` `backend/app/services/kicad_text_variables.py`;
- `api:` `backend/app/api/projects.py`;
- `pane:` `frontend/src/components/workspace/workspace-project-properties-sheet.tsx`;
- `cl:` `backend/app/release_studio/closure.py`;
- `cm:` `backend/app/release_studio/closure_models.py`;
- `cr:` `backend/app/release_studio/closure_references.py`;
- `rmi:` `backend/app/services/release_studio_model_inputs.py`;
- `bm:` `kicad-prism-viewer/pipeline/topology_compiler/board_metadata.py`;
- `cc:` `…/topology_compiler/compiler.py`;
- `vjs:` `kicad-prism-viewer/viewer/src/main.js`;
- `pcae:` `backend/app/services/project_component_asset_extractor.py`;
- `km:` the installed `kicad_monkey` 2026.9.7 package.

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.project.a0"` | — | required | new (conventions §4) | `backend/app/services/design_bundle/` reader (K) | not in any of today's shapes |
| `/projectFile` | `RepoPath` | — | required; the anchor, equal to the manifest's `config.project_file` | `pms:27-41` (`locate_project_file`, an absolute host path today) | `documentPath` of `drawing-sheet` and `.kicad_pro` `text-path` references; card adapter | today a host path; here repository-relative (D12) |
| `/projectName` | `string` (min 1) | — | required | `pms:54` (`Path(project_file).stem`); KiCad `${PROJECTNAME}` (`project.cpp:86-89`) | `ktv:89-90` (`PROJECTNAME` in title blocks); resolution step 3a | equal |
| `/textVariables` | `Record<string>` | — | required; keys in code point order; empty when the file has none | `pms:59-62` (km `KiCadProject.text_variables`); `cm:323-342` (`project_text_variables`, closure); fork `project.rs:180-198` | expansion: `ktv:88` via `pps:212-217`; model resolution `cm:164-165`; resolution step 3c here; board-objects carries the same map as a diffable settings object (`board-objects-a0.tsp:143`) | today a dict in file order; here sorted keys (D8 for non-string values) |
| `/textVariables/{key}` | `string` | — | value as written | same | same | equal for KiCad-written (string) values |
| `/netClasses` | `ProjectNetClass[]` | — | required; in file order of `net_settings.classes[]`; empty when there are none | `bm:52-87` (km `KiCadProject.net_settings.classes`); fork `project.rs:603-657` | 3D: `bm:129` → `cc:212` → `vjs:6345-6370` (net-class table) | same order; synthetic: empty, as today |
| `/netClasses/*/name` | `string` (min 1) | — | required | `bm:70` | `vjs:6355` | equal |
| `/netClasses/*/trackWidthNm` | `NonNegativeNanometres` | nm | optional; absent = not in the class (KiCad 9+ then uses `Default`'s) | `bm:71` (`track_width`, mm) | `vjs:6356` | 3D mm = nm / 1e6, absent → `None` (usb-pd `GND`) |
| `/netClasses/*/clearanceNm` | `NonNegativeNanometres` | nm | optional; as above | `bm:72` | `vjs:6357` | as above |
| `/netClasses/*/diffPairWidthNm` | `NonNegativeNanometres` | nm | optional; as above | `bm:74` | `vjs:6358` | as above |
| `/netClasses/*/diffPairGapNm` | `NonNegativeNanometres` | nm | optional; as above | `bm:73` | `vjs:6359` | as above |
| `/netClasses/*/viaDiameterNm` | `NonNegativeNanometres` | nm | optional; as above | `bm:75` | `vjs:6360` | as above |
| `/netClasses/*/viaDrillNm` | `NonNegativeNanometres` | nm | optional; as above | `bm:76` | `vjs:6360` | as above |
| `/documents` | `ProjectDocument[]` | — | required; sorted by `path` in code point order; each file once | card: `pms:189-203` (root schematic and board only); closure hierarchy `cl:868-942` | card adapter; C3 (design inputs); sheet relation ("Relations") | sub-sheets are new (no today's consumer of their header) |
| `/documents/*/path` | `RepoPath` | — | required | `pps:288`, `pps:330` (`_relative_or_name`, project-relative) | `api:80-97` → `frontend/src/types/project.ts:78-99`; `pane:79` (file name) | card `path` = this relative to the project directory (D12); `filename` = last segment |
| `/documents/*/kind` | `ProjectDocumentKind` | — | required | which file the card reads: `pms:190-200` | card adapter picks `root-schematic` and `board` | — |
| `/documents/*/formatVersion` | `ProjectFileFormatVersion` | — | optional; absent when `(version)` is missing or not an integer | `pps:290`, `:332` (regex, first `(version N)` in 256 KB) | `pane:492-507` (SCH/PCB format) | equal on every fixture |
| `/documents/*/generator` | `string` | — | optional; absent when `(generator)` is missing | `pps:291`, `:333` (quoted only, `pps:94-98`) | `pane:492-507` | D1: a bare token (`(generator eeschema)`, KiCad 6/7) is `null` today |
| `/documents/*/generatorVersion` | `string` | — | optional; absent when missing (KiCad ≤ 7) | `pps:292`, `:334` | `pane:492-507` | equal |
| `/documents/*/titleBlock` | `ProjectTitleBlock` | — | optional; absent when the file has no `(title_block)` | `pps:236-246` (`_extract_sexpr_block`, first `(title_block` in 256 KB) | expansion; Release Studio sheets (C3, if it adopts the project's own title block) | today only title and date leave the service (D7) |
| `/documents/*/titleBlock/title` | `string` (min 1) | — | optional; absent when not written or empty | `pps:240` | card adapter (via `expandedTitleBlock`) | — |
| `/documents/*/titleBlock/date` | `string` (min 1) | — | optional; as above | `pps:241` | as above | — |
| `/documents/*/titleBlock/rev` | `string` (min 1) | — | optional; as above | `pps:172` (variable `REVISION` only) | expansion (`${REVISION}`) | new as a field (D7) |
| `/documents/*/titleBlock/company` | `string` (min 1) | — | optional; as above | `pps:173` (variable `COMPANY` only) | expansion (`${COMPANY}`) | new as a field (D7) |
| `/documents/*/titleBlock/comments` | `ProjectTitleBlockComment[]` | — | required; sorted by `number` in numeric order; N in 1–9 with non-empty text; a repeated N: last wins | `pps:175-178` (variables `COMMENT1..9` only) | expansion (`${COMMENTn}`) | new as a field (D7) |
| `/documents/*/titleBlock/comments/*/number` | `ProjectTitleBlockCommentNumber` (1–9) | — | required | `pps:175-178` | as above | — |
| `/documents/*/titleBlock/comments/*/text` | `string` (min 1) | — | required | `pps:176-178` | as above | — |
| `/documents/*/expandedTitleBlock` | `ProjectTitleBlock` | — | optional; present exactly when `titleBlock` is | `pps:242-246` (`resolved.expand`), `ktv:51-93` | card adapter: `title_block = {title: expanded.title ?? "", date: expanded.date ?? ""}`; `pane:75` (board label), `pane:515-516` (dates) | equal on every fixture (cynthion `${TITLE}` → `Cynthion`) |
| `/documents/*/expandedTitleBlock/title` | `string` (min 1) | — | optional; absent when absent in `titleBlock` or expanding to `""` | `pps:244` | `pane:75`; `api:72-77` | `?? ""` gives today's value |
| `/documents/*/expandedTitleBlock/date` | `string` (min 1) | — | optional; as above | `pps:245` | `pane:515-516` | `?? ""` gives today's value |
| `/documents/*/expandedTitleBlock/rev` | `string` (min 1) | — | optional; as above | new (same rule) | none yet (named for C3 dossier sheets) | — |
| `/documents/*/expandedTitleBlock/company` | `string` (min 1) | — | optional; as above | new (same rule) | as above | — |
| `/documents/*/expandedTitleBlock/comments` | `ProjectTitleBlockComment[]` | — | required; sorted by `number`; a comment expanding to `""` is left out | new (same rule) | as above | — |
| `/documents/*/expandedTitleBlock/comments/*/number` | `ProjectTitleBlockCommentNumber` | — | required | new | as above | — |
| `/documents/*/expandedTitleBlock/comments/*/text` | `string` (min 1) | — | required | new | as above | — |
| `/documents/*/properties` | `Record<string>` | — | required; keys in code point order; empty name skipped; repeated name: last wins; empty for schematics | `pps:146-164` (`_extract_document_properties`, depth-2 `(property "N" "V")`) | expansion layer 2 (`ktv:87`) | equal |
| `/documents/*/properties/{key}` | `string` | — | value as written | `pps:163` | as above | — |
| `/references` | `ProjectPathReference[]` | — | required; sorted by `documentPath`, `kind`, `raw`, `sheetUuid`, `field`, `libraryName`, embedded `footprintUuid` (code point; absent first); empty when there are none | `cl:1003-1082` (records sorted at `cl:1035`, `cl:1231-1233`); `cl:945-975` (sheet files) | C3 closure adapter; V1 cache key; C7 via placements; K/B audit | see "Closure" rules and D2–D6 |
| `/references/*/kind` | `ProjectReferenceKind` | — | required | `cl:1026-1033` (`library_table` / `project_path`), `cm:108-117` (model by suffix) | C3 adapter (model vs other rules) | today's kind is not in the record (`cl:184-213`) |
| `/references/*/documentPath` | `RepoPath` | — | required | `ResolvedLibraryPath.source_path` `cl:195` (repository-relative) | C3 (`source_path`), `rmi:32-35` (acknowledgement key `source_path::reference`) | equal (`source_path` = this) |
| `/references/*/sheetUuid` | `KiCadUuid` | — | optional; present exactly for `sheet-file` | `cl:956-975` (reads the sheet, not its uuid) | sheet relation: = semantic index `sheetInstances[].sheetSymbolUuid` | new |
| `/references/*/sheetName` | `string` (min 1) | — | optional; present for `sheet-file` when the first `Sheetname`/`Sheet name` property has non-empty text | km/fork sheet properties | sheet relation (= `sheetInstances[].sheetName` for non-root instances) | new |
| `/references/*/libraryName` | `string` (min 1) | — | optional; present exactly for the two library kinds; unique per table | `cr:85-90` (rows read for their `uri` only) | C7 (nickname of a footprint's `lib_id`) | new |
| `/references/*/field` | `string` (min 1) | — | optional; present exactly for `drawing-sheet` and `text-path` | `cr:103-109` (`.kicad_pro` values), `cr:83-102` (s-expression atoms; field not recorded) | C3 messages; G golden diagnostics | new |
| `/references/*/raw` | `string` (min 1) | — | required; the text as written, `${KIPRJMOD}` unexpanded; its resolved `RepoPath`, if any, is `target/path` (conventions §8) | `ResolvedLibraryPath.reference` `cl:196`; `cm:278-293` (unquoting) | C3 `reference`; `rmi:32-35`; placements join (`PlacementsModel.path`) | equal (`reference` = `raw`) |
| `/references/*/variables` | `ProjectVariableName[]` | — | required; sorted in code point order, no repeats; empty when none | `cl:1170-1210` (`EnvBinding` recorded per variable used) | C3 `env_bindings` (`cl:1082`); audit | `env_bindings` = `KIPRJMOD` when any recorded reference used it (adapter) |
| `/references/*/variables/*` | `ProjectVariableName` | — | — | as above | as above | — |
| `/references/*/target` | `ProjectPathTarget` (`@oneOf`) | — | required | `cl:197-199` (`resolved_path`, `location`), `cm:83-105` (`ModelPlacement`) | C3 adapter; V1; C7 | see "Closure" |
| `/references/*/target/kind` | `"repository"` \| `"outside-repository"` \| `"absolute"` \| `"kicad-library"` \| `"embedded"` \| `"unresolved"` | — | required | `cm:200-235` (`closure` / `toolchain` / `host` / `missing` / `unreadable` / `substitutable`), `cl:1101-1151` (`closure` / `toolchain` / `external` / `missing`) | C3 adapter | host-independent; the host steps stay in C3 |
| `/references/*/target/path` | `RepoPath` (`repository`); `string` (`outside-repository`: relative to the repository root, leading `..`; `absolute`) | — | required in those variants | `cl:1145-1150` (`resolved_path` repository-relative), `cm:200-220` | C3 (`resolved_path` = path), V1, C7 | equal |
| `/references/*/target/base` | `ProjectPathBase` | — | required in `repository`, `outside-repository` | `cl:1115-1116` (relative → project root); `cl:960-972` (sheet files relative to the parent sheet); `cm:182-187` | C3 adapter: `project-directory` = today's "pinned form" (`cm:175-189`) | — |
| `/references/*/target/inSources` | `boolean` | — | required in `repository` | `cl:1141-1144` and `cm:194-225` (existence in the materialized tree) | C3 adapter (`closure` vs `missing`); V1; audit | equal on every fixture (D11 for `..` through a missing directory) |
| `/references/*/target/variable` | `ProjectVariableName` | — | required in `kicad-library`; in `unresolved` present exactly for the three variable reasons | `cm:163-167` (model variable lookup), `cl:1170-1210` | C3 adapter (looks the variable up in the worker's environment) | D4 (legacy versioned names) |
| `/references/*/target/library` | `ProjectKiCadLibrary` | — | required in `kicad-library` | `cm:63-75` (`_ALIASES`, KiCad's predefined variables) | C3 adapter; audit | new classification |
| `/references/*/target/relativePath` | `ProjectLibraryRelativePath` | — | required in `kicad-library` | `cm:181` (`root/relative`) | C3 adapter (joins to the stock directory) | — |
| `/references/*/target/name` | `string` (min 1) | — | required in `embedded` | `cm:41-43` (`kicad-embed://`, skipped), `pcae:322-336` | C7 embedded model bytes; V1 (inside the board blob) | new (D3) |
| `/references/*/target/documentPath` | `RepoPath` | — | required in `embedded` | `pcae:332-335` (board embedded files) | C7 | new (D3) |
| `/references/*/target/footprintUuid` | `KiCadUuid` | — | optional in `embedded`; present when the footprint's own embedded files hold it | `pcae:328-330` (footprint first) | C7 (`placements` `footprints[].uuid` join) | new (D3) |
| `/references/*/target/fileType` | `ProjectEmbeddedFileType` | — | required in `embedded` | fork `embedded_resource.rs:72-76` (`other` when empty) | C7 | new |
| `/references/*/target/reason` | `ProjectUnresolvedReason` | — | required in `unresolved` | `cm:170-174` (fail-closed cases), `cl:1104-1112` | C3 adapter (`unreadable` / `external` / `missing`) | — |

The member has no nullable field. Every unknown is absent (conventions §10).

## Scanning

The producer reads these files, and only these:

1. **The project file:** the effective configuration's `project_file`.
   - Its `text_variables` and `net_settings.classes[]`.
   - Its drawing-sheet settings `schematic.page_layout_descr_file` and `pcbnew.page_layout_descr_file`. An empty or missing setting is not a reference: KiCad then uses its default sheet.
   - Every other string value for `text-path`.
2. **The root schematic:** the effective configuration's `root_schematic`, or `<stem>.kicad_sch` beside the project file (KiCad's pairing; bundle-format §2.1). A KiCad 10 project's other top-level sheets (`schematic.top_level_sheets`, as stage parse reads them: cli-spec §5.2.2) follow it as `schematic` documents.
3. **Every schematic reached from them:** follow `sheet-file` references whose target is `repository` with `inSources` true, at any depth, reading each file once. A cycle ends at the first repeat.
   - Detached sheets are not read (D5).
   - A sheet file that is not in the sources is listed as a reference but not read. Stage parse loads it as an empty sheet with a `sheet-missing` warning, as KiCad does (cli-spec §5.2.2).
4. **The board:** the effective configuration's `board`, or `<stem>.kicad_pcb`.
5. **The project's two library tables, and only those:** `fp-lib-table` and `sym-lib-table` in the project directory (the anchor's directory, `${KIPRJMOD}`). KiCad loads only these plus the user's global table. Tables elsewhere in the repository are not read (D2).
6. **Every drawing-sheet file** whose `drawing-sheet` reference resolves to `repository` with `inSources` true. It is read for `text-path` only.

What each file contributes:

| Kind | Form | One entry per |
|---|---|---|
| `sheet-file` | the first `(property "Sheetfile" …)` or `(property "Sheet file" …)` of each top-level `(sheet …)` of a schematic (fork `schematic_bundle.rs:570`) | sheet; a sheet without a canonical uuid is skipped with warning `project-sheet-without-uuid` |
| `footprint-library` / `symbol-library` | `(uri …)` of each `(lib …)` row | row; a row without `name` or `uri` is skipped (`project-library-row-invalid`); a second row with a known nickname is skipped (`project-library-name-duplicate`), as KiCad refuses duplicate nicknames |
| `model-3d` | the path of each `(model …)` of each top-level `(footprint …)` of the board, hidden ones included; an empty path is skipped (as `placements` does) | distinct `raw`. For an `embedded` target, one entry per footprint whose own embedded files hold it, plus one without `footprintUuid` for those resolved by the board's |
| `drawing-sheet` | the two `.kicad_pro` settings above, when non-empty | setting |
| `text-path` | see below | distinct (`documentPath`, `field`, `raw`) |

**`text-path` detection.** This is Release Studio's rule, `cr:25-58`, unchanged:
- A string is a path reference when all of these hold:
  - it contains `${NAME}` with NAME matching `[A-Za-z_][A-Za-z0-9_]*`;
  - none of those names is `JOBSET_OUTPUT_WORK_PATH` (ASCII case-insensitive);
  - and either it contains `/` or `\`, or the whole string, trimmed, is one `${NAME}` whose upper-case name is `KIPRJMOD` or ends in `_DIR` or `_PATH`.
- Candidates:
  - in the project file, every JSON string value except the two drawing-sheet settings, with `field` the RFC 6901 pointer;
  - in every scanned s-expression file, every string atom (quoted or bare) except the atoms already listed under another kind (Sheetfile values, model paths, library `uri` values);
  - `field` is the property name when the atom is the value (third element) of a `(property "<name>" "<value>" …)`, and otherwise the head token of the list the atom is an element of.

Producer warnings go to `bundle.json` `stages.parse.warnings` (bundle-manifest-a2.tsp: `BundleManifestParseStage.warnings`). Each message names the file:

| Code | When | Effect on the member |
|---|---|---|
| `project-net-class-value-invalid` | a net-class dimension is a JSON number that is negative, or whose nanometre value is not below 2^53 | that field is absent |
| `project-library-row-invalid` | a `(lib …)` row has no `name` or no `uri` | row skipped |
| `project-library-name-duplicate` | a nickname repeats within one table | the later row is skipped |
| `project-sheet-without-uuid` | a `(sheet …)` has no canonical `(uuid …)` | sheet skipped; its file is not followed |

A dimension that is missing or not a JSON number is absent with no warning. That is how KiCad 9 writes a non-default class, as in usb-pd's `GND`.

## Resolution (normative)

Every path the resolution writes is repository-relative (conventions §8). The **project directory** is the anchor's directory, the directory of the effective configuration's `project_file`, which KiCad calls `${KIPRJMOD}`; it is `""` at the repository root.

Inputs:
- `R`, the reference's `raw` text;
- its `kind`;
- the holding file's `documentPath`;
- the project's `textVariables` and `projectName`;
- the project directory;
- the materialized source set (the revision key's source set as K materializes it, bundle-format §2.2);
- for `model-3d` and `drawing-sheet`, the embedded-file lookup order.

Nothing else is consulted: no environment variable, no file outside the sources, no KiCad installation.

1. **Separators.** Replace every `\` in `R` with `/`, as KiCad does on non-Windows hosts (`filename_resolver.cpp:256-259`) and `cm:169` does.
2. **Expansion.** Repeat at most 8 rounds; `cm:303` uses 8. KiCad re-expands while brackets remain (`common.cpp:767-771`).
   - Each round scans the text left to right for `${NAME}`, `$(NAME)` or a bare `$NAME`, where NAME is one or more of `[A-Za-z0-9_:]` (`common.cpp:573-627`; `cm:35-39`). A `$` not followed by such a name is literal.
   - Each NAME is replaced by the first rule that applies. This is KiCad's precedence: project resolver first, then the environment (`common.cpp:640-686`, `project.cpp:81-122`).
     - a. `PROJECTNAME`: `projectName`.
     - b. `CURRENT_DATE`, `CURRENT_TIME_HH_MM_SS`, `CURRENT_TIME_LOCALE`, `VCSHASH`, `VCSSHORTHASH`: stop with `unresolved` / `nondeterministic-variable`, `variable` = NAME.
     - c. A key of `textVariables`: its value, with `\` replaced by `/` (`cm:315`).
     - d. `KIPRJMOD`: the **project marker** (KiCad sets it in the environment).
     - e. A **KiCad library variable**: that library's **marker**. The table below lists them; `<N>` is one or more ASCII digits (`env_vars.cpp:87-100`).
     - f. Anything else: stop with `unresolved` / `undefined-variable`, `variable` = NAME.
   - Every NAME replaced in any round is added to `variables`, including those replaced before a stop.
   - A round that finds no reference ends the expansion. If a reference remains after round 8, the result is `unresolved` / `variable-loop`.
3. **Markers.** A marker must start the text, and only one may occur. Otherwise the result is `unresolved` / `misplaced-variable`, and `variable` is the variable of the first marker, in text order, that is not at position 0.
4. **Classification** of the expanded text `T`. The first rule that applies wins:
   1. `T` starts with `kicad-embed://`:
      - For kinds `model-3d` and `drawing-sheet`, search the lookup order for an embedded file whose `(name …)` equals the rest of `T`. If one is found, the result is `embedded` with that file's holder and `(type …)`; otherwise `unresolved` / `embedded-missing`.
      - Any other kind gives `unresolved` / `uri`.
   2. `T` matches `^[A-Za-z][A-Za-z0-9+.-]*://`: `unresolved` / `uri` (`cm:40`, `cm:173`; `cl:1105`).
   3. `T` starts with `~`: `unresolved` / `home-relative` (`cm:173`, `cl:1109`).
   4. Kind `model-3d` or `drawing-sheet`, and `T` starts with `:`. This is KiCad's alias form `:<alias>:<rest>` (`filename_resolver.cpp:747-800`, `SplitAlias`).
      - If the alias is a KiCad library variable name, the result is `kicad-library` with `variable` = alias and the rest (step 6).
      - Otherwise, or without a second `:`, the result is `unresolved` / `alias` (`cm:176-181`).
   5. `T` starts with a library marker: `kicad-library` (step 6).
   6. `T` starts with the project marker: join the rest to the project directory, base `project-variable` (step 5).
   7. `T` starts with `/`, or matches `^[A-Za-z]:/`: `absolute`, with `path` normalized as follows. Drop empty and `.` segments. A `..` removes the previous segment, and nothing at the root. Keep the drive.
   8. Otherwise the path is relative.
      - Kind `sheet-file`: join it to the holding file's directory, base `document-directory`. KiCad loads a sub-sheet relative to its parent's directory, and so does `cl:960-972`.
      - Every other kind: join it to the project directory, base `project-directory`. KiCad's resolver tries the project directory before its other fallbacks (`filename_resolver.cpp:392-411`; `cl:1115-1116`; `cm:182-187`).
5. **Join and normalize** (rules 4.6 and 4.8).
   - Start from the base directory's repository segments. That is the segments of the project directory for `project-variable` and `project-directory`, and the directory segments of `documentPath` for `document-directory`.
   - For each segment of the rest:
     - drop empty and `.` segments;
     - a `..` removes the last segment, unless there is none or the last is `..`, in which case it is appended;
     - any other segment is appended.
   - No segments left: `unresolved` / `empty-path`. A segment containing `:`: `unresolved` / `unrepresentable-path`.
   - The segments are now relative to the repository root.
     - A leading `..`: `outside-repository`, `path` = the segments joined by `/`.
     - Otherwise `repository`, `path` = the segments joined by `/`, a `RepoPath`. `inSources` is true when the materialized source set holds `path`, or any `path/…`.
     - Kind `sheet-file` whose `path` is not in the source set but matches exactly one source-set schematic when letter case is ignored: `path` is that schematic and `inSources` is true. This is KiCad's sheet file rule as the core and stage parse apply it (`prism_kicad_core::sheet_file`, cli-spec §5.2.2 `sheet-path-case`), so the projection walks the hierarchy the bundle was built from.
6. **Library path.** Drop empty and `.` segments; a `..` removes the last segment.
   - A `..` with nothing to remove: `unresolved` / `outside-library-root`.
   - No segments left: `unresolved` / `empty-path`.
   - A segment containing `:`: `unresolved` / `unrepresentable-path`.
   - Otherwise `kicad-library` with `relativePath` the segments joined by `/`.

KiCad library variables (`env_vars.cpp:38-47`, `:158-161`):

| Variable | `library` |
|---|---|
| `KICAD<N>_3DMODEL_DIR`, `KISYS3DMOD` | `model-3d` |
| `KICAD<N>_SYMBOL_DIR`, `KICAD_SYMBOL_DIR` | `symbol` |
| `KICAD<N>_FOOTPRINT_DIR`, `KISYSMOD` | `footprint` |
| `KICAD<N>_TEMPLATE_DIR`, `KICAD_PTEMPLATES` | `template` |
| `KICAD<N>_3RD_PARTY` | `third-party` |
| `KICAD_USER_TEMPLATE_DIR` | `user-template` |

Embedded lookup order:
- `model-3d`: the holding footprint's own `(embedded_files …)`, then the board's top-level `(embedded_files …)`. That is KiCad's order (`exporter_step.cpp:578-579`) and the catalog import's (`pcae:322-336`). A match in the footprint's files sets `footprintUuid`.
- `drawing-sheet` `/schematic/page_layout_descr_file`: the root schematic's top-level `(embedded_files …)` (`eeschema_config.cpp:102-104`).
- `drawing-sheet` `/pcbnew/page_layout_descr_file`: the board's top-level `(embedded_files …)`.

`fileType` is the file's `(type …)`: `model`, `worksheet`, `datasheet` or `font`, and `other` for any other token or none. This follows fork `embedded_resource.rs:72-76`.

## Title-block expansion (normative)

`expandedTitleBlock` applies today's card rule, `ktv:45-93`, to each field and comment of `titleBlock`.

Variables, from lowest to highest precedence (`ktv:84-93`):
1. The block's own fields: `TITLE`, `ISSUE_DATE`, `REVISION`, `COMPANY` and `COMMENT1` to `COMMENT9`, each the empty string when absent (`pps:167-179`).
2. The file's `properties`.
3. `textVariables`.
4. `PROJECTNAME` = `projectName`.
5. `FILENAME` = the last segment of the document's `path`.

The substitution:
- Regex `\$\{(.+?)\}` (`ktv:48`), names matched exactly.
- A known name's value is itself expanded, recursively. At depth 10 (`ktv:46`) the value is inserted unexpanded.
- An unknown name stays as written, so `${CURRENT_DATE}`, `${#}` and `${SHEETNAME}` remain visible (`ktv:33-36`).
- A field or comment whose result is the empty string is absent.

This is deliberately not KiCad's full title-block resolver: it has no per-instance `${#}`/`${##}` and no sheet variables. Parity is with the card, which already matches the ECAD viewer beside it (`ktv:10-17`).

## Relations

- **Semantic index sheets.** For every sheet instance of `projections/semantic-index.json` that has a parent, there is exactly one `sheet-file` reference with:
  - `sheetUuid` = `sheetSymbolUuid`;
  - `documentPath` = `parentPage`;
  - `target.path` = `page`.

  The set of `page` values equals the `path`s of the `root-schematic` and `schematic` documents. Checked on dv-oracle (5 instances, a reused `channel.kicad_sch`), usb-pd (2) and cynthion (20): the edge sets are equal. The instance tree (KIID paths, sheet paths) lives only in the index. This member is its file-level edge list plus whatever failed to load.
- **Placements.** For a footprint F with `PlacementsModel.path` = `p` (`placements-a0.tsp:233-253`), the resolution is the `model-3d` reference with `documentPath` = the board and `raw` = `p`:
  - if `target.kind` is `embedded`, the entry whose `target.footprintUuid` = F's `uuid` when there is one, otherwise the entry without `footprintUuid`;
  - otherwise the single entry.
- **Variants.** `.kicad_pro` `schematic.variants` (read today by `backend/app/services/variant_catalog_service.py:177-212` and `backend/app/release_studio/projections.py:677-689`) is in the semantic index `assembly.catalog`, not here.
- **Net-class membership** of each net is the semantic index `nets[].netClass` (`semantic_index_service.py:938`). Patterns and assignments, as diffable settings, are `board-objects`' `.kicad_pro` objects (`board-objects-a0.tsp:110-115`).
- **Board size and thickness** on the card stay `kicad-cli pcb export stats` outputs (`pms:179-188`, ADR §2.1). Board thickness as written is `stackup` `boardThicknessNm`.
- **Repository facts** on the card (latest commit, tag: `pms:129-154`) come from git, not from the bundle.

## How a golden is produced from today's code

WP-G captures three of today's outputs per fixture and compares each with a re-derivation from the member. The member is a new shape, so its golden is the prototype's output plus these three adapters. The scratch prototype and adapters used for this W0 check are summarized under "Example provenance".

**Card.** Today:

```python
variables = dict(KiCadProject.from_file(pro).text_variables)        # pms:59-62
sch = compute_schematic_metadata(project_dir, root_sch, project_variables=variables, project_name=pro.stem)
pcb = compute_pcb_metadata(project_dir, board, {}, project_variables=variables, project_name=pro.stem)
```

Drop `dimensions_mm` and `thickness_mm` (kicad-cli).

From the member, for `kind` `root-schematic` (schematic) and `board` (pcb), or `None` when absent:
- `path` = `path`;
- `filename` = the last segment of `path`;
- `version` = `formatVersion`;
- `generator` = `generator`;
- `generator_version` = `generatorVersion` (missing → `None`);
- `title_block` = `None` when there is no `expandedTitleBlock`, else `{"title": expanded.title ?? "", "date": expanded.date ?? ""}`.

**3D.** Today `bm.project_net_classes(board_path)`. From the member, per `netClasses` element, in order:
- `name`;
- `track_width`, `clearance`, `diff_pair_gap`, `diff_pair_width`, `via_diameter`, `via_drill` = the `…Nm` field / 1e6, or `None` when absent.

The division reproduces the file's double exactly for every value with at most 6 decimals, which every KiCad-written value has.

**Closure.** Today `materialize_input_closure(repo, commit, dest, relative_path=rel, model_env=<worker environment>)` (`cl:329-411`, called as at `backend/app/services/release_studio_build_service.py:195-204`), keeping `library_references` and `env_bindings`. From the member plus the same `model_env`, for each reference:
- Records:
  - `source_path` = `documentPath`;
  - `reference` = `raw`;
  - records are unique per (`source_path`, `reference`) and sorted as `cl:1231-1233`.
- Not recorded:
  - `model-3d` whose `raw` starts with `kicad-embed://` (`cr:136-137`);
  - `sheet-file`, `drawing-sheet` and `text-path` whose `raw` fails the `text-path` detection rule (today's generic scan sees only `${…}` text).
- `model-3d` (rules of `cm:120-235`). "Pinned" means `raw` does not start with `${`, `$(` or `/` (`cm:175-189`).
  - `repository`:
    - `inSources` → `closure`, `resolved_path` = `path`;
    - else pinned → `unreadable`;
    - else `.wrl`/`.wrz` → `substitutable`;
    - else `missing`, `advisory: true`.
  - `kicad-library`: root = `model_env[variable]`, looked up literally (no legacy mapping, D4). If root ⧺ `relativePath` is a regular file and both names end in a loadable suffix (`cm:59-62`), the result is `host` with `digest` = SHA-256 of the file. Otherwise `unreadable`.
  - `absolute`: the same test on `path`.
  - `outside-repository`, `unresolved`: `unreadable`.
- Library kinds, `text-path`, `drawing-sheet` and `sheet-file` (`_PathResolver`, `cl:1085-1210`).
  - If `variables` holds any name other than `KIPRJMOD`, the result is `external` (D6).
  - Otherwise:
    - `repository` → `closure` (`resolved_path` = `path`, `.` for the root) if `inSources`, else `missing`;
    - `absolute`, `outside-repository`, `kicad-library`, and `unresolved` (`undefined-variable`, `home-relative`, `uri`) → `external`;
    - any other `unresolved` → `missing`.
- `env_bindings` = `[{"name": "KIPRJMOD", "value": <project directory, "." at the root>}]` when any recorded reference has `KIPRJMOD` in `variables`, else `[]`.
- Today's records whose `source_path` is a library table outside the project directory are removed before comparing (D2).

**Results on the committed fixtures.**
- Prototype run on scratch git copies at HEAD.
- Two model environments: `{}`, and `{KICAD10_3DMODEL_DIR: <KiCad 10.0.6 stock 3D models>}`.
- The `today`, `member` and `diff` artifacts were produced in the W0 scratch area. None is committed.

| Fixture | Card | 3D | Closure records matched (both envs) | Today only | Member only | Excluded by D2 |
|---|---|---|---|---|---|---|
| `fixtures/release-studio/usb-pd` | equal | equal | 10/10 | 0 | 0 | 0 |
| `fixtures/release-studio/cynthion` | D1 only (bare `generator`) | equal | 36/36 | 0 | 0 | 0 |
| `fixtures/release-studio/synthetic` | equal | equal (`[]`) | 0/0 | 0 | 0 | 0 |
| `backend/tests/fixtures/system_builder/p2/sources/mezz_top/F0` (repo root = `p2/sources`) | equal | equal | 3/3 | 0 | 0 | 10 |
| `…/p2/sources/edge_a/F0` | equal | equal | 4/4 | 0 | 0 | 10 |
| `backend/tests/fixtures/design_variants/oracle` | equal | equal | 6/6 (`host` + digest with the KiCad 10 env) | 0 | 0 | 0 |
| `backend/tests/fixtures/design_variants/sch_only` | equal (pcb `None`) | equal | 0/0 | 0 | 0 | 0 |
| USB-PD-Trigger-Board `0642b077` (excluded dirs `Design-Outputs`, `Manufacturing-Outputs`) | equal | equal | 10/10 | 0 | 0 | 0 |
| usb-pd **edge** (scratch edits, "Example provenance") | equal | equal | 18/18 | 0 | 0 | 0 |

`env_bindings` is equal in every row. Two prototype runs gave byte-identical members (cynthion, usb-pd edge, mezz_top).

## Expected divergences

| Case | Today | Bundle | Why the bundle is right | Consumer affected |
|---|---|---|---|---|
| D1 Bare `(generator eeschema)` / `(generator pcbnew)` (KiCad 6/7 files; cynthion) | `generator: null` (`pps:94-98` matches quoted strings only) | `"eeschema"` / `"pcbnew"` | the file states it | card "SCH/PCB Format" row (`pane:492-507`) gains the generator name |
| D2 Library tables outside the project directory (sb-p2: 10 of 13 and 10 of 14 records) | every `fp-lib-table`/`sym-lib-table` in the repository is scanned (`cl:910-911`) and resolved with *this* project's `KIPRJMOD` (`cl:1018-1028`) | only the project's own two tables | KiCad loads only `<project dir>/fp-lib-table` and `sym-lib-table` plus the global table; another project's table never affects this build, and resolving it against this project's directory is meaningless | C3: fewer `non_hermetic_reasons` and a different `input_closure_digest`. **Open question 1** |
| D3 References today's closure does not record: `kicad-embed://` models and drawing sheets, sheet files, drawing sheets and other paths without `${…}` | skipped (`cr:129-138`; generic scan needs `${`, `cr:39-40`) | listed | they are references KiCad follows; V1 and C7 need them | none for C3 (the adapter filters them); V1, C7 gain data |
| D4 Legacy versioned library variables (`${KICAD9_3DMODEL_DIR}` in usb-pd and USB-PD-Trigger-Board, `${KICAD6_3DMODEL_DIR}` in cynthion) on a KiCad 10 worker | looked up literally in the worker environment (`cm:163-167`) → `unreadable`; each needs an acknowledgement (`rmi:64-91`) | `kicad-library`, `variable` as written | the member stays host-free. KiCad 10 itself substitutes its own `KICAD10_3DMODEL_DIR` for an unset older version (`common.cpp:648-653`), so kicad-cli renders these models. Whether C3 follows KiCad is a reader decision | C3. **Open question 2** |
| D5 Detached schematics in a directory a root sheet points into (`cl:920-940`), and other projects' `.kicad_pcb`/`.kicad_pro`/`.kicad_wks` in the project directory (`cl:914-915`) | scanned for `${…}` paths | not read | KiCad does not load them for this project | C3 hermeticity, on repositories that have them (no committed fixture does) |
| D6 Project text variables in library URIs and text paths (`${MYLIBS}/x.pretty`) | `_PathResolver` knows only `KIPRJMOD`, toolchain names and Prism bindings → `external` (`cl:1170-1192`) | resolved through `textVariables`, as KiCad does (`library_manager.cpp:989-996` → `common.cpp:640-644`) | KiCad's semantics | C3 adapter reproduces `external` from `variables`. No committed fixture uses it (models already resolve text variables today: `cm:164-165`) |
| D7 Title-block `rev`, `company`, comments; sub-sheet and board title blocks | only title and date of the root schematic and board leave the service (`pps:225-246`) | all fields of every document, raw and expanded | ADR §6 lists the title block; C3 sheets can use the project's own | none |
| D8 Non-string `text_variables` values | `str(value)` (`cm:342`); km's `KiCadProject` in the card | fork `project_string` (`project.rs:945-952`): `null`/`false`/`0` → `""`, others JSON text | the fork is the producer; KiCad writes strings only | none on KiCad-written files |
| D9 `.prism/**/*.yaml` path references | scanned (`cl:912-913`, `cr:110-118`) | not here | Prism configuration, not a KiCad source or a bundle source | C3 keeps scanning them from git |
| D10 Empty title-block field `(title "")` | `""` | absent | conventions §10 | card adapter `?? ""` gives the same value |
| D11 A path through a directory that does not exist, then `..` (`missing/../part.step`) | `missing` (KiCad checks the path as written, `cm:191-194`) | normalized lexically; may be `inSources: true` | no committed fixture has one; the member cannot see directories outside the sources | C3, on such a path only |
| D12 Paths are repository-relative (maintainer decision, conventions §8; issue #681) | the card's document `path` is relative to the project directory (`pps:330`); `projectFile` is a host path | every path is a `RepoPath`; `projectFile` is the anchor | one spelling per file whichever project refers to it; files are attributed by the anchor and the effective configuration, never by directory | card adapter strips the project directory to give today's `path`; the two are equal for a project at the repository root |

## Example provenance

`examples/ProjectA0.example.json` is the prototype's output on **usb-pd edge**: `fixtures/release-studio/usb-pd` with these scratch edits. The repository root is taken to be the fixture project's own directory, as if it were its own repository, so every repository-relative path equals the project-relative one, and `${KIPRJMOD}/../shared-models/SOT-23.step` is `outside-repository`. They cover the target variants that no committed fixture has. Each edit is listed so WP-G can rebuild the case:
- `.kicad_pro`:
  - `text_variables` = `{"MODELS": "${KIPRJMOD}/packages3D"}`;
  - `pcbnew.page_layout_descr_file` = `sheets/Board.kicad_wks`, a file that does not exist.
- Board:
  - `${KIPRJMOD}/packages3D/796638-2.step` → `${MODELS}/796638-2.step`;
  - `${KICAD9_3DMODEL_DIR}/Diode_SMD.3dshapes/D_SOD-123.step` → `~/kicad/models/D_SOD-123.step`;
  - `${KICAD9_3DMODEL_DIR}/Package_TO_SOT_SMD.3dshapes/SOT-23.step` → `${KIPRJMOD}/../shared-models/SOT-23.step`;
  - added a title block `(title "${PROJECTNAME}") (rev "${VERSION}") (comment 2 "Board file ${FILENAME}")` and a top-level `(property "VERSION" "E.1.0.0")`.
- Root schematic: the placed `CYPD3177` symbol's `Datasheet` → `${KIPRJMOD}/datasheets/CYPD3177.pdf`.
- New `fp-lib-table` with four rows:
  - `Local` → `${KIPRJMOD}/lib/Local.pretty` (missing);
  - `Stock` → `${KICAD10_FOOTPRINT_DIR}/Resistor_SMD.pretty`;
  - `Host` → `/opt/libs/Host.pretty`;
  - `Team` → `${TEAM_LIBS}/Team.pretty`.
- New `sym-lib-table` with `Device` → `${KICAD10_SYMBOL_DIR}/Device.kicad_sym` and `(descr "${KIPRJMOD}/docs/libraries.md")`.

Today's closure on the same scratch tree re-derives 18 of 18 records ("How a golden is produced").

Trimmed: 9 of the 23 references. Kept: at least one of every reference kind, every target variant, all three `base` values (`project-variable`, `document-directory`, and `project-directory` via the drawing sheet), `inSources` true and false, an embedded target with and without `footprintUuid`, and the three `field` forms (JSON Pointer, property name, head token `descr`). Removed:
- four of the five `${KICAD9_3DMODEL_DIR}` models;
- the second `${KIPRJMOD}/packages3D/…` model;
- the second embedded model;
- the `.kicad_pro` `text-path` `/text_variables/MODELS`;
- the `Local` and `Stock` library rows.

All three documents are kept (sub-sheet, board, root schematic).

Real outputs validated against the schema with `scripts/check-contract.mjs`: the nine members of the results table, one per fixture row.

## Cross-contract notes

- **Revision key (source set).**
  - `inSources` is defined against the materialized source set, that is, the revision key's name-based source set (`revision-key-a1.tsp`, `RevisionKeySourceCategory`) minus symlinks, which the job does not materialize (cli-spec §9.1). The bundle's `sources/` members are the closure the build read (bundle-format §2.2, decision Q3), which includes every `repository` target with `inSources` true.
  - A `repository` target with `inSources: false` is a file that KiCad or a KiCad-output job would read but the key does not hash: an excluded directory, an uncommitted file, or a type the selection does not name (`.kicad_dbl` database libraries; SPICE `.cir`, `.sub` and `.inc` behind a `Sim.Library` text path).
  - K or B can turn that into a manifest warning. The member reports it; it does not change the key.
- **CLI spec §5.5** says `revision-key` must parse the board to find referenced 3D models. `revision-key-a1.tsp` selects 3D models by suffix across the repository, with no parse. Only one can hold. This member is the place a board-parse-based model list would come from, but it exists only after stage parse.
- **Bundle format §2.2.** The role table maps "anything else in the source set" to `source-3d-model`. The revision-key source set also selects symbol libraries (`.kicad_sym`, `.lib`, `.dcm`), footprints (`.kicad_mod`), symlinks and gitlinks. The library URIs of this member point at those, so they need roles of their own.
- **Placements.** The join above needs `PlacementsModel.path` to be byte-equal to this member's `raw`: the same unescaping, and no trimming.
- **CLI spec §5.2.2 `sheet-missing`.** A missing sub-sheet no longer fails stage parse, so a written member can hold `sheet-file` targets with `inSources: false`.
