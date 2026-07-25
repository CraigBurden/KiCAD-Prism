# OIDC and OAuth2 Integration

KiCAD Prism supports three related auth paths:

1. OIDC for human login into the Prism web UI (session cookie).
2. OAuth2 for the KiCad Remote Symbols panel (`remote_symbols.read`).
3. OAuth2 bearer tokens for machine-to-machine API access (PLM/MRP).

For HTTPS cookie and redirect requirements, also read [HTTPS and TLS](HTTPS_AND_TLS.md).

## Human SSO (web UI)

Configure Prism as an OIDC client against your identity provider:

```env
AUTH_ENABLED=true
SESSION_SECRET=
OIDC_ISSUER_URL=https://sso.example.com/realms/engineering
OIDC_CLIENT_ID=kicad-prism
OIDC_CLIENT_SECRET=
OIDC_SCOPES=openid email profile
OIDC_EMAIL_CLAIM=email
OIDC_NAME_CLAIM=name
OIDC_PICTURE_CLAIM=picture
OIDC_PROVIDER_NAME=SSO
OIDC_TOKEN_AUTH_METHOD=client_secret_post
CORS_ORIGINS_STR=https://prism.example.com
PUBLIC_BASE_URL=https://prism.example.com
```

Generate `SESSION_SECRET`:

```bash
openssl rand -base64 48
```

The backend validates all of the above at startup and **refuses to boot** if
`AUTH_ENABLED=true` with incomplete OIDC settings, a missing or weak
`SESSION_SECRET`, or no `PRISM_DATABASE_URL`. Earlier releases silently disabled
authentication in that situation and served every request as an admin guest.
Authentication is now switched by `AUTH_ENABLED` alone; `DEV_MODE` no longer
affects it.

`SESSION_COOKIE_SECURE` is derived from `PUBLIC_BASE_URL` unless you set it
explicitly, so an HTTPS deployment gets a `Secure` cookie without extra steps.

Register redirect URIs in the identity provider:

| Flow | Redirect URI |
|------|--------------|
| Prism web UI | `https://prism.example.com/auth/callback` |
| KiCad remote-provider login | `https://prism.example.com/oauth/oidc/callback` |

Local Docker HTTP testing (not for Remote Symbols production):

- Web UI: `http://127.0.0.1:8080/auth/callback`
- Vite dev: `http://127.0.0.1:5173/auth/callback`

Google Sign-In uses the same generic OIDC fields:

```env
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_SCOPES=openid email profile
OIDC_EMAIL_CLAIM=email
OIDC_NAME_CLAIM=name
OIDC_PICTURE_CLAIM=picture
OIDC_PROVIDER_NAME=Google
OIDC_TOKEN_AUTH_METHOD=client_secret_post
```

JumpCloud US: `https://oauth.id.jumpcloud.com/`  
JumpCloud EU: `https://oauth.id.eu.jumpcloud.com/`

### Login flow

The browser never generates its own OIDC parameters. `POST /api/auth/login/start`
mints the `state`, `nonce`, and PKCE verifier server-side, returns only the
finished authorization URL, and pins all three to that browser in a short-lived
HttpOnly transaction cookie.

1. `POST /api/auth/login/start` → transaction cookie + authorization URL
2. Identity provider redirects to `/auth/callback?code=…&state=…`
3. `POST /api/auth/login` validates `state` against the transaction cookie
4. Token exchange sends the PKCE `code_verifier` (S256)
5. `id_token` verified against JWKS: signature, `iss`, `aud`, `exp`, `iat`, `sub`
6. `nonce` compared to the server-issued value; a mismatch or absence fails
7. `userinfo` is discarded unless its `sub` matches the `id_token`
8. A row is created in the session store and its opaque id is set as the cookie

Because the client id and endpoint URLs are no longer published through
`/api/auth/config`, an attacker cannot reconstruct a Prism-looking authorization
request from public data alone.

### Sessions

Sessions live in PostgreSQL (`workspace.user_sessions`) and store only a SHA-256
digest of the session id, so a database dump yields no usable cookies. This makes
sign-out real:

