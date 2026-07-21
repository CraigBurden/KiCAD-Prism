# HTTPS and TLS for KiCAD Prism

This guide explains how to host Prism behind HTTPS so the web UI, OIDC login, and especially the **KiCad Remote Symbols panel** work reliably.

If you only need a quick local Docker smoke test on `http://127.0.0.1:8080`, see [DEPLOYMENT.md](DEPLOYMENT.md). For any shared office, VPN, or production host that KiCad desktops will call, use HTTPS.

## Why HTTPS matters for the Remote Symbol Panel

KiCad discovers Prism through:

```text
https://<your-host>/.well-known/kicad-remote-provider
```

That metadata document advertises absolute URLs for:

- `api_base_url`
- `panel_url` (`/remote-provider/panel`)
- OAuth authorization-server metadata (`/oauth/.well-known/...`)
- session bootstrap URLs
- signed asset download URLs

Those URLs are derived from the incoming request origin (`Host` + forwarded scheme). If TLS is terminated incorrectly, Prism may advertise `http://` URLs or an internal container hostname. The panel then fails to load, OAuth redirects break, or asset downloads fail certificate checks.

Prism sets `"allow_insecure_localhost": true` in provider metadata so **plain HTTP on loopback** can work for developers. Non-localhost deployments should treat HTTPS as mandatory.

## Target architecture

```text
KiCad desktop / browser
        |
        | HTTPS (public CA or internal CA)
        v
 TLS terminator (Caddy / Nginx / Traefik / reverse proxy)
        |
        | HTTP on Docker network (Host + X-Forwarded-* preserved)
        v
 frontend:80  (Nginx SPA + path proxy)
        |
        +-- /api/*, /oauth/*, /.well-known/kicad-remote-provider, /remote-provider/*
        v
 backend:8000 (Uvicorn with --proxy-headers)
```

Compose already builds the frontend Nginx with the correct proxy locations and forwards:

- `Host`
- `X-Real-IP`
- `X-Forwarded-For`
- `X-Forwarded-Proto`

Your outer TLS proxy must set `X-Forwarded-Proto` to `https` and preserve the public `Host`.

## Required Prism environment for HTTPS

In the root `.env`:

```env
AUTH_ENABLED=true
DEV_MODE=false
SESSION_SECRET=<long-random-value>
SESSION_COOKIE_SECURE=true
CORS_ORIGINS_STR=https://prism.example.com
PUBLIC_BASE_URL=https://prism.example.com

OIDC_ISSUER_URL=https://sso.example.com/realms/engineering
OIDC_CLIENT_ID=kicad-prism
OIDC_CLIENT_SECRET=<secret>
OIDC_SCOPES=openid email profile
OIDC_PROVIDER_NAME=SSO
BOOTSTRAP_ADMIN_USERS_STR=admin@example.com
```

`PUBLIC_BASE_URL` is the hard override for absolute URLs advertised to KiCad (Remote Symbols
metadata and OAuth endpoints). Prefer it for multi-hop proxies (ALB → Kong → Compose, outer
nginx → frontend nginx → backend). If unset, Prism derives the origin from
`X-Forwarded-Proto` / `X-Forwarded-Host` (or `Host`) and finally `request.base_url`.

Identity provider redirect URIs (exact match):

- Web UI: `https://prism.example.com/auth/callback`
- KiCad remote-provider login: `https://prism.example.com/oauth/oidc/callback`

Optional, when comments helpers must ignore request-derived hosts (wins over `PUBLIC_BASE_URL`
for comments only):

```env
COMMENTS_API_BASE_URL=https://prism.example.com
```

Restart after changing env:

```bash
docker compose up --build -d
```

## Path rules the TLS proxy must expose

Point the public hostname at the **frontend** container (recommended). Frontend Nginx already proxies KiCad/API paths.

If your proxy routes by path to individual containers instead, keep these rules:

| Public path | Upstream |
|-------------|----------|
| `/` | frontend |
| `/api/*` | backend |
| `/oauth/*` | backend |
| `/.well-known/kicad-remote-provider` | backend |
| `/remote-provider/*` | backend |

Do not strip path prefixes. Do not rewrite `/oauth` or `/.well-known` away from the public origin.

## Option A: Public hostname + Let's Encrypt (Caddy)

