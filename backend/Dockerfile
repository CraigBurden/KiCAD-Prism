# Backend Dockerfile
# KiCad CLI runtime. Keep this aligned with the newest KiCad file format Prism imports.
ARG KICAD_BASE_PLATFORM=linux/amd64

FROM node:22-bookworm-slim AS remote-provider-panel
WORKDIR /panel
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build:panel

FROM --platform=${KICAD_BASE_PLATFORM} kicad/kicad:10.0.0
ARG KICAD_LIBRARY_UTILS_REF=7124a92887b2280f85cfe2d5abb216062978d5e1

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

USER root

# ─── System dependencies ────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    git \
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
RUN cd /opt/kicad-prism-viewer && npm ci --include=optional

COPY kicad-prism-viewer /opt/kicad-prism-viewer
COPY scripts/build-prism-clipper2.sh /app/scripts/build-prism-clipper2.sh
RUN PRISM_VIEWER_ROOT=/opt/kicad-prism-viewer /app/scripts/build-prism-clipper2.sh
RUN cp /opt/kicad-prism-viewer/native/prism-clipper2/linux-x86_64/libprism_clipper2.so \
    /usr/local/lib/libprism_clipper2.so
RUN cd /opt/kicad-prism-viewer && npm run build

COPY backend/ .
COPY scripts/ scripts/
COPY --from=remote-provider-panel /panel/dist/remote_provider/ /app/app/static/remote_provider/

# Expose backend port
EXPOSE 8000

# Run the application. Keep workers configurable because each worker runs startup hooks.
CMD ["sh", "-c", "/app/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-4}"]
