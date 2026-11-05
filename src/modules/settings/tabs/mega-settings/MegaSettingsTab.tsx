import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';

import SettingsCard from '@/modules/settings/SettingsCard';
import SettingsRow from '@/modules/settings/SettingsRow';
import SettingsSection from '@/modules/settings/SettingsSection';
import { api, readApiJson } from '@/shared/api';
import { Button } from '@/shared/ui';

type MegaStatus = {
  installed: boolean;
  running: boolean;
  pid: number | null;
  sandboxed: boolean;
  responding: boolean;
  syncOutput: string | null;
};

/** Rendered by Settings for the "mega" tab: shows whether MEGAcmd is healthy and restarts it. */
export default function MegaSettingsTab() {
  const { t } = useTranslation('settings');
  // Null until the first response so the status does not flash as stopped.
  const [status, setStatus] = useState<MegaStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await readApiJson<MegaStatus>(await api.settings.megaStatus()));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('mega.loadFailed'));
    } finally {
      setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const restart = async () => {
    setIsRestarting(true);
    try {
      await readApiJson(await api.settings.megaRestart());
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('mega.restartFailed'));
    } finally {
      setIsRestarting(false);
    }
  };

  const statusLabel = !status
    ? t('mega.checking')
    : !status.installed
      ? t('mega.statusMissing')
      : !status.running
        ? t('mega.statusStopped')
        : status.sandboxed
          ? t('mega.statusSandboxed')
          : status.responding
            ? t('mega.statusHealthy')
            : t('mega.statusNotResponding');

  return (
    <div className="space-y-8">
      <SettingsSection title={t('mega.sectionTitle')} description={t('mega.sectionDescription')}>
        <SettingsCard divided>
          <SettingsRow
            label={t('mega.statusLabel')}
            description={status?.pid ? t('mega.processId', { pid: status.pid }) : undefined}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{statusLabel}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={t('mega.refresh')}
                onClick={() => {
                  setIsRefreshing(true);
                  void refresh();
                }}
                disabled={isRefreshing || isRestarting}
              >
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </SettingsRow>
          <SettingsRow label={t('mega.restartLabel')} description={t('mega.restartDescription')}>
            <Button
              type="button"
              size="sm"
              onClick={() => void restart()}
              disabled={isRestarting || status?.installed === false}
            >
              {isRestarting ? t('mega.restarting') : t('mega.restart')}
            </Button>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {status?.syncOutput && (
        <SettingsSection title={t('mega.syncTitle')}>
          <pre className="overflow-x-auto rounded-xl border border-border bg-card/50 p-4 text-xs text-foreground">
            {status.syncOutput}
          </pre>
        </SettingsSection>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