| Endpoint | Effect |
|----------|--------|
| `POST /api/auth/logout` | Revokes the calling session immediately |
| `GET /api/auth/sessions` | Lists the caller's live sessions |
| `POST /api/auth/sessions/revoke-others` | Signs out every other browser |
| `POST /api/auth/sessions/revoke-user/{email}` | Admin-only; terminates an account's sessions |

Deleting a role assignment through `DELETE /api/settings/access/users/{email}`
also revokes that account's sessions, so withdrawing access takes effect at once
rather than when the cookie expires.

`SESSION_IDLE_TIMEOUT_MINUTES` optionally revokes sessions that go unused.
Authentication endpoints are rate limited across all workers via
`AUTH_LOGIN_RATE_LIMIT` and `AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS`.

> **Upgrade note.** Session cookies changed format (`v1` → `v2`). Everyone is
> signed out once on upgrade and must log in again. Benchmark cookies can no
> longer be forged offline; see `scripts/mint_benchmark_session.py`.

Role resolution uses PostgreSQL role assignments, bootstrap admins, and optional `DEFAULT_VIEWER_DOMAINS_STR`.

`CORS_ORIGINS_STR` must list exact browser origins. Do not use `*` with session cookies.

## KiCad Remote Symbol Provider OAuth

KiCad discovers `/.well-known/kicad-remote-provider`, follows Prism's `/oauth/*` authorization-code + PKCE flow, and receives a bearer token scoped to `remote_symbols.read`.

Those tokens can read remote-symbol provider endpoints only. They cannot call Prism admin or Library Manager mutation APIs.

This path is separate from `/api/oauth/token` (machine clients).

Production checklist: [REMOTE_SYMBOL_PROVIDER.md](REMOTE_SYMBOL_PROVIDER.md) and [HTTPS and TLS](HTTPS_AND_TLS.md).

## PLM / InvenTree link-out flow

Intended loose coupling:

1. An InvenTree (or other PLM) plugin authenticates to Prism with OAuth2.
2. The plugin calls Prism read APIs to discover projects, releases, files, and links.
3. The PLM stores Prism URLs on parts, assemblies, attachments, ECOs, or work orders.
4. A user clicks the link and lands in Prism.
5. Prism authenticates that human through OIDC/SSO.

Do not embed Prism inside a PLM iframe. Keep both systems replaceable and avoid brittle cookie/iframe issues.

## Local service clients

Admins can create Prism-owned OAuth2 service clients:

```http
POST /api/admin/service-clients
Content-Type: application/json

{
  "name": "InvenTree Plugin",
  "role": "viewer",
  "scopes": ["api:read"]
}
```

The response includes `client_secret` once. Store it in the PLM secret manager.

Request a short-lived token:

```bash
curl -X POST https://prism.example.com/api/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials' \
  -d "client_id=${PRISM_CLIENT_ID}" \
  -d "client_secret=${PRISM_CLIENT_SECRET}" \
  -d 'scope=api:read'
```

Use:

```http
Authorization: Bearer <access_token>
```

## External OAuth2 JWTs

If the deployment already has an OAuth2 security provider for service credentials, Prism can accept external bearer JWTs:

```env
OAUTH_EXTERNAL_JWT_ISSUER_URL=https://sso.example.com/realms/engineering
OAUTH_EXTERNAL_JWT_AUDIENCE=kicad-prism-api
OAUTH_EXTERNAL_JWT_ROLE_CLAIM=prism_role
OAUTH_EXTERNAL_JWT_SCOPES_CLAIM=scope
OAUTH_EXTERNAL_JWT_CLIENT_ID_CLAIM=client_id
```

The external JWT must include a valid Prism role claim (`viewer`, `designer`, or `admin`). Scope `api:read` is enough for read-only PLM link-out integrations.

`OAUTH_EXTERNAL_JWT_AUDIENCE` is mandatory whenever an external issuer is set, and
startup fails without it. An unverified audience would let any token that issuer
minted — for any unrelated application — authenticate against Prism. Tokens are
verified for signature, `iss`, `aud`, `exp`, `iat`, and `sub`, with 60 seconds of
clock-skew tolerance; multi-audience tokens must additionally name Prism in `azp`.

## Related

- [Deployment](DEPLOYMENT.md)
- [HTTPS and TLS](HTTPS_AND_TLS.md)
- [Remote Symbol Provider](REMOTE_SYMBOL_PROVIDER.md)
