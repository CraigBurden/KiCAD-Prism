# HTTPS and TLS for KiCAD Prism

This guide covers reverse-proxy HTTPS for Prism, focusing on Remote Symbols metadata that must
advertise `https://` absolute URLs to KiCad.

For general Docker hosting, see [DEPLOYMENT.md](DEPLOYMENT.md). For provider setup, see
[REMOTE_SYMBOL_PROVIDER.md](REMOTE_SYMBOL_PROVIDER.md).

## Why this matters

KiCad discovers Prism at:

```text
https://<your-host>/.well-known/kicad-remote-provider
```

That document advertises absolute URLs for `api_base_url`, `panel_url`, OAuth metadata, and asset
downloads. If Prism thinks the request was plain HTTP (common behind TLS terminators), KiCad
rejects the provider with errors such as:

```text
'api_base_url' must use HTTPS unless allow_insecure_localhost is set for loopback URLs
```

## Recommended environment

```env
AUTH_ENABLED=true
DEV_MODE=false
SESSION_SECRET=<long-random-value>
SESSION_COOKIE_SECURE=true
CORS_ORIGINS_STR=https://prism.example.com
PUBLIC_BASE_URL=https://prism.example.com
```

`PUBLIC_BASE_URL` is the hard override for absolute URLs. Prefer it for any multi-hop proxy
(ALB → Kong → Compose, outer nginx → frontend nginx → backend, etc.).

Comments helpers still honor `COMMENTS_API_BASE_URL` as a comments-only override that wins over
`PUBLIC_BASE_URL`.

## Proxy path map

Point the public hostname at the **frontend** container (recommended). Frontend Nginx proxies:

| Path | Upstream |
|------|----------|
| `/` | frontend static SPA |
| `/api/*` | backend |
| `/oauth/*` | backend |
| `/.well-known/kicad-remote-provider` | backend |
| `/remote-provider/*` | backend |

Outer TLS proxy requirements:

- Preserve public `Host`
- Set `X-Forwarded-Proto: https`
- Optionally set `X-Forwarded-Host` to the public host

Frontend Nginx preserves an incoming `X-Forwarded-Proto` (falls back to `$scheme` for direct HTTP)
and forwards `X-Forwarded-Host`.

## Verify

```bash
curl -fsS https://prism.example.com/.well-known/kicad-remote-provider | jq '{api_base_url, panel_url, auth}'
curl -fsS https://prism.example.com/oauth/.well-known/oauth-authorization-server | jq '{issuer, authorization_endpoint, token_endpoint}'
```

Every advertised URL must start with `https://prism.example.com`.

## Bare IP addresses

Browsers and Windows Schannel (`curl.exe`, PowerShell) send no SNI when the URL host is an IP
address. Caddy then has no name to pick a certificate by and aborts the handshake:
`ERR_SSL_PROTOCOL_ERROR` in Chrome, `SEC_E_ILLEGAL_MESSAGE` from Schannel, while
`openssl s_client -servername <ip>` still works.

Name the IP in a global `default_sni` option at the top of `Caddyfile`, and use it as the site
address:

```caddyfile
{
	default_sni 192.168.1.20
}

192.168.1.20 {
	tls /certs/prism.crt /certs/prism.key
	# ...rest of the site block from deploy/Caddyfile.internal
}
```

The certificate must list the address as an IP subject alternative name, and
`PUBLIC_BASE_URL` must be `https://192.168.1.20`. Public ACME (`Caddyfile`, `Caddyfile.dns-01`)
cannot issue for a private IP; use `Caddyfile.internal`. A DNS name, even one that exists only in
internal DNS, avoids all of this.

## Common failure: metadata shows `http://`

Cause: outer proxy missing `X-Forwarded-Proto: https`, overwriting `Host`, or an older frontend
nginx that rewrote forwarded proto to the internal `http` hop.

Fix:

1. Set `PUBLIC_BASE_URL=https://<public-host>`
2. Preserve public `Host` and force `X-Forwarded-Proto: https` on the outer proxy
3. Rebuild/restart so frontend nginx proto passthrough is active
4. Re-fetch metadata and confirm every URL is `https://<public-host>/...`
