import { memo, type KeyboardEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { TFunction } from 'i18next';

import { ActionMenuButton, Badge, Checkbox, LLMProviderLogo, Tooltip, buttonVariants } from '@/shared/ui';
import { cn } from '@/shared/utils';
import type { LLMProvider, Project, ProjectSession, SessionWithProvider } from '@/shared/types';
import { createSessionViewModel, formatCompactAge } from '@/modules/sidebar/utils/sidebarProjectFormatting';
import { useCompactSidebar } from '@/modules/sidebar/hooks/useCompactSidebar';
import SessionOptions from '@/modules/sidebar/SessionOptions';

type SidebarSessionItemProps = {
  project: Project;
  session: SessionWithProvider;
  selectedSession: ProjectSession | null;
  isProcessing: boolean;
  /** The session's turn has ended but the agents, workflows or commands it launched still run. */
  hasBackgroundWork: boolean;
  needsAttention: boolean;
  currentTime: Date;
  /** Resolved for this row, so a keystroke elsewhere does not invalidate it. */
  isEditing: boolean;
  renameDraft: string;
  onRenameDraftChange: (draft: string) => void;
  onStartEditingSession: (projectId: string, sessionId: string, initialName: string) => void;
  onCancelEditingSession: () => void;
  onSaveEditingSession: (projectName: string, sessionId: string, summary: string, provider: LLMProvider) => void;
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: SessionWithProvider, projectName: string) => void;
  onDeleteSession: (sessionId: string, sessionTitle: string) => void;
  /** Branches this session into an independent one; absent when its provider cannot. */
  onForkSession?: (session: SessionWithProvider) => void;
  /** This project's list is in bulk-selection mode: the row shows a checkbox and hides its options. */
  isSelecting: boolean;
  /** Ticked for the pending bulk delete. Resolved by the list, which never ticks a running row. */
  isChecked: boolean;
  /** Takes the owning projectId so this memoized row binds itself without the list making a closure per row. */
  onToggleSessionSelected: (projectId: string, sessionId: string) => void;
  t: TFunction;
};

