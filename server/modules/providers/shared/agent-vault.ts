/**
 * Agent Vault secrets shared with agent runtimes.
 *
 * A vault entry is a named secret the user saved in settings. It does not have
 * to be an API key. Entries with an https upstream are API secrets: the Claude
 * runtime brokers those through nono and this module does not copy their
 * values into other agents. Every other secret is placed in the agent process
 * environment under its name. Prompts and AGENT_VAULT_NOTE name the variables
 * and never include the stored value.
 */

import { brokeredCredentialsDb } from '@/modules/database/index.js';

/** One active vault secret, including the value, as a runtime is about to start. */
export type AgentVaultRuntimeSecret = {
  name: string;
  note: string | null;
  upstream: string;
  injectHeader: string;
  credentialFormat: string;
  secret: string;
};

/** One vault entry described to an agent. `tokenEnv` is the variable the agent may read. */
export type AgentVaultPromptEntry = {
  name: string;
  note: string | null;
  kind: 'api' | 'secret';
  tokenEnv: string;
  baseUrlEnv: string;
};

/** Env var names nono derives from an API secret's slug. Used by the Claude broker. */
export function brokeredCredentialEnvNames(name: string): { tokenEnv: string; baseUrlEnv: string } {
  const prefix = name.toUpperCase();
  return { tokenEnv: `${prefix}_TOKEN`, baseUrlEnv: `${prefix}_BASE_URL` };
}

/** True when this secret should be brokered to an https API instead of handed to the agent directly. */
export function isApiVaultSecret(secret: { upstream: string }): boolean {
  return secret.upstream.trim().length > 0;
}

/**
 * Prompt text that names vault variables.
 *
 * The Claude runtime appends this to the system prompt. Other runtimes copy
 * the same text into AGENT_VAULT_NOTE. The stored secret must never appear here.
 */
export function buildAgentVaultPrompt(entries: AgentVaultPromptEntry[]): string {
  if (entries.length === 0) {
    return '';
  }
  const lines = [
    'Agent Vault secrets are available in the environment.',
    'Use the named variable for each secret. Do not print those values, write them to a file, or ask the user to repeat them.',
  ];
  for (const entry of entries) {
    const detail = entry.kind === 'api'
      ? `base URL $${entry.baseUrlEnv}, token $${entry.tokenEnv}`
      : `$${entry.tokenEnv}`;
    const note = entry.note ? ` — ${entry.note}` : '';
    lines.push(`- ${entry.name}: ${detail}${note}`);
  }
  return lines.join('\n');
}

/** Describes one stored secret without copying its value. */
export function agentVaultPromptEntry(secret: AgentVaultRuntimeSecret): AgentVaultPromptEntry {
  if (isApiVaultSecret(secret)) {
    const envNames = brokeredCredentialEnvNames(secret.name);
    return {
      name: secret.name,
      note: secret.note,
      kind: 'api',
      tokenEnv: envNames.tokenEnv,
      baseUrlEnv: envNames.baseUrlEnv,
    };
  }
  return {
    name: secret.name,
    note: secret.note,
    kind: 'secret',
    tokenEnv: secret.name.toUpperCase(),
    baseUrlEnv: '',
  };
}

/** Active vault secrets for one user. Empty when the id is not a real user. Used by agent runtimes before they start. */
export function loadAgentVaultSecrets(userId: number): AgentVaultRuntimeSecret[] {
  if (!Number.isInteger(userId) || userId <= 0) {
    return [];
  }
  return brokeredCredentialsDb.listActiveSecrets(userId).map((row) => ({
    name: row.name,
    note: row.note?.trim() || null,
    upstream: row.upstream,
    injectHeader: row.inject_header,
    credentialFormat: row.credential_format,
    secret: row.secret,
  }));
}

/**
 * Environment entries for a plain vault secret.
 *
 * API secrets are omitted so their values are not copied into a process that
 * cannot broker them. Used by Cursor, OpenCode, and the Codex environment
 * helper. Claude uses the same values when it is not wrapping the process in nono.
 */
export function agentVaultProcessEnv(userId: number): Record<string, string> {
  const secrets = loadAgentVaultSecrets(userId).filter((secret) => !isApiVaultSecret(secret));
  if (secrets.length === 0) {
    return {};
  }
  const env: Record<string, string> = {};
  for (const secret of secrets) {
    env[secret.name.toUpperCase()] = secret.secret;
  }
  const note = buildAgentVaultPrompt(secrets.map(agentVaultPromptEntry));
  if (note) {
    env.AGENT_VAULT_NOTE = note;
  }
  return env;
}

/**
 * Full process environment for Codex.
 *
 * The Codex SDK drops the parent environment when `env` is set, so this copies
 * the current environment and then adds vault variables. Returns undefined
 * when the user has no plain secrets, leaving Codex on its default inheritance.
 * Used by the Codex runtime.
 */
export function codexEnvWithAgentVault(userId: number): Record<string, string> | undefined {
  const vaultEnv = agentVaultProcessEnv(userId);
  if (Object.keys(vaultEnv).length === 0) {
    return undefined;
  }
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  return { ...env, ...vaultEnv };
}
