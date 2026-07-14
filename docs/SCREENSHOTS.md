# Screenshot requests

Several marketing and user-guide pages still need current screenshots. Existing files under `assets/` are reused where they remain accurate. Items below are explicitly requested from you.

When providing screenshots, prefer PNG for stills and short GIF/MP4 for motion. Capture at 2x if possible, with a realistic project (not empty placeholders). Avoid including secrets, private repo URLs, or PII.

## Priority 1 — replace or confirm existing marketing shots

| Preferred filename | Subject | Notes |
|--------------------|---------|-------|
| `assets/KiCAD-Prism-Login-Page.png` | SSO / login | Confirm still matches current login |
| `assets/KiCAD-Prism-New-Workspace.png` | Workspace gallery | Should show folders + projects; Library Manager entry if visible |
| `assets/KiCAD-Prism-Importing-Repo.png` | Import dialog | Analyze or board selection state |
| `assets/KiCAD-Prism-Visualizer-SCH.png` | Schematic viewer | Current ecad-viewer host |
| `assets/KiCAD-Prism-Visualizer-PCB.png` | PCB viewer | Current ecad-viewer host |
| `assets/KiCAD-Prism-Visualiser-3DView.png` | 3D / WebGPU | Update if UI chrome changed |
| `assets/KiCAD-Prism-Visualizer-ibom.png` | Assembly / iBOM | Optional if unchanged |
| `assets/KiCAD-Prism-Workflows.png` | Workflows | Optional if unchanged |
| `assets/KiCAD-Prism-Assets-Portal.png` | Assets | Optional if unchanged |
| `assets/KiCAD-Prism-Project-Overview.png` | Project overview | Optional if unchanged |

## Priority 2 — new screenshots (missing today)

| Preferred filename | Subject |
|--------------------|---------|
| `assets/KiCAD-Prism-Library-Catalog.png` | Library Manager catalog list |
| `assets/KiCAD-Prism-Library-Component.png` | Component workspace with assets/previews |
| `assets/KiCAD-Prism-Library-Release-Queue.png` | Release queue / QA |
| `assets/KiCAD-Prism-Library-Import-Center.png` | Import Center session |
| `assets/KiCAD-Prism-Remote-Symbols-Panel.png` | KiCad Remote Symbols panel (search results) |
| `assets/KiCAD-Prism-Remote-Symbols-Place.png` | Part detail with Place enabled, or post-place schematic |
| `assets/KiCAD-Prism-Visual-Diff.png` | Still frame of SCH or PCB visual diff (GIF already exists) |
| `assets/KiCAD-Prism-Selection-Inspector.png` | Visualizer + selection inspector |
| `assets/KiCAD-Prism-Engineering-BOM.png` | Engineering BOM table |
| `assets/KiCAD-Prism-HTTPS-Provider-Metadata.png` | Optional: browser JSON view of `/.well-known/kicad-remote-provider` on HTTPS |

## Priority 3 — remove or archive

Do **not** feature these as current product UI until commenting returns:

- `assets/KiCAD-Prism-Commenting-Mode.png`
- `assets/KiCAD-Prism-Comment-Dialog.png`
- `assets/KiCAD-Prism-Comments-Panel-Reply.png`
- `assets/KiCAD-Prism-Comment-JSON.png` (OK to keep for docs about export artifact only)

## How to deliver

1. Drop files into `assets/` using the preferred filenames above, **or**
2. Reply in chat with attachments and the target filename for each image.

After files land, docs that contain `<!-- SCREENSHOT NEEDED: ... -->` comments can have those comments removed and image tags pointed at the new files.
