# Field map: revision key (`prism.revision_key.effective_config.a1`, `prism.revision_key.record.a1`, `prism.revision_key.vectors.a1`)

Root models `RevisionKeyEffectiveConfigA1`, `RevisionKeyRecordA1` and `RevisionKeyVectorsA1` in `tsp/prism/revision-key-a1.tsp`. Examples:

- `examples/RevisionKeyEffectiveConfigA1.example.json`
- `examples/RevisionKeyRecordA1.example.json`
- `examples/RevisionKeyVectorsA1.example.json`

The normative algorithm is in [`../revision-key.md`](../revision-key.md); section numbers below (§n) refer to it.

None of these documents is a bundle member of its own:

- The effective config is embedded in `bundle.json` (manifest a2) and is the `--config` input of `prism-kicad revision-key` and `prism-kicad bundle build`.
- The record is the stdout of `prism-kicad revision-key`.
- The vectors file is `revision-key-vectors.json`, beside this directory's README.

Written by:

- WP-B: `prism-kicad revision-key`, the Rust reference, in `native/src/rs/prism-kicad-cli/`.
- WP-K: the Python reference, the effective-config resolution (§4.4) and the commit index (§10), in `backend/app/services/design_bundle/`.

Stage: none. The key is computed before the `design_bundle` job, at import, sync or an on-demand commit (ADR §4.4), and it names the job.

## Fields: `RevisionKeyEffectiveConfigA1`

Pointers are RFC 6901 with two extensions: `*` is every element of an array,
`{key}` is every key of a map. One row per leaf and per array/map.

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.revision_key.effective_config.a1"` | — | required | new | K `design_bundle` (writes `--config`); B `prism-kicad revision-key`, `bundle build --config`; manifest a2 (embeds this root by `$id`) | — |
| `/project_file` | `RepoPath` (last segment ends in `.kicad_pro`, ASCII case-insensitive) | — | required | anchor `ws_projects.project_file_rel` (`backend/app/services/workspace_migrations/m020_project_file_anchor.py:24-28`, read at `backend/app/services/path_config_service.py:163-169`), joined to the project directory (`backend/app/services/project_revision.py:105-124`, `:158-164`); exactly the stored anchor, with none of `find_kicad_project`'s fallbacks (`backend/app/services/semantic_visualizer_service.py:115-157`; revision-key.md §4.4 step 2), and the project-absent outcome when it is not in the tree; hashed today as `project_file_rel` (`backend/app/services/semantic_index_service.py:94-96`, `:220`, `:236`; `semantic_visualizer_service.py:174-180`) | selection (§5.3: must be a selected entry); B `bundle build` project file; its directory is `${KIPRJMOD}`, to which project-a0 resolves `${KIPRJMOD}` references (conventions.md §8); K commit index; manifest a2 | today a project-directory-relative name (`anchor or name`); a1 the repository-relative path |
| `/root_schematic` | `RepoPath` (ends in `.kicad_sch`) | — | optional; absent = Prism resolved no root schematic | `resolve_paths` schematic (`path_config_service.py:620-630`, default `*.kicad_sch` at `:23`, rules at `:315-359`); stored setting (`backend/app/services/project_settings_service.py:83-101`); committed `.prism.json` (`project_revision.py:508-532`) | B `bundle build` (the root sheet it parses); today `project_service.find_schematic_file` (`backend/app/services/project_service.py:551-554`), commit reads `backend/app/api/projects.py:1616-1622` | today a glob or a project-relative path resolved at read time; a1 resolved and repository-relative |
| `/board` | `RepoPath` (ends in `.kicad_pcb`) | — | optional; absent = Prism resolved no board | `resolve_paths` pcb (`path_config_service.py:632-655`, default `*.kicad_pcb` at `:24`) | B `bundle build` (the board it parses); today `project_service.find_pcb_file` (`project_service.py:556-559`), `api/projects.py:1817`; V1 models cache (§14) | as `root_schematic` |
| `/excluded_dirs` | `RepoPath[]` | — | required; sorted by UTF-8 bytes, strictly increasing, no element under another; empty = nothing excluded | `designOutputs` / `manufacturingOutputs` (`path_config_service.py:26-27`; read at `api/projects.py:189-196`); precedent `COMPARE_INPUTS.skip_top_dirs` (`project_revision.py:272-283`) | selection (§5.3, K and B); manifest a2 | new: no key excludes output directories today, but Design Comparison's snapshot skips them (`project_revision.py:272-283`) |
| `/excluded_dirs/*` | `RepoPath` | — | — | as above | as above | — |
| `/zone_fills` | `RevisionKeyZoneFills` (`refill` \| `saved`) | — | optional; absent = refill (the default); only `saved` is ever written, an explicit `refill` is `config-invalid` (§4.1 rule 5); last in the canonical key order (§4.2) | new stored setting `zone_fills` in `ws_projects.path_settings`, which K adds to `project_settings_service.STORED_FIELDS` (`backend/app/services/project_settings_service.py:42`; §4.4 step 5); today the reference branch falls back to the saved fills on any refill failure (ref: `backend/app/services/zone_refill.py:67-73`), and a1 chose per build with `--no-refill` (sim: `src/prism-bundle/src/bin/prism-bundle.rs:73`) | B `bundle build --stage board` (refill or saved mode, cli-spec.md §5.2.3); K skips the refill step (cli-spec.md §9.1); manifest a2 (`/stages/board/fill_provenance`) | new: no key today records the fill choice |

