import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock3,
  Download,
  Expand,
  ExternalLink,
  Loader2,
  MonitorPlay,
  PictureInPicture2,
  RefreshCw,
  Settings,
  Square,
  Trash2,
  X,
} from 'lucide-react';

import { cn } from '@/shared/utils';
import { Badge, BrowserIcon, Button } from '@/shared/ui';
import { WORKSPACE_PANE_ACTION_CLASS, WORKSPACE_PANE_TOOLBAR_CHROME_CLASS } from '@/shared/constants';
import { api, readApiJson, ApiRequestError } from '@/shared/api';
import type { BrowserUseSession, SettingsMainTab } from '@/shared/types';

type BrowserUseStatus = {
  enabled: boolean;
  available: boolean;
  playwrightInstalled: boolean;
  chromiumInstalled: boolean;
  installInProgress: boolean;
  steelReachable?: boolean;
  sessionCount: number;
  message: string;
};

type BrowserUsePanelProps = {
  isVisible: boolean;
  onShowSettings?: (tab?: SettingsMainTab) => void;
  /** Leaves the Browser tab and opens the floating window, even if the user closed it. */
  onPopOut?: () => void;
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const BROWSER_USE_PANEL_ERROR_KEYS: Record<string, string> = {
  BROWSER_USE_STATUS_LOAD_FAILED: 'browserUse.loadFailed',
  BROWSER_USE_SESSIONS_LOAD_FAILED: 'browserUse.loadFailed',
  BROWSER_USE_SESSION_STOP_FAILED: 'browserUse.actionFailed',
  BROWSER_USE_SESSION_DELETE_FAILED: 'browserUse.actionFailed',
  BROWSER_USE_RUNTIME_INSTALL_FAILED: 'browserUse.installFailed',
};

function localizeApiError(err: unknown, fallbackKey: string, t: TranslateFn): string {
  if (err instanceof ApiRequestError && err.code && BROWSER_USE_PANEL_ERROR_KEYS[err.code]) {
    return t(BROWSER_USE_PANEL_ERROR_KEYS[err.code]);
  }
  return t(fallbackKey);
}


function formatRelativeTime(value: string | null, t: TranslateFn): string {
  if (!value) return t('browserUse.never');

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return t('browserUse.unknown');

  const elapsedSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 10) return t('browserUse.justNow');
  if (elapsedSeconds < 60) return t('browserUse.secondsAgo', { n: elapsedSeconds });
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return t('browserUse.minutesAgo', { n: elapsedMinutes });
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return t('browserUse.hoursAgo', { n: elapsedHours });
  return t('browserUse.daysAgo', { n: Math.round(elapsedHours / 24) });
}

