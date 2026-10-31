import type { TFunction } from 'i18next';

import { Button, Skeleton } from '@/shared/ui';
import { cn } from '@/shared/utils';
import type { LLMProvider, Project, ProjectSession, SessionWithProvider, SidebarSessionSelection } from '@/shared/types';
import SidebarSessionItem from '@/modules/sidebar/SidebarSessionItem';
import { useCompactSidebar } from '@/modules/sidebar/hooks/useCompactSidebar';
import { getSelectableSessionIds } from '@/modules/sidebar/utils/sidebarProjectFormatting';

type SidebarProjectSessionsProps = {
  project: Project;
  isExpanded: boolean;
  sessions: SessionWithProvider[];
  selectedSession: ProjectSession | null;
  initialSessionsLoaded: boolean;
  hasMoreSessions: boolean;
  isLoadingMoreSessions: boolean;
  activeSessions: ReadonlySet<string>;
  backgroundSessionIds: ReadonlySet<string>;
  attentionSessionIds: ReadonlySet<string>;
  currentTime: Date;
  /** The session being renamed, when it belongs to this project. */
  sessionRenameId: string | null;
  sessionRenameDraft: string;
  onRenameDraftChange: (draft: string) => void;
  onStartEditingSession: (projectId: string, sessionId: string, initialName: string) => void;
  onCancelEditingSession: () => void;
  onSaveEditingSession: (projectName: string, sessionId: string, summary: string, provider: LLMProvider) => void;
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: SessionWithProvider, projectName: string) => void;
  onDeleteSession: (sessionId: string, sessionTitle: string) => void;
  onForkSession?: (session: SessionWithProvider) => void;
  onLoadMoreSessions: (projectId: string) => void;
  /** The sessions ticked here, or null when this project's list is not in selection mode. */
  selectedSessionIds: ReadonlySet<string> | null;
  onSetSessionSelection: (selection: SidebarSessionSelection) => void;
  onToggleSessionSelected: (projectId: string, sessionId: string) => void;
  onCancelSessionSelection: () => void;
  /** Archives or deletes the sessions ticked in this list. */
  onDeleteSelectedSessions: (sessionIds: string[]) => void;
  t: TFunction;
};

function SessionListSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-md p-2">
          <div className="flex items-start gap-2">
            <Skeleton className="mt-0.5 h-3 w-3 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3" style={{ width: `${60 + index * 15}%` }} />
              <Skeleton className="h-2 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/** Rendered by SidebarProjectItem to show an expanded project's sessions, delegating each row to SidebarSessionItem. */