Deliberately absent: `subsheets`, `jobset`, `documentation`, `thumbnail`, `readme`, `project_name`, `description`, `workflows` and `portfolio` (`path_config_service.py:92-106`). None of them selects what the build parses (§4).

## Fields: `RevisionKeyRecordA1`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.revision_key.record.a1"` | — | required | new | K (parses the CLI's stdout) | — |
| `/revision_key` | `Sha256Hex` | — | required | today's analogues are `_revision_key` (`semantic_index_service.py:90-102`, truncated to 32 hex at `:102`) and `source_fingerprint_for_root` (`semantic_visualizer_service.py:166-212`); the closure digest (`backend/app/release_studio/closure.py:254-258`) | storage path `.kicad-prism/bundles/<project_id>/<revision_key>/…` (ADR §5); bundle key (ADR §5); K commit index (§10); manifest a2; replaces the semantic index artifact key (`semantic_index_service.py:69-74`), the comparison cache directory (`backend/app/services/design_compare_service.py:115-127`), the System Builder interface key (`backend/app/services/systems/store_reviews.py:321-336`) and the 3D commit index (`semantic_visualizer_service.py:469-542`) in C1, C2, C4 and C5; semantic-index a1 `sourceRevisionKey` (`semantic_index_service.py:1147`) | a different algorithm from every key today: never compared |
| `/object_format` | `RevisionKeyObjectFormat` (`sha1` \| `sha256`) | — | required | new; `git rev-parse --show-object-format`; Release Studio already accepts 40- to 64-hex ids (`closure.py:450-457`) | hashing (§8); manifest a2 | — |
| `/source` | `RevisionKeySource` (`@oneOf`) | — | required | the commit / working-tree branches of `_revision_identity` (`semantic_index_service.py:204-240`) | K (commit index only for `commit`) | not hashed |
| `/source/kind` | `"commit"` \| `"worktree"` | — | required | as above | K | — |
| `/source/commit` | `GitObjectId` | — | required in the `commit` variant; absent in `worktree` | `project_revision.resolve_commit` (`project_revision.py:142-155`), returned by `_revision_identity` (`semantic_index_service.py:225-240`) | K commit index `commit` column (§10) | — |
| `/config` | `RevisionKeyEffectiveConfigA1` | — | required | see the first table | manifest a2; K | the default config (§4.3) when `--config` is absent |
| `/config_digest` | `Sha256Hex` | — | required | new | K commit index `config_digest` column (ADR §5) | — |
| `/entries` | `RevisionKeyEntry[]` | — | required, at least 1; sorted by `path` in code point order (UTF-8 byte order) | the `ls-tree` listings of `semantic_index_service.py:130-156`, `project_revision.py:314-329`, `closure.py:650-663` | hashing (§8); bundle build materialization (`git cat-file` of these ids) and the manifest's `sources/` members (§14); V1 models-stage cache (`model-3d` and board entries); K logging | today no list is emitted |
| `/entries/*/path` | `RepoPath` | — | required | `ls-tree` path (`semantic_index_service.py:141-155`, project-relative there) | as `/entries` | today project-directory-relative; a1 repository-relative |
| `/entries/*/kind` | `RevisionKeyEntryKind` | — | required | git modes `project_revision.py:292-293`; Release Studio input types `closure.py:582`, `:596`, `:620` | hashing (the mode and type, §7); materialization (exec bit `project_revision.py:383`, symlinks `:426-440`) | today's semantic key ignores modes |
| `/entries/*/object_id` | `GitObjectId` | — | required | blob ids `semantic_index_service.py:147-155`; gitlink commit `closure.py:570-575`; LFS pointer blob `closure.py:608-614` | hashing; materialization | today's working-tree id is a SHA-1 of raw bytes (`semantic_index_service.py:77-87`); a1 runs git's clean filters (§9) |
| `/entries/*/category` | `RevisionKeySourceCategory` | — | required | suffix sets `project_revision.py:246-284`, `semantic_visualizer_service.py:67-81`, `backend/app/release_studio/closure_models.py:46-60`; autosave rule `backend/app/services/kicad_noise_service.py:56` | V1 (models), K counts and logs, C3 closure | not hashed |
| `/counts` | `RevisionKeyCounts` | — | required | new | K: source-set sizes in logs and metrics (ADR §11 G2) | — |
| `/counts/kicad_project` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/kicad_schematic` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/kicad_board` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/kicad_design_rules` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/kicad_worksheet` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/kicad_jobset` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/library_table` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/symbol_library` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/footprint` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/model_3d` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/prism_settings` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/symlink` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/gitlink` | `Count` | entries | required | new | as `/counts` | — |
| `/counts/total` | `Count` | entries | required; equals the length of `/entries` | new | as `/counts` | — |
| `/warnings` | `Warning[]` | — | required; sorted by `code`, then `message`, code point order; empty when none | new; precedent: LFS hydration failures `closure.py:740-765` | K logs; the CLI may echo them on stderr (CLI spec) | — |
| `/warnings/*/code` | `DiagnosticCode` | — | required | new; only `lfs-filter-unavailable` (§9) | K | — |
| `/warnings/*/message` | string | — | required | new | people | wording may change |

