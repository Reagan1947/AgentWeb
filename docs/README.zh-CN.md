<div align="center">
 <img src="../public/agentweb-icon.png" alt="AgentWeb" width="128" height="128">
 <h1>AgentWeb</h1>
 <p>面向 <a href="https://docs.anthropic.com/en/docs/claude-code">Claude Code</a>、<a href="https://docs.cursor.com/en/cli/overview">Cursor CLI</a> 和 <a href="https://developers.openai.com/codex">Codex</a> 的 Web、桌面与移动端界面。</p>
</div>

<div align="right"><i><a href="../README.md">English</a> · <b>简体中文</b></i></div>

---

## 关于本项目

AgentWeb 是 [CloudCLI UI](https://github.com/siteboon/claudecodeui)（也称 Claude Code UI）的 fork。它保留了上游面向 Claude Code、Cursor CLI 和 Codex 的工作区，并内置了一个浏览器：代理可以操作页面，你可以在界面里看着它做。

让代理打开网页、走一遍流程，或检查界面。会话会出现在 **Browser** 标签页里：页面本身，以及状态、最近一次操作，还有停止和删除按钮。接入 [Steel](https://github.com/steel-dev/steel-browser) 后，这个画面是实时的、可以直接看交互；不接的话，标签页显示本地 Playwright 的截图。悬浮窗会把同一个页面留在屏幕上，你继续留在对话里。

AgentWeb 运行在你自己的机器上，使用你已有的 CLI 和订阅，本身不提供任何 AI 模型。

<div align="center">
<img src="../public/screenshots/browser-tab.png" alt="Browser 标签页中的 Steel 实时会话" width="800">
<p><sub>Browser 标签页。代理打开了页面；你能看到实时画面、会话列表，以及停止或删除会话的操作。</sub></p>
</div>

## 功能

- **浏览器** — 代理打开浏览器，你在旁边看。Browser 标签页显示实时页面（Steel）或截图（本地 Playwright），列出每个会话，并可以停止或删除。把同一个会话弹出成悬浮窗，聊天时画面也留在屏幕上。
- **多代理** — 在同一个工作区中使用 Claude Code、Cursor CLI 和 Codex，自动发现已有会话。
- **对话界面** — 与代理对话，支持恢复会话、查看历史，每个项目可以有多个会话。
- **Shell 终端** — 在内置终端中直接使用各代理的 CLI。
- **文件浏览器** — 文件树，支持语法高亮和直接编辑。
- **Git** — 查看 diff、暂存并提交更改、切换分支。
- **响应式布局** — 适配桌面、平板和手机。
- **插件** — 添加自定义标签页，可带独立前端和可选的 Node.js 后端。
- **TaskMaster AI**（可选）— 通过 [TaskMaster](https://github.com/eyaltoledano/claude-task-master) 进行任务规划和 PRD 解析。

## 环境要求

- Node.js 22 或更高版本（见 `.nvmrc`）
- 至少安装并登录一个代理 CLI：Claude Code、Cursor CLI 或 Codex

## 快速开始

```bash
git clone https://github.com/Reagan1947/AgentWeb.git
cd AgentWeb
npm install
```

复制示例环境变量文件，按需修改：

```bash
cp .env.example .env
```

### 开发模式

```bash
npm run dev
```

后端运行在 `http://localhost:3001`，Vite 开发服务器运行在 `http://localhost:5173`。在浏览器中打开 Vite 的地址。

### 生产模式

```bash
npm start
```

先构建前端和后端，然后统一由 `http://localhost:3001` 提供服务。要从手机或同一网络中的其他设备访问，打开 `http://<你的 IP>:3001`。

### 桌面应用

Electron 桌面应用封装了本地服务器。

```bash
npm run desktop:dev        # 连接开发服务器运行（需先执行 npm run dev）
npm run desktop:dist:mac   # 构建 macOS .dmg
npm run desktop:dist:win   # 构建 Windows 安装包
```

## 配置

`.env` 中的常用配置：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `SERVER_PORT` | `3001` | 后端 API 与 WebSocket 端口 |
| `VITE_PORT` | `5173` | 前端开发服务器端口 |
| `HOST` | `0.0.0.0` | 监听地址。设为 `127.0.0.1` 则只允许本机访问 |
| `CLAUDE_CLI_PATH` | `claude` | 自定义 Claude CLI 路径 |
| `DATABASE_PATH` | — | 自定义认证数据库的位置 |

完整列表见 [`.env.example`](../.env.example)。

> **安全提示：** 默认 `HOST=0.0.0.0` 时，同一网络中的所有设备都能访问 AgentWeb，而它运行的代理可以读写本机文件。请只在可信网络中开放。

### 浏览器

Browser 标签页用来跟着代理看它在网页上做了什么。每个会话都会显示状态、最近一次操作和配置档。在这个标签页里可以打开悬浮窗、进入全屏，或停止并删除会话。悬浮窗盖在对话上面，也可以把它送回标签页、最小化，或先藏起来，直到下一个会话。

<div align="center">
<img src="../public/screenshots/browser-float.png" alt="盖在对话上的浏览器悬浮窗" width="800">
<p><sub>悬浮窗留在对话上方，聊天的同时能看着页面。</sub></p>
</div>

在 **设置 > Browser** 中启用浏览器。无需额外配置时，会话使用本地 Playwright，Browser 标签页显示截图。如果缺少 Chromium 依赖，运行：

```bash
npx playwright install-deps chromium
```

如需实时、可交互的画面，安装并运行 [Steel](https://github.com/steel-dev/steel-browser)，然后在同一设置页填写它的地址（默认 `http://127.0.0.1:3000`）。只有使用 Steel Cloud 时才需要 API key。

## 插件

在 **设置 > Plugins** 中从 git 仓库安装插件。要开发自己的插件，可以从[插件模板](https://github.com/cloudcli-ai/cloudcli-plugin-starter)或本地的 [`plugins/starter`](../plugins/starter) 开始。

插件通过 `git clone` 安装、`git pull` 更新，使用的是运行服务器的操作系统用户的 git 凭据。服务器无法响应密码或口令提示，因此安装私有仓库前，请先为该用户配置凭据：

- **`https://` 地址** — 配置凭据助手，例如先执行 `gh auth login`，再执行 `gh auth setup-git`。
- **`git@` 地址** — 使用无需交互的 SSH 密钥（没有口令，或已加载到服务器进程继承的 `ssh-agent` 中），并把主机加入 `~/.ssh/known_hosts`。

## 开发命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 以开发模式启动后端和前端 |
| `npm run build` | 构建前端和后端 |
| `npm run typecheck` | 对前端和后端做类型检查 |
| `npm run lint` | 对 `src/` 和 `server/` 运行 lint |
| `npm test` | 运行后端测试 |
| `npm run test:client` | 运行前端测试 |

贡献方式见 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## 许可证

GNU Affero General Public License v3.0 或更高版本（AGPL-3.0-or-later）。完整条款（包括第 7 节的附加条款）见 [LICENSE](../LICENSE)，另见 [NOTICE](../NOTICE)。

如果你修改本软件并将其作为网络服务运行，必须向该服务的用户提供修改后的源代码。

## 致谢

- **[CloudCLI UI](https://github.com/siteboon/claudecodeui)** — AgentWeb 所基于的上游项目。
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)**、**[Cursor CLI](https://docs.cursor.com/en/cli/overview)** 和 **[Codex](https://developers.openai.com/codex)** — AgentWeb 所支持的代理 CLI。
- **[React](https://react.dev/)**、**[Vite](https://vitejs.dev/)**、**[Tailwind CSS](https://tailwindcss.com/)** 和 **[CodeMirror](https://codemirror.net/)**。
