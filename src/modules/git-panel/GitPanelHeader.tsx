import { AlertCircle, Check, ChevronDown, Download, GitBranch, Plus, RefreshCw, RotateCcw, Search, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfirmationRequest, GitRemoteStatus } from '@/shared/types';
import { Button } from '@/shared/ui';
import { cn } from '@/shared/utils';
import {
  WORKSPACE_PANE_ACTION_CLASS,
  WORKSPACE_PANE_ICON_ACTION_CLASS,
  WORKSPACE_PANE_TOOLBAR_CHROME_CLASS,
} from '@/shared/constants';
import NewBranchModal from '@/modules/git-panel/modals/NewBranchModal';

type GitPanelHeaderProps = {
  currentBranch: string;
  branches: string[];
  remoteStatus: GitRemoteStatus | null;
  isLoading: boolean;
  isCreatingBranch: boolean;
  isFetching: boolean;
  isPulling: boolean;
  isPushing: boolean;
  isPublishing: boolean;
  isRevertingLocalCommit: boolean;
  operationError: string | null;
  onRefresh: () => void;
  onRevertLocalCommit: () => Promise<void>;
  onSwitchBranch: (branchName: string) => Promise<boolean>;
  onCreateBranch: (branchName: string) => Promise<boolean>;
  onFetch: () => Promise<void>;
  onPull: () => Promise<void>;
  onPush: () => Promise<void>;
  onPublish: () => Promise<void>;
  onClearError: () => void;
  onRequestConfirmation: (request: ConfirmationRequest) => void;
};

