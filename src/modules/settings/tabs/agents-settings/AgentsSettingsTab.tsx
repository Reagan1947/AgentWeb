import { useMemo, useState } from 'react';

import AgentSettingsLayer from '@/modules/settings/tabs/agents-settings/AgentSettingsLayer';
import AgentListSection from '@/modules/settings/tabs/agents-settings/sections/AgentListSection';
import { ScrollArea } from '@/shared/ui';
import type { AgentContextByProvider, AgentProvider, AgentSettingsProject, ClaudePermissionsState, CodexPermissionMode, CursorPermissionsState, ProviderAuthStatus } from '@/shared/types';

type ProviderAuthStatusByProvider = Record<AgentProvider, ProviderAuthStatus>;

type AgentsSettingsTabProps = {
  providerAuthStatus: ProviderAuthStatusByProvider;
  onProviderLogin: (provider: AgentProvider) => void;
  claudePermissions: ClaudePermissionsState;
  onClaudePermissionsChange: (value: ClaudePermissionsState) => void;
  cursorPermissions: CursorPermissionsState;
  onCursorPermissionsChange: (value: CursorPermissionsState) => void;
  codexPermissionMode: CodexPermissionMode;
  onCodexPermissionModeChange: (value: CodexPermissionMode) => void;
  projects: AgentSettingsProject[];
};

const AGENT_PROVIDERS: AgentProvider[] = ['claude', 'cursor', 'codex', 'opencode'];

/** Rendered by Settings for the "agents" tab, listing providers and opening one provider's settings layer. */
export default function AgentsSettingsTab({
  providerAuthStatus,
  onProviderLogin,
  claudePermissions,
  onClaudePermissionsChange,
  cursorPermissions,
  onCursorPermissionsChange,
  codexPermissionMode,
  onCodexPermissionModeChange,
  projects,
}: AgentsSettingsTabProps) {
  // Which provider's settings layer is open. Null leaves the list as the whole tab.
  const [openAgent, setOpenAgent] = useState<AgentProvider | null>(null);

  const agentContextById = useMemo<AgentContextByProvider>(() => ({
    claude: {
      authStatus: providerAuthStatus.claude,
      onLogin: () => onProviderLogin('claude'),
    },
    cursor: {
      authStatus: providerAuthStatus.cursor,
      onLogin: () => onProviderLogin('cursor'),
    },
    codex: {
      authStatus: providerAuthStatus.codex,
      onLogin: () => onProviderLogin('codex'),
    },
    opencode: {
      authStatus: providerAuthStatus.opencode,
      onLogin: () => onProviderLogin('opencode'),
    },
  }), [
    onProviderLogin,
    providerAuthStatus.claude,
    providerAuthStatus.codex,
    providerAuthStatus.cursor,
    providerAuthStatus.opencode,
  ]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ScrollArea overlayScrollbar className="min-h-0 flex-1">
        <div className="-mr-3 min-w-0 p-4 pb-safe-area-inset-bottom md:p-6">
          <AgentListSection
            agents={AGENT_PROVIDERS}
            agentContextById={agentContextById}
            onOpenAgent={setOpenAgent}
          />
        </div>
      </ScrollArea>

      {openAgent && (
        <AgentSettingsLayer
          key={openAgent}
          agent={openAgent}
          agentContextById={agentContextById}
          onClose={() => setOpenAgent(null)}
          claudePermissions={claudePermissions}
          onClaudePermissionsChange={onClaudePermissionsChange}
          cursorPermissions={cursorPermissions}
          onCursorPermissionsChange={onCursorPermissionsChange}
          codexPermissionMode={codexPermissionMode}
          onCodexPermissionModeChange={onCodexPermissionModeChange}
          projects={projects}
        />
      )}
    </div>
  );
}
