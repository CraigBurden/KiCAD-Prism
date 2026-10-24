# Remote Symbol Provider

KiCAD Prism exposes released Library Manager components to supported desktop
KiCad installations. The provider includes discovery metadata, a browser panel,
OAuth2 login, catalog search, previews, and placement bundles with signed asset
URLs.

## Prerequisites

- Prism is reachable from each KiCad workstation.
- Shared deployments use HTTPS with a certificate trusted by the workstation
  operating system.
- `PUBLIC_BASE_URL` is the exact external origin.
- the identity provider allows the provider callback, or password login is enabled;
- at least one component is released and place-ready.

## Verify server metadata

From a workstation:

```bash
curl -fsS https://prism.example.com/.well-known/kicad-remote-provider
curl -fsS https://prism.example.com/oauth/.well-known/oauth-authorization-server
curl -fsSI https://prism.example.com/remote-provider/panel
```

Do not use `-k`. A command that works only when certificate validation is
disabled will also fail for normal KiCad users.

Every advertised absolute URL must use the public HTTPS origin. If metadata
shows `http://`, a container hostname, or the backend port:

1. set `PUBLIC_BASE_URL`;
2. preserve `Host` at the reverse proxy;
3. set `X-Forwarded-Proto: https`;
4. restart and verify again.

## OIDC setup

Register:

```text
https://prism.example.com/oauth/oidc/callback
```

Prism's provider OAuth server accepts authorization code with PKCE and issues
tokens scoped to `remote_symbols.read`. Those tokens cannot modify Prism
projects or Library Manager state.

If the workstation already has a Prism browser session, authorize-and-done
continues. Otherwise KiCad is sent to the same Prism login page
(`/?next=/oauth/authorize…`) used by the web app, then returned to complete
the provider grant. Password-only deployments do not need a separate KiCad
password form.

## Build a datasource package

From the repository:

```bash
python3 scripts/build_datasource_package.py \
  --base-url https://prism.example.com
```

The script writes a package under `dist/`. Build it against the final public
origin; do not reuse a localhost package for production.

## Install in KiCad

Depending on the supported KiCad build:

1. install the generated datasource package through Plugin and Content Manager,
   or add the Prism provider URL manually;
2. open a schematic and the Remote Symbols panel;
3. complete SSO in the system browser when prompted;
4. search by part name, manufacturer part number, or category;
5. open a component, select a representation, and verify that both symbol and
   footprint previews change together;
6. place both the default and a non-default representation into a disposable project;
7. verify the project-local remote library files were created.

Default placement settings are:

```text
library prefix: remote
destination: ${KIPRJMOD}/RemoteLibrary
```

If KiCad uses different values, configure matching
`REMOTE_PROVIDER_LIBRARY_PREFIX` and `REMOTE_PROVIDER_DESTINATION_DIR` values in
Prism.

Clients that omit the `representation` query parameter continue to receive the
default representation. Representation-aware clients pass the selected ID to
the component detail, part manifest, inline bundle, and signed asset download
flows. Unknown and incomplete IDs are rejected rather than silently falling
back.

## Placing an earlier released revision

From `provider_version` `0.4.0` the component detail, part manifest and inline
bundle take an optional `revision` query parameter: the id of one of the
component's released revisions. The detail lists them as `released_revisions`
(`revision_id`, `version`, `released_at`, newest first) and names the revision
it describes in `revision_id`; its `manifest_url` and `inline_url` carry the
chosen `revision`, and the signed asset URLs of that manifest name it as `rev`.
The placed symbols are stamped with that revision. Only revisions that were
released and are not archived qualify: a draft, an archived revision, another
component's revision or an unknown id is refused with 404
`revision_not_released`, never served. Without `revision` the current release
is served, as before.

KiCad needs no change for this: the KiCad 10 Remote Symbols panel shows Prism's
own page and places whatever manifest or inline bundle that page sends
(`PLACE_COMPONENT`). The panel shows a revision selector next to the
representation selector when a part has more than one released revision; it
defaults to the latest.

## Placed symbol provenance

Placed symbols carry two hidden properties after the catalog metadata
fields: `Prism_Component` (the catalog component id) and `Prism_Revision`
(the released revision id that was served), both as lowercase UUID text.
KiCad copies them onto the placed instance, so a committed schematic records
which catalog revision each part came from. Both names are reserved, matched
the way custom field keys are (`prism-revision` and `Prism Revision` count,
`prismrevision` does not): a custom metadata field cannot use them, placement
replaces any stamp already in the stored symbol, and a project import treats
them as per-placement context rather than part metadata. The DBL export does
not add these properties.

After every sync Prism scans the checkout's committed schematics and records
which catalog revision each part placed (`GET
/api/projects/{id}/catalog-usage`; the project header's library button lists
them and counts parts with a newer released revision). A part without the
stamp, placed before it existed, is matched by its `remote_<library>:<name>`
symbol or its manufacturer part number, and its revision is the oldest
released revision whose symbol fields all equal the placed ones; such rows are
marked inferred, and nothing is written into the project.

KiCad keeps the stamp through its update commands (checked in the KiCad 8.0,
9.0 and 10.0.6 sources):

- **Update Symbols from Library** copies the library symbol's field text by
  default ("Update field text"), so the instance takes the stamp of the
  revision now in the project's remote library, together with the rest of
  that revision's symbol. A library symbol without the fields leaves the
  instance's stamp in place, unless "Remove fields if not in library symbol"
  is checked.
- **Update PCB from Schematic** copies symbol fields, the stamp included, to
  the footprint while "Update footprint fields" is on; "Remove extra fields"
  only removes fields the symbol no longer has.

## Search and recovery

