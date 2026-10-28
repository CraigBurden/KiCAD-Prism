# Divergences: semantic-index

- Member: `projections/semantic-index.json`, schema `prism.semantic_index.a2` (root `SemanticIndexA2`)
- Producer: P1 (`native/src/rs/prism-projections/src/semantic_index.rs`)
- Field map: [`native/contracts/prism/field-maps/semantic-index.md`](../../contracts/prism/field-maps/semantic-index.md) ("Expected divergences" holds the full text; maintainer decisions in [`decisions.md`](../../contracts/prism/decisions.md), "Semantic index")
- Golden: `capture/semantic_index.py` (dev's builder with the a1 additions patched in memory, then the a0 → a1 envelope), on the prepared, KiCad-upgraded sources.

One runner entry, D1's a2 envelope, applies to every case: the goldens hold the a1 envelope until they are recaptured. Every other item below is either already in the golden transform, removed by the comparison, or absent from the fixtures.

## D1. Envelope

- Today: `schema: prism.semantic_index_a0`, plus `commit`, `generator` and `generatedAt`.
- Bundle: `schema: prism.semantic_index.a2`, with no `commit`, `generator` or `generatedAt` (decisions, Semantic index 1), and `designKey` in place of a1's `sourceRevisionKey` (bundle-format.md §2.3).
- Why: a member is keyed by revision key, not by commit. The generator is recorded in `bundle.json`. A wall-clock time would break determinism.
- Consumer: C1 (`frontend/src/types/prism-selection.ts` literal type, ETag); K (job details).
- Fixtures: all 32 goldens.
- Runner: rule `semantic-index/envelope-a2` (`divergences.py`), cases `["*"]`. The golden transform writes the a1 envelope, so until the goldens are recaptured the rule sets the golden's `schema` to a2 and moves its `sourceRevisionKey` to `designKey`, as an a2 producer writes it. The key's value is non-semantic under either name (`members.py`).

## D2. Revision key

- Today: 32 hex over the semantic sources.
- Bundle: the 64-hex design revision key (ADR §5).
- Consumer: C1 comment anchors (decisions, Semantic index 2).
- Fixtures: all. The golden stores a stand-in, `sha256("prism.revision_key.a1\0stand-in\0" + today's key)`. Today's key is recorded in `capture.json` notes.
- Runner: ignored. `/sourceRevisionKey` is non-semantic in `members.py`.

## D3. Key order (maps in code point order, structs in declared order)

- Consumer: C1 inspector `fields` order.
- Fixtures: all, in bytes only.
- Runner: nothing to do. The comparison treats objects as key sets.

## D4. KiCad ≤ 7 boards (`tstamp`, `fp_text reference`)

- Superseded by the source upgrade (decisions, Occurrences 1 and Semantic index 8). The golden is built on the upgraded copy, so today's kicad_monkey reads `(uuid …)` and `(property "Reference" …)` from the same bytes the bundle parses.
- Measured against W0, whose output was built on the un-upgraded sources:
  - `rs-cynthion`: 348/348 footprint ids (was 0), 5723 `netByPcbUuid` entries (was 0), 1343/1343 terminals with `pcbPadUuid` (was 0/1342), 348 components with `pcbRefs` (was 0).
  - Board-net reconciliation now folds 52 schematic nets into 26 board nets, giving 427 nets (was 375).
  - `rs-synthetic`: 3/3 footprint ids, 10 `netByPcbUuid` entries.
- The field map's D4 row predicted something different: ids present but references still empty, so `components[].pcbRefs` and `pcbPadUuid` unchanged. That prediction no longer holds, because the upgrade also writes `Reference` properties.
- Runner: nothing to do.

## D5. Serialization (escapes, float text, trailing LF)

- Runner: nothing to do. Values are compared, not bytes.

## D6. Graphical-pin-only terminals (`pinName`/`pinType` absent, not `""`)

- The golden patch adds both fields only when `"pin_type" in raw_terminal` (decisions, Semantic index 7).
- Fixtures: no committed fixture has such a terminal.
- Runner: nothing to do.

## D7. Design Comparison input / D8. Release Studio digests

- These are consumer-side migrations (C2, C3). They do not affect the member's comparison.

## D9. Repository-relative paths

- Today: `sheetInstances[].page`, `parentPage`, `buses[].page`, `nets[].schematicRefs[].page` and diagnostic `path` are relative to the project directory.
- Bundle: each is a `RepoPath`, and `sheetInstanceUid` (which hashes `page`) is computed from that `RepoPath`.
- Golden: the patched module's `_relative_schematic_page` resolves against the repository root (`ctx.src`), so `page`, `parentPage`, the placements behind `schematicRefs` and `sheetInstanceUid` all derive from the `RepoPath`. Diagnostic `path` values go through `ctx.repo_path`.
- Fixtures: every committed fixture has `project_dir == ""`, so this is the identity (28 goldens equal W0's value for value; see the capture report).
- Checked on a copy of `design_variants/oracle` placed under `hw/`: 5 `page`, 4 `parentPage` and 5 `sheetInstanceUid` values change, and nothing else does.
- Runner: nothing to do.

## D10. Field scan over the reached schematics

- Today: every `.kicad_sch` under the project directory, later files overwriting earlier ones by symbol UUID.
- Bundle: the root schematic and the sheets it reaches.
- Why: an unreached copy of a sheet (backup, old revision) is not the design.
- Consumer: component fields in the semantic index and the BOM.
- Fixtures: no committed fixture has an unreached schematic copy (`board-objects.md` D11: 0 documents outside the closure on all 33), so every golden is unchanged. The 21 C2r bundle-gate trees build byte-identical archives with and without this change.
- Runner: nothing to do.

## D11. Bus alias members are signal names (KiCad 10), not further aliases

- Today: kicad_monkey expands an alias member that names another alias (`OUTER: [X{INNER}, Y]` style nesting through a member list) and refuses a cycle, so a project whose alias lists its own name (`FAN_TACH: [FAN_TACH, FAN2_TACH]`, the SAS R3 Base) failed `design.json` with "bus alias cycle".
- Bundle: an alias's direct members are signal names and are never looked up as aliases again; vector and group syntax inside a member still expands (and `A: [X{A}]` still fails closed). A self-reference or a cycle builds.
- Why: KiCad 10.0.6's netlist does the same. With the `project_bus_alias_hierarchy` fixture's aliases replaced by `CTRL: [INNER, CTRL_B], INNER: [CTRL_A]`, `CTRL_A` is not bused (`/CTRL_A` and `/MEMBER_SHEET/CTRL_A` stay separate nets); `INNER: [CTRL]` (a cycle) and `CTRL: [CTRL, CTRL_B]` give the same nets, with no error.
- Consumer: every reader of the schematic nets (`design.json`, the semantic index, occurrences, system interface).
- Fixtures: none of the parity cases nests or cycles aliases; `prism-kicad-core/tests/schematic_bus.rs` and `project_bus_alias_design.rs` pin the behaviour. `crate_version` 0.10.0.

## D12. Sub-sheets: KiCad 9 private fields, letter-case matches and absent files

- Today: kicad_monkey fails a schematic whose field carries KiCad 9's bare `private` flag, and fails the design when a sub-sheet file is absent.
- Bundle: a private field is read like any other (KiCad's netlist keeps it; the plotter skips it, as KiCad draws it only in the symbol editor). A sub-sheet reference that matches exactly one source-set schematic only when letter case is ignored reads that file and warns `sheet-path-case`; an absent sub-sheet is empty and warns `sheet-missing` (cli-spec.md §5.2.2).
- Why: KiCad 10.0.6 parses `(property private …)` and loads an absent sheet file empty (`SCH_IO_KICAD_SEXPR::loadHierarchy`). It opens a sheet file through the file system, so a letter-case-only mismatch resolves on Windows and macOS, where these designs are authored, and is empty on Linux. The bundle follows the authoring platforms.
- Consumer: every reader of the schematic (`design.json`, the semantic index, occurrences, the plots).
- Fixtures: none of the parity cases has private fields, a mis-cased or an absent sheet; `prism-kicad-core/tests/schematic_private_properties.rs`, `schematic_private_drawing.rs`, `schematic_bundle.rs` and `prism-kicad-cli/tests/exits.rs` pin the behaviour. `crate_version` 0.11.0.

## D13. Pins that share a number pair with saved pins in order

- Today: kicad_monkey keys a placed symbol's saved pins by number, so two library pins with one number (a connector's mounting pads) take the same pin UUID, and a design whose two such pins sit on different nets fails "one semantic terminal source resolves to multiple local nets".
- Bundle: the nth library pin with a number, over every unit of the placed body style, takes the nth saved `(pin "N" (uuid …))`.
- Why: KiCad 10.0.6 pairs them the same way (`SCH_SYMBOL::updatePins`); its netlist gives each pin its own net (`unconnected-(J3-25-PadMounting)`, `unconnected-(J3-26-PadMounting)`).
- Consumer: every reader of the schematic nets and terminals.
- Fixtures: none of the parity cases repeats a pin number; `prism-kicad-core/tests/compiled_graph_producer.rs` pins the behaviour. `crate_version` 0.11.0.

## D14. Schematic nets follow KiCad 10.0.6's connection graph

- Today: kicad_monkey's connectivity differs from KiCad 10.0.6 in several rules, so a design can get different nets or net names from KiCad's own netlist.
- Bundle: these rules match `eeschema/connection_graph.cpp` at 10.0.6.
  - A bus wire entry drawn between two wires joins them (`SCH_BUS_WIRE_ENTRY::ConnectionPropagatesTo`).
  - A global label and a global power symbol with one name are one net, and equal global drivers name the net alphabetically (the `name_to_sgs` pre-pass).
  - A global label meets a local label of the same text on its sheet.
  - Buses carrying one global label join member by member.
  - Stacked no-connect pins stay apart.
  - A sheet pin inside a bus segment pairs with that bus.
  - A placed symbol resolves its library symbol by its exact name first.
  - Local power nets carry their sheet path.
  - A net whose only driver is one pin is `unconnected-(…)`, and a `~` pin name counts from file version 20250318.
    The nine design-variant and synthetic goldens with such nets carry KiCad's names (`unconnected-(R1-~-Pad1)`) and their net uids.
  - A unit's `(unit_name …)` replaces its letter in net names (`SCH_SYMBOL::SubReference`).
  - Placed symbols read `(body_style N)` as well as `(convert N)`.
- Why: checked net for net against KiCad 10.0.6's `kicad-cli sch export netlist` on the committed fixtures and on a corpus of 34 production KiCad 9/10 projects. Every committed fixture KiCad loads matches.
- Not emulated:
  - the `_N` order of colliding weak names (KiCad's subgraph creation order);
  - the path prefix of a bus member shared by a root local bus and a sheet's global bus;
  - an order-dependent hierarchical rename after the global merge.
- Consumer: every reader of the schematic nets (`design.json`, the semantic index, occurrences, system interface).
- Fixtures: `prism-kicad-core/tests/schematic_kicad_connectivity.rs`, `schematic_connectivity.rs` and `schematic_kicad_forms.rs` pin each rule with a synthetic design. `crate_version` 0.12.0.
