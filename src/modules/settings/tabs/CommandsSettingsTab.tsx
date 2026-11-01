import { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { usePaletteOps } from '@/modules/command-palette';
import { useProjectSlashCommands } from '@/shared/hooks/useProjectSlashCommands';
import { useSelectedProvider } from '@/shared/hooks/useSelectedProvider';
import type { Project, SlashCommand } from '@/shared/types';
import { isSkillCommand } from '@/shared/utils';
import SettingsSection from '@/modules/settings/SettingsSection';

type CommandGroupKey = 'builtIn' | 'custom' | 'skills';

type CommandGroup = {
  key: CommandGroupKey;
  labelKey: string;
  commands: SlashCommand[];
};

// Same heading order the old quick-settings Commands tab used. The composer
// menu groups by namespace instead, so the two orders stay different on purpose.
const GROUP_ORDER: { key: CommandGroupKey; labelKey: string }[] = [
  { key: 'builtIn', labelKey: 'quickSettings.commands.groups.builtIn' },
  { key: 'custom', labelKey: 'quickSettings.commands.groups.custom' },
  { key: 'skills', labelKey: 'quickSettings.commands.groups.skills' },
];

const groupKeyFor = (command: SlashCommand): CommandGroupKey => {
  if (isSkillCommand(command)) return 'skills';
  if (command.type === 'custom') return 'custom';
  return 'builtIn';
};

const matchesQuery = (command: SlashCommand, normalizedQuery: string): boolean => (
  command.name.toLowerCase().includes(normalizedQuery)
  || (command.description?.toLowerCase().includes(normalizedQuery) ?? false)
);

type CommandsSettingsTabProps = {
  selectedProject: Project | null;
  onClose: () => void;
};

/** Rendered by Settings for the "commands" tab: a searchable list of the selected project's slash commands that inserts the chosen one into the chat composer. */
export default function CommandsSettingsTab({ selectedProject, onClose }: CommandsSettingsTabProps) {
  const { t } = useTranslation('settings');
  const provider = useSelectedProvider();
  const paletteOps = usePaletteOps();
  const {
    commands,
    isLoading,
    error: hasError,
  } = useProjectSlashCommands(selectedProject, provider);
  // Narrows this list only; it resets when the settings dialog remounts the tab.
  const [query, setQuery] = useState('');

  const groups = useMemo<CommandGroup[]>(() => {
    const normalizedQuery = query.trim().toLowerCase().replace(/^\//, '');
    const visible = normalizedQuery
      ? commands.filter((command) => matchesQuery(command, normalizedQuery))
      : commands;

    return GROUP_ORDER
      .map(({ key, labelKey }) => ({
        key,
        labelKey,
        commands: visible.filter((command) => groupKeyFor(command) === key),
      }))
      .filter((group) => group.commands.length > 0);
  }, [commands, query]);

  const handleInsertCommand = useCallback((command: SlashCommand) => {
    paletteOps.showChat();
    paletteOps.insertComposerText(`${command.name} `);
    onClose();
  }, [onClose, paletteOps]);

  const hasProject = selectedProject !== null;

  const renderStatus = (message: string) => (
    <p className="px-1 py-6 text-center text-sm text-muted-foreground">{message}</p>
  );

  const renderBody = () => {
    if (!hasProject) return renderStatus(t('quickSettings.commands.noProject'));
    if (isLoading) return renderStatus(t('quickSettings.commands.loading'));
    if (hasError) return renderStatus(t('quickSettings.commands.loadError'));
    if (commands.length === 0) return renderStatus(t('quickSettings.commands.empty'));
    if (groups.length === 0) return renderStatus(t('quickSettings.commands.noMatches'));

    return groups.map((group) => (
      <div key={group.key} className="space-y-0.5">
        <h4 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t(group.labelKey)}
        </h4>
        {group.commands.map((command, index) => (
          <button
            // A project command and a user command can share a name, so the
            // position keeps the key unique.
            key={`${group.key}-${index}-${command.name}`}
            type="button"
            onClick={() => handleInsertCommand(command)}
            title={t('quickSettings.commands.insertTitle', { command: command.name })}
            className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
          >
            <span className="font-mono text-sm text-foreground">{command.name}</span>
            {command.description && (
              <span className="line-clamp-2 text-xs text-muted-foreground">{command.description}</span>
            )}
          </button>
        ))}
      </div>
    ));
  };

  return (
    <SettingsSection title={t('quickSettings.tabs.commands')}>
      <label className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 focus-within:border-primary">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('quickSettings.commands.searchPlaceholder')}
          aria-label={t('quickSettings.commands.searchPlaceholder')}
          disabled={!hasProject}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </label>
      <div className="space-y-4">
        {renderBody()}
      </div>
    </SettingsSection>
  );
}
