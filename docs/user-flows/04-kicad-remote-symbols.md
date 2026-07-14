# User flow: KiCad Remote Symbols

Audience: librarians and designers placing Prism-governed parts into KiCad schematics.

## Why HTTPS

KiCad talks to Prism as a remote provider. Outside localhost, use HTTPS with a certificate the **workstation OS trusts**. Incomplete TLS trust is the most common production failure mode.

Admin setup: [HTTPS and TLS](../HTTPS_AND_TLS.md) and [REMOTE_SYMBOL_PROVIDER.md](../REMOTE_SYMBOL_PROVIDER.md).

## One-time admin setup

1. Host Prism at `https://<public-or-corp-host>`.
2. Confirm metadata:

```bash
curl -fsS https://<host>/.well-known/kicad-remote-provider | jq .
```

All advertised URLs must be `https://<host>/...`.

3. Register IdP redirect URI `https://<host>/oauth/oidc/callback` when auth is enabled.
4. Build the datasource ZIP:

```bash
python3 scripts/build_datasource_package.py --base-url https://<host>
```

5. Distribute the ZIP (or instruct users to add the provider URL manually).
6. If using an internal CA, install the CA on every KiCad workstation **before** testing placement.

## One-time KiCad user setup

1. Install the datasource ZIP via KiCad Plugin and Content Manager **or** add the provider base URL under Remote Symbol Settings.
2. Confirm library prefix / destination directory match Prism defaults unless your admin customized:

- prefix: `remote`
- destination: `${KIPRJMOD}/RemoteLibrary`

3. Open a schematic project.

## Place a part

1. Open the **Remote Symbols** panel in eeschema.
2. If prompted, sign in. Complete SSO in the system browser and return to KiCad.
3. Search by name, MPN, or category.
4. Open a part; confirm symbol/footprint previews.
5. Click **Place** (or use inline fallback if your KiCad build requires it).
6. Verify the symbol appears and project `RemoteLibrary` updates as expected.

Only released, place-ready components with both symbol and footprint assets are listed.

<!-- SCREENSHOT NEEDED: KiCad Remote Symbols panel search results. assets/KiCAD-Prism-Remote-Symbols-Panel.png -->
<!-- SCREENSHOT NEEDED: Part detail with Place enabled. -->
<!-- SCREENSHOT NEEDED: Schematic after successful placement. -->

## Troubleshooting for users

| Symptom | Likely cause |
|---------|----------------|
| Provider missing / network error | Wrong URL, VPN down, TLS trust missing |
| Empty catalog | No released place-ready parts, or auth/role cannot read provider |
| Sign-in loop | IdP redirect URI mismatch or metadata advertising HTTP |
| Place disabled | Missing symbol/footprint or not released |
| Preview blank | Preview generation pending/failed; placement may still work |

Admins should verify with `curl` without `-k` from the same machine that runs KiCad.

## Related

- [REMOTE_SYMBOL_PROVIDER.md](../REMOTE_SYMBOL_PROVIDER.md)
- [HTTPS_AND_TLS.md](../HTTPS_AND_TLS.md)
- [Library Manager flow](03-library-manager.md)
