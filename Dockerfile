# AgentWeb with nono and the agent CLIs. Steel runs next to it: see docker-compose.yml.
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
ARG OPTIONAL_TOOLS=
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
COPY docker/extra-tools.sh /tmp/extra-tools.sh
RUN bash /tmp/extra-tools.sh "$OPTIONAL_TOOLS" && rm -f /tmp/extra-tools.sh
# Declared here so a version change does not rebuild the system packages above.
ARG CODEX_VERSION=latest
ARG OPENCODE_VERSION=latest
COPY docker/install-agent-clis.sh /tmp/install-agent-clis.sh
RUN bash /tmp/install-agent-clis.sh "$CODEX_VERSION" "$OPENCODE_VERSION" && rm -f /tmp/install-agent-clis.sh
# mega-exec starts a server by running /usr/bin/mega-cmd-server. Keep the real binary aside and
# put the helper there, so an agent cannot start MEGAcmd inside its own sandbox.
COPY docker/mega/agentweb-mega /usr/local/bin/agentweb-mega
COPY docker/mega/mega-cmd-server /usr/bin/mega-cmd-server.wrapper
RUN chmod 755 /usr/local/bin/agentweb-mega /usr/bin/mega-cmd-server.wrapper \
  && mv /usr/bin/mega-cmd-server /usr/bin/mega-cmd-server.real \
  && mv /usr/bin/mega-cmd-server.wrapper /usr/bin/mega-cmd-server
# The node image already owns UID 1000 as `node`, so reuse or create the account.
RUN if ! getent passwd "$AGENT_UID" >/dev/null; then useradd -m -u "$AGENT_UID" -s /bin/bash agent; \
    else usermod -l agent -d /home/agent -m "$(getent passwd "$AGENT_UID" | cut -d: -f1)"; fi \
  && mkdir -p /workspace && chown agent /workspace \
  && ln -sf /home/agent/.machine-id /etc/machine-id
COPY --from=build --chown=agent /app /app
USER agent
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 SERVER_PORT=3001 WORKSPACES_ROOT=/workspace
ENV JAVA_HOME=/usr/lib/jvm/jdk-default JDK8_HOME=/usr/lib/jvm/jdk-8 JDK17_HOME=/usr/lib/jvm/jdk-17
# Installed files nono must also allow. Maven and Python venv read /usr/share, MEGAcmd lives in /opt and keeps its data in ~/.megaCmd.
ENV AGENTWEB_NONO_READ_PATHS=/usr/share:/etc/maven:/opt/megacmd AGENTWEB_NONO_ALLOW_PATHS=/home/agent/.megaCmd
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD curl -fsS "http://127.0.0.1:${SERVER_PORT}/health" || exit 1
# Containers have no machine id, and tools such as mega-sync use it as a device id. It lives in
# the home volume because a rebuilt container must keep it, or those tools see a new device.
CMD ["sh", "-c", "[ -s \"$HOME/.machine-id\" ] || tr -d - < /proc/sys/kernel/random/uuid > \"$HOME/.machine-id\"; exec node dist-server/server/index.js"]
