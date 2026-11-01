import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import '@/modules/i18n';
import AgentsSettingsTab from '@/modules/settings/tabs/agents-settings/AgentsSettingsTab';
import type { ProviderAuthStatus } from '@/shared/types';

// Opening an agent mounts the account panel, which asks for the CLI version.
// That request is not what this navigation test is about.
vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    api: { providers: { cliStatus: () => new Promise<Response>(() => {}) } },
  };
});

const status = (authenticated: boolean, loading = false): ProviderAuthStatus => ({
  authenticated,
  email: authenticated ? 'ada@example.com' : null,
  method: authenticated ? 'cli' : null,
  error: null,
  loading,
});

const renderAgents = () => render(
  <AgentsSettingsTab
    providerAuthStatus={{
      claude: status(true),
      cursor: status(false),
      codex: status(false, true),
      opencode: status(false),
    }}
    onProviderLogin={() => {}}
    claudePermissions={{ skipPermissions: false, allowedTools: [], disallowedTools: [] }}
    onClaudePermissionsChange={() => {}}
    cursorPermissions={{ skipPermissions: false, allowedCommands: [], disallowedCommands: [] }}
    onCursorPermissionsChange={() => {}}
    codexPermissionMode="default"
    onCodexPermissionModeChange={() => {}}
    projects={[]}
  />,
);

describe('Agents settings navigation', () => {
  it('lists each agent with its connection lamp, then opens that agent in a layer', () => {
    renderAgents();

    expect(screen.getByRole('button', { name: 'Claude, Connected' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cursor, Not connected' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Codex, Checking...' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'OpenCode, Not connected' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Claude, Connected' }));

    expect(screen.getByRole('dialog', { name: 'Claude' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Account', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Permissions' })).toBeTruthy();
    expect(screen.getByText('Logged in as ada@example.com')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Claude, Connected' })).toBeTruthy();
  });

  it('closes the layer on Escape and hides categories OpenCode does not have', () => {
    renderAgents();

    fireEvent.click(screen.getByRole('button', { name: 'OpenCode, Not connected' }));

    expect(screen.getByRole('dialog', { name: 'OpenCode' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Account', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'MCP Servers' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Permissions' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Skills' })).toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
