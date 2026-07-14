# User flow: Project review

Audience: reviewers, designers, and anyone inspecting KiCad designs in the browser.

## Open a project

From the workspace, open a project card. URL form:

```text
/project/<projectId>
optional: ?branch=<name>&commit=<sha>
```

Sections are selected in the project sidebar. Note: the active section (Overview, Visualizers, …) is currently UI state and is not always reflected in the URL. Branch and commit pins are shareable.

<!-- SCREENSHOT NEEDED: Project overview / README. assets/KiCAD-Prism-Project-Overview.png -->

## Overview

Shows project summary and README content when present.

## Visualizers

Tabs:

| Tab | Content |
|-----|---------|
| Schematic | ecad-viewer schematic host |
| PCB | ecad-viewer PCB host |
| 3D | WebGPU board view (may require explicit generation) |
| BOM | Engineering BOM table from semantic index |
| Assembly | Interactive HTML BOM iframe when the artifact exists |

### Cross-probe and selection

1. Click a symbol or footprint in SCH/PCB, or a BOM row.
2. The selection inspector opens with fields and actions.
3. Matching objects highlight across hosts when semantic identity is ready.

Semantic identity generation can continue in the background; SCH/PCB viewing does not wait for it.

<!-- SCREENSHOT NEEDED: SCH tab with selection inspector open. -->
<!-- SCREENSHOT NEEDED: BOM table with a selected row. -->

### Import selection into Library Manager

From the selection inspector, designers with catalog rights can stage a component into an Import Center session for library onboarding.

## History and visual diff

1. Open **History**.
2. Browse commits and release tags.
3. Select two commits and run visual compare.
4. Inspect SCH/PCB image overlay and BOM field differences.
5. Optionally open a single commit with the eye / pin control to browse that revision in all project surfaces.

Visual diff is raster/overlay based today. It is not yet a semantic object-level diff and does not create review comments.

<!-- SCREENSHOT NEEDED: Visual diff UI. assets/Visual-Diff-GIF.gif or a still frame. -->

## Workflows

1. Open **Workflows**.
2. Choose a job type (design / manufacturing / 3D render as configured).
3. Start the job and watch the log terminal.
4. When complete, find outputs under **Assets** (paths depend on `.prism.json` / jobset).

<!-- SCREENSHOT NEEDED: Workflow running with logs. assets/KiCAD-Prism-Workflows.png -->

## Assets and documentation

- **Assets**: tree browser for generated and configured output paths; download or preview when supported.
- **Documentation**: markdown files from the repository.

<!-- SCREENSHOT NEEDED: Assets portal. assets/KiCAD-Prism-Assets-Portal.png -->

## Comments during review

The visualizer does not currently expose pin/thread commenting UI. Helper REST URLs for experimental KiCad integrations are available from the import flow and comments API. See [COMMENTS.md](../COMMENTS.md).

## Reviewer checklist

1. Pin the commit under review (`?commit=`).
2. Walk schematic pages and PCB.
3. Spot-check BOM fields and datasheet links.
4. Compare against previous release tag via visual diff.
5. Download manufacturing outputs from Assets if approving a release candidate.
6. Record decisions in your team process (PR, ticket, or KiCad-side comments if configured).

## Next

- [Library Manager flow](03-library-manager.md)
- [Comments](../COMMENTS.md)
