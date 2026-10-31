import { Activity } from 'lucide-react';
import type { TFunction } from 'i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/shared/ui';
import { cn } from '@/shared/utils';
import type { SidebarSearchMode } from '@/shared/types';

type ModeOption = {
  mode: SidebarSearchMode;
  label: string;
};

type SidebarViewMenuProps = {
  searchMode: SidebarSearchMode;
  onSearchModeChange: (mode: SidebarSearchMode) => void;
  runningSessionsCount: number;
  t: TFunction;
  /** Extra trigger classes. SidebarHeader uses this to cap the switcher beside the search field. */
  className?: string;
};

const SIDEBAR_SEARCH_MODES: readonly SidebarSearchMode[] = ['projects', 'conversations', 'running', 'archived'];

function isSidebarSearchMode(value: string): value is SidebarSearchMode {
  return (SIDEBAR_SEARCH_MODES as readonly string[]).includes(value);
}

/** The running-session count, shown on the trigger and on the Running row so the number stays visible after the tab strip is gone. */
function RunningCount({ count, withIcon = false }: { count: number; withIcon?: boolean }) {
  if (count <= 0) {
    return null;
  }

  const text = count > 99 ? '99+' : String(count);

  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full bg-emerald-500 px-1 text-[10px] font-semibold leading-none text-white">
      {withIcon && <Activity className="h-2.5 w-2.5" />}
      {text}
    </span>
  );
}

/**
 * Used by SidebarHeader beside the search box, in both the desktop and the mobile header.
 *
 * Projects, Conversations, Running and Archive are one choice, so this is a
 * shadcn Select. The trigger shows the open view and stays at most half the
 * row so the search field keeps the rest.
 */
export default function SidebarViewMenu({
  searchMode,
  onSearchModeChange,
  runningSessionsCount,
  t,
  className,
}: SidebarViewMenuProps) {
  const options: ModeOption[] = [
    { mode: 'projects', label: t('search.modeProjects') },
    { mode: 'conversations', label: t('search.modeConversations') },
    { mode: 'running', label: t('search.modeRunning', 'Running') },
    { mode: 'archived', label: t('search.modeArchived', 'Archive') },
  ];

  const active = options.find((option) => option.mode === searchMode) ?? options[0];

  return (
    <Select
      value={searchMode}
      onValueChange={(value) => {
        if (isSidebarSearchMode(value)) {
          onSearchModeChange(value);
        }
      }}
    >
      <SelectTrigger
        aria-label={active.label}
        className={cn(
          'h-8 w-auto min-w-0 max-w-full shrink-0 gap-1 px-2.5 py-1 text-xs [&>svg]:h-3.5 [&>svg]:w-3.5',
          className,
        )}
      >
        {/* A div, not a span: SelectTrigger line-clamps its direct span child, which would collapse this row. */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{active.label}</span>
          {active.mode !== 'running' && <RunningCount count={runningSessionsCount} withIcon />}
          {active.mode === 'running' && <RunningCount count={runningSessionsCount} />}
        </div>
      </SelectTrigger>
      <SelectContent position="popper" className="w-max min-w-[var(--radix-select-trigger-width)] text-xs">
        {options.map((option) => (
          <SelectItem key={option.mode} value={option.mode} className="py-1 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="truncate">{option.label}</span>
              {option.mode === 'running' && <RunningCount count={runningSessionsCount} />}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
