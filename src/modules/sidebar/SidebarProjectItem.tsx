import { memo, useEffect, useRef, type ReactNode } from 'react';
import { Check, CheckSquare, ChevronDown, ChevronRight, Edit3, Folder, Plus, Star, Trash2, X } from 'lucide-react';
import type { TFunction } from 'i18next';

import { cn } from '@/shared/utils';
import { ActionMenu, ActionMenuButton, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Input } from '@/shared/ui';
import type { LLMProvider, MCPServerStatus, Project, ProjectSession, SessionWithProvider, SidebarSessionSelection } from '@/shared/types';
import { getSelectableSessionIds, getTaskIndicatorStatus } from '@/modules/sidebar/utils/sidebarProjectFormatting';
import TaskIndicator from '@/modules/sidebar/TaskIndicator';
import SidebarProjectSessions from '@/modules/sidebar/SidebarProjectSessions';
import { useCompactSidebar } from '@/modules/sidebar/hooks/useCompactSidebar';

/** Menu, new-session, and unstarred favorite share this color. Hover keeps the icon color. */
const PROJECT_ROW_ACTION_CLASS = 'text-muted-foreground hover:bg-accent hover:text-muted-foreground';

type ProjectRowIconButtonProps = {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
};

/** Icon button on a project row. The click must not also expand or select the project. */
function ProjectRowIconButton({
  label,
  onClick,
  className,
  disabled,
  pressed,
  children,
}: ProjectRowIconButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

type SidebarProjectItemProps = {
  project: Project;
  selectedProject: Project | null;
  selectedSession: ProjectSession | null;
  isExpanded: boolean;
  isDeleting: boolean;
  isStarred: boolean;
  /** Resolved for this row: only the project being renamed re-renders on a keystroke. */
  isEditing: boolean;
  renameDraft: string;
  sessions: SessionWithProvider[];
  initialSessionsLoaded: boolean;
  isLoadingMoreSessions: boolean;
  currentTime: Date;
  /** The session being renamed, when it belongs to this project. */
  sessionRenameId: string | null;
  sessionRenameDraft: string;
  tasksEnabled: boolean;
  mcpServerStatus: MCPServerStatus;
  onRenameDraftChange: (name: string) => void;
  onToggleProject: (projectId: string) => void;
  onProjectSelect: (project: Project) => void;
  onToggleStarProject: (projectId: string) => void;
  onStartEditingProject: (project: Project) => void;
  onCancelEditingProject: () => void;
  onSaveProjectName: (projectId: string, nextName: string) => void;
  onDeleteProject: (project: Project) => void;
  onSessionSelect: (session: SessionWithProvider, projectName: string) => void;
  onDeleteSession: (sessionId: string, sessionTitle: string) => void;
  onForkSession?: (session: SessionWithProvider) => void;
  onLoadMoreSessions: (projectId: string) => void;
  activeSessions: ReadonlySet<string>;
  backgroundSessionIds: ReadonlySet<string>;
  attentionSessionIds: ReadonlySet<string>;
  onNewSession: (project: Project) => void;
  onStartEditingSession: (projectId: string, sessionId: string, initialName: string) => void;
  onCancelEditingSession: () => void;
  onSaveEditingSession: (projectName: string, sessionId: string, summary: string, provider: LLMProvider) => void;
  /** The sessions ticked in this project's list, or null when it is not the one selecting. */
  selectedSessionIds: ReadonlySet<string> | null;
  onSetSessionSelection: (selection: SidebarSessionSelection) => void;
  onToggleSessionSelected: (projectId: string, sessionId: string) => void;
  onCancelSessionSelection: () => void;
  onDeleteSelectedSessions: (sessionIds: string[]) => void;
  t: TFunction;
};

/** Rendered by SidebarProjectList for one project row. Collapsible expands the sessions; a right-click or the hover "…" button opens manage sessions, rename, and delete, and Button and Input are the remaining row actions and the rename field. */
function SidebarProjectItem({
  project,
  selectedProject,
  selectedSession,
  isExpanded,
  isDeleting,
  isStarred,
  isEditing,
  renameDraft,
  sessions,
  initialSessionsLoaded,
  isLoadingMoreSessions,
  currentTime,
  sessionRenameId,
  sessionRenameDraft,
  tasksEnabled,
  mcpServerStatus,
  onRenameDraftChange,
  onToggleProject,
  onProjectSelect,
  onToggleStarProject,
  onStartEditingProject,
  onCancelEditingProject,
  onSaveProjectName,
  onDeleteProject,
  onSessionSelect,
  onDeleteSession,
  onForkSession,
  onLoadMoreSessions,
  activeSessions,
  backgroundSessionIds,
  attentionSessionIds,
  onNewSession,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveEditingSession,
  selectedSessionIds,
  onSetSessionSelection,
  onToggleSessionSelected,
  onCancelSessionSelection,
  onDeleteSelectedSessions,
  t,
}: SidebarProjectItemProps) {
  // Project identity is tracked by the DB-assigned `projectId` everywhere
  // after the projectName → projectId migration. The row stays plain either
  // way: expanding already shows the current group, so a selected fill is noise.
  const isCurrentProject = selectedProject?.projectId === project.projectId;
  const totalSessionCount = Number(project.sessionMeta?.total ?? sessions.length);
  const taskStatus = getTaskIndicatorStatus(project, mcpServerStatus);
  const mobileRenameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing || !mobileRenameInputRef.current) {
      return;
    }

    let animationFrame = 0;
    const revealInput = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        mobileRenameInputRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
      });
    };

    revealInput();
    window.visualViewport?.addEventListener('resize', revealInput);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.visualViewport?.removeEventListener('resize', revealInput);
    };
  }, [isEditing]);

  const isCompact = useCompactSidebar();

  const toggleStarProject = () => onToggleStarProject(project.projectId);

  const saveProjectName = () => {
    onSaveProjectName(project.projectId, renameDraft);
  };

  // Expansion belongs to Collapsible. Calling onToggleProject here as well
  // would open the row and close it again in the same click.
  const handleExpandedChange = (open: boolean) => {
    if (open !== isExpanded) {
      onToggleProject(project.projectId);
    }
  };

  // The compact row only expands. Desktop also selects the project.
  const selectProjectFromRow = () => {
    if (isCompact || isCurrentProject) {
      return;
    }

    onProjectSelect(project);
  };

  const isSelecting = selectedSessionIds !== null;
  const selectableSessionIds = getSelectableSessionIds(sessions, activeSessions, backgroundSessionIds);
  const canStartSelecting = initialSessionsLoaded && selectableSessionIds.length > 0;

  const toggleSelectionMode = () => {
    if (isSelecting) {
      onCancelSessionSelection();
      return;
    }

    if (!isExpanded) {
      onToggleProject(project.projectId);
    }

    onSetSessionSelection({ projectId: project.projectId, sessionIds: new Set() });
  };

  const startNewSession = () => {
    // The compact row used to select the project before starting the session.
    // Desktop already relies on onNewSession to select it.
    if (isCompact) {
      onProjectSelect(project);
    }

    onNewSession(project);
  };

  const expandIconClass = 'h-4 w-4 shrink-0 text-muted-foreground';
  const expandIcon = isExpanded ? (
    <ChevronDown className={expandIconClass} />
  ) : (
    <ChevronRight className={expandIconClass} />
  );

  const renderRowActions = (compact: boolean) => {
    // Desktop hover actions match the session "…" control: a 24px target and a 14px glyph.
    // Touch rows stay larger. [&_svg] overrides Button's default size-4 icon.
    const buttonClass = cn(
      'shrink-0 p-0 shadow-none',
      compact ? 'h-8 w-8 active:scale-95' : 'h-6 w-6 [&_svg]:size-3.5',
    );
    const iconClass = compact ? 'h-4 w-4' : 'h-3.5 w-3.5';

    if (isEditing) {
      return (
        <>
          <ProjectRowIconButton
            label={t('tooltips.save')}
            className={cn(
              buttonClass,
              compact
                ? 'bg-green-500 text-white shadow-sm hover:bg-green-500 hover:text-white active:scale-90 active:bg-green-500 dark:bg-green-600 dark:hover:bg-green-600'
                : 'text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/20',
            )}
            onClick={saveProjectName}
          >
            <Check className={cn(iconClass, compact && 'text-white')} />
          </ProjectRowIconButton>
          <ProjectRowIconButton
            label={t('tooltips.cancel')}
            className={cn(
              buttonClass,
              compact
                ? 'bg-gray-500 text-white shadow-sm hover:bg-gray-500 hover:text-white active:scale-90 active:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-600'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-gray-800',
            )}
            onClick={onCancelEditingProject}
          >
            <X className={cn(iconClass, compact && 'text-white')} />
          </ProjectRowIconButton>
        </>
      );
    }

    const favoriteLabel = isStarred ? t('tooltips.removeFromFavorites') : t('tooltips.addToFavorites');
    // Once starred, the yellow star stays on the row. The menu and new-session
    // icons still appear only while the pointer or focus is on the row.
    const hoverOnlyActionClass = !compact && isStarred
      ? 'hidden group-hover:flex group-focus-within:flex'
      : undefined;

    return (
      <>
        <ActionMenuButton
          label={t('tooltips.moreOptions', 'More options')}
          className={cn(buttonClass, PROJECT_ROW_ACTION_CLASS, hoverOnlyActionClass)}
        />
        <ProjectRowIconButton
          label={t('sessions.newSession')}
          className={cn(buttonClass, PROJECT_ROW_ACTION_CLASS, hoverOnlyActionClass)}
          onClick={startNewSession}
        >
          <Plus className={iconClass} />
        </ProjectRowIconButton>
        <ProjectRowIconButton
          label={favoriteLabel}
          className={cn(
            buttonClass,
            isStarred
              // Ghost hover/active recolors the icon to the accent foreground, so a
              // click stays black until the pointer leaves unless yellow is restated.
              // The hover fill stays the same accent as the other row actions.
              ? 'text-yellow-600 hover:bg-accent hover:text-yellow-600 active:bg-accent active:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-400 dark:active:text-yellow-400'
              : PROJECT_ROW_ACTION_CLASS,
          )}
          onClick={toggleStarProject}
        >
          <Star className={cn(iconClass, isStarred && 'fill-current')} />
        </ProjectRowIconButton>
      </>
    );
  };

  // Management Session lives in the menu the "…" button and a right-click both open.
  // Touch rows keep the icons visible; a pointer row reveals them on hover.
  // A starred row keeps its container up so the yellow star does not leave with the pointer.
  const rowActionsClass = (compact: boolean) => cn(
    'shrink-0 items-center gap-0.5',
    compact || isEditing || isStarred ? 'flex' : 'hidden group-hover:flex group-focus-within:flex',
    compact ? 'pr-2' : 'pr-1',
  );
  const folderIcon = <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={handleExpandedChange}
      className={cn(isDeleting && 'pointer-events-none opacity-50')}
    >
      <div className="md:group group sticky top-0 z-10">
        <ActionMenu
          trigger="context"
          disabled={isEditing}
          label={project.displayName}
          ariaLabel={project.displayName}
          compact
          menuClassName="w-[280px] rounded-xl p-1 shadow-xl"
          header={(
            <div className="mb-1 border-b border-border px-2.5 py-1.5">
              <p className="truncate text-[11px] font-medium leading-4 text-foreground" title={project.displayName}>
                {project.displayName}
              </p>
              <p className="mt-0.5 text-[10px] leading-3 text-muted-foreground">
                {t('deleteConfirmation.sessionCount', { count: totalSessionCount })}
              </p>
              <p className="mt-0.5 break-all text-[9px] leading-3 text-muted-foreground">
                {project.fullPath}
              </p>
            </div>
          )}
          items={[
            {
              key: 'select',
              label: isSelecting ? t('actions.cancel') : t('sessions.select'),
              icon: CheckSquare,
              disabled: !isSelecting && !canStartSelecting,
              onSelect: toggleSelectionMode,
            },
            {
              key: 'rename',
              label: t('projects.renameProject'),
              icon: Edit3,
              onSelect: () => onStartEditingProject(project),
            },
            {
              key: 'delete',
              label: t('projects.deleteProject'),
              icon: Trash2,
              isDanger: true,
              showDividerBefore: true,
              onSelect: () => onDeleteProject(project),
            },
          ]}
        >
        {isCompact && (
        <div className="bg-background">
          <div className="mx-3 my-1 rounded-lg border border-border/50 bg-card transition-all duration-150">
            {isEditing ? (
              <div className="flex items-center gap-2 p-3">
                <CollapsibleTrigger className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-accent hover:text-muted-foreground">
                  {expandIcon}
                </CollapsibleTrigger>
                {folderIcon}
                <Input
                  ref={mobileRenameInputRef}
                  type="text"
                  value={renameDraft}
                  onChange={(event) => onRenameDraftChange(event.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-lg border-2 border-primary/40 bg-background px-3 py-2 text-base shadow-sm focus-visible:border-primary focus-visible:ring-0"
                  placeholder={t('projects.projectNamePlaceholder')}
                  autoFocus
                  autoComplete="off"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      saveProjectName();
                    }

                    if (event.key === 'Escape') {
                      // Cancelling the rename must not also close the code editor.
                      event.stopPropagation();
                      onCancelEditingProject();
                    }
                  }}
                />
                <div className={rowActionsClass(true)}>
                  {renderRowActions(true)}
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 bg-transparent p-3 text-left font-normal text-inherit shadow-none hover:bg-transparent">
                  {expandIcon}
                  {folderIcon}
                  <div className="flex min-w-0 flex-1 items-center justify-between">
                    <h3 className="truncate text-xs font-normal text-foreground">{project.displayName}</h3>
                    {tasksEnabled && (
                      <TaskIndicator
                        status={taskStatus}
                        size="xs"
                        className="ml-2 hidden flex-shrink-0 md:inline-flex"
                      />
                    )}
                  </div>
                </CollapsibleTrigger>
                <div className={rowActionsClass(true)}>
                  {renderRowActions(true)}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Starring only fills the star. The row keeps the same background and hover as every other project. */}
        {!isCompact && (
        <div className="relative isolate flex w-full items-center bg-background font-normal">
          {/* The row fill stays square so a sticky header still masks sessions scrolling underneath. Hover stays the neutral accent; the open session uses the blue fill. The fill sits on a lower layer so it does not cover the icon or name. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-md transition-colors group-hover:bg-accent"
          />
          {isEditing ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 p-2">
              <CollapsibleTrigger className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-accent hover:text-muted-foreground">
                {expandIcon}
              </CollapsibleTrigger>
              {folderIcon}
              <Input
                type="text"
                value={renameDraft}
                onChange={(event) => onRenameDraftChange(event.target.value)}
                className="h-8 min-w-0 flex-1 px-2 shadow-none"
                placeholder={t('projects.projectNamePlaceholder')}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    saveProjectName();
                  }
                  if (event.key === 'Escape') {
                    // Cancelling the rename must not also close the code editor.
                    event.stopPropagation();
                    onCancelEditingProject();
                  }
                }}
              />
            </div>
          ) : (
            <CollapsibleTrigger
              className="flex min-w-0 flex-1 items-center gap-2 bg-transparent p-2 text-left font-normal text-inherit shadow-none hover:bg-transparent"
              onClick={selectProjectFromRow}
            >
              {expandIcon}
              {folderIcon}
              <div className="min-w-0 flex-1 truncate text-xs font-normal text-foreground" title={project.displayName}>
                {project.displayName}
              </div>
            </CollapsibleTrigger>
          )}
          <div className={rowActionsClass(false)}>
            {renderRowActions(false)}
          </div>
        </div>
        )}
        </ActionMenu>
      </div>

      <CollapsibleContent className={cn(isExpanded && 'md:mt-1')}>
      <SidebarProjectSessions
        project={project}
        isExpanded={isExpanded}
        sessions={sessions}
        selectedSession={selectedSession}
        initialSessionsLoaded={initialSessionsLoaded}
        hasMoreSessions={Boolean(project.sessionMeta?.hasMore)}
        isLoadingMoreSessions={isLoadingMoreSessions}
        activeSessions={activeSessions}
        backgroundSessionIds={backgroundSessionIds}
        attentionSessionIds={attentionSessionIds}
        currentTime={currentTime}
        sessionRenameId={sessionRenameId}
        sessionRenameDraft={sessionRenameDraft}
        onRenameDraftChange={onRenameDraftChange}
        onStartEditingSession={onStartEditingSession}
        onCancelEditingSession={onCancelEditingSession}
        onSaveEditingSession={onSaveEditingSession}
        onProjectSelect={onProjectSelect}
        onSessionSelect={onSessionSelect}
        onDeleteSession={onDeleteSession}
        onForkSession={onForkSession}
        onLoadMoreSessions={onLoadMoreSessions}
        selectedSessionIds={selectedSessionIds}
        onSetSessionSelection={onSetSessionSelection}
        onToggleSessionSelected={onToggleSessionSelected}
        onCancelSessionSelection={onCancelSessionSelection}
        onDeleteSelectedSessions={onDeleteSelectedSessions}
        t={t}
      />
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Memoized: a websocket session delta re-renders the sidebar roughly every
 * 0.5-2s during a run, and a rename keystroke re-renders it per character.
 *
 * Both renames are resolved to scalars by SidebarProjectList and the sorted
 * session array is cached per project, so a keystroke changes props on exactly
 * one row and every other row's compare succeeds. See sidebarRowProps.test.tsx.
 */
export default memo(SidebarProjectItem);
