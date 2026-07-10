# UI Change Request

## Screenshots

- Current UI screenshot 1: Existing Visualizer on `origin/main` (no supplied annotation).
- Current UI screenshot 2: Semantic viewer branch and Keybored02 integration inspected during feasibility.
- Annotation notes: Preserve native-like ecad-viewer schematic/PCB rendering and isolate WebGPU readiness UI to the 3D tab.

## Where

- Route(s): `/project/:projectId`, Visualizers section.
- Screen/component name(s): Visualizer shell, shared selection inspector, 3D tab, BOM tab, Assembly Assistant tab.

## Before -> After

1. Keep ecad-viewer as the Schematic and PCB renderers.
2. Replace online-3d-viewer with the Prism WebGPU renderer in an isolated 3D tab.
3. Use five tabs: Schematic, PCB, 3D, BOM, Assembly Assistant.
4. Centralize SCH/PCB/3D/BOM selection and cross-probe state.
5. Auto-open a ShadCN-styled selection inspector after selection; Escape clears selection.
6. Keep 3D generation explicit and cache artifacts by source revision and generator version.
7. Render BOM as a dense engineering table with required fields first and remaining symbol fields afterward.
8. Allow selecting individual BOM references for cross-probe highlighting.
9. Reserve stable source identities and selection origins for future semantic visual diff.
10. Reserve element and world-coordinate anchors for future `C` commenting mode integration.
11. Keep the 3D renderer mounted after its first activation and restore the current selection when its tab becomes visible.
12. Collapse the embedded 3D controls to a narrow rail without covering or shrinking the canvas incorrectly.
13. Preserve cross-probed PCB highlights while the pointer moves, until a new click or Escape clears/replaces selection.
14. Group BOM rows by Value and provide persistent, keyboard-accessible column resizing with a reset action.
15. Remove ecad-viewer's duplicate property panel when Prism owns the selection inspector.
16. Add schematic page shortcuts: `[` previous, `]` next, and `Alt+Backspace`/`Option+Delete` parent sheet.
17. Replace unknown item labels with context-aware component, net, terminal, wire, label, pad, and footprint names.
18. Give the Prism inspector type-specific pages with breadcrumbs and reserved Library Manager/component-database actions.
19. In 3D, toggle net isolation with `I`; isolation hides the board substrate and restoring the board exits isolation.
20. Preserve copper-layer material colors for isolated net geometry while retaining green emphasis in contextual/non-isolated view.
21. Upgrade BOM filtering to token-aware, field-aware search with trailing-space exact reference locking.
22. Make schematic previous/next and parent shortcuts follow exact sheet-instance hierarchy paths at arbitrary depth.
23. Keep the embedded Prism renderer explicitly 3D-only and remove temporary implementation diagnostics before handoff.

## Constraints

- New dependencies allowed: no; use existing React, Tailwind, ShadCN/Radix and lucide-react.
- Dark mode impact: all additions use existing semantic tokens.
- Breakpoints to verify: desktop primary; narrow layouts must keep tabs scrollable and the inspector usable.
- Behavior constraints: SCH/PCB must never wait for semantic index or WebGPU assets; 3D selections defer until ready.
- Non-goals: replacing ecad-viewer 2D rendering, GitHub issue creation, and complete visual diff UI.

## Done-When Checklist

- [x] Schematic and PCB load independently through ecad-viewer.
- [x] Five requested tabs are present and Assembly Assistant retains iBoM.
- [x] Selection inspector auto-opens and Escape clears selection.
- [x] Cross-probe routes through a Visualizer-level bus.
- [x] Missing/stale WebGPU assets affect only the 3D tab.
- [x] Artifact readiness includes source revision and generator version.
- [x] BOM shows required columns before additional symbol fields.
- [x] No hardcoded colors introduced.
- [x] Loading, empty, stale, generating and error states remain valid.
- [x] Keyboard focus and labels remain accessible.
- [x] The 3D renderer survives tab switches and net/component selection still resolves to the intended feature.
- [x] Cross-probing into 3D frames the selected feature after the tab becomes visible.
- [x] Collapsing 3D controls leaves only the narrow rail.
- [x] PCB hover does not erase a cross-probed highlight.
- [x] BOM rows group by Value and columns resize/reset accessibly.
- [x] Only the Prism inspector appears for ecad selections.
- [x] Schematic page navigation shortcuts work without intercepting text entry.
- [x] Inspector item types and type-specific placeholder integrations are resolved.
- [x] `I` toggles 3D net isolation only while the 3D tab is active and stays synchronized with the Isolate button.
- [x] Isolated nets use layer colors; non-isolated highlighted nets use green.
- [x] BOM reference prefixes avoid unrelated substring matches and trailing whitespace locks an exact reference.
- [x] JTYU-OBC previous/next and parent navigation works across multi-level hierarchy instances.
- [x] The embedded WebGPU element does not initialize legacy schematic or BOM workspaces.
- [x] Temporary navigation diagnostics and generated local-only files are excluded from the branch.
