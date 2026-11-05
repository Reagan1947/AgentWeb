import {
  Bell,
  GitBranch,
  Info,
  KeyRound,
  ListChecks,
  MonitorPlay,
  Palette,
  Plug,
  Shield,
  Terminal,
} from 'lucide-react';

import { AgentIcon } from '@/shared/ui/AgentIcon';
import type { ComponentType } from 'react';

import type { AgentProvider, FileStatusCode, LLMProvider, McpProvider, McpScope, McpTransport, SettingsMainTab } from '@/shared/types';
import type { UserPreferenceKey } from '@/shared/userSettings';

/** The four buckets the git changes view sorts working-tree files into. */
type GitStatusFileGroup = 'modified' | 'added' | 'deleted' | 'untracked';

//----------------- BRANDING ------------

/**
 * Font stack used to render the CloudCLI wordmark consistently wherever the brand name
 * appears as text. Apply it inline so the wordmark does not inherit a themed font.
 */
export const CLOUDCLI_WORDMARK_FONT_FAMILY =
  'ui-sans-serif, system-ui, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji';

// ---------------------------

//----------------- APPLE DESIGN TOKENS ------------

/**
 * Palette from the Apple analysis at getdesign.md/apple.
 * `src/index.css` stores the same colors as HSL components on the semantic
 * theme variables. Use these hex values when a caller cannot read those
 * variables: the theme-color meta tag, xterm, and CSS injected as a string.
 */
export const APPLE_COLOR = {
  /** `{colors.canvas-parchment}` — light page floor. */
  canvas: '#f5f5f7',
  /** `{colors.ink}` — near-black text on light surfaces. */
  ink: '#1d1d1f',
  /** Running text on light surfaces. Same near-black as `{colors.body}`. */
  body: '#1d1d1f',
  /** `{colors.ink-muted-48}` — secondary text and disabled labels. */
  muted: '#7a7a7a',
  /** `{colors.primary}` — Action Blue for links, primary buttons, and focus. */
  primary: '#0066cc',
  /** `{colors.primary-on-dark}` — sky blue for interactive color on dark tiles. */
  primaryOnDark: '#2997ff',
  /** `{colors.on-primary}` — text on Action Blue. */
  onPrimary: '#ffffff',
  /** `{colors.body-on-dark}` — text on the dark canvas. */
  onDark: '#ffffff',
  /** `{colors.divider-soft}` — secondary fills on the light floor. */
  surfaceSoft: '#f0f0f0',
  /** `{colors.canvas}` — white cards. */
  surfaceCard: '#ffffff',
  /** `{colors.hairline}` — 1px separator on light cards. */
  hairline: '#e0e0e0',
  /** `{colors.surface-black}` — dark page floor and code surfaces. */
  surfaceDark: '#000000',
  /** `{colors.surface-tile-1}` — cards sitting on the dark floor. */
  surfaceDarkElevated: '#272729',
  /** `{colors.surface-tile-3}` — inset fills inside a dark card. */
  surfaceDarkSoft: '#252527',
  /** `{colors.body-muted}` — secondary text on dark surfaces. */
  onDarkSoft: '#cccccc',
  /** Product error red. The Apple palette documents no validation color. */
  error: '#e53935',
  /** Product success green. The Apple palette documents no status green. */
  success: '#27a644',
  /** Dark 1px separator, one step above the tile ladder so borders stay visible. */
  hairlineDark: '#3a3a3c',
} as const;

/** `{typography.mono}` fallback. Linear Mono is proprietary. */
export const LINEAR_FONT_MONO =
  'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace';

// ---------------------------

//----------------- APPLICATION VERSION ------------

/**
 * Version of the installed package, baked into the client bundle at build time.
 * Compare it with the version reported by `/health` to detect a package that was
 * updated without restarting the server. Empty outside a Vite build (for example
 * under the `tsx` test runner), where no build-time value is injected.
 */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';

// ---------------------------

//----------------- SETTINGS NAVIGATION ------------

