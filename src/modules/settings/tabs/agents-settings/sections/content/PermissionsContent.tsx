import { useState } from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ClaudeSettingsFileRules from '@/modules/settings/tabs/agents-settings/sections/content/ClaudeSettingsFileRules';
import SettingsCard from '@/modules/settings/SettingsCard';
import SettingsRow from '@/modules/settings/SettingsRow';
import SettingsSection from '@/modules/settings/SettingsSection';
import SettingsToggle from '@/modules/settings/SettingsToggle';
import { Button, Input } from '@/shared/ui';
import { cn } from '@/shared/utils';
import type { CodexPermissionMode } from '@/shared/types';

const COMMON_CLAUDE_TOOLS = [
  'Bash(git log:*)',
  'Bash(git diff:*)',
  'Bash(git status:*)',
  'Write',
  'Read',
  'Edit',
  'Glob',
  'Grep',
  'MultiEdit',
  'Task',
  'TodoWrite',
  'TodoRead',
  'WebFetch',
  'WebSearch',
];

const COMMON_CURSOR_COMMANDS = [
  'Shell(ls)',
  'Shell(mkdir)',
  'Shell(cd)',
  'Shell(cat)',
  'Shell(echo)',
  'Shell(git status)',
  'Shell(git diff)',
  'Shell(git log)',
  'Shell(npm install)',
  'Shell(npm run)',
  'Shell(python)',
  'Shell(node)',
];

const addUnique = (items: string[], value: string): string[] => {
  const normalizedValue = value.trim();
  if (!normalizedValue || items.includes(normalizedValue)) {
    return items;
  }

  return [...items, normalizedValue];
};

const removeValue = (items: string[], value: string): string[] => (
  items.filter((item) => item !== value)
);

type RuleListEditorProps = {
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
  suggestions: readonly string[];
  suggestionsLabel: string;
  emptyLabel: string;
  tone: 'allow' | 'block';
};

const RULE_CHIP_CLASS = {
  allow: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200',
  block: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200',
} as const;

