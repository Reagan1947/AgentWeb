# AgentWeb with nono and the Claude CLI. Steel runs next to it: see docker-compose.yml.
FROM node:22-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 python3-setuptools git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund \
  && npm run build \
  && npm prune --omit=dev --no-audit --no-fund \
  && npm install --no-save --no-package-lock --no-audit --no-fund playwright

FROM node:22-bookworm-slim
ARG NONO_VERSION=0.81.0
ARG CLAUDE_CODE_VERSION=latest
ARG AGENT_UID=1000
ARG TARGETARCH
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential python3 git openssh-client curl ca-certificates jq ripgrep sqlite3 zip unzip tree \
  && rm -rf /var/lib/apt/lists/*
# The release checksum file pins the package, so a changed download fails the build.
RUN set -e; arch="${TARGETARCH:-$(dpkg --print-architecture)}"; cd /tmp; \
  base="https://github.com/always-further/nono/releases/download/v${NONO_VERSION}"; \
  deb="nono-cli_${NONO_VERSION}_${arch}.deb"; \
  curl -fsSLO "$base/$deb"; curl -fsSLO "$base/SHA256SUMS.txt"; \
  grep " $deb\$" SHA256SUMS.txt | sha256sum -c -; \
  apt-get install -y "./$deb"; rm -f "$deb" SHA256SUMS.txt; nono --version
RUN npm install -g --no-audit --no-fund "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"
# The node image already owns UID 1000 as `node`, so reuse or create the account.
RUN if ! getent passwd "$AGENT_UID" >/dev/null; then useradd -m -u "$AGENT_UID" -s /bin/bash agent; \
    else usermod -l agent -d /home/agent -m "$(getent passwd "$AGENT_UID" | cut -d: -f1)"; fi \
  && mkdir -p /workspace && chown agent /workspace
COPY --from=build --chown=agent /app /app
USER agent
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 SERVER_PORT=3001 WORKSPACES_ROOT=/workspace
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD curl -fsS "http://127.0.0.1:${SERVER_PORT}/health" || exit 1
CMD ["node", "dist-server/server/index.js"]
