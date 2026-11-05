/**
 * Launches Claude inside nono when the user has enabled it.
 *
 * Plain secrets are environment variables. API secrets (those with an https
 * upstream) are placed only in the environment of a nono parent. Claude is the
 * sandboxed child and receives phantom tokens plus localhost base URLs.
 * Extra folders from the nono settings tab are added to the filesystem allow list.
 * The prompt names every variable and never includes a stored secret.
 *
 * Once the user enables nono, every failure here stops the turn. Claude must
 * never fall back to running outside the sandbox the user asked for.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { userPreferencesDb } from '@/modules/database/index.js';
import {
  agentVaultPromptEntry,
  buildAgentVaultPrompt,
  isApiVaultSecret,
  loadAgentVaultSecrets,
  type AgentVaultRuntimeSecret,
} from '@/modules/providers/shared/agent-vault.js';
import {
  AppError,
  findExecutableOnPath,
  getModuleDirectory,
  isNonoFolderCoveringHome,
  NONO_SETTINGS_PREFERENCE_KEY,
  readNonoSettings,
} from '@/shared/utils.js';
import type { NonoSettings } from '@/shared/types.js';

const WRAPPER_NAME = 'claude-broker.mjs';
const PREFLIGHT_TIMEOUT_MS = 15_000;
const PREFLIGHT_ERROR_LENGTH = 800;

const execFileAsync = promisify(execFile);

/** Metadata for one API secret written into a nono profile. The secret value is never part of this type. */
export type BrokeredProfileCredential = {
  name: string;
  upstream: string;
  injectHeader: string;
  credentialFormat: string;
};

/**
 * Profile JSON and the prompt note that names the phantom env vars.
 *
 * The profile must not contain secret values. Callers pass metadata only.
 * Plain secrets are described in the prompt and left out of the profile.
 * Used by the Claude runtime and by the broker tests.
 */
export function buildBrokeredNonoProfile(input: {
  credentials: Array<BrokeredProfileCredential & { note?: string | null }>;
  claudeTempDir: string;
  allowedFolders?: string[];
  /** Folders a sandboxed process needs to read: the Node install and the AgentWeb MCP entry. */
  readFolders?: string[];
  /** The server's own port. Browser MCP tools call it directly once API secrets turn on nono's proxy. */
  serverPort?: number;
}): { profile: Record<string, unknown>; promptAppend: string } {
  const apiCredentials = input.credentials.filter((credential) => isApiVaultSecret(credential));
  const customCredentials: Record<string, unknown> = {};
  for (const credential of apiCredentials) {
    const described = agentVaultPromptEntry({
      name: credential.name,
      note: credential.note ?? null,
      upstream: credential.upstream,
      injectHeader: credential.injectHeader,
      credentialFormat: credential.credentialFormat,
      secret: '',
    });
    customCredentials[credential.name] = {
      upstream: credential.upstream,
      credential_key: `env://${described.tokenEnv}`,
      env_var: described.tokenEnv,
      inject_header: credential.injectHeader,
      credential_format: credential.credentialFormat,
    };
  }
  const promptAppend = buildAgentVaultPrompt(input.credentials.map((credential) => agentVaultPromptEntry({
    name: credential.name,
    note: credential.note ?? null,
    upstream: credential.upstream,
    injectHeader: credential.injectHeader,
    credentialFormat: credential.credentialFormat,
    secret: '',
  })));
  const allowedFolders = (input.allowedFolders ?? []).filter((folder) => folder && !folder.includes('\0'));
  return {
    profile: {
      meta: { name: 'agentweb-broker', version: '1.0.0' },
      // --allow-cwd grants the open project only when the profile names a workdir level.
      workdir: { access: 'readwrite' },
      groups: {
        // Skipped on platforms they do not apply to. nono adds its deny groups by itself.
        include: ['claude_code_linux', 'claude_cache_linux', 'node_runtime', 'mise_manager', 'git_config'],
      },
      filesystem: {
        allow: [...new Set(['$HOME/.claude', input.claudeTempDir, ...allowedFolders])],
        allow_file: ['$HOME/.claude.json', '$HOME/.claude.json.lock'],
        read: [...new Set(input.readFolders ?? [])],
      },
      network: {
        credentials: apiCredentials.map((credential) => credential.name),
        custom_credentials: customCredentials,
        connect_port: apiCredentials.length > 0 && input.serverPort ? [input.serverPort] : [],
      },
    },
    promptAppend,
  };
}

