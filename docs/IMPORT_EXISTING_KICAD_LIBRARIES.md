# Import Existing KiCad Libraries

This guide covers migrating existing KiCad component libraries into Prism's SQLite-backed component catalog.

Prism uses two separate layers:

- canonical files on disk under `data/projects/.kicad-prism/components`
- database rows that index components, reusable assets, preview status, and component-to-asset links

The scripts in this repo help convert existing KiCad libraries into that structure and generate a CSV that can be uploaded through the Library Manager Import Dialog.

## Expected Source Directory

The bulk importer expects a source root with these optional folders:

```text
EEE_KiCAD_Libraries/
  symbols/
    packed_or_single_symbol_files.kicad_sym
  footprints/
    LibraryName.pretty/
      FootprintName.kicad_mod
  3D/
    LibraryName/
      Model.step
  spice/
    LibraryName/
      Model.lib
```

Supported files:

- symbols: `.kicad_sym`
- footprints: `.kicad_mod`
- 3D models: `.step`, `.stp`
- SPICE: `.lib`, `.mod`, `.mdl`, `.cir`, `.sub`, `.subckt`, `.spice`

The importer writes Prism canonical files into:

```text
data/projects/.kicad-prism/components/
  symbols/
  footprints/
  3dmodels/
  spice/
  previews/
  revisions/
```

For a normal Docker deployment, Prism creates this directory tree automatically on backend startup. The importer also creates the same tree if you run it before the backend has created any assets.

## Script 1: Split Packed Symbols Only

Use `scripts/split_kicad_symbols.py` when you only want to convert packaged `.kicad_sym` libraries into KiCad v10-style one-symbol-per-file output.

Example:

```bash
python3 scripts/split_kicad_symbols.py \
  ./EEE_KiCAD_Libraries/symbols \
  /tmp/prism-split-symbols \
  --report-json /tmp/prism-split-symbols-report.json
```

Useful options:

- `--kicad-cli /path/to/kicad-cli`: explicitly choose KiCad CLI.
- `--no-kicad-cli`: use Prism's built-in fallback splitter.
- `--strict-kicad-cli`: fail instead of falling back when `kicad-cli sym upgrade` fails.
- `--flat`: write all generated symbol files directly into one output directory.
- `--overwrite`: allow overwriting existing different output files.
- `--dry-run`: report what would be processed without writing files.
- `--report-json path`: write a machine-readable report.

The script first tries:

```bash
kicad-cli sym upgrade --force --output <output-dir> <input-file>
```

If KiCad CLI cannot split a file and `--strict-kicad-cli` is not set, the script falls back to Prism's built-in top-level symbol splitter.

## Script 2: Import Libraries Into Prism Storage

Use `scripts/import_kicad_library_assets.py` for the normal migration workflow. It can:

- normalize and split packed symbols
- copy footprints, STEP models, and SPICE files into canonical storage
- register reusable asset rows in SQLite
- generate asset-scoped symbol and footprint previews
- generate a component metadata CSV with asset-link columns

Run it inside the backend container so the script has backend dependencies, KiCad CLI, the Compose network, and the same `/app/projects` path that the backend uses.

Example:

```bash
docker compose run --rm backend \
  python3 /app/scripts/import_kicad_library_assets.py \
    /app/../EEE_KiCAD_Libraries \
    --store-root /app/projects/.kicad-prism/components \
    --csv-store-root /app/projects/.kicad-prism/components \
    --component-csv /app/projects/imports/eee-kicad-components.csv \
    --report-json /app/projects/imports/eee-kicad-import-report.json
```

If your source library is outside the Compose context on your host system, use the `-v` (volume mount) flag in Docker to dynamically pass the folder into the container without copying files physically.

For example, to mount a folder located at `/path/to/my_libraries` on your host machine to `/app/custom_imports` inside the Docker backend container, execute:

```bash
docker compose run --rm \
  -v /path/to/my_libraries:/app/custom_imports:ro \
  backend \
  python3 /app/scripts/import_kicad_library_assets.py \
    /app/custom_imports \
    --store-root /app/projects/.kicad-prism/components \
    --csv-store-root /app/projects/.kicad-prism/components \
    --component-csv /app/projects/imports/custom-components.csv \
    --report-json /app/projects/imports/custom-import-report.json
```

As the script processes your files, it will explicitly output the current progress (e.g. `Processing symbol library: MyLib.kicad_sym ...` and `-> Extracting symbol: Resistor_10k`) so you can directly monitor the operation.

For a host-side dry run without touching SQLite:

```bash
python3 scripts/import_kicad_library_assets.py \
  ./EEE_KiCAD_Libraries \
  --store-root /tmp/prism-component-store \
  --component-csv /tmp/prism-components.csv \
  --csv-store-root /app/projects/.kicad-prism/components \
  --no-index-db \
  --no-previews \
  --dry-run
```

Useful options:

