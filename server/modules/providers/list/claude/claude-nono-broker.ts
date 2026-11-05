/**
 * Launches Claude inside nono when the user has enabled it.
 *
 * Plain secrets are environment variables. API secrets (those with an https
 * upstream) are placed only in the environment of a nono parent. Claude is the
 * sandboxed child and receives phantom tokens plus localhost base URLs.
 * Extra folders from the nono settings tab are added to the filesystem allow list.
 * Folders that contain nono's protected credential paths are left out, because
 * Linux cannot allow a parent of those paths. The open project is granted with
 * --allow-cwd, so that project must be a subdirectory rather than the home directory.
 * The prompt names every variable and never includes a stored secret.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { userPreferencesDb } from '@/modules/database/index.js';
import {
  agentVaultPromptEntry,
  buildAgentVaultPrompt,
  isApiVaultSecret,
  loadAgentVaultSecrets,
  type AgentVaultRuntimeSecret,
} from '@/modules/providers/shared/agent-vault.js';
import {
  findExecutableOnPath,
  nonoFolderOverlapsProtectedPath,
  NONO_SETTINGS_PREFERENCE_KEY,
  readNonoSettings,
} from '@/shared/utils.js';
import type { NonoSettings } from '@/shared/types.js';

const WRAPPER_NAME = 'claude-broker.mjs';

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
  const allowedFolders = (input.allowedFolders ?? []).filter((folder) =>
    folder && !folder.includes('\0') && !nonoFolderOverlapsProtectedPath(folder));
  return {
    profile: {
      meta: { name: 'agentweb-broker', version: '1.0.0' },
      // --allow-cwd grants the open project only when the profile names a workdir level.
      workdir: { access: 'readwrite' },
      filesystem: {
        allow: [...new Set(['$HOME/.claude', input.claudeTempDir, ...allowedFolders])],
      },
      network: {
        credentials: apiCredentials.map((credential) => credential.name),
        custom_credentials: customCredentials,
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
if (process.env.CLOUDCLI_NONO_PROJECT_BLOCKED === '1') {
  process.stderr.write('This project folder contains protected credential paths, so nono cannot allow it. Open a subdirectory instead.\\n');
  process.exit(1);
}
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

function loadUserNonoSettings(userId: number): NonoSettings {
  return readNonoSettings(userPreferencesDb.getPreferences(userId)[NONO_SETTINGS_PREFERENCE_KEY]);
}

/**
 * Prepares Claude's environment for this user's nono choice and Agent Vault secrets.
 *
 * Returns null when nono is off and there is nothing plain to pass through.
 * nono wraps Claude only after the user enables it. API secrets then stay in the
 * nono parent; a missing nono binary must not fall back to putting those secrets
 * in Claude's environment. Plain secrets are still applied. Extra folders from
 * the nono settings tab are added to the profile allow list.
 * Used by the Claude runtime before it starts a session.
 */
export function applyClaudeNonoBroker(input: {
  userId: number;
  claudeExecutable: string | undefined;
  cwd?: string;
}): { executablePath?: string; env: NodeJS.ProcessEnv; promptAppend: string } | null {
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
    console.warn(nonoPath
      ? '[Claude] nono is enabled, but it does not run on native Windows'
      : '[Claude] nono is enabled, but it is not installed');
    // API secrets are not in the environment, so the prompt must not name them.
    return plainOnly();
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
    allowedFolders: settings.allowedFolders,
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
      ...(input.cwd && nonoFolderOverlapsProtectedPath(input.cwd) ? { CLOUDCLI_NONO_PROJECT_BLOCKED: '1' } : {}),
      CLAUDE_CODE_TMPDIR: paths.tempDir,
    },
  };
}
