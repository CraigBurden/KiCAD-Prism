# User flow: Library Manager

Audience: `component_designer`, `component_qa`, and `admin` users.

## Enter Library Manager

From the workspace sidebar, open **Library Manager**, or navigate to:

```text
/?section=library-manager
```

Sub-views (URL-backed):

| View | Purpose |
|------|---------|
| Catalog | Browse / create / open components |
| Bulk Edit | Tabular multi-component edits |
| Import Center | Folder and project harvest sessions |
| Release Queue | QA and release transitions |
| Connectors | Placeholder (not implemented yet) |

Deep links also support component id, tab, revision, compare, and import session query parameters.

<!-- SCREENSHOT NEEDED: Library Manager catalog. assets/KiCAD-Prism-Library-Catalog.png -->

## Create or import components

### Manual create

1. Catalog → create component.
2. Fill required metadata (name, manufacturer, MPN, datasheet URL, category, …).
3. Attach symbol and footprint assets (and optional 3D/SPICE).
4. Save a draft revision.

### Folder import

1. Open Import Center.
2. Choose a configured server import root or upload/discover a library folder.
3. Review discovered candidates and remediation issues.
4. Accept proposals into draft components.

See also [IMPORT_EXISTING_KICAD_LIBRARIES.md](../IMPORT_EXISTING_KICAD_LIBRARIES.md).

### Project harvest

1. From a project visualizer selection, stage into Library Manager, **or**
2. Start a project import session in Import Center.
3. Review proposals, fix missing fields/assets, accept into drafts.

<!-- SCREENSHOT NEEDED: Import Center session with proposals. -->

## Component workspace

Open a component to:

- Edit fields and extra attributes
- Manage attached assets and previews
- Compare revisions
- View audit / evidence
- Run optional KLC validation (when enabled)
- Transition workflow stages according to your role

<!-- SCREENSHOT NEEDED: Component workspace overview tab. -->

## QA and release

Typical stage path (exact labels may vary by configuration):

1. Draft authoring (`component_designer`)
2. QA review (`component_qa`)
3. Released / place-ready

Release Queue lists items needing attention. With `CATALOG_KLC_RELEASE_GATE=block`, failing KLC evidence can prevent release.

<!-- SCREENSHOT NEEDED: Release queue. assets/KiCAD-Prism-Library-Release-Queue.png -->

## Placeability rules

A part appears in the KiCad Remote Symbols panel only when:

- workflow stage is released / place-ready
- symbol and footprint assets are attached
- the panel user can authenticate (if auth enabled)

## Bulk edit

Use Bulk Edit for systematic field updates across many components. Export CSV when you need offline review; re-import carefully according to UI validation messages.

## Connectors tab

The Connectors tab is intentionally empty today. PLM/ERP sync is not shipped. Machine API access for link-out integrations uses service clients; see [OIDC_OAUTH_INTEGRATION.md](../OIDC_OAUTH_INTEGRATION.md).

## Next

- [KiCad Remote Symbols flow](04-kicad-remote-symbols.md)
- [Remote Symbol Provider reference](../REMOTE_SYMBOL_PROVIDER.md)