- `--store-root path`: Prism canonical store root. In Docker this is normally `/app/projects/.kicad-prism/components`.
- `--database-url path`: explicit SQLite catalog path. Normally omit this in Docker and let backend settings use `CATALOG_SQLITE_PATH`.
- `--no-index-db`: write canonical files only; do not create SQLite asset rows.
- `--no-previews`: skip preview generation.
- `--skip-symbol-upgrade`: do not run `kicad-cli sym upgrade` before splitting symbols.
- `--overwrite`: overwrite conflicting canonical files instead of writing suffixed names.
- `--dry-run`: report what would be imported without writing files or DB rows.
- `--strict`: exit non-zero if any asset fails to import.
- `--report-json path`: write import stats and errors.
- `--component-csv path`: write a CSV for the Library Manager Import Dialog.
- `--csv-store-root path`: root path to write into CSV asset-link columns.

Use `--csv-store-root /app/projects/.kicad-prism/components` when the generated CSV will be uploaded through the Docker-hosted Library Manager. This ensures asset paths in the CSV match paths visible to the backend.

## Generated CSV Contract

The generated CSV is intended for the Library Manager Import Dialog.

Required metadata columns:

- `value`
- `datasheet`
- `description`
- `manufacturer`
- `manufacturer_part_number`

Optional metadata columns:

- `category`
- `package_name`
- `vendor`
- `vendor_part_number`
- `mass_g`
- `rqjc_c_w`
- `rqjc_top_c_w`
- `temp_max_c`
- `temp_min_c`
- `power_dissipation_w`
- `rate`
- `sap_code`

Optional asset-link columns:

- `symbol_file_path`
- `symbol_target_library`
- `symbol_target_name`
- `footprint_file_path`
- `footprint_target_library`
- `footprint_target_name`
- `model_3d_file_path`
- `spice_file_path`

CSV behavior in the Library Manager:

- Rows are upserted by `manufacturer_part_number`.
- Rows with no asset columns become metadata-only components.
- Rows with only a symbol or only a footprint become partial components.
- Rows with valid symbol and footprint links become place-ready components.
- Blank asset columns do not detach existing links.
- Invalid canonical asset paths fail validation before anything is imported.

The script fills missing required metadata from symbol properties where possible. If a required field is missing from the symbol file, it writes a placeholder such as `TBD` and increments `component_csv_required_placeholders` in the JSON report. Review those rows before importing.

## Database Object Structure

It's important to understand *how* Prism stores component data to see why we use both a Python ingestion script and a UI-based CSV import step. In the PostgreSQL database, physical files and the components themselves exist separately:

1. **Assets (`assets` table):** This contains canonical representations of reusable physical files (symbols, footprints, 3D models). To prevent data duplication, different components can safely reference the exact same asset row without redefining it. The Python script physically splits and copies your files into the V10 KiCAD standard, indexing them into the `assets` table. It does *not* create user-facing components.
2. **Components (`components` & `component_revisions` tables):** This is the user-facing metadata element containing attributes like `Manufacturer`, `Part Number`, `Value`, and descriptive keywords.
3. **Links (`revision_assets` table):** This associates physical files (Assets) to the unified logical entity (Component).

By generating a CSV out of your symbols, the Python script prepares the bridge. When you upload that CSV via the **Import Components Dialog Box** inside the Prism Workspace, the backend performs upserts into the `components` structure and builds the proper linkage entries to your previously uploaded backend `assets`.

## Typical Migration Workflow

1. Arrange the source library folders under one root, for example `EEE_KiCAD_Libraries`.
2. Run the importer inside Docker to populate canonical storage and generate previews.
3. Review the JSON report for errors and placeholder counts.
4. Review the generated CSV and correct metadata placeholders.
5. Open KiCAD Prism.
6. Go to `Apps & Integrations` -> `Library Manager`.
7. Use the Import Dialog to upload the generated CSV.
8. Verify imported components in the Library Manager.
9. Release only the components that are QA-approved and place-ready.
10. Open the KiCad Remote Symbols panel and confirm released components appear.

## Troubleshooting

### Backend dependencies are not available

The importer depends on backend Python packages. If host-side execution fails with a dependency error, run it inside the backend container:

```bash
docker compose run --rm backend \
  python3 /app/scripts/import_kicad_library_assets.py --help
```

### Preview generation fails

Preview generation is best-effort. Imports can succeed while preview status is `failed`.

Check:

- backend image includes KiCad CLI v10
- symbol and footprint files are valid KiCad files
- the target library and target name match the generated canonical asset

You can retry previews later from the Library Manager component detail pane with `Regenerate`.

### CSV asset paths do not resolve

Use paths that are visible to the backend container. For Docker-hosted Prism, prefer:

```bash
--csv-store-root /app/projects/.kicad-prism/components
```

If the CSV contains host-only paths such as `/Users/...`, the backend container will not be able to resolve them unless that host path is also mounted into the container.

### Existing files conflict

By default, conflicting canonical files are not overwritten. The importer writes suffixed names for symbol and footprint conflicts where possible, or records an error.

Use `--overwrite` only when you intentionally want the migration to replace existing canonical files.