function getDomain(url: string | null, t: TranslateFn): string {
  if (!url) return t('browserUse.noPageLoaded');

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatAction(action: string | null, t: TranslateFn): string {
  if (!action) return t('browserUse.waitingAction');
  // The target URL is already on screen next to every action label.
  if (action.startsWith('navigate:')) return 'navigate';
  return action.replace(/_/g, ' ').replace(/:/g, ': ');
}

function getStatusTone(status: BrowserUseSession['status']): string {
  if (status === 'ready') {
    return 'border-primary/30 bg-primary/5 text-foreground';
  }
  if (status === 'stopped') {
    return 'border-border bg-muted text-muted-foreground';
  }
  return 'border-border bg-background text-muted-foreground';
}

function getStatusLabel(status: BrowserUseSession['status'] | undefined, t: TranslateFn, lastAction?: string | null): string {
  if (!status) return t('browserUse.statusEmpty');
  if (status === 'stopped' && lastAction === 'replaced') return t('browserUse.statusReplacedSession');
  if (status === 'ready') return t('browserUse.statusReadySession');
  if (status === 'stopped') return t('browserUse.statusStoppedSession');
  if (status === 'unavailable') return t('browserUse.statusUnavailableSession');
  return status;
}

function getStatusDot(status: BrowserUseSession['status']): string {
  if (status === 'ready') return 'bg-primary';
  if (status === 'stopped') return 'bg-muted-foreground/50';
  return 'bg-border';
}

const PROMPT_KEYS = ['browserUse.prompt1', 'browserUse.prompt2'];
const SESSION_POLL_INTERVAL_MS = 2000;

/** Used by the project-workspace module to render the Browser tab's session list and live preview. */
export default function BrowserUsePanel({ isVisible, onShowSettings, onPopOut }: BrowserUsePanelProps) {
  const { t } = useTranslation('settings');
  const [status, setStatus] = useState<BrowserUseStatus | null>(null);
  const [sessions, setSessions] = useState<BrowserUseSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ignores a session poll that finishes after the tab hides or a newer load starts.
  const refreshGeneration = useRef(0);
  // Keeps the background poll from replacing a manual refresh that is still in flight.
  const manualRefresh = useRef(false);
  // Session ids from the previous poll, so a newly created session can take the selection once.
  const knownSessionIds = useRef<Set<string> | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || sessions[0] || null,
    [selectedSessionId, sessions],
  );
  // Self-hosted Steel runs one Chrome, so at most one session owns the live view.
  const liveSession = useMemo(
    () => [...sessions].reverse().find((session) => session.status === 'ready' && session.debugUrl) || null,
    [sessions],
  );
  const isReplacedSession = selectedSession?.lastAction === 'replaced';

  const activeSessions = sessions.filter((session) => session.status === 'ready');
  const needsBrowserBinaries = Boolean(
    status?.enabled
    && !status.available
    && (!status.playwrightInstalled || (!status.chromiumInstalled && !status.steelReachable)),
  );

  const cursorStyle = selectedSession?.cursor && selectedSession.viewport
    ? {
      left: `${(selectedSession.cursor.x / selectedSession.viewport.width) * 100}%`,
      top: `${(selectedSession.cursor.y / selectedSession.viewport.height) * 100}%`,
    }
    : null;

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent && manualRefresh.current) {
      return;
    }

    const generation = refreshGeneration.current + 1;
    refreshGeneration.current = generation;
    if (!options?.silent) {
      manualRefresh.current = true;
      setIsRefreshing(true);
    }
    try {
      const [statusResponse, sessionsResponse] = await Promise.all([
        api.browserUse.status(),
        api.browserUse.sessions(),
      ]);
      const statusData = await readApiJson<{ data: BrowserUseStatus }>(statusResponse);
      const sessionsData = await readApiJson<{ data: { sessions: BrowserUseSession[] } }>(sessionsResponse);
      if (refreshGeneration.current !== generation) {
        return;
      }
      const nextSessions = sessionsData.data.sessions;
      setStatus(statusData.data);
      setSessions(nextSessions);
      const previousIds = knownSessionIds.current;
      knownSessionIds.current = new Set(nextSessions.map((session) => session.id));
      const newestReady = [...nextSessions].reverse().find((session) => session.status === 'ready');
      const newlyCreated = previousIds
        ? [...nextSessions].reverse().find((session) => !previousIds.has(session.id))
        : null;
      setSelectedSessionId((current) => {
        // Follow an agent that just opened a session; otherwise keep the user's pick.
        if (newlyCreated) return newlyCreated.id;
        if (current && nextSessions.some((session) => session.id === current)) return current;
        return newestReady?.id || nextSessions[nextSessions.length - 1]?.id || null;
      });
      setError(null);
    } catch (err) {
      if (refreshGeneration.current !== generation || options?.silent) {
        return;
      }
      setError(localizeApiError(err, 'browserUse.loadFailed', t));
    } finally {
      if (!options?.silent && refreshGeneration.current === generation) {
        manualRefresh.current = false;
        setIsRefreshing(false);
      }
    }
  }, [t]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    void refresh();
    const timer = window.setInterval(() => {
      void refresh({ silent: true });
    }, SESSION_POLL_INTERVAL_MS);
    return () => {
      refreshGeneration.current += 1;
      window.clearInterval(timer);
    };
  }, [isVisible, refresh]);

  const runAction = useCallback(async (action: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(localizeApiError(err, 'browserUse.actionFailed', t));
    } finally {
      setIsBusy(false);
    }
  }, [refresh, t]);

  const stopSession = () => runAction(async () => {
    if (!selectedSession) return;
    const response = await api.browserUse.stopSession(selectedSession.id);
    await readApiJson(response);
  });

  const deleteSession = () => runAction(async () => {
    if (!selectedSession) return;
    const response = await api.browserUse.deleteSession(selectedSession.id);
    await readApiJson(response);
    setIsFullscreen(false);
  });

  const installBrowserBinaries = () => runAction(async () => {
    setIsInstalling(true);
    try {
      const response = await api.browserUse.installRuntime();
      await readApiJson(response);
    } finally {
      setIsInstalling(false);
    }
  });

  const renderSessionItem = (session: BrowserUseSession) => {
    const isSelected = selectedSession?.id === session.id;
    return (
      <button
        key={session.id}
        type="button"
        onClick={() => setSelectedSessionId(session.id)}
        className={cn(
          'group w-full rounded-md border px-3 py-2.5 text-left transition-colors',
          isSelected
            ? 'border-primary/50 bg-primary/10 text-foreground'
            : 'border-border/60 bg-card/30 text-muted-foreground hover:bg-muted/50',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', getStatusDot(session.status))} />
              <div className="truncate text-sm font-medium">{session.title || getDomain(session.url, t)}</div>
            </div>
            <div className="mt-1 truncate pl-3.5 text-xs text-muted-foreground">{getDomain(session.url, t)}</div>
          </div>
          <Badge variant="outline" className="shrink-0 border-border bg-background text-[10px] text-muted-foreground">
            {getStatusLabel(session.status, t, session.lastAction)}
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock3 className="h-3 w-3" />
          <span>{formatRelativeTime(session.updatedAt, t)}</span>
          <span className="truncate">- {formatAction(session.lastAction, t)}</span>
        </div>
      </button>
    );
  };

  const renderEmptyState = () => (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-md border border-border bg-card/40 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            <BrowserIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              {status?.enabled ? t('browserUse.emptyTitleEnabled') : t('browserUse.emptyTitleDisabled')}
            </div>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              {status?.enabled
                ? t('browserUse.emptyDescEnabled')
                : t('browserUse.emptyDescDisabled')}
            </p>
          </div>
        </div>

        {needsBrowserBinaries && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
            <div className="text-sm font-medium text-foreground">{t('browserUse.runtimeSetupTitle')}</div>
            <p className="mt-1 text-sm text-muted-foreground">{status?.message}</p>
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={installBrowserBinaries}
              disabled={isBusy || isInstalling || status?.installInProgress}
            >
              {isInstalling || status?.installInProgress ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isInstalling || status?.installInProgress ? t('browserUse.installing') : t('browserUse.installRuntime')}
            </Button>
          </div>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {PROMPT_KEYS.map((promptKey) => (
            <div key={promptKey} className="rounded-md border border-border/70 bg-background/70 p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('browserUse.promptLabel')}
              </div>
              <p className="text-sm leading-6 text-foreground">{t(promptKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const hasLiveView = Boolean(selectedSession?.status === 'ready' && selectedSession.debugUrl);
  const canExpand = Boolean(hasLiveView || selectedSession?.screenshotDataUrl);

  const renderBrowserSurface = (fullscreen = false) => (
    <div className={cn(
      'flex w-full flex-1 flex-col bg-neutral-950',
      hasLiveView ? 'items-stretch' : 'items-center justify-center',
      fullscreen ? 'min-h-0' : 'min-h-[420px]',
    )}>
      {hasLiveView && selectedSession?.debugUrl ? (
        <iframe
          src={selectedSession.debugUrl}
          title={t('browserUse.liveViewTitle')}
          referrerPolicy="no-referrer"
          allow="clipboard-read; clipboard-write; fullscreen"
          className={cn('h-full w-full flex-1 border-0 bg-neutral-950', fullscreen ? 'min-h-0' : 'min-h-[420px]')}
        />
      ) : selectedSession?.screenshotDataUrl ? (
        <div className="relative inline-block max-h-full">
          {isReplacedSession && (
            <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-black/75 px-3 py-2 text-xs text-white">
              <span>{t('browserUse.replacedNotice')}</span>
              {liveSession && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={() => setSelectedSessionId(liveSession.id)}
                >
                  <MonitorPlay className="h-3.5 w-3.5" />
                  {t('browserUse.showLiveSession')}
                </Button>
              )}
            </div>
          )}
          <img
            src={selectedSession.screenshotDataUrl}
            alt={t('browserUse.screenshotAlt')}
            className={fullscreen ? 'block max-h-[80vh] w-auto max-w-full object-contain' : 'block max-h-[72vh] w-auto max-w-full object-contain'}
          />
          {cursorStyle && (
            <div
              className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-primary/80 shadow-[0_0_0_6px_hsl(var(--primary)/0.18)]"
              style={cursorStyle}
            >
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            </div>
          )}
        </div>
      ) : (
        <div className="px-6 text-center">
          <MonitorPlay className="mx-auto h-9 w-9 text-neutral-500" />
          <div className="mt-3 text-sm font-medium text-neutral-100">{selectedSession?.message || t('browserUse.waitingScreenshot')}</div>
          <p className="mt-1 text-xs text-neutral-400">{t('browserUse.waitingScreenshotHint')}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className={cn('flex min-w-0 flex-wrap items-center gap-1', WORKSPACE_PANE_TOOLBAR_CHROME_CLASS)}>
        {onShowSettings && (
          <Button
            variant="outline"
            size="sm"
            className={WORKSPACE_PANE_ACTION_CLASS}
            onClick={() => onShowSettings('browser')}
            title={t('browserUse.openSettings')}
            aria-label={t('browserUse.openSettings')}
          >
            <Settings />
            <span>{t('browserUse.openSettings')}</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className={WORKSPACE_PANE_ACTION_CLASS}
          onClick={() => void refresh()}
          disabled={isRefreshing || isBusy}
          title={t('browserUse.refreshSessions')}
          aria-label={t('browserUse.refreshSessions')}
        >
          <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
          <span>{t('browserUse.refreshSessions')}</span>
        </Button>
      </div>

      {error && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="border-b border-border/60 bg-muted/20 px-3 py-2 lg:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className={cn(
                  'flex min-w-[180px] items-center gap-2 rounded-md border px-2.5 py-2 text-left',
                  selectedSession?.id === session.id
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-background',
                )}
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', getStatusDot(session.status))} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {session.title || getDomain(session.url, t)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="flex min-h-0 flex-col overflow-hidden">
          {sessions.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4">
              <div className="mx-auto flex h-full min-h-[500px] max-w-7xl flex-col overflow-hidden rounded-md border border-border bg-background shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      {selectedSession && (
                        <span
                          className={cn('h-2 w-2 shrink-0 rounded-full', getStatusDot(selectedSession.status))}
                          title={getStatusLabel(selectedSession.status, t, selectedSession.lastAction)}
                        />
                      )}
                      <span className="truncate text-sm font-medium text-foreground">
                        {selectedSession?.title || getDomain(selectedSession?.url || null, t)}
                      </span>
                      {/* "ready" is the normal case; only call out a session that can no longer be driven. */}
                      {selectedSession && selectedSession.status !== 'ready' && (
                        <Badge variant="outline" className={cn('shrink-0 text-[10px]', getStatusTone(selectedSession.status))}>
                          {getStatusLabel(selectedSession.status, t, selectedSession.lastAction)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{selectedSession?.url || t('browserUse.noPageLoaded')}</span>
                    </div>
                  </div>
                  {/* The Selected card shows the last action from lg up. */}
                  <div className="hidden text-xs text-muted-foreground md:block lg:hidden">
                    {formatAction(selectedSession?.lastAction || null, t)}
                  </div>
                  {onPopOut && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 [&_svg]:size-[18px]" onClick={onPopOut} disabled={activeSessions.length === 0} title={t('browserUse.popOut')} aria-label={t('browserUse.popOut')}>
                      <PictureInPicture2 />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsFullscreen(true)} disabled={!canExpand} title={t('browserUse.fullScreen')} aria-label={t('browserUse.fullScreen')}>
                    <Expand className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 lg:hidden" onClick={stopSession} disabled={isBusy || !selectedSession || selectedSession.status !== 'ready'} title={t('browserUse.stopSession')} aria-label={t('browserUse.stopSession')}>
                    <Square className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 lg:hidden" onClick={deleteSession} disabled={isBusy || !selectedSession} title={t('browserUse.deleteSession')} aria-label={t('browserUse.deleteSession')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {renderBrowserSurface()}
              </div>
            </div>
          )}
        </main>

        <aside className="hidden min-h-0 flex-col border-l border-border/60 bg-background lg:flex">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-foreground">{t('browserUse.sessions')}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t('browserUse.totalCount', { n: sessions.length })}</div>
              </div>
              <Badge variant="outline" className="text-[10px]">{t('browserUse.activeCount', { n: activeSessions.length })}</Badge>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {sessions.length > 0 ? (
              <div className="space-y-2">{sessions.map(renderSessionItem)}</div>
            ) : (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-8 text-center text-xs text-muted-foreground">
                {t('browserUse.noSessions')}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 p-3">
            <div className="rounded-md border border-border/70 bg-muted/30 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('browserUse.selected')}
              </div>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>{t('browserUse.statusLabel')}</span>
                  <span className="font-medium text-foreground">{getStatusLabel(selectedSession?.status, t, selectedSession?.lastAction)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('browserUse.lastAction')}</span>
                  <span className="truncate font-medium text-foreground">{formatAction(selectedSession?.lastAction || null, t)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('browserUse.profileLabel')}</span>
                  <span className="truncate font-medium text-foreground">{selectedSession?.profileName || t('browserUse.temporaryProfile')}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{t('browserUse.providerLabel')}</span>
                  <span className="truncate font-medium text-foreground">
                    {selectedSession?.provider === 'steel'
                      ? t('browserUse.providerSteel')
                      : selectedSession?.provider === 'playwright'
                        ? t('browserUse.providerLocal')
                        : t('browserUse.none')}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={stopSession} disabled={isBusy || !selectedSession || selectedSession.status !== 'ready'}>
                  <Square className="h-4 w-4" />
                  {t('browserUse.stop')}
                </Button>
                <Button variant="outline" size="sm" onClick={deleteSession} disabled={isBusy || !selectedSession}>
                  <Trash2 className="h-4 w-4" />
                  {t('browserUse.delete')}
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {isFullscreen && selectedSession && (
        <div className="modal-backdrop fixed inset-0 z-50 p-6">
          <div className="flex h-full flex-col rounded-md border border-white/10 bg-black">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm text-white/80">
              <div className="min-w-0 truncate">{selectedSession.title || selectedSession.url || t('browserUse.sessionFallback')}</div>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={() => setIsFullscreen(false)}
              >
                <X className="h-4 w-4" />
                {t('browserUse.close')}
              </Button>
            </div>
            {renderBrowserSurface(true)}
          </div>
        </div>
      )}
    </div>
  );
}