Repository files:

- [`deploy/Caddyfile`](../deploy/Caddyfile)
- [`docker-compose.proxy.yml`](../docker-compose.proxy.yml)

1. Edit `deploy/Caddyfile` and set your domain.
2. Ensure DNS `A`/`AAAA` records point at the host.
3. Open ports `80` and `443`.
4. Set HTTPS env vars as above.
5. Start Prism + Caddy:

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up --build -d
```

Caddy obtains and renews certificates automatically.

Verify:

```bash
curl -fsS https://prism.example.com/.well-known/kicad-remote-provider | jq .
curl -fsSI https://prism.example.com/remote-provider/panel
```

Confirm metadata URLs all start with `https://prism.example.com`.

## Option B: Internal CA / private certificates (office or VPN)

Use this when:

- Prism is only reachable on a corporate DNS name (for example `https://kicad-prism.corp.internal`)
- Certificates are issued by an internal PKI / Active Directory CA / step-ca / Smallstep / HashiCorp Vault PKI
- Clients (browsers and KiCad) must trust that CA

Repository example: [`deploy/Caddyfile.internal`](../deploy/Caddyfile.internal)

### 1. Obtain server certificate material

You need:

- `prism.crt` (leaf certificate, preferably with full chain)
- `prism.key` (private key)
- optionally `corp-root-ca.crt` (CA certificate for distribution to clients)

Recommended leaf SAN entries:

- DNS: `kicad-prism.corp.internal`
- DNS: `prism.corp.internal` (if used)
- do **not** rely on IP-only certificates if clients will use hostnames

Place files on the host, for example:

```text
deploy/certs/prism.crt
deploy/certs/prism.key
deploy/certs/corp-root-ca.crt
```

Keep private keys out of Git. Add `deploy/certs/` to local ignore rules if needed.

### 2. Configure the TLS terminator

Point Caddy or Nginx at those files. See `deploy/Caddyfile.internal` and `deploy/nginx-tls.conf.example`.

Critical headers when proxying to frontend:

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-Host  $host;
```

### 3. Trust the CA on every KiCad workstation

TLS verification fails in KiCad if only the browser trusts the CA, or if only part of the OS trust store is updated.

#### macOS

1. Copy `corp-root-ca.crt` to the Mac.
2. Open **Keychain Access**.
3. Import into **System** (preferred) or **login** keychain.
4. Double-click the CA certificate → Trust → set **When using this certificate** to **Always Trust** for SSL.
5. Restart KiCad completely (quit from dock, reopen).

#### Windows

1. Import `corp-root-ca.crt` into **Trusted Root Certification Authorities** for Local Computer (admin) or Current User.
2. Confirm with `certmgr.msc` / `certlm.msc`.
3. Restart KiCad.

#### Linux

Distribution-dependent examples:

Debian/Ubuntu:

```bash
sudo cp corp-root-ca.crt /usr/local/share/ca-certificates/corp-root-ca.crt
sudo update-ca-certificates
```

RHEL/Fedora:

```bash
sudo cp corp-root-ca.crt /etc/pki/ca-trust/source/anchors/
sudo update-ca-trust
```

Then restart KiCad.

### 4. Verify from a workstation before opening KiCad

```bash
curl -v https://kicad-prism.corp.internal/.well-known/kicad-remote-provider
openssl s_client -connect kicad-prism.corp.internal:443 -servername kicad-prism.corp.internal </dev/null 2>/dev/null | openssl x509 -noout -issuer -subject -dates
```

`curl` must succeed **without** `-k`. If you need `-k`, KiCad will also fail TLS verification.

## Option C: Existing corporate reverse proxy

If you already terminate TLS on F5, HAProxy, Traefik, Cloudflare, or Nginx Ingress:

1. Forward to `frontend:80` (or host-mapped `8080`).
2. Preserve Host.
3. Set `X-Forwarded-Proto: https`.
4. Allow request bodies up to at least 2 GB for catalog imports (frontend Nginx already sets `client_max_body_size 2g` for `/api/`).
5. Increase proxy read timeouts for first-time semantic index generation (frontend uses 300s for `/api/`).

Then set Prism `.env` exactly as in the HTTPS section above.

## OIDC and cookies behind HTTPS

| Setting | HTTPS value | Why |
|---------|-------------|-----|
| `SESSION_COOKIE_SECURE` | `true` | Prevents cookies on plain HTTP |
| `CORS_ORIGINS_STR` | exact `https://...` origin | Credentialed browser calls |
| `PUBLIC_BASE_URL` | exact `https://...` origin | Absolute URLs for KiCad Remote Symbols / OAuth |
| IdP redirect URIs | HTTPS callbacks only | Matches browser and KiCad login return URLs |
| `DEV_MODE` | `false` | Auth actually enabled |