function brokerPaths(userId: number): { directory: string; profilePath: string; wrapperPath: string; tempDir: string } {
  const directory = path.join(os.homedir(), '.cloudcli', 'nono');
  return {
    directory,
    profilePath: path.join(directory, `user-${userId}.json`),
    wrapperPath: path.join(directory, WRAPPER_NAME),
    tempDir: path.join(os.tmpdir(), 'cloudcli-claude'),
  };
}

function ensureWrapper(wrapperPath: string): void {
  const source = `import { spawn } from 'node:child_process';
import process from 'node:process';

const nono = process.env.CLOUDCLI_NONO_BIN;
const profile = process.env.CLOUDCLI_NONO_PROFILE;
const claude = process.env.CLOUDCLI_CLAUDE_BIN;
if (!nono || !profile || !claude) {
  process.stderr.write('CloudCLI nono broker is not configured\\n');
  process.exit(1);
}

const child = spawn(nono, [
  'run',
  '--silent',
  '--no-rollback',
  '--no-rollback-prompt',
  '--profile',
  profile,
  '--allow-cwd',
  '--',
  claude,
  ...process.argv.slice(2),
], { stdio: 'inherit' });

child.on('error', () => {
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
`;
  fs.writeFileSync(wrapperPath, source, { mode: 0o755 });
}

function secretEnv(credentials: AgentVaultRuntimeSecret[]): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const credential of credentials) {
    env[agentVaultPromptEntry(credential).tokenEnv] = credential.secret;
  }
  return env;
}

/**
 * The shared `.git` directory of a linked worktree, or null for anything else.
 *
 * A worktree's `.git` is a file pointing at `<repo>/.git/worktrees/<name>`, which
 * sits outside the project. Commits there fail unless nono can write to it.
 * Used by the Claude broker and its tests.
 */
export function resolveWorktreeGitDir(projectPath: string): string | null {
  try {
    const dotGit = path.join(projectPath, '.git');
    if (!fs.statSync(dotGit).isFile()) {
      return null;
    }
    const match = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(dotGit, 'utf8'));
    if (!match) {
      return null;
    }
    const gitDir = path.resolve(projectPath, match[1].trim());
    const worktrees = path.dirname(gitDir);
    return path.basename(worktrees) === 'worktrees' ? path.dirname(worktrees) : null;
  } catch {
    return null;
  }
}

/** Nearest folder above this module that holds package.json. The browser MCP entry lives under it. */
function findAppRoot(): string {
  const start = getModuleDirectory(import.meta.url);
  let current = start;
  while (path.dirname(current) !== current) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return start;
}

/**
 * Asks nono to resolve the profile without starting Claude, so a policy conflict
 * becomes a readable error. The wrapper runs with --silent and cannot report one.
 */
async function preflightNonoProfile(input: {
  nonoPath: string;
  profilePath: string;
  claudeExecutable: string;
  projectPath: string;
  env: NodeJS.ProcessEnv;
}): Promise<void> {
  try {
    await execFileAsync(input.nonoPath, [
      'run',
      '--dry-run',
      '--no-rollback',
      '--no-rollback-prompt',
      '--profile',
      input.profilePath,
      '--allow-cwd',
      '--',
      input.claudeExecutable,
      '--version',
    ], {
      cwd: input.projectPath,
      env: { ...process.env, ...input.env, NO_COLOR: '1' },
      timeout: PREFLIGHT_TIMEOUT_MS,
    });
  } catch (error) {
    const failure = error as { stderr?: string; message?: string };
    const detail = (failure.stderr || failure.message || '').trim().slice(0, PREFLIGHT_ERROR_LENGTH);
    throw new AppError(`nono refused to start Claude: ${detail}`, {
      code: 'NONO_POLICY_REJECTED',
      statusCode: 400,
    });
  }
}

function loadUserNonoSettings(userId: number): NonoSettings {
  return readNonoSettings(userPreferencesDb.getPreferences(userId)[NONO_SETTINGS_PREFERENCE_KEY]);
}

/**
 * Prepares Claude's environment for this user's nono choice and Agent Vault secrets.
 *
 * Returns null when nono is off and there is nothing plain to pass through.
 * nono wraps Claude only after the user enables it. API secrets then stay in the
 * nono parent. Extra folders from the nono settings tab are added to the profile
 * allow list. Throws `AppError` when nono is enabled but cannot sandbox this
 * project; the Claude runtime reports that to the user and does not start Claude.
 * Used by the Claude runtime before it starts a session.
 */
