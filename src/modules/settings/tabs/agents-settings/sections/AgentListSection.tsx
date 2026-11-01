import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import AgentStatusLight from '@/modules/settings/tabs/agents-settings/AgentStatusLight';
import SettingsCard from '@/modules/settings/SettingsCard';
import SettingsSection from '@/modules/settings/SettingsSection';
import { AGENT_PROVIDER_NAMES } from '@/shared/constants';
import { LLMProviderLogo } from '@/shared/ui';
import type { AgentContextByProvider, AgentProvider } from '@/shared/types';

type AgentListSectionProps = {
  agents: AgentProvider[];
  agentContextById: AgentContextByProvider;
  onOpenAgent: (agent: AgentProvider) => void;
};

/** Rendered by AgentsSettingsTab as the provider list that opens one agent's settings layer. */
export default function AgentListSection({
  agents,
  agentContextById,
  onOpenAgent,
}: AgentListSectionProps) {
  const { t } = useTranslation('settings');

  return (
    <SettingsSection title={t('mainTabs.agents')} description={t('agents.list.description')}>
      <SettingsCard divided>
        {agents.map((agent) => {
          const authStatus = agentContextById[agent].authStatus;
          const name = AGENT_PROVIDER_NAMES[agent];
          const statusLabel = authStatus.loading
            ? t('agents.authStatus.checking')
            : authStatus.authenticated
              ? t('agents.authStatus.connected')
              : t('agents.authStatus.notConnected');

          return (
            <button
              key={agent}
              type="button"
              onClick={() => onOpenAgent(agent)}
              aria-label={`${name}, ${statusLabel}`}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50 active:bg-accent/70"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                <LLMProviderLogo provider={agent} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{name}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {t(`agents.account.${agent}.description`, {
                    defaultValue: agent === 'opencode' ? 'OpenCode CLI assistant' : `${name} CLI assistant`,
                  })}
                </div>
              </div>
              <span className="flex-shrink-0 text-xs text-muted-foreground">{statusLabel}</span>
              <AgentStatusLight
                loading={authStatus.loading}
                authenticated={authStatus.authenticated}
                label={statusLabel}
              />
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
            </button>
          );
        })}
      </SettingsCard>
    </SettingsSection>
  );
}
