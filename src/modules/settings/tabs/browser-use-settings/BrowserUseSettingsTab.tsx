import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2 } from 'lucide-react';

import { Button, Input } from '@/shared/ui';
import { api, readApiJson, ApiRequestError } from '@/shared/api';
import SettingsCard from '@/modules/settings/SettingsCard';
import SettingsRow from '@/modules/settings/SettingsRow';
import SettingsSection from '@/modules/settings/SettingsSection';
import SettingsToggle from '@/modules/settings/SettingsToggle';

type BrowserUseSettings = {
  enabled: boolean;
  steelBaseUrl: string;
  steelApiKey: string;
};

type BrowserUseStatus = {
  enabled: boolean;
  available: boolean;
  playwrightInstalled: boolean;
  chromiumInstalled: boolean;
  installInProgress: boolean;
  steelConfigured?: boolean;
  steelReachable?: boolean;
  steelAuthenticated?: boolean;
  message: string;
};

const DEFAULT_STEEL_BASE_URL = 'http://127.0.0.1:3000';

function readBrowserSettings(value: Partial<BrowserUseSettings> | null | undefined): BrowserUseSettings {
  return {
    enabled: value?.enabled === true,
    steelBaseUrl: typeof value?.steelBaseUrl === 'string' ? value.steelBaseUrl : DEFAULT_STEEL_BASE_URL,
    steelApiKey: typeof value?.steelApiKey === 'string' ? value.steelApiKey : '',
  };
}

/** Rendered by Settings for the "browser" tab, configuring the browser automation integration. */
const BROWSER_USE_ERROR_KEYS: Record<string, string> = {
  BROWSER_USE_STATUS_LOAD_FAILED: 'browserUseSettings.loadStatusFailed',
  BROWSER_USE_SETTINGS_LOAD_FAILED: 'browserUseSettings.loadSettingsFailed',
  BROWSER_USE_SETTINGS_SAVE_FAILED: 'browserUseSettings.saveFailed',
  BROWSER_USE_RUNTIME_INSTALL_FAILED: 'browserUseSettings.installFailed',
};

function localizeApiError(err: unknown, fallbackKey: string, t: (key: string) => string): string {
  if (err instanceof ApiRequestError && err.code && BROWSER_USE_ERROR_KEYS[err.code]) {
    const localized = t(BROWSER_USE_ERROR_KEYS[err.code]);
    return typeof err.details === 'string' && err.details.trim()
      ? `${localized} ${err.details}`
      : localized;
  }
  return t(fallbackKey);
}

