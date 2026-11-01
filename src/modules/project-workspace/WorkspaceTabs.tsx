import { MessageSquare, Terminal, Folder, GitBranch, ClipboardCheck, type LucideIcon } from 'lucide-react';
import { Fragment } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

import { usePlugins, PluginIcon } from '@/modules/plugins';
import browserIconSvg from '@/modules/project-workspace/browser-icon.svg?raw';
import { Tooltip, Tabs, TabsList, TabsTrigger } from '@/shared/ui';
import type { AppTab } from '@/shared/types';

type WorkspaceTabsProps = {
  activeTab: AppTab;
  setActiveTab: Dispatch<SetStateAction<AppTab>>;
  shouldShowTasksTab: boolean;
  shouldShowBrowserTab: boolean;
};

type TabIconProps = {
  className?: string;
};

type StandardBuiltInTab = {
  kind: 'builtin';
  id: Exclude<AppTab, 'browser'>;
  labelKey: string;
  icon: LucideIcon;
};

type BrowserBuiltInTab = {
  kind: 'builtin';
  id: 'browser';
  labelKey: string;
};

type BuiltInTab = StandardBuiltInTab | BrowserBuiltInTab;

type PluginTab = {
  kind: 'plugin';
  id: AppTab;
  label: string;
  pluginName: string;
  iconFile: string;
};

type TabDefinition = BuiltInTab | PluginTab;

const BASE_TABS: BuiltInTab[] = [
  { kind: 'builtin', id: 'chat',  labelKey: 'tabs.chat',  icon: MessageSquare },
  { kind: 'builtin', id: 'shell', labelKey: 'tabs.shell', icon: Terminal },
  { kind: 'builtin', id: 'files', labelKey: 'tabs.files', icon: Folder },
  { kind: 'builtin', id: 'git',   labelKey: 'tabs.git',   icon: GitBranch },
];

// Renders the supplied Browser.svg artwork. currentColor lets the tab tint it; the path is left unchanged.
function BrowserTabIcon({ className }: TabIconProps) {
  const svgStart = browserIconSvg.indexOf('<svg');
  const svg = browserIconSvg
    .slice(svgStart)
    .replace('<svg ', '<svg fill="currentColor" aria-hidden="true" ')
    .replace(' width="200" height="200"', '');

  return (
    <span
      className={`inline-flex ${className ?? ''} [&>svg]:h-full [&>svg]:w-full`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const BROWSER_TAB: BrowserBuiltInTab = {
  kind: 'builtin',
  id: 'browser',
  labelKey: 'tabs.browser',
};

const TASKS_TAB: BuiltInTab = {
  kind: 'builtin',
  id: 'tasks',
  labelKey: 'tabs.tasks',
  icon: ClipboardCheck,
};

/** Rendered by WorkspaceHeader to show the built-in workspace tabs plus any enabled plugin tabs. */
export default function WorkspaceTabs({
  activeTab,
  setActiveTab,
  shouldShowTasksTab,
  shouldShowBrowserTab,
}: WorkspaceTabsProps) {
  const { t } = useTranslation();
  const { plugins } = usePlugins();

  const builtInTabs: BuiltInTab[] = [
    ...BASE_TABS,
    ...(shouldShowBrowserTab ? [BROWSER_TAB] : []),
    ...(shouldShowTasksTab ? [TASKS_TAB] : []),
  ];

  const pluginTabs: PluginTab[] = plugins
    .filter((p) => p.enabled)
    .map((p) => ({
      kind: 'plugin',
      id: `plugin:${p.name}` as AppTab,
      label: p.displayName,
      pluginName: p.name,
      iconFile: p.icon,
    }));

  const tabs: TabDefinition[] = [...builtInTabs, ...pluginTabs];

  const selectTab = (value: string) => {
    const nextTab = tabs.find((tab) => tab.id === value);
    if (nextTab) {
      setActiveTab(nextTab.id);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={selectTab} className="w-max">
      <TabsList
        aria-label={t('tabs.views', { defaultValue: 'Workspace views' })}
        className="w-max gap-1.5"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          const displayLabel = tab.kind === 'builtin' ? t(tab.labelKey) : tab.label;

          return (
            <Fragment key={`${tab.id}-${index}`}>
              {index === builtInTabs.length && pluginTabs.length > 0 && (
                <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
              )}
              <Tooltip content={displayLabel} position="bottom">
                <TabsTrigger
                  value={tab.id}
                  aria-label={displayLabel}
                  className="size-7 px-0"
                >
                  {tab.kind === 'plugin' ? (
                    <PluginIcon
                      pluginName={tab.pluginName}
                      iconFile={tab.iconFile}
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full"
                    />
                  ) : tab.id === 'browser' ? (
                    <BrowserTabIcon className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <tab.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                  )}
                </TabsTrigger>
              </Tooltip>
            </Fragment>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
