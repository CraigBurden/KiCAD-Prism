# KiCAD Prism release deployment

This directory is the source template for the deployment bundle attached to a
KiCAD Prism GitHub Release. Release automation replaces the image and build
placeholders before publishing the archive.

## Start

1. Copy `.env.example` to `.env`.
2. Configure PostgreSQL, OIDC, the public URL, CORS, and a random session secret.
3. For direct local HTTP access:

   ```bash
   docker compose pull
   docker compose up -d --wait
   ```

4. For a public HTTPS deployment, edit `Caddyfile` and start the proxy profile:

   ```bash
   docker compose --profile proxy pull
   docker compose --profile proxy up -d --wait
   ```

For an internal CA or custom certificate, replace `Caddyfile` with
`Caddyfile.internal`, place `prism.crt` and `prism.key` in `./certs`, then start
the same proxy profile.

The frontend is bound to `127.0.0.1:8080` by default. The backend is reachable
only through the frontend proxy and is not published directly on the host.

## Persistent state

- `prism-postgres-data` stores PostgreSQL data.
- `./data/projects` stores repositories, generated assets, and caches.
- `./data/ssh` stores Git SSH identity and known-host state.

Back up all three before upgrading. To roll back, restore the previous release
bundle and run `docker compose up -d --wait`; its generated `.env.example`
contains the image digests for that release.
