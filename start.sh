#!/usr/bin/env bash
# Start AgentWeb from the repository root.
#   ./start.sh        development (backend :3001, Vite :5173)
#   ./start.sh prod   build, then serve on :3001

set -euo pipefail

cd "$(dirname "$0")"

# nvm 的默认版本可能低于 .nvmrc。脚本自己切过去，避免 concurrently 在 Node 12 上解析失败。
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  set +u
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use
  set -u
fi

if ! command -v node >/dev/null 2>&1; then
  echo "需要 Node.js 22 或更高版本（见 .nvmrc）。"
  exit 1
fi

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( node_major < 22 )); then
  echo "当前 Node 是 $(node -v)，本项目需要 22 或更高（.nvmrc 为 v22）。"
  echo "已安装 v22 时，在这个目录执行: nvm use"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "未找到 node_modules，正在安装依赖..."
  npm install
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "已从 .env.example 生成 .env"
fi

mode="${1:-dev}"
case "$mode" in
  dev)
    echo "开发模式：后端 http://localhost:3001 ，前端 http://localhost:5173"
    exec npm run dev
    ;;
  prod|start)
    echo "生产模式：构建后由 http://localhost:3001 提供服务"
    exec npm start
    ;;
  *)
    echo "用法: ./start.sh [dev|prod]"
    exit 1
    ;;
esac