export default function SidebarProjectSessions({
  project,
  isExpanded,
  sessions,
  selectedSession,
  initialSessionsLoaded,
  hasMoreSessions,
  isLoadingMoreSessions,
  activeSessions,
  backgroundSessionIds,
  attentionSessionIds,
  currentTime,
  sessionRenameId,
  sessionRenameDraft,
  onRenameDraftChange,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveEditingSession,
  onProjectSelect,
  onSessionSelect,
  onDeleteSession,
  onForkSession,
  onLoadMoreSessions,
  selectedSessionIds,
  onSetSessionSelection,
  onToggleSessionSelected,
  onCancelSessionSelection,
  onDeleteSelectedSessions,
  t,
}: SidebarProjectSessionsProps) {
  const isCompact = useCompactSidebar();

  if (!isExpanded) {
    return null;
  }

  const hasSessions = sessions.length > 0;
  const isSelecting = selectedSessionIds !== null;
  const selectableSessionIds = getSelectableSessionIds(sessions, activeSessions, backgroundSessionIds);
  const selectableSessionIdSet = new Set(selectableSessionIds);
  // Derived from the shared selectable set so a running row stays locked here
  // and on the project row's bulk delete together.
  const isSessionRunning = (session: SessionWithProvider) => !selectableSessionIdSet.has(session.id);
  // Re-derived from the selectable rows rather than read straight off the
  // selection, so a row that started running after it was ticked is drawn
  // unticked and drops out of Select all. The project row uses the same ids
  // for its bulk-delete count.
  const effectiveSelectedIds = selectedSessionIds
    ? selectableSessionIds.filter((sessionId) => selectedSessionIds.has(sessionId))
    : [];
  const checkedSessionIds = new Set(effectiveSelectedIds);
  const allLoadedSelected =
    selectableSessionIds.length > 0 && effectiveSelectedIds.length === selectableSessionIds.length;
  // With more sessions on the server than on screen, the button only reaches the
  // loaded rows, so it offers "Select all loaded" rather than a "Select all" it
  // could not honour. Once those rows are ticked it flips to "Clear" either way.
  const selectAllLabel = allLoadedSelected
    ? t('sessions.clearSelection')
    : hasMoreSessions
      ? t('sessions.selectAllLoaded')
      : t('sessions.selectAll');

  return (
    <div className="ml-3 space-y-1 pl-3">
      {isSelecting && (
        <div className={cn('space-y-1', isCompact && 'px-3')}>
          {/* Wraps rather than clips: at the narrowest sidebar width a long
              translated "Select all loaded" leaves no room for Cancel.
              Delete stays immediately left of Select all / Clear, with only a
              small gap, so the two labels read as one pair. */}
          <div className="flex flex-wrap items-center gap-1">
            <div className="flex items-center gap-0.5">
              {effectiveSelectedIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs uppercase text-red-600 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  onClick={() => onDeleteSelectedSessions(effectiveSelectedIds)}
                >
                  {`Delete (${effectiveSelectedIds.length})`}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-xs uppercase text-muted-foreground hover:text-foreground"
                onClick={() =>
                  onSetSessionSelection({
                    projectId: project.projectId,
                    sessionIds: new Set(allLoadedSelected ? [] : selectableSessionIds),
                  })
                }
                disabled={selectableSessionIds.length === 0}
              >
                {selectAllLabel}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-xs uppercase text-muted-foreground hover:text-foreground"
              onClick={onCancelSessionSelection}
            >
              {t('actions.cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* A page emptied by deleting every loaded row still has sessions behind
          it on the server, so it keeps its "Load more" instead of "No sessions". */}
      {!initialSessionsLoaded ? (
        <SessionListSkeleton />
      ) : !hasSessions && !hasMoreSessions ? (
        <div className="px-3 py-2 text-left">
          <p className="text-xs text-muted-foreground">{t('sessions.noSessions')}</p>
        </div>
      ) : (
        <>
          {sessions.map((session) => (
            <SidebarSessionItem
              key={session.id}
              project={project}
              session={session}
              selectedSession={selectedSession}
              isProcessing={isSessionRunning(session)}
              hasBackgroundWork={backgroundSessionIds.has(session.id)}
              needsAttention={attentionSessionIds.has(session.id)}
              currentTime={currentTime}
              onRenameDraftChange={onRenameDraftChange}
              isEditing={session.id === sessionRenameId}
              renameDraft={session.id === sessionRenameId ? sessionRenameDraft : ''}
              onStartEditingSession={onStartEditingSession}
              onCancelEditingSession={onCancelEditingSession}
              onSaveEditingSession={onSaveEditingSession}
              onProjectSelect={onProjectSelect}
              onSessionSelect={onSessionSelect}
              onDeleteSession={onDeleteSession}
              onForkSession={onForkSession}
              isSelecting={isSelecting}
              isChecked={checkedSessionIds.has(session.id)}
              onToggleSessionSelected={onToggleSessionSelected}
              t={t}
            />
          ))}

          {hasMoreSessions && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onLoadMoreSessions(project.projectId)}
              disabled={isLoadingMoreSessions}
            >
              {isLoadingMoreSessions ? t('sessions.loadingSessions') : 'Load more sessions'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