/** Shared allow/block editor for the Claude and Cursor permission panels. */
function RuleListEditor({
  placeholder,
  items,
  onChange,
  suggestions,
  suggestionsLabel,
  emptyLabel,
  tone,
}: RuleListEditorProps) {
  const { t } = useTranslation('settings');
  // Cleared only when this draft itself is added, so picking a suggestion does not wipe an in-progress pattern.
  const [draft, setDraft] = useState('');
  const remainingSuggestions = suggestions.filter((suggestion) => !items.includes(suggestion));

  const addItem = (value: string) => {
    const updated = addUnique(items, value);
    if (updated.length === items.length) {
      return;
    }

    onChange(updated);
    if (value.trim() === draft.trim()) {
      setDraft('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addItem(draft);
            }
          }}
          className="h-10 flex-1"
        />
        <Button
          onClick={() => addItem(draft)}
          disabled={!draft.trim()}
          size="sm"
          className="h-10 px-4"
        >
          <Plus />
          {t('permissions.actions.add')}
        </Button>
      </div>

      {remainingSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{suggestionsLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {remainingSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addItem(suggestion)}
                className="rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-foreground transition-colors hover:bg-accent"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className={cn('inline-flex max-w-full items-center gap-1 break-all rounded-md border py-1 pl-2 pr-1 font-mono text-xs', RULE_CHIP_CLASS[tone])}
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(removeValue(items, item))}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10"
                aria-label={item}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

type PatternExamplesProps = {
  title: string;
  items: Array<{ pattern: string; description: string }>;
};

function PatternExamples({ title, items }: PatternExamplesProps) {
  return (
    <details className="rounded-xl border border-border bg-card/50 px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-foreground">
        {title}
      </summary>
      <ul className="mt-3 space-y-1.5 text-muted-foreground">
        {items.map((item) => (
          <li key={item.pattern}>
            <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">{item.pattern}</code>
            {' '}
            {item.description}
          </li>
        ))}
      </ul>
    </details>
  );
}

type SkipPermissionsCardProps = {
  checked: boolean;
  onChange: (value: boolean) => void;
  description: string;
};

function SkipPermissionsCard({ checked, onChange, description }: SkipPermissionsCardProps) {
  const { t } = useTranslation('settings');
  const label = t('permissions.skipPermissions.label');

  return (
    <SettingsCard className={checked ? 'border-orange-300 dark:border-orange-800' : undefined}>
      <SettingsRow label={label} description={description}>
        <SettingsToggle checked={checked} onChange={onChange} ariaLabel={label} />
      </SettingsRow>
    </SettingsCard>
  );
}

type ClaudePermissionsProps = {
  agent: 'claude';
  skipPermissions: boolean;
  onSkipPermissionsChange: (value: boolean) => void;
  allowedTools: string[];
  onAllowedToolsChange: (value: string[]) => void;
  disallowedTools: string[];
  onDisallowedToolsChange: (value: string[]) => void;
};

function ClaudePermissions({
  skipPermissions,
  onSkipPermissionsChange,
  allowedTools,
  onAllowedToolsChange,
  disallowedTools,
  onDisallowedToolsChange,
}: Omit<ClaudePermissionsProps, 'agent'>) {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-8">
      <SkipPermissionsCard
        checked={skipPermissions}
        onChange={onSkipPermissionsChange}
        description={t('permissions.skipPermissions.claudeDescription')}
      />

      <SettingsSection
        title={t('permissions.allowedTools.title')}
        description={t('permissions.allowedTools.description')}
      >
        <RuleListEditor
          placeholder={t('permissions.allowedTools.placeholder')}
          items={allowedTools}
          onChange={onAllowedToolsChange}
          suggestions={COMMON_CLAUDE_TOOLS}
          suggestionsLabel={t('permissions.allowedTools.quickAdd')}
          emptyLabel={t('permissions.allowedTools.empty')}
          tone="allow"
        />
      </SettingsSection>

      <SettingsSection
        title={t('permissions.blockedTools.title')}
        description={t('permissions.blockedTools.description')}
      >
        <RuleListEditor
          placeholder={t('permissions.blockedTools.placeholder')}
          items={disallowedTools}
          onChange={onDisallowedToolsChange}
          suggestions={[]}
          suggestionsLabel=""
          emptyLabel={t('permissions.blockedTools.empty')}
          tone="block"
        />
      </SettingsSection>

      <PatternExamples
        title={t('permissions.toolExamples.title')}
        items={[
          { pattern: '"Bash(git log:*)"', description: t('permissions.toolExamples.bashGitLog') },
          { pattern: '"Bash(git diff:*)"', description: t('permissions.toolExamples.bashGitDiff') },
          { pattern: '"Write"', description: t('permissions.toolExamples.write') },
          { pattern: '"Bash(rm:*)"', description: t('permissions.toolExamples.bashRm') },
        ]}
      />

      <ClaudeSettingsFileRules />
    </div>
  );
}

type CursorPermissionsProps = {
  agent: 'cursor';
  skipPermissions: boolean;
  onSkipPermissionsChange: (value: boolean) => void;
  allowedCommands: string[];
  onAllowedCommandsChange: (value: string[]) => void;
  disallowedCommands: string[];
  onDisallowedCommandsChange: (value: string[]) => void;
};

function CursorPermissions({
  skipPermissions,
  onSkipPermissionsChange,
  allowedCommands,
  onAllowedCommandsChange,
  disallowedCommands,
  onDisallowedCommandsChange,
}: Omit<CursorPermissionsProps, 'agent'>) {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-8">
      <SkipPermissionsCard
        checked={skipPermissions}
        onChange={onSkipPermissionsChange}
        description={t('permissions.skipPermissions.cursorDescription')}
      />

      <SettingsSection
        title={t('permissions.allowedCommands.title')}
        description={t('permissions.allowedCommands.description')}
      >
        <RuleListEditor
          placeholder={t('permissions.allowedCommands.placeholder')}
          items={allowedCommands}
          onChange={onAllowedCommandsChange}
          suggestions={COMMON_CURSOR_COMMANDS}
          suggestionsLabel={t('permissions.allowedCommands.quickAdd')}
          emptyLabel={t('permissions.allowedCommands.empty')}
          tone="allow"
        />
      </SettingsSection>

      <SettingsSection
        title={t('permissions.blockedCommands.title')}
        description={t('permissions.blockedCommands.description')}
      >
        <RuleListEditor
          placeholder={t('permissions.blockedCommands.placeholder')}
          items={disallowedCommands}
          onChange={onDisallowedCommandsChange}
          suggestions={[]}
          suggestionsLabel=""
          emptyLabel={t('permissions.blockedCommands.empty')}
          tone="block"
        />
      </SettingsSection>

      <PatternExamples
        title={t('permissions.shellExamples.title')}
        items={[
          { pattern: '"Shell(ls)"', description: t('permissions.shellExamples.ls') },
          { pattern: '"Shell(git status)"', description: t('permissions.shellExamples.gitStatus') },
          { pattern: '"Shell(npm install)"', description: t('permissions.shellExamples.npmInstall') },
          { pattern: '"Shell(rm -rf)"', description: t('permissions.shellExamples.rmRf') },
        ]}
      />
    </div>
  );
}

