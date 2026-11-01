import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import AgentStatusLight from '@/modules/settings/tabs/agents-settings/AgentStatusLight';
import AgentCategoryContentSection from '@/modules/settings/tabs/agents-settings/sections/AgentCategoryContentSection';
import AgentCategoryTabsSection from '@/modules/settings/tabs/agents-settings/sections/AgentCategoryTabsSection';
import { AGENT_PROVIDER_NAMES } from '@/shared/constants';
import { Button, LLMProviderLogo, ScrollArea } from '@/shared/ui';
import type { AgentCategory, AgentContextByProvider, AgentProvider, AgentSettingsProject, ClaudePermissionsState, CodexPermissionMode, CursorPermissionsState } from '@/shared/types';

type AgentSettingsLayerProps = {
  agent: AgentProvider;
  agentContextById: AgentContextByProvider;
  onClose: () => void;
  claudePermissions: ClaudePermissionsState;
  onClaudePermissionsChange: (value: ClaudePermissionsState) => void;
  cursorPermissions: CursorPermissionsState;
  onCursorPermissionsChange: (value: CursorPermissionsState) => void;
  codexPermissionMode: CodexPermissionMode;
  onCodexPermissionModeChange: (value: CodexPermissionMode) => void;
  projects: AgentSettingsProject[];
};

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Rendered by AgentsSettingsTab as the second dialog for one provider's account, permissions, MCP and skills. */
export default function AgentSettingsLayer({
  agent,
  agentContextById,
  onClose,
  claudePermissions,
  onClaudePermissionsChange,
  cursorPermissions,
  onCursorPermissionsChange,
  codexPermissionMode,
  onCodexPermissionModeChange,
  projects,
}: AgentSettingsLayerProps) {
  const { t } = useTranslation(['settings', 'common']);
  const titleId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // A click only counts as "outside" when it both started and ended on this layer's backdrop.
  const backdropMouseDownRef = useRef(false);
  // Which category this opening of the layer shows. Remounting the layer (a new agent) starts again on Account.
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory>('account');
  const authStatus = agentContextById[agent].authStatus;
  const name = AGENT_PROVIDER_NAMES[agent];
  const statusLabel = authStatus.loading
    ? t('agents.authStatus.checking')
    : authStatus.authenticated
      ? t('agents.authStatus.connected')
      : t('agents.authStatus.notConnected');
  // OpenCode has no permission model in this app, and no skills panel, so those tabs stay off this layer.
  const visibleCategories = useMemo<AgentCategory[]>(() => (
    agent === 'opencode'
      ? ['account', 'mcp']
      : ['account', 'permissions', 'mcp', 'skills']
  ), [agent]);
  const activeCategory = visibleCategories.includes(selectedCategory)
    ? selectedCategory
    : (visibleCategories[0] ?? 'account');

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const layers = document.querySelectorAll('[data-escape-layer]');
      // A menu or the login shell opened on top of this layer owns Escape and Tab.
      if (layers[layers.length - 1] !== layerRef.current) {
        return;
      }

      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) {
        return;
      }

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panelRef.current.contains(active);
      if (!inside || (event.shiftKey && active === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    backdropMouseDownRef.current = event.target === event.currentTarget;
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const startedOnBackdrop = backdropMouseDownRef.current;
    backdropMouseDownRef.current = false;
    if (startedOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      ref={layerRef}
      data-escape-layer
      className="modal-backdrop fixed inset-0 z-[9998] flex items-center justify-center md:p-4"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex h-full w-full flex-col overflow-hidden border border-border bg-background shadow-2xl outline-none duration-150 animate-in fade-in zoom-in-95 md:h-[82vh] md:max-w-3xl md:rounded-xl"
      >
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-border px-3 py-3 md:px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={t('common:navigation.back')}
            className="h-10 w-10 flex-shrink-0 touch-manipulation p-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-card">
            <LLMProviderLogo provider={agent} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold text-foreground">{name}</h2>
            <p className="truncate text-xs text-muted-foreground">{statusLabel}</p>
          </div>
          <AgentStatusLight
            loading={authStatus.loading}
            authenticated={authStatus.authenticated}
            label={statusLabel}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={t('common:buttons.close')}
            className="h-10 w-10 flex-shrink-0 touch-manipulation p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-shrink-0 border-b border-border">
          <AgentCategoryTabsSection
            categories={visibleCategories}
            selectedAgent={agent}
            selectedCategory={activeCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>

        <ScrollArea overlayScrollbar className="min-h-0 flex-1">
          <div className="-mr-3 min-w-0 p-4 pb-safe-area-inset-bottom md:p-6">
            <AgentCategoryContentSection
              selectedAgent={agent}
              selectedCategory={activeCategory}
              agentContextById={agentContextById}
              claudePermissions={claudePermissions}
              onClaudePermissionsChange={onClaudePermissionsChange}
              cursorPermissions={cursorPermissions}
              onCursorPermissionsChange={onCursorPermissionsChange}
              codexPermissionMode={codexPermissionMode}
              onCodexPermissionModeChange={onCodexPermissionModeChange}
              projects={projects}
            />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