The finder pages through the catalog rather than truncating it to the first
page. Changing the query cancels superseded searches. Detail and preview errors
are retryable; reauthenticate when the panel reports an expired session.
Placement is dispatched once per request. If an attempt fails, inspect its
status before explicitly retrying. Transfer logs are bounded and redact
credentials.

## Parts payload contract (parts_v1)

Clients must read `provider_version` from the discovery metadata before
assuming payload fields.

`0.4.0` (issue #698) is additive for clients. It records two payload changes
that shipped under `0.3.0`, and adds one request parameter:

- placed symbols carry the hidden `Prism_Component` and `Prism_Revision`
  properties, and both names are reserved
  ([Placed symbol provenance](#placed-symbol-provenance));
- placed footprints embed their 3D models, and an embedded model is no longer
  a separate `3dmodel` asset in the manifest or inline bundle
  ([3D models](#3d-models));
- new: the optional `revision` parameter and the `released_revisions` and
  `revision_id` detail fields
  ([Placing an earlier released revision](#placing-an-earlier-released-revision)).

Version `0.3.0` is a breaking change to the parts payload:

Removed in `0.3.0` — the flat inventory fields
`stock_known`, `stock_quantity`, `stock_uom`, `inventory_status`,
`local_inventory`.

Added in `0.3.0` — one availability structure carried identically by search
results, list payloads, and component detail:

```json
"supply": {
  "sources": [
    {
      "kind": "vendor",
      "id": "csv",
      "display_name": "InvenTree",
      "stock": 0.0,
      "uom": "pcs",
      "stock_status": "available",
      "fetch_status": "ok",
      "fetched_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

- Every source is `"kind": "local"` today; distributor adapters will add
  vendor rows with optional pricing fields (`unit_price`, `currency`,
  `price_break_qty`, `price_breaks`, `product_url`) in a later version.
- Clients must treat unknown kinds, extra fields, and absent optional fields
  as non-fatal.
- The admin API (`GET /api/catalog/components/{id}`) keeps the legacy flat
  fields for existing internal consumers and additionally returns `supply`.

## 3D models

Placed footprints carry their 3D models as KiCad embedded files: each
`(model ...)` points at `kicad-embed://<stem>-<sha12><ext>` and the footprint
holds the zstd-compressed data. KiCad (9 and later) moves that data into the
board's own embedded files when the board is saved, so the board file, and so
the project commit, pins the exact model of the placed revision; a fresh clone
needs no `RemoteLibrary/` files.

An embedded model is not shipped as a separate `3dmodel` asset in the manifest
or inline bundle: KiCad only writes such assets to `<prefix>_3d/`, and every
manifest asset counts against one `max_download_bytes` budget. A model is
embedded only when the footprint grows by no more than the raw file it stops
shipping, so embedding never makes a placement larger; incompressible models
(`.wrz`, `.stpz`) therefore stay external. The embedded models of one
footprint may carry at most `REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES` of
compressed data (default 16 MiB), which grows the footprint, and the board
file, by about 4/3 of that per placed part. Prism reads and compresses at most
64 MiB of raw models per footprint; a larger model is skipped from its file
size. A 64 MiB STEP model compresses to about 6-13 MiB, so with the default cap
the raw ceiling is usually the limit that applies. Every placed asset still
counts against KiCad's one `max_download_bytes` budget (16 MiB), so a part
whose embedded footprint exceeds it does not place, exactly as it would not
with the raw model shipped instead. Models that are not embedded
(over either limit, incompressible, or whose stored file is missing) keep
the shared `<destination>/<prefix>_3d/<name>` path, which is not pinned, and
are still shipped. A footprint whose text cannot take an `embedded_files`
block is placed with external model paths and logged. Footprint embedding
needs no new discovery fields; `provider_version` `0.4.0` records the change.

Prism keeps the compressed copy of each model it embeds under the catalog
store (`embedded-models/`) and reuses it, so a placed footprint's bytes do not
change when the `zstandard` library is upgraded. A copy that no longer
decompresses to its model is replaced and logged.

A project imported from a board whose footprints carry `kicad-embed://` models
gets those models back as catalog 3D model assets, under their original file
names. `scripts/report_unpinned_board_models.py` lists the boards whose placed
parts still reference the shared `<prefix>_3d` folder (placed before embedding,
with embedding off, or over the cap); see
[Operations](OPERATIONS.md#catalog-metadata-exists-but-placement-fails).

Set `REMOTE_PROVIDER_EMBED_3D_MODELS=false` to turn embedding off: every model
then keeps the destination path and is shipped as a `3dmodel` asset, as before
embedding existed. The default is `true`.

## What users can see

The provider reads the released catalog projection. Components are absent when
they are:

- still being authored or reviewed;
- archived or inactive;
- missing a required symbol or footprint;
- not the current released revision, unless a placement names an earlier
  released revision explicitly.

A blank provider can therefore indicate catalog state rather than an
authentication failure.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| provider cannot be added | URL, DNS, VPN, TLS trust, discovery metadata |
| login repeats | provider callback URI and advertised HTTPS origin |
| catalog is empty | released place-ready components and token scope |
| preview is missing | preview-generation job and catalog worker logs |
| Place is disabled | release status and required assets |
| model path is wrong | provider prefix and destination configuration (only for models above the embed cap) |
| works in browser but not KiCad | OS certificate trust and proxy interception |

Inspect:

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 catalog-worker
```

## Security notes

- Treat signed asset URLs as short-lived bearer capabilities.
- Do not expose provider tokens to browser extensions or logs.
- Use an internal VPN or access boundary when the catalog is confidential.
- Rotate the Prism session secret only during a planned sign-out event.
- Remove provider access by withdrawing the user's Prism role or identity
  provider access.

For the catalog lifecycle, see [Library Manager](LIBRARY_MANAGER.md).