/** Shape of one entry in `SETTINGS_MAIN_TABS`; only that constant needs it. */
type SettingsMainTabMeta = {
  id: SettingsMainTab;
  label: string;
  keywords: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * The ordered list of top-level settings tabs. The settings sidebar renders it directly and
 * the command palette turns each entry into an "open settings" command, so both stay in sync.
 */
export const SETTINGS_MAIN_TABS: SettingsMainTabMeta[] = [
  { id: 'agents', label: 'Agents', keywords: 'agents subagents claude code', icon: AgentIcon },
  { id: 'appearance', label: 'Appearance', keywords: 'appearance theme dark light language thinking parameters', icon: Palette },
  { id: 'commands', label: 'Commands', keywords: 'commands slash skills builtins', icon: Terminal },
  { id: 'git', label: 'Git', keywords: 'git github commits', icon: GitBranch },
  { id: 'api', label: 'API Tokens', keywords: 'api tokens auth keys', icon: KeyRound },
  { id: 'nono', label: 'nono', keywords: 'nono sandbox vault folders secrets', icon: Shield },
  { id: 'tasks', label: 'Tasks', keywords: 'tasks taskmaster', icon: ListChecks },
  { id: 'browser', label: 'Browser', keywords: 'browser playwright chromium automation', icon: MonitorPlay },
  { id: 'notifications', label: 'Notifications', keywords: 'notifications alerts push', icon: Bell },
  { id: 'plugins', label: 'Plugins', keywords: 'plugins extensions integrations', icon: Plug },
  { id: 'about', label: 'About', keywords: 'about version info', icon: Info },
];

/**
 * Display names for the CLI agents configured under Settings → Agents.
 * The agents list, the agent settings layer, and the account panel all use these labels.
 */
export const AGENT_PROVIDER_NAMES: Record<AgentProvider, string> = {
  claude: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
  opencode: 'OpenCode',
};

// ---------------------------

//----------------- CHAT REASONING EFFORT ------------

/**
 * Sentinel effort value meaning "use whatever the model defaults to". The composer's model
 * menu renders it as the first choice and the provider state treats it as "no explicit effort".
 */
export const DEFAULT_EFFORT_VALUE = 'default';

// ---------------------------

//----------------- FILE UPLOAD LIMITS ------------

/** Largest single file the upload endpoint accepts, in megabytes. Source of truth for the two derived limits below. */
export const MAX_FILE_UPLOAD_SIZE_MB = 200;

/** `MAX_FILE_UPLOAD_SIZE_MB` in bytes, for comparing against `File.size` before uploading. */
export const MAX_FILE_UPLOAD_SIZE_BYTES = MAX_FILE_UPLOAD_SIZE_MB * 1024 * 1024;

/** Human-readable form of the size limit, shown in the file tree header and in upload errors. */
export const MAX_FILE_UPLOAD_SIZE_LABEL = `${MAX_FILE_UPLOAD_SIZE_MB}MB`;

// ---------------------------

//----------------- GIT CHANGE GROUPS ------------

/** Shape of one entry in `FILE_STATUS_GROUPS`; only that constant needs it. */
type GitStatusGroupEntry = {
  key: GitStatusFileGroup;
  status: FileStatusCode;
};

/**
 * The order in which the git changes view groups files, and the status code each group holds.
 * Both the change list and the status-grouping helper iterate it so the two stay aligned.
 */
export const FILE_STATUS_GROUPS: GitStatusGroupEntry[] = [
  { key: 'modified', status: 'M' },
  { key: 'added', status: 'A' },
  { key: 'deleted', status: 'D' },
  { key: 'untracked', status: 'U' },
];

// ---------------------------

//----------------- MCP SERVER CAPABILITIES ------------

/** Display name for each provider that can host MCP servers, used in headings and buttons. */
export const MCP_PROVIDER_NAMES: Record<McpProvider, string> = {
  claude: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
  opencode: 'OpenCode',
};

/** Scopes each provider can install an MCP server into; drives the scope selector and validation. */
export const MCP_SUPPORTED_SCOPES: Record<McpProvider, McpScope[]> = {
  claude: ['user', 'project', 'local'],
  cursor: ['user', 'project'],
  codex: ['user', 'project'],
  opencode: ['user', 'project'],
};

/** Transports each provider can talk to an MCP server over; drives the transport selector and validation. */
export const MCP_SUPPORTED_TRANSPORTS: Record<McpProvider, McpTransport[]> = {
  claude: ['stdio', 'http', 'sse'],
  cursor: ['stdio', 'http'],
  codex: ['stdio', 'http'],
  opencode: ['stdio', 'http'],
};

/** Transports offered when configuring a global (provider-agnostic) MCP server. */
export const MCP_GLOBAL_SUPPORTED_TRANSPORTS: McpTransport[] = ['stdio', 'http'];

/** Whether a provider honours an MCP server's working-directory setting; the form hides the field when it does not. */
export const MCP_SUPPORTS_WORKING_DIRECTORY: Record<McpProvider, boolean> = {
  claude: false,
  cursor: false,
  codex: true,
  opencode: false,
};

// ---------------------------

//----------------- TERMINAL TIMING ------------

/**
 * Delay before the terminal is measured and fitted after it is attached. Gives the browser one
 * layout pass so the initial fit and the resize message sent to the backend use real dimensions.
 */
export const TERMINAL_INIT_DELAY_MS = 100;

// ---------------------------

//----------------- CODE EDITOR DISPLAY SETTINGS ------------

/**
 * The four localStorage keys the code-editor display settings used to live
 * under, kept only so `userSettings` can migrate an existing install onto the
 * stored `codeEditorSettings` preference. Nothing writes them any more.
 */
export const CODE_EDITOR_STORAGE_KEYS = {
  wordWrap: 'codeEditorWordWrap',
  showMinimap: 'codeEditorShowMinimap',
  lineNumbers: 'codeEditorLineNumbers',
  fontSize: 'codeEditorFontSize',
} as const;

/**
 * Values applied when a code-editor setting has never been written. These are
 * the editor's own historical defaults; the settings dialog used to carry its
 * own copy with a different fontSize, so merely opening it rewrote the user's
 * editor font.
 */
export const CODE_EDITOR_DEFAULTS = {
  wordWrap: false,
  showMinimap: true,
  lineNumbers: true,
  fontSize: '12',
} as const;


// ---------------------------

//----------------- PROVIDER TOOL SETTINGS STORAGE ------------

/**
 * Per-provider preference key holding that provider's tool-permission
 * settings, sent with every `chat.send`.
 *
 * `opencode` intentionally maps to its own key even though no settings UI
 * writes it yet: without the entry the lookup would fall through to Claude's
 * key and OpenCode sessions would silently inherit Claude's `skipPermissions`.
 */
export const PROVIDER_PERMISSION_PREFERENCE_KEYS: Record<LLMProvider, UserPreferenceKey> = {
  claude: 'claudePermissions',
  cursor: 'cursorPermissions',
  codex: 'codexPermissions',
  opencode: 'opencodePermissions',
};

// ---------------------------

//----------------- SIDEBAR SELECTION ------------

/**
 * Fill for the open session in the project list and the recent-conversations
 * list. Light mode keeps one even #dbdbdc wash with ink text. Dark mode uses
 * #2b2b2b with white text. Hover repeats the same fill so the row stays one color.
 */
export const SELECTED_SESSION_ROW_CLASS =
  'bg-[#dbdbdc] text-[#1d1d1f] hover:bg-[#dbdbdc] dark:bg-[#2b2b2b] dark:text-[#ffffff] dark:hover:bg-[#2b2b2b]';

// ---------------------------

//----------------- WORKSPACE PANE TOOLBARS ------------

/**
 * Chrome for the action strip under the workspace tab bar on Shell, Files, Browser, and Source Control.
 * Those panes share this hairline, floor, and padding so the row opens at the same size.
 */
export const WORKSPACE_PANE_TOOLBAR_CHROME_CLASS =
  'border-b border-border/60 bg-background px-3 py-2';

/**
 * Labeled action on that strip. Use with Button variant "outline" and size "sm".
 * 28px tall, 12px label, 14px icon.
 */
export const WORKSPACE_PANE_ACTION_CLASS =
  'h-7 gap-1.5 px-2 text-xs font-medium [&_svg]:size-3.5';

/**
 * Icon-only outline action on the same strip. Same height and icon size as the labeled action.
 * Use with Button variant "outline" and size "sm".
 */
export const WORKSPACE_PANE_ICON_ACTION_CLASS =
  'h-7 w-7 p-0 [&_svg]:size-3.5';

// ---------------------------

//----------------- PORTAL TARGETS ------------

/**
 * Name of the slot left of the chat transcript's export button. The chat module
 * registers it with useRegisterPortalTarget; the browser-use module portals its
 * minimized live-browser chip into it through usePortalTarget.
 */
export const CHAT_HEADER_ACTIONS_PORTAL = 'chat-header-actions';
