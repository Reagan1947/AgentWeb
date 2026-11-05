#!/usr/bin/env bash
# Agent CLIs the web UI launches by name. Installed outside /home/agent because
# compose mounts a volume there and would hide anything written into the image home.
# Usage: install-agent-clis.sh [codex-version] [opencode-version]
set -euo pipefail

codex_version="${1:-latest}"
opencode_version="${2:-latest}"

# Codex on PATH is what the Shell tab runs. Chats still use the @openai/codex
# build this app depends on. OpenCode 1 is the CLI the provider drives
# (`opencode run`); OpenCode 2 is a different package and protocol.
npm install -g --no-audit --no-fund \
  "@openai/codex@${codex_version}" \
  "opencode-ai@${opencode_version}"

# Cursor's installer always writes under $HOME/.local. Give it a prefix the
# home volume cannot cover, then expose the name AgentWeb spawns.
cursor_root=/opt/cursor-agent
mkdir -p "$cursor_root"
HOME="$cursor_root" bash -c 'set -o pipefail; curl -fsSL https://cursor.com/install | bash'
ln -sfn "$cursor_root/.local/bin/cursor-agent" /usr/local/bin/cursor-agent
chmod -R a+rX "$cursor_root"

codex --version
opencode --version
cursor-agent --version