export default function BrowserUseSettingsTab() {
  const { t } = useTranslation('settings');
  const [settings, setSettings] = useState<BrowserUseSettings | null>(null);
  const [status, setStatus] = useState<BrowserUseStatus | null>(null);
  // Steel address draft. Saved with the button or Enter so typing does not call the settings API on every keystroke.
  const [steelBaseUrlDraft, setSteelBaseUrlDraft] = useState(DEFAULT_STEEL_BASE_URL);
  // Optional Steel API key draft, saved together with the address.
  const [steelApiKeyDraft, setSteelApiKeyDraft] = useState('');
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applySettings = useCallback((value: Partial<BrowserUseSettings>, syncDrafts: boolean) => {
    const next = readBrowserSettings(value);
    setSettings(next);
    if (syncDrafts) {
      setSteelBaseUrlDraft(next.steelBaseUrl);
      setSteelApiKeyDraft(next.steelApiKey);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const settingsResponse = await api.browserUse.settings();
    const settingsData = await readApiJson<{ data: { settings: Partial<BrowserUseSettings> } }>(settingsResponse);
    applySettings(settingsData.data.settings, true);
  }, [applySettings]);

  const loadStatus = useCallback(async () => {
    const statusResponse = await api.browserUse.status();
    const statusData = await readApiJson<{ data: BrowserUseStatus }>(statusResponse);
    setStatus(statusData.data);
  }, []);

  useEffect(() => {
    setError(null);
    setIsSettingsLoading(true);
    setIsStatusLoading(true);

    void loadSettings()
      .catch((err) => setError(localizeApiError(err, 'browserUseSettings.loadSettingsFailed', t)))
      .finally(() => setIsSettingsLoading(false));

    void loadStatus()
      .catch((err) => setError(localizeApiError(err, 'browserUseSettings.loadStatusFailed', t)))
      .finally(() => setIsStatusLoading(false));
  }, [loadSettings, loadStatus, t]);

  const updateSettings = async (nextSettings: Partial<BrowserUseSettings>) => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await api.browserUse.saveSettings(nextSettings);
      const data = await readApiJson<{ data: { settings: Partial<BrowserUseSettings> } }>(response);
      const updatesSteel = Object.prototype.hasOwnProperty.call(nextSettings, 'steelBaseUrl')
        || Object.prototype.hasOwnProperty.call(nextSettings, 'steelApiKey');
      applySettings(data.data.settings, updatesSteel);
      window.dispatchEvent(new Event('browserUseSettingsChanged'));
      setIsStatusLoading(true);
      await loadStatus();
    } catch (err) {
      setError(localizeApiError(err, 'browserUseSettings.saveFailed', t));
    } finally {
      setIsStatusLoading(false);
      setIsSaving(false);
    }
  };

  const installBrowserBinaries = async () => {
    setIsInstalling(true);
    setError(null);
    try {
      const response = await api.browserUse.installRuntime();
      await readApiJson(response);
      setIsStatusLoading(true);
      await loadStatus();
    } catch (err) {
      setError(localizeApiError(err, 'browserUseSettings.installFailed', t));
    } finally {
      setIsStatusLoading(false);
      setIsInstalling(false);
    }
  };

  const saveSteelSettings = async () => {
    if (!settings) {
      return;
    }
    if (steelBaseUrlDraft === settings.steelBaseUrl && steelApiKeyDraft === settings.steelApiKey) {
      return;
    }
    await updateSettings({
      steelBaseUrl: steelBaseUrlDraft,
      steelApiKey: steelApiKeyDraft,
    });
  };

  const browserEnabled = settings?.enabled === true;
  const needsBrowserBinaries = Boolean(
    browserEnabled
    && status
    && !status.available
    && (!status.playwrightInstalled || (!status.chromiumInstalled && !status.steelReachable)),
  );
  const steelStatusLabel = !settings?.steelBaseUrl
    ? t('browserUseSettings.steelNotConfigured')
    : status?.steelReachable && status.steelAuthenticated === false
      ? t('browserUseSettings.steelAuthFailed')
      : status?.steelReachable
        ? t('browserUseSettings.steelReachable')
        : t('browserUseSettings.steelUnreachable');
  const runtimeLabel = (installed?: boolean) => {
    if (isStatusLoading && !status) {
      return t('browserUseSettings.checking');
    }
    return installed ? t('browserUseSettings.installed') : t('browserUseSettings.missing');
  };

  return (
    <div className="space-y-8">
      <SettingsSection
        title={t('browserUseSettings.sectionTitle')}
        description={t('browserUseSettings.sectionDescription')}
      >
        <SettingsCard divided>
          <SettingsRow
            label={t('browserUseSettings.enableLabel')}
            description={t('browserUseSettings.enableDescription')}
          >
            {isSettingsLoading && !settings ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <SettingsToggle
                checked={browserEnabled}
                onChange={(value) => void updateSettings({ enabled: value })}
                ariaLabel={t('browserUseSettings.enableAriaLabel')}
                disabled={isSaving}
              />
            )}
          </SettingsRow>

          <div className="space-y-4 px-4 py-4">
            <div className="space-y-1">
              <label htmlFor="browser-use-steel-url" className="text-sm font-medium text-foreground">
                {t('browserUseSettings.steelUrlLabel')}
              </label>
              <Input
                id="browser-use-steel-url"
                type="url"
                value={steelBaseUrlDraft}
                placeholder={t('browserUseSettings.steelUrlPlaceholder')}
                disabled={isSettingsLoading || isSaving}
                onChange={(event) => setSteelBaseUrlDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveSteelSettings();
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">{t('browserUseSettings.steelUrlDescription')}</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="browser-use-steel-api-key" className="text-sm font-medium text-foreground">
                {t('browserUseSettings.steelApiKeyLabel')}
              </label>
              <Input
                id="browser-use-steel-api-key"
                type="password"
                value={steelApiKeyDraft}
                autoComplete="off"
                disabled={isSettingsLoading || isSaving}
                onChange={(event) => setSteelApiKeyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveSteelSettings();
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">{t('browserUseSettings.steelApiKeyDescription')}</p>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => void saveSteelSettings()}
              disabled={
                isSaving
                || !settings
                || (steelBaseUrlDraft === settings.steelBaseUrl && steelApiKeyDraft === settings.steelApiKey)
              }
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('browserUseSettings.steelSave')}
            </Button>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-md border border-border px-2 py-1">
                {t('browserUseSettings.playwrightLabel')}: {runtimeLabel(status?.playwrightInstalled)}
              </span>
              <span className="rounded-md border border-border px-2 py-1">
                {t('browserUseSettings.chromiumLabel')}: {runtimeLabel(status?.chromiumInstalled)}
              </span>
              <span className="rounded-md border border-border px-2 py-1">
                {t('browserUseSettings.steelUrlLabel')}: {isStatusLoading && !status
                  ? t('browserUseSettings.checking')
                  : steelStatusLabel}
              </span>
              <span className="rounded-md border border-border px-2 py-1">
                {t('browserUseSettings.statusPrefix')}: {isStatusLoading && !status
                  ? t('browserUseSettings.checking')
                  : status?.available
                    ? t('browserUseSettings.ready')
                    : browserEnabled
                      ? t('browserUseSettings.setupRequired')
                      : t('browserUseSettings.disabled')}
              </span>
            </div>

            {needsBrowserBinaries && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-medium text-foreground">{t('browserUseSettings.runtimeRequiredTitle')}</div>
                  <p className="text-sm text-muted-foreground">
                    {t('browserUseSettings.runtimeRequiredFallback')}
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => void installBrowserBinaries()}
                  disabled={isInstalling || status?.installInProgress}
                  className="flex-shrink-0"
                >
                  {isInstalling || status?.installInProgress ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isInstalling || status?.installInProgress
                    ? t('browserUseSettings.installing')
                    : t('browserUseSettings.installRuntime')}
                </Button>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            )}
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
