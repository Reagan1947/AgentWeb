#!/usr/bin/env bash
# Development tools baked into the AgentWeb image. Agents run unprivileged inside
# nono and cannot install system packages, so add what they need here and rebuild:
#   docker compose up -d --build
# Usage: extra-tools.sh [comma-separated optional tools: jdk8,jdk17]
set -euo pipefail

GO_VERSION=1.27.3
GO_SHA256_AMD64=65efbc80fdc1fa2cd2631cad5b481777a68e8725f34e89f50fc6ac714e379b40
GO_SHA256_ARM64=a06e99309dbcbdca1a8ccd2282c3ee146e55930886e26b4f1193269587165f49
UV_VERSION=0.13.1
PNPM_VERSION=12.16.1
BUN_VERSION=1.4.4

optional_tools="${1:-}"
arch="$(dpkg --print-architecture)"
export DEBIAN_FRONTEND=noninteractive
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
cd "$work_dir"

apt-get update
apt-get install -y --no-install-recommends \
  wget gnupg rsync lsof htop tmux vim less fd-find fzf cmake pkg-config \
  python3-pip python3-venv postgresql-client default-mysql-client redis-tools
ln -sf /usr/bin/fdfind /usr/local/bin/fd

# GitHub CLI, from its signed apt repository. Debian's package is far behind.
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  -o /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$arch signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  > /etc/apt/sources.list.d/github-cli.list
apt-get update
apt-get install -y --no-install-recommends gh

# MEGAcmd. MEGA publishes no stable checksum for this rolling URL.
curl -fsSL "https://mega.nz/linux/repo/Debian_12/$arch/megacmd-Debian_12_$arch.deb" -o megacmd.deb
apt-get install -y --no-install-recommends ./megacmd.deb

# Go
case "$arch" in
  amd64) go_sha256="$GO_SHA256_AMD64" ;;
  arm64) go_sha256="$GO_SHA256_ARM64" ;;
  *) echo "No Go checksum for architecture: $arch" >&2; exit 1 ;;
esac
curl -fsSL "https://go.dev/dl/go$GO_VERSION.linux-$arch.tar.gz" -o go.tar.gz
echo "$go_sha256  go.tar.gz" | sha256sum -c -
tar -C /usr/local -xzf go.tar.gz
ln -sf /usr/local/go/bin/go /usr/local/go/bin/gofmt /usr/local/bin/

# uv
case "$arch" in
  amd64) uv_target=x86_64-unknown-linux-gnu ;;
  arm64) uv_target=aarch64-unknown-linux-gnu ;;
  *) echo "No uv build for architecture: $arch" >&2; exit 1 ;;
esac
uv_archive="uv-$uv_target.tar.gz"
uv_base="https://github.com/astral-sh/uv/releases/download/$UV_VERSION"
curl -fsSLO "$uv_base/$uv_archive"
curl -fsSLO "$uv_base/$uv_archive.sha256"
sha256sum -c "$uv_archive.sha256"
tar -xzf "$uv_archive"
install -m 0755 "uv-$uv_target/uv" "uv-$uv_target/uvx" /usr/local/bin/

npm install -g --no-audit --no-fund "pnpm@$PNPM_VERSION" "bun@$BUN_VERSION"

# Optional tools
jdk_versions=()
for tool in ${optional_tools//,/ }; do
  case "$tool" in
    jdk8) jdk_versions+=(8) ;;
    jdk17) jdk_versions+=(17) ;;
    *) echo "Unknown optional tool: $tool" >&2; exit 1 ;;
  esac
done

if (( ${#jdk_versions[@]} > 0 )); then
  # Debian 12 has no JDK 8, so every JDK comes from Eclipse Temurin's signed repository.
  curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public \
    | gpg --dearmor -o /usr/share/keyrings/adoptium.gpg
  echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb bookworm main" \
    > /etc/apt/sources.list.d/adoptium.list
  apt-get update
  for version in "${jdk_versions[@]}"; do
    apt-get install -y --no-install-recommends "temurin-$version-jdk"
    ln -sfn "/usr/lib/jvm/temurin-$version-jdk-$arch" "/usr/lib/jvm/jdk-$version"
  done
  apt-get install -y --no-install-recommends maven

  # The newest JDK listed is the default. Set JAVA_HOME to JDK8_HOME or JDK17_HOME to switch.
  default_jdk="/usr/lib/jvm/jdk-$(printf '%s\n' "${jdk_versions[@]}" | sort -n | tail -1)"
  ln -sfn "$(readlink -f "$default_jdk")" /usr/lib/jvm/jdk-default
  for tool_path in "$default_jdk"/bin/*; do
    tool_name="$(basename "$tool_path")"
    if update-alternatives --list "$tool_name" >/dev/null 2>&1; then
      update-alternatives --set "$tool_name" "$(readlink -f "$tool_path")" || true
    fi
  done
fi

rm -rf /var/lib/apt/lists/*
