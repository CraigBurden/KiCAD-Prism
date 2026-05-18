# OIDC and OAuth2 Integration

KiCAD Prism supports two separate integration paths:

- OIDC for human login into the Prism web UI.
- OAuth2 bearer tokens for machine-to-machine API access from PLM/MRP systems such as InvenTree.

## Human SSO

Configure Prism as an OIDC client against your identity provider:

```env
AUTH_ENABLED=true
DEV_MODE=false
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
```

Fill `OIDC_CLIENT_SECRET` with the value from your identity provider. Generate `SESSION_SECRET`
locally with `python3 -c 'import secrets; print(secrets.token_urlsafe(48))'`.

Register these redirect URIs in the identity provider:

- Prism web UI: `https://prism.example.com/auth/callback`
- KiCad remote-provider login: `https://prism.example.com/oauth/oidc/callback`

Google Sign-In uses the same generic OIDC settings as every other provider. Register the frontend
callback URL in Google Cloud Console. For Docker this is `http://127.0.0.1:8080/auth/callback`; for
Vite dev it is `http://127.0.0.1:5173/auth/callback`.

For Google through the generic OIDC path, use:

```env
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_SCOPES=openid email profile
OIDC_EMAIL_CLAIM=email
OIDC_NAME_CLAIM=name
OIDC_PICTURE_CLAIM=picture
OIDC_PROVIDER_NAME=Google
OIDC_TOKEN_AUTH_METHOD=client_secret_post
```

For JumpCloud US tenants, use `OIDC_ISSUER_URL=https://oauth.id.jumpcloud.com/`; for EU tenants,
use `OIDC_ISSUER_URL=https://oauth.id.eu.jumpcloud.com/`. Most providers expose `email`, `name`,
and `picture` claims, but the claim env vars allow deployments to adapt if their IdP maps profile
attributes differently.

The browser login flow uses authorization code, validates the OIDC discovery metadata, exchanges the
code through the configured token endpoint, verifies signed `id_token`s with JWKS, checks nonce, and
then creates Prism's own HttpOnly session cookie.

`CORS_ORIGINS_STR` must list the browser origins that may send credentialed requests to the API.
Do not set it to `*` when session cookies are enabled.

## PLM / InvenTree Link-Out Flow

The intended InvenTree integration is loose coupling:

1. An InvenTree plugin authenticates to Prism with OAuth2.
2. The plugin calls Prism read APIs to discover projects, releases, files, and links.
3. InvenTree stores Prism URLs on parts, assemblies, attachments, ECOs, or work orders.
4. A user clicks the link and lands in Prism.
5. Prism authenticates that human through OIDC/SSO and shows the project, diff, comments, or release context.

Prism should not be embedded in an InvenTree iframe. This avoids CORS and browser security mistakes and keeps both systems replaceable.

## Local Service Clients

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

Use the token on Prism API calls:

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

## KiCad Remote Symbol Provider

KiCad remote-symbol login is separate from PLM API access. KiCad discovers `/.well-known/kicad-remote-provider`, follows Prism's `/oauth/*` authorization-code + PKCE flow, and receives a bearer token scoped for `remote_symbols.read`.

Those KiCad tokens can read remote-symbol provider endpoints but cannot access Prism admin APIs.

This is intentionally separate from `/api/oauth/token`: KiCad receives Prism-issued
`remote_symbols.read` tokens for symbol search/placement, while PLM/MRP integrations receive
service-client or external OAuth2 API tokens for project metadata queries.