/** Rendered by GitPanel to host the branch switcher and the fetch/pull/push/publish/revert actions. */
export default function GitPanelHeader({
  currentBranch,
  branches,
  remoteStatus,
  isLoading,
  isCreatingBranch,
  isFetching,
  isPulling,
  isPushing,
  isPublishing,
  isRevertingLocalCommit,
  operationError,
  onRefresh,
  onRevertLocalCommit,
  onSwitchBranch,
  onCreateBranch,
  onFetch,
  onPull,
  onPush,
  onPublish,
  onClearError,
  onRequestConfirmation,
}: GitPanelHeaderProps) {
  const { t } = useTranslation();
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showNewBranchModal, setShowNewBranchModal] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const branchSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Focus the search box on open; drop any stale query on close.
  useEffect(() => {
    if (showBranchDropdown) {
      branchSearchInputRef.current?.focus();
    } else {
      setBranchSearchQuery('');
    }
  }, [showBranchDropdown]);

  const filteredBranches = useMemo(() => {
    const query = branchSearchQuery.trim().toLowerCase();
    if (!query) {
      return branches;
    }
    return branches.filter((branch) => branch.toLowerCase().includes(query));
  }, [branches, branchSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const aheadCount = remoteStatus?.ahead ?? 0;
  const behindCount = remoteStatus?.behind ?? 0;
  const remoteName = remoteStatus?.remoteName ?? 'remote';
  const anyPending = isFetching || isPulling || isPushing || isPublishing;

  const requestPullConfirmation = () => {
    onRequestConfirmation({
      type: 'pull',
      message: t('git:header.confirmPull', { count: behindCount, remote: remoteName }),
      onConfirm: onPull,
    });
  };

  const requestPushConfirmation = () => {
    onRequestConfirmation({
      type: 'push',
      message: t('git:header.confirmPush', { count: aheadCount, remote: remoteName }),
      onConfirm: onPush,
    });
  };

  const requestPublishConfirmation = () => {
    onRequestConfirmation({
      type: 'publish',
      message: t('git:header.confirmPublish', { branch: currentBranch, remote: remoteName }),
      onConfirm: onPublish,
    });
  };

  const requestRevertLocalCommitConfirmation = () => {
    onRequestConfirmation({
      type: 'revertLocalCommit',
      message: t('git:header.confirmRevert'),
      onConfirm: onRevertLocalCommit,
    });
  };

  const handleSwitchBranch = async (branchName: string) => {
    try {
      const success = await onSwitchBranch(branchName);
      if (success) setShowBranchDropdown(false);
    } catch (error) {
      console.error('[GitPanelHeader] Failed to switch branch:', error);
    }
  };

  return (
    <>
      <div className={cn('flex items-center justify-between gap-2', WORKSPACE_PANE_TOOLBAR_CHROME_CLASS)}>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {remoteStatus?.hasRemote && (
            <>
              {!remoteStatus.hasUpstream ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={requestPublishConfirmation}
                  disabled={anyPending}
                  className={WORKSPACE_PANE_ACTION_CLASS}
                  title={t('git:header.publishTitle', { branch: currentBranch, remote: remoteName })}
                >
                  <Upload className={isPublishing ? 'animate-pulse' : ''} />
                  <span>{isPublishing ? t('git:header.publishing') : t('git:header.publish')}</span>
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onFetch()}
                    disabled={anyPending}
                    className={WORKSPACE_PANE_ACTION_CLASS}
                    title={t('git:header.fetchTitle', { remote: remoteName })}
                  >
                    <RefreshCw className={isFetching ? 'animate-spin' : ''} />
                    <span>{isFetching ? t('git:header.fetching') : t('git:header.fetch')}</span>
                  </Button>

                  {behindCount > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={requestPullConfirmation}
                      disabled={anyPending}
                      className={WORKSPACE_PANE_ACTION_CLASS}
                      title={t('git:header.pullTitle', { n: behindCount, remote: remoteName })}
                    >
                      <Download className={isPulling ? 'animate-pulse' : ''} />
                      <span>{isPulling ? t('git:header.pulling') : t('git:header.pullCount', { n: behindCount })}</span>
                    </Button>
                  )}

                  {aheadCount > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={requestPushConfirmation}
                      disabled={anyPending}
                      className={WORKSPACE_PANE_ACTION_CLASS}
                      title={t('git:header.pushTitle', { n: aheadCount, remote: remoteName })}
                    >
                      <Upload className={isPushing ? 'animate-pulse' : ''} />
                      <span>{isPushing ? t('git:header.pushing') : t('git:header.pushCount', { n: aheadCount })}</span>
                    </Button>
                  )}
                </>
              )}
            </>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={requestRevertLocalCommitConfirmation}
            disabled={isRevertingLocalCommit}
            className={WORKSPACE_PANE_ICON_ACTION_CLASS}
            title={t('git:header.revertTitle')}
            aria-label={t('git:header.revertTitle')}
          >
            <RotateCcw className={isRevertingLocalCommit ? 'animate-pulse' : ''} />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className={WORKSPACE_PANE_ICON_ACTION_CLASS}
            title={t('git:header.refreshTitle')}
            aria-label={t('git:header.refreshTitle')}
          >
            <RefreshCw className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>

        <div className="relative shrink-0" ref={dropdownRef}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowBranchDropdown((prev) => !prev)}
            className={cn(WORKSPACE_PANE_ACTION_CLASS, 'max-w-[16rem]')}
          >
            <GitBranch />
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate font-medium">{currentBranch}</span>
              {remoteStatus?.hasRemote && (
                <span className="flex items-center gap-0.5 text-xs">
                  {aheadCount > 0 && (
                    <span className="text-green-600 dark:text-green-400" title={t('git:header.aheadTitle', { n: aheadCount })}>
                      ↑{aheadCount}
                    </span>
                  )}
                  {behindCount > 0 && (
                    <span className="text-primary" title={t('git:header.behindTitle', { n: behindCount })}>
                      ↓{behindCount}
                    </span>
                  )}
                  {remoteStatus.isUpToDate && (
                    <span className="text-muted-foreground" title={t('git:header.upToDate')}>✓</span>
                  )}
                </span>
              )}
            </span>
            <ChevronDown className={cn('transition-transform', showBranchDropdown && 'rotate-180')} />
          </Button>

          {showBranchDropdown && (
            <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  ref={branchSearchInputRef}
                  type="text"
                  value={branchSearchQuery}
                  onChange={(event) => setBranchSearchQuery(event.target.value)}
                  placeholder={t('git:header.searchBranches')}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                {branchSearchQuery && (
                  <button
                    onClick={() => setBranchSearchQuery('')}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    title={t('git:header.clearSearch')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredBranches.length === 0 ? (
                  <div className="px-4 py-3 text-center text-sm text-muted-foreground">{t('git:header.noMatchingBranches')}</div>
                ) : (
                  filteredBranches.map((branch) => (
                    <button
                      key={branch}
                      onClick={() => void handleSwitchBranch(branch)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-accent ${
                        branch === currentBranch ? 'bg-accent/50 text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        {branch === currentBranch && <Check className="h-3 w-3 text-primary" />}
                        <span className={branch === currentBranch ? 'font-medium' : ''}>{branch}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-border py-1">
                <button
                  onClick={() => {
                    setShowNewBranchModal(true);
                    setShowBranchDropdown(false);
                  }}
                  className="flex w-full items-center space-x-2 px-4 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <Plus className="h-3 w-3" />
                  <span>{t('git:header.createNewBranch')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline error banner */}
      {operationError && (
        <div className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1 leading-snug">{operationError}</span>
          <button
            onClick={onClearError}
            className="shrink-0 rounded p-0.5 hover:bg-destructive/20"
            aria-label={t('git:header.dismissError')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <NewBranchModal
        isOpen={showNewBranchModal}
        currentBranch={currentBranch}
        isCreatingBranch={isCreatingBranch}
        onClose={() => setShowNewBranchModal(false)}
        onCreateBranch={onCreateBranch}
      />
    </>
  );
}
