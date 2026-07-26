# Backend Dockerfile
ARG KICAD_MONKEY_VARIANT=kicad-monkey-upstream

# KiCad CLI runtime. Keep this aligned with the newest KiCad file format Prism imports.
# Override via docker compose build args (see KICAD_BASE_IMAGE / KICAD_BASE_PLATFORM in .env).
ARG KICAD_BASE_PLATFORM=linux/arm64
ARG KICAD_BASE_IMAGE=kicad/kicad:10.0.4-arm64-local

FROM --platform=${KICAD_BASE_PLATFORM} node:22-bookworm-slim AS remote-provider-panel
WORKDIR /panel
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build:panel

FROM --platform=${KICAD_BASE_PLATFORM} ${KICAD_BASE_IMAGE} AS prism-runtime
ARG KICAD_LIBRARY_UTILS_REF=7124a92887b2280f85cfe2d5abb216062978d5e1

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
    openssh-client \
    g++ \
    cmake \
    make \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.5.18 /uv /uvx /usr/local/bin/

# Reuse the pinned Node runtime for the isolated WebGPU asset compiler.
COPY --from=remote-provider-panel /usr/local/bin/node /usr/local/bin/node
COPY --from=remote-provider-panel /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Optional KiCad Library Convention checker used by the component catalog health view.
RUN git clone --depth 1 https://gitlab.com/kicad/libraries/kicad-library-utils.git /opt/kicad-library-utils \
    && cd /opt/kicad-library-utils \
    && git fetch --depth 1 origin ${KICAD_LIBRARY_UTILS_REF} \
    && git checkout FETCH_HEAD

# ─── Backend setup ───────────────────────────────────────────────────
WORKDIR /app

ENV UV_NO_CACHE=1
RUN uv python install 3.12 \
    && uv venv /app/venv --python 3.12
ENV PATH="/app/venv/bin:$PATH"
ENV PRISM_SEMANTIC_VIEWER_REPO=/opt/kicad-prism-viewer
ENV PYTHONPATH=/opt/kicad-prism-viewer
ENV PRISM_CLIPPER2_LIBRARY=/usr/local/lib/libprism_clipper2.so

COPY backend/requirements.txt .
RUN uv pip install --no-cache-dir -r requirements.txt

# Install generator dependencies independently from the API requirements.
COPY kicad-prism-viewer/requirements-runtime.txt /opt/kicad-prism-viewer/
RUN uv pip install --no-cache-dir -r /opt/kicad-prism-viewer/requirements-runtime.txt

COPY kicad-prism-viewer/package*.json /opt/kicad-prism-viewer/
# package-lock optional deps may pin the wrong CPU arch when the image platform changes.
RUN cd /opt/kicad-prism-viewer && npm ci --include=optional \
    && ARCH="$(uname -m)" \
    && case "$ARCH" in aarch64|arm64) SHARP_CPU=arm64 ;; *) SHARP_CPU=x64 ;; esac \
    && npm install --include=optional --os=linux --cpu="${SHARP_CPU}" sharp

COPY kicad-prism-viewer /opt/kicad-prism-viewer
COPY scripts/build-prism-clipper2.sh /app/scripts/build-prism-clipper2.sh
RUN PRISM_VIEWER_ROOT=/opt/kicad-prism-viewer /app/scripts/build-prism-clipper2.sh \
    && ARCH="$(uname -m)" \
    && case "$ARCH" in aarch64|arm64) CLIPPER_ARCH=arm64 ;; *) CLIPPER_ARCH=x86_64 ;; esac \
    && cp "/opt/kicad-prism-viewer/native/prism-clipper2/linux-${CLIPPER_ARCH}/libprism_clipper2.so" \
        /usr/local/lib/libprism_clipper2.so
RUN cd /opt/kicad-prism-viewer && npm run build

COPY backend/ .
COPY scripts/ scripts/
COPY --from=remote-provider-panel /panel/dist/remote_provider/ /app/app/static/remote_provider/

# Expose backend port
EXPOSE 8000

# Run the application. Keep workers configurable because each worker runs startup hooks.
CMD ["sh", "-c", "/app/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-4}"]

# The default image keeps the release pins from requirements-runtime.txt.
FROM prism-runtime AS kicad-monkey-upstream
ENV PRISM_KICAD_MONKEY_SOURCE=pypi-release

# Opt-in development target. The named context is supplied only by
# docker-compose.local-kicad-monkey.yml, so normal deployments do not need a
# sibling kicad-monkey checkout.
FROM prism-runtime AS kicad-monkey-local
RUN --mount=from=kicad_monkey,source=/,target=/tmp/kicad-monkey,ro \
    uv pip install --no-cache-dir --no-deps --reinstall /tmp/kicad-monkey \
    && KICAD_MONKEY_VERSION="$(python -c 'import kicad_monkey; print(kicad_monkey.__version__)')" \
    && uv pip install --no-cache-dir --upgrade "kicad-cruncher==${KICAD_MONKEY_VERSION}" \
    && uv pip check
ENV PRISM_KICAD_MONKEY_SOURCE=local-working-tree

FROM ${KICAD_MONKEY_VARIANT} AS final
