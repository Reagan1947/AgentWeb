import { Palette, RotateCcw, Shield, ShieldOff, X } from 'lucide-react';

import { Button } from '@/shared/ui';
import { cn } from '@/shared/utils';
import { WORKSPACE_PANE_ACTION_CLASS, WORKSPACE_PANE_TOOLBAR_CHROME_CLASS } from '@/shared/constants';

type ShellHeaderProps = {
  isConnected: boolean;
  isInitialized: boolean;
  isRestarting: boolean;
  onDisconnect: () => void;
  onRestart: () => void;
  statusInitializingText: string;
  statusRestartingText: string;
  showThemeRestartHint: boolean;
  themeRestartHintText: string;
  disconnectLabel: string;
  disconnectTitle: string;
  restartLabel: string;
  restartTitle: string;
  disableRestart: boolean;
  showBypassToggle: boolean;
  bypassEnabled: boolean;
  onToggleBypass: () => void;
  bypassLabel: string;
  bypassTitle: string;
};

/** Rendered by Shell above the terminal. The session name used to sit here; the disconnect and restart actions take that spot. */
export default function ShellHeader({
  isConnected,
  isInitialized,
  isRestarting,
  onDisconnect,
  onRestart,
  statusInitializingText,
  statusRestartingText,
  showThemeRestartHint,
  themeRestartHintText,
  disconnectLabel,
  disconnectTitle,
  restartLabel,
  restartTitle,
  disableRestart,
  showBypassToggle,
  bypassEnabled,
  onToggleBypass,
  bypassLabel,
  bypassTitle,
}: ShellHeaderProps) {
  return (
    <div className={cn('flex-shrink-0', WORKSPACE_PANE_TOOLBAR_CHROME_CLASS)}>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {showBypassToggle && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleBypass}
            aria-pressed={bypassEnabled}
            title={bypassTitle}
            className={cn(
              WORKSPACE_PANE_ACTION_CLASS,
              bypassEnabled && 'border-orange-700 bg-orange-700 text-white hover:bg-orange-800 hover:text-white dark:border-orange-500/70 dark:bg-orange-600/80 dark:hover:bg-orange-700',
            )}
          >
            {bypassEnabled ? (
              <ShieldOff aria-hidden="true" />
            ) : (
              <Shield aria-hidden="true" />
            )}
            <span>{bypassLabel}</span>
          </Button>
        )}

        {isConnected && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDisconnect}
            title={disconnectTitle}
            className={cn(WORKSPACE_PANE_ACTION_CLASS, 'text-red-600 hover:bg-red-600/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300')}
          >
            <X aria-hidden="true" />
            <span>{disconnectLabel}</span>
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRestart}
          disabled={disableRestart}
          title={restartTitle}
          className={WORKSPACE_PANE_ACTION_CLASS}
        >
          <RotateCcw className={isRestarting ? 'animate-spin' : ''} aria-hidden="true" />
          <span>{restartLabel}</span>
        </Button>

        {!isInitialized && <span className="text-xs text-yellow-700 dark:text-yellow-400">{statusInitializingText}</span>}

        {isRestarting && <span className="text-xs text-primary">{statusRestartingText}</span>}
      </div>

      {/* A running Claude CLI keeps the theme it was launched in; Restart applies the new one. */}
      {showThemeRestartHint && (
        <p role="status" className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Palette className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{themeRestartHintText}</span>
        </p>
      )}
    </div>
  );
}
