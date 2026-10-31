import { useEffect, useRef, type ReactNode } from 'react';
import { Check, Edit2, GitBranch, MoreHorizontal, Trash2, X } from 'lucide-react';
import type { TFunction } from 'i18next';

import { ActionMenu, Button, Input } from '@/shared/ui';
import { cn } from '@/shared/utils';
import type { LLMProvider } from '@/shared/types';
import { useSessionForkingProviders } from '@/shared/hooks/useProviderCapabilities';
import { useProviderSessionIdCopy } from '@/modules/sidebar/hooks/useProviderSessionIdCopy';
import { PROVIDER_LABELS } from '@/modules/sidebar/utils/sidebarProjectFormatting';

type SessionOptionsProps = {
  sessionId: string;
  sessionName: string;
  provider: LLMProvider;
  /**
   * The project that owns the session. Null where the row does not know it, in
   * which case rename is withheld rather than guessed — it is keyed by project.
   */
  projectId: string | null;
  /** A running session cannot be deleted or forked, matching the Projects row. */
  isProcessing: boolean;
  isEditing: boolean;
  renameDraft: string;
  onRenameDraftChange: (draft: string) => void;
  onStartEditingSession: (projectId: string, sessionId: string, initialName: string) => void;
  onCancelEditingSession: () => void;
  onSaveEditingSession: (projectId: string, sessionId: string, summary: string, provider: LLMProvider) => void;
  onDeleteSession: (sessionId: string, sessionTitle: string) => void;
  /** Bound by the caller, which owns the session object the fork needs. */
  onFork?: () => void;
  /** Withheld where the row has nowhere to send a delete. */
  canDelete?: boolean;
  /**
   * `context` opens this menu from a right-click on `children`. Project rows add
   * their own "…" button for the same menu. The conversations list keeps the button.
   */
  trigger?: 'button' | 'context';
  children?: ReactNode;
  className?: string;
  t: TFunction;
};

/**
 * A session row's controls: the options menu, and the inline rename that
 * replaces it while a rename is open.
 *
 * Shared by the Projects list and the Conversations list so the two rows cannot
 * drift — the first cut of the Conversations row copied this markup, which is
 * how two rows end up diverging one fix at a time. The project tree opens the
 * menu from a right-click or the row's "…" button; the conversations list keeps
 * its own button. Callers keep only what is genuinely theirs: where the controls
 * sit, and whether deleting is offered.
 */
export default function SessionOptions({
  sessionId,
  sessionName,
  provider,
  projectId,
  isProcessing,
  isEditing,
  renameDraft,
  onRenameDraftChange,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveEditingSession,
  onDeleteSession,
  onFork,
  canDelete = true,
  trigger = 'button',
  children,
  className,
  t,
}: SessionOptionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const providerLabel = PROVIDER_LABELS[provider];
  const { copyState, copyLabel, setOptionsOpen, handleCopyAction, isCopyPending, CopyStateIcon } =
    useProviderSessionIdCopy(sessionId, providerLabel);

  // Read from the backend capability matrix rather than branching on the
  // provider id here; the request is cached module-side, so every row shares one.
  const forkableProviders = useSessionForkingProviders();
  const canFork = Boolean(onFork) && forkableProviders.has(provider) && !isProcessing;

  // While editing, dismiss only when the click lands outside the rename panel,
  // matching Escape and the cancel button.
  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const container = containerRef.current;
      if (container && !container.contains(event.target as Node)) {
        onCancelEditingSession();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isEditing, onCancelEditingSession]);

  const saveRename = () => {
    if (projectId === null) {
      onCancelEditingSession();
      return;
    }
    onSaveEditingSession(projectId, sessionId, renameDraft, provider);
  };

  const renameControls = (
    <>
      <Input
        type="text"
        value={renameDraft}
        onChange={(event) => onRenameDraftChange(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            saveRename();
          } else if (event.key === 'Escape') {
            onCancelEditingSession();
          }
        }}
        onClick={(event) => event.stopPropagation()}
        className="h-7 w-32 px-2 text-xs shadow-none"
        autoFocus
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 bg-green-50 p-0 text-green-600 hover:bg-green-100 hover:text-green-600 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 dark:hover:text-green-400"
        onClick={(event) => {
          event.stopPropagation();
          saveRename();
        }}
        title={t('tooltips.save')}
        aria-label={t('tooltips.save')}
      >
        <Check className="h-3 w-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 bg-gray-50 p-0 text-gray-600 hover:bg-gray-100 hover:text-gray-600 dark:bg-gray-900/20 dark:text-gray-400 dark:hover:bg-gray-900/40 dark:hover:text-gray-400"
        onClick={(event) => {
          event.stopPropagation();
          onCancelEditingSession();
        }}
        title={t('tooltips.cancel')}
        aria-label={t('tooltips.cancel')}
      >
        <X className="h-3 w-3" />
      </Button>
    </>
  );

  const menu = (
    <ActionMenu
      trigger={trigger}
      label="Session options"
      ariaLabel={`Session options for ${sessionName}`}
      icon={trigger === 'button' ? MoreHorizontal : undefined}
      iconOnly
      portal
      variant="ghost"
      size="icon"
      onOpenChange={setOptionsOpen}
      triggerClassName="h-7 w-7 text-muted-foreground opacity-70 hover:bg-muted hover:opacity-100"
      menuClassName="w-[260px] rounded-xl p-1.5 shadow-xl"
      header={(
        <div className="mb-1 border-b border-border px-3 py-2">
          <p className="truncate text-xs font-medium text-foreground" title={sessionName}>
            {sessionName}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{providerLabel} session</p>
        </div>
      )}
      items={[
        ...(projectId !== null ? [{
          key: 'rename',
          label: 'Rename session',
          icon: Edit2,
          onSelect: () => onStartEditingSession(projectId, sessionId, sessionName),
        }] : []),
        {
          key: 'copy',
          label: copyLabel,
          description: copyState === 'error' ? 'Click to try again.' : undefined,
          icon: CopyStateIcon,
          loading: isCopyPending,
          closeOnSelect: false,
          onSelect: handleCopyAction,
        },
        ...(canFork && onFork ? [{
          key: 'fork',
          label: 'Fork session',
          description: 'Continue from a copy, leaving this one untouched.',
          icon: GitBranch,
          onSelect: onFork,
        }] : []),
        ...(canDelete && !isProcessing ? [{
          key: 'delete',
          label: 'Archive or delete session',
          icon: Trash2,
          isDanger: true,
          showDividerBefore: true,
          onSelect: () => onDeleteSession(sessionId, sessionName),
        }] : []),
      ]}
    >
      {trigger === 'context' ? children : undefined}
    </ActionMenu>
  );

  if (trigger === 'context') {
    return (
      <div ref={containerRef} className={cn('relative', className)}>
        {isEditing ? (
          <>
            {children}
            <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
              {renameControls}
            </div>
          </>
        ) : menu}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('flex items-center gap-1', className)}>
      {isEditing ? renameControls : menu}
    </div>
  );
}
