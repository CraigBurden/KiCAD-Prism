# Backend Dockerfile
ARG KICAD_MONKEY_VARIANT=kicad-monkey-upstream
ARG NODE_VERSION=24.22.0
ARG PYTHON_VERSION=3.12.13
# native/ pins its own toolchain (native/rust-toolchain.toml).
ARG NATIVE_RUST_VERSION=1.98.0
ARG UV_VERSION=0.12.5

# KiCad CLI runtime. Release/source defaults are reproducible and AMD64-only.
# Compose supplies the platform from its environment file. Select a different
# base image explicitly with `docker compose build --build-arg`; it is not a
# runtime environment value.
ARG KICAD_BASE_PLATFORM=linux/amd64
ARG KICAD_BASE_IMAGE=kicad/kicad:10.0.4@sha256:ee71e88396f8563168eb1ef282cda9ff2670fe86a677c63dd78b35e3d464454c

FROM --platform=${KICAD_BASE_PLATFORM} node:${NODE_VERSION}-bookworm-slim AS remote-provider-panel
WORKDIR /panel
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build:panel

# prism-kicad, Prism's KiCad parser and design-bundle CLI (native/, ADR §4.1).
# Only the binary is built here; native/'s tests and lints run in CI's
# native-workspace job when native/ changes (ADR §11 G10). The cache mounts
# keep the crates and the build between image builds.
#
# geometer-client is vendored under native/third_party/ (ADR amendment C3), so
# loading the workspace clones nothing. The check fails the build unless every
# (crate, version) it builds was already locked.
FROM --platform=${KICAD_BASE_PLATFORM} rust:${NATIVE_RUST_VERSION}-bookworm AS prism-kicad-builder
WORKDIR /build/native
COPY native/Cargo.toml native/Cargo.lock native/rust-toolchain.toml native/clippy.toml ./
COPY native/.cargo ./.cargo
COPY native/src/rs ./src/rs
COPY native/assets ./assets
COPY native/third_party ./third_party
RUN cp Cargo.lock /tmp/Cargo.lock.locked
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/native/target \
    cargo build --release -p prism-kicad-cli \
    && awk '/^name = /{n=$3} /^version = /{print n, $3}' /tmp/Cargo.lock.locked | sort -u > /tmp/locked.pairs \
    && awk '/^name = /{n=$3} /^version = /{print n, $3}' Cargo.lock | sort -u > /tmp/built.pairs \
    && if [ -n "$(comm -13 /tmp/locked.pairs /tmp/built.pairs)" ]; then \
         echo "a crate is not at its locked version:" >&2; comm -13 /tmp/locked.pairs /tmp/built.pairs >&2; exit 1; \
       fi \
    && cp target/release/prism-kicad /tmp/prism-kicad

FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv-bin

FROM --platform=${KICAD_BASE_PLATFORM} ${KICAD_BASE_IMAGE} AS prism-runtime
# Redeclare so the value that satisfied FROM is available in this stage and can
# be baked into the image as the Release Studio executor identity.
ARG KICAD_BASE_IMAGE
ARG PYTHON_VERSION
ARG KICAD_LIBRARY_UTILS_REF=7124a92887b2280f85cfe2d5abb216062978d5e1
LABEL prism.release.kicad_base_image="${KICAD_BASE_IMAGE}"

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

USER root

# ─── System dependencies ────────────────────────────────────────────
# openssh-client provides ssh (which git needs for any ssh:// or git@host
# remote) and ssh-keyscan (used to read a host key before pinning it). Without
# it the image could only ever clone over HTTPS, and reading a host key failed
# with a bare "No such file or directory: 'ssh-keyscan'".
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    git \
    git-lfs \
    openssh-client \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=uv-bin /uv /uvx /usr/local/bin/