If login appears to succeed but subsequent `/api/*` calls return `401`:

- cookie Secure flag mismatch (HTTP site with Secure cookies, or mixed content)
- wrong CORS origin
- proxy not forwarding cookies (`Cookie` header stripped)

## KiCad Remote Symbols checklist (HTTPS)

1. Metadata returns HTTPS absolute URLs:

```bash
curl -fsS https://prism.example.com/.well-known/kicad-remote-provider | jq '{api_base_url, panel_url, auth}'
```

2. Panel HTML loads:

```bash
curl -fsSI https://prism.example.com/remote-provider/panel
```

3. Build a datasource ZIP against the **public HTTPS origin**:

```bash
python3 scripts/build_datasource_package.py --base-url https://prism.example.com
```

4. In KiCad: Preferences → Remote Symbols → add provider base URL `https://prism.example.com` (or install the ZIP).
5. Open the Remote Symbols panel.
6. If auth is enabled, complete SSO in the system browser and return to KiCad.
7. Place a released, place-ready component.

Detailed product steps: [REMOTE_SYMBOL_PROVIDER.md](REMOTE_SYMBOL_PROVIDER.md) and [user-flows/04-kicad-remote-symbols.md](user-flows/04-kicad-remote-symbols.md).

## Common failure modes

### Metadata shows `http://` or `backend:8000`

Cause: outer proxy missing `X-Forwarded-Proto: https`, overwriting `Host`, or an older frontend
Nginx that forced `$scheme` on the internal HTTP hop to the backend.

Fix:

1. Set `PUBLIC_BASE_URL=https://<public-host>`
2. Preserve public Host and force `X-Forwarded-Proto: https` on the outer proxy
3. Restart proxy + Compose; re-fetch metadata

Frontend Nginx preserves an incoming `X-Forwarded-Proto` (falls back to `$scheme` for direct HTTP).

### Browser works, KiCad panel shows certificate / network error

Cause: CA not trusted by the OS trust store used by KiCad, expired leaf, wrong SAN, or TLS interception.

Fix: install/trust the internal root CA on that workstation; verify with `curl` without `-k`; confirm certificate SANs match the hostname typed into KiCad.

### OAuth completes in browser but panel stays signed out

Cause: redirect URI mismatch, mixed HTTP/HTTPS metadata, or bootstrap URL advertising wrong origin.

Fix: register `https://<host>/oauth/oidc/callback`; confirm metadata `auth.metadata_url` and `session_bootstrap_url` are HTTPS on the same host.

### `SESSION_COOKIE_SECURE=true` on plain HTTP

Cause: cookies never stick.

Fix: either enable real HTTPS or set `SESSION_COOKIE_SECURE=false` for local HTTP-only testing.

### Self-signed leaf without distributing a CA

Cause: every client must permanently bypass verification (unsupported for KiCad at scale).

Fix: issue certificates from an internal CA and distribute the CA certificate, or use a public DNS name with Let's Encrypt / public ACME.

## Security notes

- Prefer VPN or private network exposure for internal Prism hosts.
- Signed remote-provider asset URLs are time-limited and not bound to a user session; treat them as bearer capabilities.
- Do not commit private keys or production `.env` files.
- Keep `DEV_MODE=false` on shared hosts.
- Rotate `SESSION_SECRET` only when you intend to invalidate all sessions and provider-signing secrets that depend on it.

## Related docs

- [DEPLOYMENT.md](DEPLOYMENT.md)
- [REMOTE_SYMBOL_PROVIDER.md](REMOTE_SYMBOL_PROVIDER.md)
- [OIDC_OAUTH_INTEGRATION.md](OIDC_OAUTH_INTEGRATION.md)