## Fields: `RevisionKeyVectorsA1`

Today's source is "new" for every row: the vectors come from the W0 generator, which builds scratch repositories and runs the two scratch implementations (see "Example provenance"). Consumers are the same for every row:

- WP-K's Python reference tests;
- WP-B's Rust reference tests;
- WP-L's CI jobs, which run both;
- WP-G, which uses this file as the key's golden.

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source | Consumers | Parity note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.revision_key.vectors.a1"` | — | required | new | K, B, L, G | — |
| `/listing_git_version` | string | — | required | `git --version` of the generator (2.55.0) | reviewers re-running the generator | — |
| `/selection` | `RevisionKeySelectionVector[]` | — | required; sorted by `name`, code point order | new | K, B | — |
| `/selection/*/name` | `RevisionKeyVectorName` | — | required, unique | new | K, B (test ids), `/relations/*/vectors` | — |
| `/selection/*/scenario` | string | — | required | new: the scratch repository (`usb-pd`, `monorepo`, `links`, `unicode`, `sha256`, `minimal`) | readers | — |
| `/selection/*/description` | string | — | required | new | readers | — |
| `/selection/*/object_format` | `RevisionKeyObjectFormat` | — | required | `git rev-parse --show-object-format` | K, B | — |
| `/selection/*/listing` | `RevisionKeyListingEntry[]` | — | required; in the order `git ls-tree -r -z --full-tree` printed it | `git ls-tree` on the scenario repository | K, B (input of `select`) | — |
| `/selection/*/listing/*/mode` | `RevisionKeyListingMode` | — | required | ls-tree mode column | K, B | — |
| `/selection/*/listing/*/type` | `RevisionKeyListingType` | — | required | ls-tree type column | K, B | — |
| `/selection/*/listing/*/object_id` | `GitObjectId` | — | required | ls-tree object column | K, B | — |
| `/selection/*/listing/*/path` | string | — | required | ls-tree path column, decoded as UTF-8 | K, B | may break the RepoPath rule (`error-unrepresentable-path`) |
| `/selection/*/config` | `RevisionKeyEffectiveConfigA1` | — | required | new | K, B | schema-valid; may break a §4.1 rule |
| `/selection/*/expected` | `RevisionKeySelectionOutcome` (`@oneOf`) | — | required | Python reference (`rk.py`), confirmed by the Node reference (`rk.mjs`) | K, B | — |
| `/selection/*/expected/kind` | `"selected"` \| `"error"` | — | required | as above | K, B | — |
| `/selection/*/expected/entries` | `RevisionKeyEntry[]` | — | `selected` only; sorted by `path`, code point order | as above | K, B | — |
| `/selection/*/expected/entries/*/path` | `RepoPath` | — | required | as above | K, B | — |
| `/selection/*/expected/entries/*/kind` | `RevisionKeyEntryKind` | — | required | as above | K, B | — |
| `/selection/*/expected/entries/*/object_id` | `GitObjectId` | — | required | as above | K, B | — |
| `/selection/*/expected/entries/*/category` | `RevisionKeySourceCategory` | — | required | as above | K, B | — |
| `/selection/*/expected/counts` | `RevisionKeyCounts` | — | `selected` only | as above | K, B | — |
| `/selection/*/expected/counts/kicad_project` | `Count` | entries | required | as `/counts/kicad_project` of the record | K, B | — |
| `/selection/*/expected/counts/kicad_schematic` | `Count` | entries | required | as `/counts/kicad_schematic` of the record | K, B | — |
| `/selection/*/expected/counts/kicad_board` | `Count` | entries | required | as `/counts/kicad_board` of the record | K, B | — |
| `/selection/*/expected/counts/kicad_design_rules` | `Count` | entries | required | as `/counts/kicad_design_rules` of the record | K, B | — |
| `/selection/*/expected/counts/kicad_worksheet` | `Count` | entries | required | as `/counts/kicad_worksheet` of the record | K, B | — |
| `/selection/*/expected/counts/kicad_jobset` | `Count` | entries | required | as `/counts/kicad_jobset` of the record | K, B | — |
| `/selection/*/expected/counts/library_table` | `Count` | entries | required | as `/counts/library_table` of the record | K, B | — |
| `/selection/*/expected/counts/symbol_library` | `Count` | entries | required | as `/counts/symbol_library` of the record | K, B | — |
| `/selection/*/expected/counts/footprint` | `Count` | entries | required | as `/counts/footprint` of the record | K, B | — |
| `/selection/*/expected/counts/model_3d` | `Count` | entries | required | as `/counts/model_3d` of the record | K, B | — |
| `/selection/*/expected/counts/prism_settings` | `Count` | entries | required | as `/counts/prism_settings` of the record | K, B | — |
| `/selection/*/expected/counts/symlink` | `Count` | entries | required | as `/counts/symlink` of the record | K, B | — |
| `/selection/*/expected/counts/gitlink` | `Count` | entries | required | as `/counts/gitlink` of the record | K, B | — |
| `/selection/*/expected/counts/total` | `Count` | entries | required | as `/counts/total` of the record | K, B | — |
| `/selection/*/expected/config_canonical` | string | — | `selected` only | as above | K, B | — |
| `/selection/*/expected/config_digest` | `Sha256Hex` | — | `selected` only | as above | K, B | — |
| `/selection/*/expected/revision_key` | `Sha256Hex` | — | `selected` only | as above | K, B | — |
| `/selection/*/expected/code` | `RevisionKeyErrorCode` | — | `error` only | as above | K, B | — |
| `/hashing` | `RevisionKeyHashingVector[]` | — | required; sorted by `name`, code point order | new | K, B | — |
| `/hashing/*/name` | `RevisionKeyVectorName` | — | required, unique | new | K, B | — |
| `/hashing/*/description` | string | — | required | new | readers | — |
| `/hashing/*/object_format` | `RevisionKeyObjectFormat` | — | required | new | K, B | — |
| `/hashing/*/config` | `RevisionKeyEffectiveConfigA1` | — | required | new | K, B | — |
| `/hashing/*/entries` | `RevisionKeyEntry[]` | — | required; in input order, deliberately unsorted in `hash-sort-order` | new (synthetic ids) | K, B | `category` is ignored by hashing |
| `/hashing/*/entries/*/path` | `RepoPath` | — | required | new | K, B | — |
| `/hashing/*/entries/*/kind` | `RevisionKeyEntryKind` | — | required | new | K, B | — |
| `/hashing/*/entries/*/object_id` | `GitObjectId` | — | required | new | K, B | — |
| `/hashing/*/entries/*/category` | `RevisionKeySourceCategory` | — | required | new | not used | — |
| `/hashing/*/expected/config_canonical` | string | — | required | Python, confirmed by Node | K, B | — |
| `/hashing/*/expected/config_digest` | `Sha256Hex` | — | required | as above | K, B | — |
| `/hashing/*/expected/preimage_hex` | `RevisionKeyHex` | bytes (hex) | required | as above | K, B (compare first) | — |
| `/hashing/*/expected/revision_key` | `Sha256Hex` | — | required | as above | K, B | — |
| `/relations` | `RevisionKeyVectorRelation[]` | — | required; sorted by `relation`, then `vectors`, code point order | new | K, B | — |
| `/relations/*/relation` | `RevisionKeyRelationKind` (`same-key` \| `different-key`) | — | required | new | K, B | — |
| `/relations/*/vectors` | `RevisionKeyVectorName[]` | — | required, at least 2; sorted, code point order | new | K, B | — |
| `/relations/*/vectors/*` | `RevisionKeyVectorName` | — | — | new | K, B | — |
| `/relations/*/reason` | string | — | required | new | readers | — |