# Optional KiCad Library Convention checker used by the component catalog health view.
RUN git clone --depth 1 https://gitlab.com/kicad/libraries/kicad-library-utils.git /opt/kicad-library-utils \
    && cd /opt/kicad-library-utils \
    && git fetch --depth 1 origin ${KICAD_LIBRARY_UTILS_REF} \
    && git checkout FETCH_HEAD

# ─── Backend setup ───────────────────────────────────────────────────
WORKDIR /app

ENV UV_NO_CACHE=1
# Pin the interpreter rather than inheriting the base image's system Python.
# The KiCad 10.0.4 base ships 3.13; Prism's dependency set -- kicad-monkey in
# particular -- is validated on 3.12, so the venv selects it explicitly and a
# base-image Python bump cannot silently move it.
RUN uv python install ${PYTHON_VERSION} \
    && uv venv /app/venv --python ${PYTHON_VERSION}
ENV PATH="/app/venv/bin:$PATH"
# glibc gives each thread its own malloc arena and rarely returns their memory;
# two arenas keep a long-lived API or worker process near its working set.
ENV MALLOC_ARENA_MAX=2

# API, workers and Release Studio share one fully resolved runtime.
COPY requirements/runtime.lock /app/requirements/runtime.lock
COPY .python-version /app/
COPY scripts/verify_dependency_identity.py /app/scripts/verify_dependency_identity.py
RUN uv pip sync --python /app/venv/bin/python /app/requirements/runtime.lock \
    && python /app/scripts/verify_dependency_identity.py --python-only

# The Geometer runtime prism-kicad launches for the assembly HLR member (ADR
# amendment C3 §2 item 4). Pinned to the release the vendored geometer-client
# accepts (native/third_party/geometer-client, 2026.9.19 / ABI 20260919) and
# checked against the sha256s of that release's inventory.
ARG GEOMETER_RELEASE_TAG=v2026-09-19
ARG GEOMETER_SHA256_AMD64=5d7beb6823254c754583f1222b54c278bd11ff8d47181c9a0462b6ed205cddc7
ARG GEOMETER_SHA256_ARM64=e6e46deab795817c11feee2ade5a97bb7070876992fe8c5c916f3b5268d020b6
RUN set -eu; \
    case "$(dpkg --print-architecture)" in \
      amd64) asset=native-linux-x64.zip; sum=${GEOMETER_SHA256_AMD64} ;; \
      arm64) asset=native-linux-arm64.zip; sum=${GEOMETER_SHA256_ARM64} ;; \
      *) echo "no Geometer runtime for $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/geometer.zip \
      "https://github.com/wavenumber-eng/geometer/releases/download/${GEOMETER_RELEASE_TAG}/${asset}"; \
    echo "${sum}  /tmp/geometer.zip" | sha256sum -c -; \
    mkdir -p /opt/geometer; \
    python -m zipfile -e /tmp/geometer.zip /opt/geometer; \
    rm /tmp/geometer.zip; \
    chmod 0755 /opt/geometer/geometer; \
    /opt/geometer/geometer --version | grep -q 'abi 20260919'
ENV GEOMETER_EXECUTABLE=/opt/geometer/geometer

# Simulation Studio engines: the prism-sim-studio release pinned in
# backend/sim-engines.lock.json (tag and sha256 per platform), installed where
# PRISM_SIM_BIN_DIR points. The release is private, so the build reads a token
# from the BuildKit secret `prism_sim_release_token`; without one the engines
# are left out and Simulation Studio (opt-in) cannot run.
COPY backend/sim-engines.lock.json /tmp/sim-engines/sim-engines.lock.json
COPY scripts/fetch_sim_engines.py /tmp/sim-engines/fetch_sim_engines.py
RUN --mount=type=secret,id=prism_sim_release_token,required=false \
    case "$(dpkg --print-architecture)" in \
      amd64) sim_platform=linux-x64 ;; arm64) sim_platform=linux-arm64 ;; *) sim_platform=unsupported ;; \
    esac \
    && python /tmp/sim-engines/fetch_sim_engines.py --optional \
        --lock /tmp/sim-engines/sim-engines.lock.json --platform "$sim_platform" \
        --token-file /run/secrets/prism_sim_release_token --dest /opt/prism-sim/bin \
    && rm -rf /tmp/sim-engines