/** Rendered by SidebarProjectSessions for one session row, including its rename, copy and delete controls. */
function SidebarSessionItem({
  project,
  session,
  selectedSession,
  isProcessing,
  hasBackgroundWork,
  needsAttention,
  currentTime,
  isEditing,
  renameDraft,
  onRenameDraftChange,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveEditingSession,
  onProjectSelect,
  onSessionSelect,
  onDeleteSession,
  onForkSession,
  isSelecting,
  isChecked,
  onToggleSessionSelected,
  t,
}: SidebarSessionItemProps) {
  const isCompact = useCompactSidebar();
  const sessionView = createSessionViewModel(session, currentTime, t);
  const isSelected = selectedSession?.id === session.id;
  const compactSessionAge = formatCompactAge(sessionView.sessionTime, currentTime);
  const showAttentionIndicator = needsAttention && !isSelected;
  // Background work takes the recent-activity dot's place: the session is
  // still doing something, which says more than that it was touched lately.
  const showBackgroundIndicator = !showAttentionIndicator && hasBackgroundWork;
  const showRecentIndicator = !showAttentionIndicator && !showBackgroundIndicator && !isProcessing && sessionView.isActive;
  const indicatorLabel = showAttentionIndicator
    ? t('tooltips.attentionRequiredIndicator', { defaultValue: 'Session needs attention' })
    : showBackgroundIndicator
      ? t('tooltips.backgroundWorkIndicator', { defaultValue: 'Background work running' })
      : t('tooltips.activeSessionIndicator');

  // Sessions are owned by a project identified by `projectId` (DB primary key)
  // after the projectName → projectId migration.
  const selectMobileSession = () => {
    onProjectSelect(project);
    onSessionSelect(session, project.projectId);
  };

  // A running session cannot be deleted, so it cannot be ticked either; the row
  // still renders, locked, instead of disappearing from the list mid-selection.
  const isSelectable = isSelecting && !isProcessing;
  const toggleSelected = () => {
    onToggleSessionSelected(project.projectId, session.id);
  };
  // Space and Enter would also activate the checkbox button, so they are handled
  // here and the native click is cancelled. Otherwise one keypress ticks twice.
  const handleSelectionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    if (isSelectable) {
      toggleSelected();
    }
  };
  // A click on the checkbox must not reach the row, which ticks the same session.
  const selectionControl = isSelecting ? (
    <Checkbox
      checked={isChecked}
      disabled={!isSelectable}
      aria-label={sessionView.sessionName}
      onCheckedChange={() => {
        if (isSelectable) {
          toggleSelected();
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={handleSelectionKeyDown}
    />
  ) : null;

  // Selection mode hides the menu until the selection ends.
  // The "…" button opens that same menu; the age stays in the row beside it.
  // The highlight lives on the wrapper so it covers the row and that button.
  // The row's own fill would stop short of the button and leave a gap.
  // Hover matches the selected fill. Selection still recolors the label; hover does not.
  const sessionHighlightClass = cn(
    'hover:bg-accent',
    isSelected && 'bg-accent text-accent-foreground hover:bg-accent',
    isChecked && 'bg-primary/10',
  );
  const withSessionMenu = (row: ReactNode) => (
    isSelecting ? row : (
      <SessionOptions
        trigger="context"
        sessionId={session.id}
        sessionName={sessionView.sessionName}
        provider={session.__provider}
        projectId={project.projectId}
        isProcessing={isProcessing}
        isEditing={isEditing}
        renameDraft={renameDraft}
        onRenameDraftChange={onRenameDraftChange}
        onStartEditingSession={onStartEditingSession}
        onCancelEditingSession={onCancelEditingSession}
        onSaveEditingSession={onSaveEditingSession}
        onDeleteSession={onDeleteSession}
        onFork={onForkSession ? () => onForkSession(session) : undefined}
        t={t}
      >
        <div className={cn(
          'group flex w-full min-w-0 items-center rounded-md transition-colors',
          isCompact && 'mx-3 my-0.5',
          sessionHighlightClass,
        )}>
          {row}
          {!isEditing && (
            <ActionMenuButton
              label={`Session options for ${sessionView.sessionName}`}
              className={cn(
                // Transparent so the wrapper highlight stays one region across the icon.
                'h-6 shrink-0 text-muted-foreground hover:bg-transparent hover:text-muted-foreground active:bg-transparent',
                isCompact
                  ? 'mr-1 w-6'
                  : 'pointer-events-none w-0 overflow-hidden p-0 opacity-0 group-hover:pointer-events-auto group-hover:mr-1 group-hover:w-6 group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:mr-1 focus-visible:w-6 focus-visible:opacity-100',
              )}
            />
          )}
        </div>
      </SessionOptions>
    )
  );

  const compactRow = (
    <div
      className={cn(
        'rounded-md p-2 transition-colors active:scale-[0.98]',
        isSelecting ? 'mx-3 my-0.5' : 'min-w-0 flex-1',
        isSelecting && (isSelected ? 'bg-accent' : 'hover:bg-accent'),
        isSelecting && isChecked && 'bg-primary/10',
      )}
      onClick={isSelecting ? (isSelectable ? toggleSelected : undefined) : selectMobileSession}
    >
      <div className="flex items-center gap-2">
        {selectionControl}
        <div
          className={cn(
            'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0',
            isSelected ? 'bg-primary/10' : 'bg-muted/50',
          )}
        >
          <LLMProviderLogo provider={session.__provider} className="h-3 w-3" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div
              className="min-w-0 flex-1 truncate text-xs font-normal text-foreground"
              title={sessionView.sessionName}
            >
              {sessionView.sessionName}
            </div>
            {isProcessing ? (
              <span className={cn('ml-auto flex-shrink-0', isEditing && 'opacity-0')}>
                <Tooltip content={t('tooltips.processingSessionIndicator', 'Processing session')} position="top">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </span>
                </Tooltip>
              </span>
            ) : compactSessionAge && (
              <span className={cn('ml-auto flex-shrink-0 text-[11px] text-muted-foreground', isEditing && 'opacity-0')}>
                {compactSessionAge}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center">
            {sessionView.messageCount > 0 && (
              <Badge variant="secondary" className="px-1 py-0 text-xs">
                {sessionView.messageCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const desktopRowClassName = cn(
    buttonVariants({ variant: 'ghost' }),
    'h-auto justify-start rounded-md bg-transparent p-2 text-left font-normal shadow-none hover:text-inherit',
    isSelecting
      ? 'w-full hover:bg-accent'
      : 'min-w-0 flex-1 hover:bg-transparent active:bg-transparent',
    isSelecting && isSelected && 'bg-accent text-accent-foreground hover:bg-accent',
    isSelecting && isChecked && 'bg-primary/10',
  );
  const desktopRowBody = (
    <div className="flex w-full min-w-0 items-center gap-2">
      {selectionControl}
      <div
        className={cn(
          'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md',
          isSelected ? 'bg-primary/10' : 'bg-muted/50',
        )}
      >
        <LLMProviderLogo provider={session.__provider} className="h-3 w-3" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div
            className="min-w-0 flex-1 truncate text-xs font-normal text-foreground"
            title={sessionView.sessionName}
          >
            {sessionView.sessionName}
          </div>
          {isProcessing ? (
            <span className={cn('ml-auto flex-shrink-0 transition-opacity duration-200', isEditing && 'opacity-0')}>
              <Tooltip content={t('tooltips.processingSessionIndicator', 'Processing session')} position="top">
                <span className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </span>
              </Tooltip>
            </span>
          ) : compactSessionAge && (
            <span
              className={cn(
                'ml-auto flex-shrink-0 text-[11px] text-muted-foreground transition-opacity duration-200',
                isEditing && 'opacity-0',
              )}
            >
              {compactSessionAge}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center">
          {sessionView.messageCount > 0 && <Badge variant="secondary" className="px-1 py-0 text-xs">{sessionView.messageCount}</Badge>}
        </div>
      </div>
    </div>
  );
  // While selecting, the row is a div: a checkbox button cannot sit inside the
  // session link. Left-click otherwise stays in-app; modifier clicks use href.
  const desktopRow = isSelecting ? (
    <div
      className={desktopRowClassName}
      onClick={isSelectable ? toggleSelected : undefined}
    >
      {desktopRowBody}
    </div>
  ) : (
    <a
      href={`/session/${session.id}`}
      className={desktopRowClassName}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onSessionSelect(session, project.projectId);
      }}
    >
      {desktopRowBody}
    </a>
  );

  return (
    <div className="relative">
      {/* The row fill is painted after this dot and covers the half that sits
          on the row's left edge. Keep the dot above that fill, and under the
          sticky project header (z-10). */}
      {(showAttentionIndicator || showBackgroundIndicator || showRecentIndicator) && (
        <div className="absolute left-0 top-1/2 z-[1] -translate-x-1 -translate-y-1/2 transform">
          <Tooltip content={indicatorLabel} position="right">
            <div
              role="status"
              aria-label={indicatorLabel}
              className={cn(
                'h-2 w-2 animate-pulse rounded-full',
                showAttentionIndicator
                  ? 'bg-amber-500'
                  : showBackgroundIndicator
                    ? 'bg-purple-500 dark:bg-purple-400'
                    : 'bg-green-500',
              )}
            />
          </Tooltip>
        </div>
      )}

      {isCompact && withSessionMenu(compactRow)}
      {!isCompact && withSessionMenu(desktopRow)}
    </div>
  );
}

/**
 * Memoized: a websocket session delta re-renders the sidebar roughly every
 * 0.5-2s during a run, and a rename keystroke re-renders it per character.
 *
 * SidebarProjectSessions hands every row but the one being renamed a constant
 * draft, and the session objects come from a per-project cache, so the compare
 * succeeds for the rest. See sidebarRowProps.test.tsx.
 */
export default memo(SidebarSessionItem);