No field of the three roots is nullable.

## How a golden is produced from today's code

No code today computes this key, so there is no golden from today's output. The key's golden is `revision-key-vectors.json`, together with the working-tree procedure in §13.

For a comparison only, today's nearest key is the semantic index's. It is computed on dev like this:

```sh
cd backend && PYTHONPATH=$PWD uv run --offline --no-project --python <venv python> \
  --with-requirements ../requirements/test.txt python -c '
from pathlib import Path
from app.services import semantic_index_service as s
e = s._source_entries_in_commit(Path("<repo>"), "HEAD", "<project dir>")
print(len(e), s._revision_key(e, project_file_rel="<anchor>"))'
```

On USB-PD-Trigger-Board `HEAD` (`0642b077…`) it selects 4 entries and gives the 32-hex key `0e240f21050b83f6ba80d36a42d65129`. The a1 record selects 9 entries:

- the 4 today's key has;
- `Outputs.kicad_jobset`;
- `assets/Schematic-Page-Template.kicad_wks`;
- three `packages3D` models.

It also leaves out the committed `Design-Outputs/3DModel/*.step`. The two keys are different algorithms; consumers switching to bundles (C1–C5) re-key their caches rather than translate keys.

To produce a record from the scratch reference (the same steps WP-K's tests take), there are two inputs:

- a config: the effective-config example for USB-PD-Trigger-Board, which is K's §4.4 resolution with no stored settings, no committed `.prism.json`, `DEFAULT_PATHS` and the anchor `USB-PD-Trigger-Board.kicad_pro`;
- `git ls-tree -r -z --full-tree HEAD` on the repository.

Then select (§5.3), canonicalize (§4.2), and hash (§8).

## Expected divergences

| Case | Today | Bundle (a1) | Why a1 is right | Consumer affected |
|---|---|---|---|---|
| CRLF working copy of an LF-committed file (`text=auto`) | SHA-1 of the raw bytes ≠ the committed blob (`semantic_index_service.py:77-87`), so it rebuilds | `git hash-object --path` normalizes, so working tree = commit (case `wt2`) | the same content gives the same key (ADR §5) | C1 index, C5 3D tab |
| LFS file hydrated in the working tree | content hash in the working tree vs. pointer blob at the commit, so they never match | pointer blob both ways when `filter.lfs.clean` is configured; otherwise a warning and a distinct but correct key | ADR §5: "LFS files contribute their pointer's blob id" | C1, C5, K's worker image (git-lfs) |
| Extent of the source set | project directory; `SEMANTIC_SOURCES` (`project_revision.py:255-260`) or `SOURCE_SUFFIXES` (`semantic_visualizer_service.py:67-81`) | the whole repository by kind, plus all symlinks and gitlinks, minus output directories (§5) | a project can read sheets, worksheets, libraries and models anywhere in the repository; the key must not go stale | all consumers: more rebuilds in multi-project repositories (Q1) |
| Files ignored by `.gitignore` in a working tree | included (`rglob`, `semantic_index_service.py:105-115`) | excluded (`git add -A`, §9) | working-tree key = the key of the commit you would make (Q4) | C1, C5 working-tree views |
| Stored Prism settings at a commit | ignored (`project_revision.path_config_at`, `project_revision.py:508-532`) | applied (§4.4) | ADR G6: a settings change changes the key, and the same settings apply at every revision | C2 Design Comparison, C3 Release Studio (commit views) |
| Working-tree config detection | filesystem walks (`path_config_service.py:574-581`) | listing-based in both modes (§4.4) | identical content must give an identical config | K |
| Files over 32 MB | size and mtime (`semantic_visualizer_service.py:197-199`) | blob id | content, not metadata | C5 |
| Every `.json` file | in the 3D fingerprint (`semantic_visualizer_service.py:80`) | only `.prism.json` | other JSON is not a KiCad input | C5 |
| Commit-keyed caches | a new commit always misses (`design_compare_service.py:115-127`, `systems/store_reviews.py:321-336`) | content-keyed: commits that do not touch the source set share a key (vectors `usb-pd-readme-only-change`, `usb-pd-output-only-change`) | reuse is the point of one key (ADR §1) | C2, C4 |
| Saved zone fills | the reference branch silently materializes the saved fills when a refill fails (ref: `zone_refill.py:67-73`); a1 per build with `--no-refill` | only a project whose stored setting says `zone_fills: "saved"`, which is in the key; otherwise a refill failure leaves stage board `pending` | one key, one content: the fill choice is an input, never a runtime fallback | C3, C5, C6 (fill provenance and the `saved-fills-used` warning) |
| Key length and path base | 32 hex; project-relative paths | 64 hex; repository-relative paths | ADR §5 says sha256; the anchor is repository-relative (G5) | storage layout |

## Example provenance

- **`RevisionKeyRecordA1.example.json`**:
  - produced by the scratch Python reference;
  - repository: the user's USB-PD-Trigger-Board (read-only), commit mode, `HEAD` = `0642b07770533173e731613a031d706c6163395e`;
  - config: the one in the effective-config example;
  - the scratch Node reference gives the same key (`faea5ace…`);
  - not trimmed (9 entries).
- **`RevisionKeyEffectiveConfigA1.example.json`**: the config of that run. K's §4.4 resolution for the repository:
  - the anchor `USB-PD-Trigger-Board.kicad_pro`;
  - `*.kicad_sch` and `*.kicad_pcb` resolve to the stem-matched root files;
  - the output directories take their defaults;
  - no stored `zone_fills`, so the field is absent (refill). The vectors cover `zone_fills: "saved"` (`usb-pd-zone-fills-saved`, `hash-zone-fills-saved`).
- **`RevisionKeyVectorsA1.example.json`**:
  - a trimmed copy of `revision-key-vectors.json`: 3 of its 30 selection vectors (the `minimal` scenario, one of them an error), 2 of 7 hashing vectors (`hash-all-kinds`, every entry kind, and `hash-zone-fills-saved`, the optional `zone_fills`), and 1 of 13 relations;
  - values are unchanged;
  - every object kind and every optional field of the vectors schema appears.
- **Other real outputs validated against `RevisionKeyRecordA1`** (not committed):
  - `fixtures/release-studio/usb-pd` and `fixtures/release-studio/cynthion` at this repository's `HEAD`: 216 entries each, because the source set is repository-wide;
  - a scratch copy of USB-PD-Trigger-Board in working-tree mode: 13 entries, with the untracked `fp-lib-table`, `sym-lib-table` and `RemoteLibrary/` parts.