# backend/ carries the application. scripts/ holds the operator CLIs run inside the
# container (catalog imports, benchmark sessions); nothing at runtime reads it.
COPY backend/ .
COPY scripts/ scripts/
# The design-bundle reader validates members against native/'s committed JSON
# Schema (app/services/design_bundle/schemas.py looks for it under /app/native).
COPY native/contracts/generated/schema /app/native/contracts/generated/schema
# `prism-kicad artwork --config` reads the native configurations, so Release
# Studio's bundle path ships them at the path app.release_studio resolves.
COPY native/src/rs/prism-artwork/configs /app/native/src/rs/prism-artwork/configs
COPY --from=prism-kicad-builder /tmp/prism-kicad /usr/local/bin/prism-kicad
COPY --from=remote-provider-panel /panel/dist/remote_provider/ /app/app/static/remote_provider/

# Stable on-disk identity for toolchain_digest / live CI. Written late so the
# expensive layers above stay cacheable when only executor identity changes.
RUN mkdir -p /etc/prism \
    && printf '%s\n' "${KICAD_BASE_IMAGE}" > /etc/prism/kicad-base-image \
    && chmod 0644 /etc/prism/kicad-base-image

# Expose backend port
EXPOSE 8000

# Run the application. Keep workers configurable because each worker runs startup hooks.
CMD ["sh", "-c", "/app/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-4}"]

# The default image keeps the release lock from requirements/runtime.lock.
FROM prism-runtime AS kicad-monkey-upstream

# Opt-in development target. The named context is supplied only by
# docker-compose.local-kicad-monkey.yml, so normal deployments do not need a
# sibling kicad-monkey checkout.
FROM prism-runtime AS kicad-monkey-local
# A local development image replaces the published kicad-monkey with a sibling
# checkout's working tree. kicad-cruncher is gone with C3 F4c; the monorepo's
# cruncher package is no longer installed.
RUN --mount=from=kicad_toolchain,source=/,target=/tmp/kicad-toolchain,ro \
    test -f /tmp/kicad-toolchain/pyproject.toml \
    && uv pip install --no-cache-dir --no-deps --reinstall \
        /tmp/kicad-toolchain \
    && uv pip check --python /app/venv/bin/python \
    && python - <<'PY'
import pathlib, sys, kicad_monkey
installed = pathlib.Path(kicad_monkey.__file__).parent
mounted = pathlib.Path("/tmp/kicad-toolchain/src/py/kicad_monkey")
for name in sorted(p.name for p in mounted.glob("*.py")):
    if not (installed / name).exists():
        sys.exit(f"local working tree not installed: {name} is missing from {installed}")
print(f"kicad-monkey {kicad_monkey.__version__} installed from the mounted working tree")
PY

FROM ${KICAD_MONKEY_VARIANT} AS final
ARG PRISM_RELEASE=development
ARG PRISM_REVISION=unknown
ARG PRISM_BUILD_DATE=unknown
ENV PRISM_RELEASE=${PRISM_RELEASE}
ENV PRISM_REVISION=${PRISM_REVISION}
ENV PRISM_BUILD_DATE=${PRISM_BUILD_DATE}
LABEL org.opencontainers.image.title="KiCAD Prism backend" \
    org.opencontainers.image.version="${PRISM_RELEASE}" \
    org.opencontainers.image.revision="${PRISM_REVISION}" \
    org.opencontainers.image.created="${PRISM_BUILD_DATE}" \
    org.opencontainers.image.source="https://github.com/krishna-swaroop/KiCAD-Prism" \
    org.opencontainers.image.licenses="Apache-2.0"
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=10 \
    CMD curl -fsS http://127.0.0.1:8000/api/health/ready >/dev/null || exit 1