type CodexPermissionsProps = {
  agent: 'codex';
  permissionMode: CodexPermissionMode;
  onPermissionModeChange: (value: CodexPermissionMode) => void;
};

const CODEX_MODES: CodexPermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions'];

function CodexPermissions({ permissionMode, onPermissionModeChange }: Omit<CodexPermissionsProps, 'agent'>) {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('permissions.codex.permissionMode')}
        description={t('permissions.codex.description')}
      >
        <div className="space-y-2">
          {CODEX_MODES.map((mode) => {
            const selected = permissionMode === mode;
            const bypass = mode === 'bypassPermissions';

            return (
              <div
                key={mode}
                className={cn(
                  'cursor-pointer rounded-xl border p-4 transition-colors',
                  selected && bypass && 'border-orange-400 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20',
                  selected && !bypass && 'border-primary bg-accent',
                  !selected && 'border-border bg-card/50 hover:bg-accent/40',
                )}
                onClick={() => onPermissionModeChange(mode)}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="codexPermissionMode"
                    checked={selected}
                    onChange={() => onPermissionModeChange(mode)}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <div className={cn(
                      'flex items-center gap-2 font-medium',
                      selected && bypass ? 'text-orange-900 dark:text-orange-100' : 'text-foreground',
                    )}
                    >
                      {t(`permissions.codex.modes.${mode}.title`)}
                      {bypass && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                    </div>
                    <div className={cn(
                      'mt-0.5 text-sm',
                      selected && bypass ? 'text-orange-700 dark:text-orange-300' : 'text-muted-foreground',
                    )}
                    >
                      {t(`permissions.codex.modes.${mode}.description`)}
                    </div>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          {t('permissions.codex.technicalDetails')}
        </summary>
        <div className="mt-2 space-y-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          {CODEX_MODES.map((mode) => (
            <p key={mode}>
              <strong>{t(`permissions.codex.modes.${mode}.title`)}:</strong>
              {' '}
              {t(`permissions.codex.technicalInfo.${mode}`)}
            </p>
          ))}
          <p>{t('permissions.codex.technicalInfo.overrideNote')}</p>
        </div>
      </details>
    </div>
  );
}

type PermissionsContentProps = ClaudePermissionsProps | CursorPermissionsProps | CodexPermissionsProps;

/** Rendered by AgentCategoryContentSection for the "permissions" category, one variant per agent provider. */
export default function PermissionsContent(props: PermissionsContentProps) {
  if (props.agent === 'claude') {
    return <ClaudePermissions {...props} />;
  }

  if (props.agent === 'cursor') {
    return <CursorPermissions {...props} />;
  }

  return <CodexPermissions {...props} />;
}
