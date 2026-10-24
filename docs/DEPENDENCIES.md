# Dependency identity

Prism deliberately has one Python runtime identity, two independently locked
JavaScript workspaces and one locked Rust workspace (`native/`). Hosts, CI, and
Docker must not resolve different versions from the same source declarations.

## Runtime versions

- `.python-version` selects the exact Python patch release used by host tools,
  CI, and Docker.
- `.node-version` selects the exact Node patch release used by both JavaScript
  workspaces and Docker.
- `frontend/package.json` and `kicad-prism-viewer/package.json` record the npm
  version and reject unsupported runtime lines.

Run the identity check after selecting those runtimes. It rejects an incorrect
Python, Node, or npm version and any missing, mismatched, or extra distribution
in the Python environment:

```bash
backend/venv/bin/python scripts/verify_dependency_identity.py
```

## Python ownership

`requirements/runtime.in` is the only place to add a direct Python runtime
dependency. `requirements/runtime.lock` is the complete, resolved graph used by
the API, workers and Release Studio.

The historical `backend/requirements.txt` file is a compatibility alias to
that same lock. They must not contain their own packages or pins.

To update and reproduce the Python graph:

```bash
python scripts/sync_dependencies.py --update-lock --python-only
```

Review the lock diff, especially the `kicad-monkey` version, then run backend and
semantic-viewer tests. The sync
recreates `backend/venv`; this is intentional so an older host environment
cannot retain undeclared packages.

Release Studio's PDF conversion also needs the native Cairo library. On macOS,
install it with Homebrew. Prism locates the normal Apple Silicon and Intel
Homebrew paths for uv's portable Python; set `PRISM_CAIRO_LIBRARY_DIR` only for
a nonstandard installation.

## Native (Rust) ownership

`native/` is Prism's KiCad parser and design-bundle CLI, `prism-kicad`
([ADR](architecture/adr-native-design-bundle.md)).

- `native/rust-toolchain.toml` pins the Rust toolchain (1.98.0); the image's
  `prism-kicad-builder` stage uses the same version (`NATIVE_RUST_VERSION`).
- `native/Cargo.lock` is the complete crate graph. The image build fails if it
  would build any crate version that is not already locked, and CI runs
  `cargo deny check licenses sources` (`native/deny.toml`).
- `native/third_party/` vendors `geometer-client`, so building the workspace
  clones nothing.

Binary tools the worker image installs beside `prism-kicad`, each pinned by
version and sha256 in `backend/Dockerfile`:

- the Geometer runtime (`GEOMETER_RELEASE_TAG`, ABI `20260919`), which the
  bundle's `models` stage runs for the parts' hidden-line views;
- Simulation Studio's engines, from the `prism-sim-studio` release pinned in
  `backend/sim-engines.lock.json`. That release is private: the build reads a
  token from the BuildKit secret `prism_sim_release_token`, and without one it
  leaves the engines out (Simulation Studio is opt-in).

Python `kicad-monkey` remains only for the catalog's library files
(`.kicad_sym`, `.kicad_mod`); project revisions are read by `prism-kicad`.

## JavaScript ownership

Each JavaScript workspace owns its `package.json` and `package-lock.json`. Use
the Node version in `.node-version` and npm version in each package manifest.
Install with `npm ci`; do not depend on packages left in an existing
`node_modules` directory.

```bash
python scripts/sync_dependencies.py --node-only
```

Major framework upgrades are reviewed separately from routine lock refreshes.

## Local KiCad toolchain development

The normal image always uses the published `kicad-monkey` in the Python lock.
To test unpublished upstream work, provide a modern `kicad_monkey` monorepo
checkout:

```bash
KICAD_TOOLCHAIN_CONTEXT=/absolute/path/to/kicad_monkey \
  docker compose -f docker-compose.yml \
  -f docker-compose.local-kicad-monkey.yml build backend
```

The local target reinstalls `kicad-monkey` from the mounted working tree and
validates the dependency graph. `kicad-cruncher` is gone with C3 F4c; the
monorepo's cruncher package is no longer installed. Older standalone
checkouts fail the image preflight instead of silently combining their code
with a published package.

Python source discovery is explicit: Prism no longer searches adjacent
checkouts or legacy `references/` directories automatically. The published
`kicad-monkey` distribution serves the catalog's library-file imports only
(WP-R2); no revision parse imports it.