export async function applyClaudeNonoBroker(input: {
  userId: number;
  claudeExecutable: string | undefined;
  projectPath: string | undefined;
}): Promise<{ executablePath?: string; env: NodeJS.ProcessEnv; promptAppend: string } | null> {
  const settings = loadUserNonoSettings(input.userId);
  const secrets = loadAgentVaultSecrets(input.userId);
  const apiSecrets = secrets.filter((secret) => isApiVaultSecret(secret));
  const plainSecrets = secrets.filter((secret) => !isApiVaultSecret(secret));
  const promptAppend = buildAgentVaultPrompt(secrets.map(agentVaultPromptEntry));
  const plainPrompt = buildAgentVaultPrompt(plainSecrets.map(agentVaultPromptEntry));
  const plainEnv = secretEnv(plainSecrets);
  const plainOnly = () => {
    if (plainSecrets.length === 0) {
      return null;
    }
    return {
      env: plainPrompt ? { ...plainEnv, AGENT_VAULT_NOTE: plainPrompt } : plainEnv,
      promptAppend: plainPrompt,
    };
  };

  if (!settings.enabled) {
    return plainOnly();
  }

  const nonoPath = findExecutableOnPath('nono');
  if (!nonoPath || process.platform === 'win32') {
    throw new AppError(nonoPath
      ? 'nono is enabled, but it does not run on native Windows. Turn it off in Settings > nono to use Claude here.'
      : 'nono is enabled, but it is not installed on this server. Install it, or turn it off in Settings > nono.', {
      code: 'NONO_UNAVAILABLE',
      statusCode: 503,
    });
  }

  const projectPath = input.projectPath || process.cwd();
  if (isNonoFolderCoveringHome(projectPath)) {
    throw new AppError(
      `nono cannot protect your home directory while ${projectPath} is the open project. Open a project folder inside it instead.`,
      { code: 'NONO_PROJECT_INVALID', statusCode: 400 },
    );
  }

  const paths = brokerPaths(input.userId);
  fs.mkdirSync(paths.directory, { recursive: true, mode: 0o700 });
  fs.mkdirSync(paths.tempDir, { recursive: true, mode: 0o700 });
  const built = buildBrokeredNonoProfile({
    credentials: apiSecrets.map((credential) => ({
      name: credential.name,
      note: credential.note,
      upstream: credential.upstream,
      injectHeader: credential.injectHeader,
      credentialFormat: credential.credentialFormat,
    })),
    claudeTempDir: paths.tempDir,
    allowedFolders: [
      ...settings.allowedFolders,
      ...[resolveWorktreeGitDir(projectPath)].filter((folder): folder is string => Boolean(folder)),
    ],
    readFolders: [findAppRoot(), path.dirname(path.dirname(process.execPath))]
      .filter((folder) => !isNonoFolderCoveringHome(folder)),
    serverPort: Number.parseInt(process.env.SERVER_PORT || process.env.PORT || '3001', 10),
  });
  const serialized = JSON.stringify(built.profile);
  for (const credential of secrets) {
    if (serialized.includes(credential.secret)) {
      throw new Error('Refusing to write a nono profile that contains an Agent Vault secret');
    }
  }
  fs.writeFileSync(paths.profilePath, `${serialized}\n`, { mode: 0o600 });
  ensureWrapper(paths.wrapperPath);
  const claudeExecutable = input.claudeExecutable && input.claudeExecutable.includes(path.sep)
    ? input.claudeExecutable
    : (findExecutableOnPath(input.claudeExecutable || 'claude') || input.claudeExecutable || 'claude');

  await preflightNonoProfile({
    nonoPath,
    profilePath: paths.profilePath,
    claudeExecutable,
    projectPath,
    env: secretEnv(apiSecrets),
  });

  return {
    executablePath: paths.wrapperPath,
    promptAppend,
    env: {
      ...secretEnv(apiSecrets),
      ...plainEnv,
      ...(promptAppend ? { AGENT_VAULT_NOTE: promptAppend } : {}),
      CLOUDCLI_NONO_BIN: nonoPath,
      CLOUDCLI_NONO_PROFILE: paths.profilePath,
      CLOUDCLI_CLAUDE_BIN: claudeExecutable,
      CLAUDE_CODE_TMPDIR: paths.tempDir,
    },
  };
}
