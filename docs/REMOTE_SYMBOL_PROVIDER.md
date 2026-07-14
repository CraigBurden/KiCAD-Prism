# KiCAD Prism Remote Symbol Provider

Prism exposes a KiCad-compatible remote symbol provider backed by the PostgreSQL component catalog and on-disk KiCad assets.

## What you get

- Provider discovery at `/.well-known/kicad-remote-provider`
- Same-origin provider webview at `/remote-provider/panel`
- KiCad-compatible OAuth for `REMOTE_LOGIN` (authorization code + PKCE)
- Manifest-based placement with short-lived signed asset URLs
- Inline payload fallback for provider/UI validation
- Optional CERN-style KiCad DBL export
- Datasource ZIP builder: `scripts/build_datasource_package.py`

## Storage model

| Layer | Location |
|-------|----------|
| Metadata, revisions, workflow, OAuth | PostgreSQL `catalog` (+ related) schemas |
| Canonical KiCad files | `data/projects/.kicad-prism/components/` |
| Content-addressed artifacts | `data/projects/.kicad-prism/artifacts/` |
| DBL export bundles | `data/projects/.kicad-prism/exports/kicad-dbl/` |
| KLC reports | `data/projects/.kicad-prism/validation/klc/` |

Canonical disk layout:

- `symbols/<library>/*.kicad_sym`
- `footprints/<library>.pretty/*.kicad_mod`
- `3dmodels/<library>/*.step`
- `spice/<library>/*`
- `previews/symbols/*.svg`
- `previews/footprints/*.svg`

Search uses PostgreSQL-backed catalog queries (not SQLite FTS). Only released / place-ready parts with symbol and footprint assets are exposed to KiCad.

## HTTPS requirement

For any non-loopback deployment used by desktop KiCad, serve Prism over HTTPS and ensure every workstation trusts the certificate chain. Metadata, panel, OAuth, and asset URLs are absolute and must match the public origin.

Full guide: [HTTPS and TLS](HTTPS_AND_TLS.md).

User placement steps: [user-flows/04-kicad-remote-symbols.md](user-flows/04-kicad-remote-symbols.md).

## Local HTTP smoke test

1. Start Prism (`docker compose up --build -d`).
2. Open `http://127.0.0.1:8080/.well-known/kicad-remote-provider` (through the frontend proxy) **or** `http://127.0.0.1:8000/.well-known/kicad-remote-provider`.
3. Open `/remote-provider/panel` and confirm the UI loads.
4. Provider metadata includes `"allow_insecure_localhost": true` for loopback development.

Prefer testing through the same origin KiCad will use in production (the frontend/proxy origin), not the raw backend port, once you move past localhost.

## Authentication

Prism advertises `auth.type = oauth2` when all of the following are true:

- `AUTH_ENABLED=true`
- `DEV_MODE=false`
- OIDC settings configured (`OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`)
- `SESSION_SECRET` set

Register the KiCad remote-provider callback separately from the web UI callback:

| Client | Redirect URI |
|--------|--------------|
| Web UI | `https://<host>/auth/callback` |
| KiCad provider | `https://<host>/oauth/oidc/callback` |

Provider OAuth metadata endpoints:

- `/oauth/.well-known/oauth-authorization-server`
- `/oauth/.well-known/openid-configuration`

KiCad tokens are limited to `remote_symbols.read` and cannot call Prism admin or Library Manager mutation APIs.

`SESSION_SECRET` also signs provider access/refresh/bootstrap tokens and catalog asset URL signatures.

## KiCad defaults and env overrides

KiCad defaults Prism expects:

- library prefix: `remote`
- destination directory: `${KIPRJMOD}/RemoteLibrary`

Overrides:

```env
REMOTE_PROVIDER_LIBRARY_PREFIX=remote
REMOTE_PROVIDER_DESTINATION_DIR=$${KIPRJMOD}/RemoteLibrary
REMOTE_PROVIDER_OAUTH_CLIENT_ID=kicad-prism-kicad
```

In Compose `.env` files, write `$${KIPRJMOD}` so Compose does not interpolate it to empty.

## Build the datasource ZIP

```bash
python3 scripts/build_datasource_package.py --base-url https://prism.example.com
```

Output: `dist/kicad-prism-remote-symbols.zip`.

Install from file in KiCad PCM, or add `https://prism.example.com` under Remote Symbol Settings if auto-registration does not occur.

## Manual authentication test

1. Enable real auth and HTTPS as documented.
2. Add the provider base URL in KiCad.
3. Open Remote Symbols; confirm sign-in prompt.
4. Complete SSO in the system browser.
5. Confirm catalog reload.
6. Place a released part; confirm project `RemoteLibrary` updates.

## DBL export (optional)

```bash
curl -X POST https://prism.example.com/api/catalog/exports/kicad-dbl
```

Writes `Prism.sqlite`, platform `.kicad_dbl` files, lib tables, `SchLib/`, and `PcbLib/`.

## Operational limits

- Provider OAuth is for KiCad/panel access only.
- Machine PLM access should use `/api/oauth/token` service clients or external JWTs.
- Signed asset URLs are capability-bearing until expiry; keep Prism on trusted networks.
- Connectors / live PLM sync UI is not implemented.

## Related

- [HTTPS and TLS](HTTPS_AND_TLS.md)
- [Deployment](DEPLOYMENT.md)
- [OIDC and OAuth](OIDC_OAUTH_INTEGRATION.md)
- [Library Manager flow](user-flows/03-library-manager.md)
