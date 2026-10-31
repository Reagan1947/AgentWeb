import { FolderPlus, Plus, RefreshCw, Search, X, PanelLeftClose } from 'lucide-react';
import type { TFunction } from 'i18next';

import { Button, Input } from '@/shared/ui';
import { CLOUDCLI_WORDMARK_FONT_FAMILY } from '@/shared/constants';
import { IS_PLATFORM } from '@/shared/utils';
import type { SidebarSearchMode } from '@/shared/types';
import GitHubStarBadge from '@/modules/sidebar/GitHubStarBadge';
import SidebarViewMenu from '@/modules/sidebar/SidebarViewMenu';

const MOD_KEY =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

type SidebarHeaderProps = {
  isPWA: boolean;
  isMobile: boolean;
  isLoading: boolean;
  projectsCount: number;
  runningSessionsCount: number;
  archivedSessionsCount: number;
  isArchivedSessionsLoading: boolean;
  searchFilter: string;
  onSearchFilterChange: (value: string) => void;
  onClearSearchFilter: () => void;
  searchMode: SidebarSearchMode;
  onSearchModeChange: (mode: SidebarSearchMode) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onCreateProject: () => void;
  onCollapseSidebar: () => void;
  t: TFunction;
};

type SidebarSearchRowProps = {
  searchMode: SidebarSearchMode;
  onSearchModeChange: (mode: SidebarSearchMode) => void;
  runningSessionsCount: number;
  searchPlaceholder: string;
  searchFilter: string;
  onSearchFilterChange: (value: string) => void;
  onClearSearchFilter: () => void;
  t: TFunction;
};

/** Shared by the desktop and mobile headers so the view Select and the search Input stay the same control. */
function SidebarSearchRow({
  searchMode,
  onSearchModeChange,
  runningSessionsCount,
  searchPlaceholder,
  searchFilter,
  onSearchFilterChange,
  onClearSearchFilter,
  t,
}: SidebarSearchRowProps) {
  // Desktop drop keeps the Projects switch and search a little lower, still below the workspace header (~57px).
  return (
    <div className="mt-3 flex items-center gap-1.5 md:mt-5">
      <SidebarViewMenu
        searchMode={searchMode}
        onSearchModeChange={onSearchModeChange}
        runningSessionsCount={runningSessionsCount}
        t={t}
        className="max-w-[50%]"
      />
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchFilter}
          onChange={(event) => onSearchFilterChange(event.target.value)}
          className="h-8 py-1 pl-8 pr-11 text-xs md:text-xs"
        />
        {searchFilter ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearSearchFilter}
            aria-label={t('tooltips.clearSearch')}
            className="absolute right-0.5 top-1/2 h-6 w-6 -translate-y-1/2 p-0 text-muted-foreground [&_svg]:size-3.5"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <kbd
            aria-hidden
            title={t('tooltips.openCommandPalette')}
            className="pointer-events-none absolute right-1.5 top-1/2 hidden h-4 -translate-y-1/2 items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground md:inline-flex"
          >
            {MOD_KEY}
            <span>K</span>
          </kbd>
        )}
      </div>
    </div>
  );
}

/** Module-level, not a nested render function, so the wordmark is not remounted on every SidebarHeader render. */
function LogoBlock({ t }: { t: TFunction }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/90 shadow-sm">
        <svg className="h-3.5 w-3.5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h1
        className="truncate text-sm font-bold tracking-tight text-foreground"
        style={{ fontFamily: CLOUDCLI_WORDMARK_FONT_FAMILY }}
      >
        {t('app.title')}
      </h1>
    </div>
  );
}

/** Rendered by SidebarContent at the top of the panel for the search box, view menu, refresh and new-project actions. */
export default function SidebarHeader({
  isPWA,
  isMobile,
  isLoading,
  projectsCount,
  runningSessionsCount,
  archivedSessionsCount,
  isArchivedSessionsLoading,
  searchFilter,
  onSearchFilterChange,
  onClearSearchFilter,
  searchMode,
  onSearchModeChange,
  onRefresh,
  isRefreshing,
  onCreateProject,
  onCollapseSidebar,
  t,
}: SidebarHeaderProps) {
  const showSearchTools = (projectsCount > 0 || runningSessionsCount > 0 || archivedSessionsCount > 0 || isArchivedSessionsLoading) && !isLoading;
  const searchPlaceholder = searchMode === 'conversations'
    ? t('search.conversationsPlaceholder')
    : searchMode === 'archived'
      ? t('search.archivedPlaceholder', 'Search archived sessions...')
      : searchMode === 'running'
        ? t('search.runningPlaceholder', 'Search running sessions...')
        : t('projects.searchPlaceholder');

  return (
    <div className="flex-shrink-0">
      {/* Desktop header */}
      <div
        className="hidden px-3 pb-4 pt-3 md:block"
        style={{}}
      >
        <div className="flex items-center justify-between gap-2">
          {IS_PLATFORM ? (
            <a
              href="https://cloudcli.ai/dashboard"
              className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80"
              title={t('tooltips.viewEnvironments')}
            >
              <LogoBlock t={t} />
            </a>
          ) : (
            <LogoBlock t={t} />
          )}

          <div className="flex flex-shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-lg p-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground"
              onClick={onRefresh}
              disabled={isRefreshing}
              title={t('tooltips.refresh')}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-lg p-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground"
              onClick={onCreateProject}
              title={t('tooltips.createProject')}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-lg p-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground"
              onClick={onCollapseSidebar}
              title={t('tooltips.hideSidebar')}
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <GitHubStarBadge />

        {showSearchTools && (
          <SidebarSearchRow
            searchMode={searchMode}
            onSearchModeChange={onSearchModeChange}
            runningSessionsCount={runningSessionsCount}
            searchPlaceholder={searchPlaceholder}
            searchFilter={searchFilter}
            onSearchFilterChange={onSearchFilterChange}
            onClearSearchFilter={onClearSearchFilter}
            t={t}
          />
        )}
      </div>

      {/* Mobile header */}
      <div
        className="p-3 pb-4 md:hidden"
        style={isPWA && isMobile ? { paddingTop: '16px' } : {}}
      >
        <div className="flex items-center justify-between">
          {IS_PLATFORM ? (
            <a
              href="https://cloudcli.ai/dashboard"
              className="flex min-w-0 items-center gap-2.5 transition-opacity active:opacity-70"
              title={t('tooltips.viewEnvironments')}
            >
              <LogoBlock t={t} />
            </a>
          ) : (
            <LogoBlock t={t} />
          )}

          <div className="flex flex-shrink-0 gap-1.5">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 transition-all active:scale-95"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/90 text-primary-foreground transition-all active:scale-95"
              onClick={onCreateProject}
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showSearchTools && (
          <SidebarSearchRow
            searchMode={searchMode}
            onSearchModeChange={onSearchModeChange}
            runningSessionsCount={runningSessionsCount}
            searchPlaceholder={searchPlaceholder}
            searchFilter={searchFilter}
            onSearchFilterChange={onSearchFilterChange}
            onClearSearchFilter={onClearSearchFilter}
            t={t}
          />
        )}
      </div>

    </div>
  );
}
