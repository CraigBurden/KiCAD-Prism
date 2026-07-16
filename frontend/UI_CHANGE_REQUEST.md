# UI Change Request

## Screenshots

- Current UI screenshot: `/var/folders/16/cv6qs1kd1hlg28vrg96rsg040000gq/T/codex-clipboard-08ec566c-f774-44c4-a11a-99e24503dd77.png`.
- Annotation notes: Remove the semantic glTF eyebrow, project title, and persistent active-status copy from the 3D drawer. Promote the PCB/3D segmented control into that space so Layers follows immediately below.
- Reference implementation: Reuse and polish the existing semantic viewer Stackup workspace as a full-page Visualizer tab.

## Where

- Route(s): `/project/:projectId`, Visualizers section.
- Screen/component name(s): Visualizer tab bar, WebGPU 3D drawer, Stackup Viewer, shared WebGPU asset-readiness states.

## Before -> After

1. Restore the PCB/3D segmented-control behavior after its move into the drawer header.
2. Give the selected PCB/3D mode an unambiguous primary-color active state.
3. Reduce the cross-section graphic scale slightly.
4. Make the cross-section card independently scrollable while the right-side information remains stationary.
5. Append millimetre units to impedance-class values.
6. Strengthen the visual hierarchy of Fabrication, Layers Stackup, and Impedance Net Classes headings.
7. Normalize via endpoints from layer IDs, endpoint IDs, or layer masks and render distinct thru, blind, and buried spans.
8. Put a true thickness dimension and available layer metadata directly beside every cross-section layer.
9. Keep layer-table and graphic hover highlighting synchronized by stable layer ID.
10. Auto-scroll the independent cross-section pane to the matching layer when a layer-table row is hovered or focused.

## Constraints

- New dependencies allowed: no; use existing React, Tailwind, ShadCN/Radix and lucide-react.
- Dark mode impact: all additions use existing semantic tokens.
- Breakpoints to verify: desktop primary; narrow layouts must keep tabs scrollable and the inspector usable.
- Behavior constraints: SCH/PCB must never wait for semantic index or WebGPU assets; 3D selections defer until ready.
- Behavior constraints: Stackup remains on the same mounted semantic viewer and generated-asset contract.
- Behavior constraints: scrolling the cross-section must not move the side information at desktop widths.
- Behavior constraints: table-driven reveal must scroll only the cross-section pane, never the side inspector or page.
- Non-goals: changing the stackup artifact schema, replacing ecad-viewer 2D rendering, or adding a new backend endpoint.

## Done-When Checklist

- [x] PCB and 3D both switch modes and expose an active pressed state.
- [x] The selected mode uses Prism's primary theme color in light and dark modes.
- [x] The cross-section graphic is slightly smaller and scrolls independently on desktop.
- [x] Side summaries and tables remain stationary while the cross-section scrolls.
- [x] Impedance-class measurements display `mm` values.
- [x] Requested Stackup section headings are visually prominent.
- [x] Thru, blind, and buried spans classify and render distinctly.
- [x] Narrow layouts retain a usable document-style scroll flow.
- [x] Frontend lint/build and semantic viewer build pass.
- [x] Cross-section callouts show thickness, role/subtype, material, and dielectric properties when available.
- [x] Total board thickness is dimensioned on the graphic.
- [x] Hovering or focusing a layer-table row highlights and centers the corresponding graphic layer.
- [x] Table-driven reveal changes only the diagram scroll position; it does not programmatically scroll the side panel or outer page.
