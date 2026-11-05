import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Loader2, Trash2 } from 'lucide-react';

import BrokeredCredentialsSection from '@/modules/settings/tabs/nono-settings/BrokeredCredentialsSection';
import SettingsCard from '@/modules/settings/SettingsCard';
import SettingsRow from '@/modules/settings/SettingsRow';
import SettingsSection from '@/modules/settings/SettingsSection';
import SettingsToggle from '@/modules/settings/SettingsToggle';
import { FolderBrowserModal } from '@/modules/project-creation-wizard';
import { ApiRequestError, api, readApiJson } from '@/shared/api';
import { Button, InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/shared/ui';

type NonoSettings = {
  enabled: boolean;
  allowedFolders: string[];
  available: boolean;
  supported: boolean;
};

/** Rendered by Settings for the "nono" tab: the enable switch, extra folders, and Agent Vault. */
export default function NonoSettingsTab() {
  const { t } = useTranslation('settings');
  // Server copy of the nono choice. Null until the first load so the switch does not flash off.
  const [settings, setSettings] = useState<NonoSettings | null>(null);
  // Path in the add-folder field, typed or filled by the folder browser. Saved only when the user adds it.
  const [folderDraft, setFolderDraft] = useState('');
  // The folder browser sits above this dialog while the user picks a path to write into the field.
  const [browserOpen, setBrowserOpen] = useState(false);
  // True until the first settings response settles.
  const [isLoading, setIsLoading] = useState(true);
  // True while a toggle or folder edit is being saved.
  const [isSaving, setIsSaving] = useState(false);
  // The last load or save error, shown above Agent Vault.
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const response = await api.settings.nono();
    const data = await readApiJson<NonoSettings>(response);
    setSettings({
      enabled: data.enabled === true,
      allowedFolders: Array.isArray(data.allowedFolders) ? data.allowedFolders : [],
      available: data.available === true,
      supported: data.supported !== false,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadSettings()
      .then(() => {
        if (!cancelled) {
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('nono.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadSettings, t]);

  const persist = async (next: Pick<NonoSettings, 'enabled' | 'allowedFolders'>): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await api.settings.saveNono(next);
      const data = await readApiJson<NonoSettings>(response);
      setSettings({
        enabled: data.enabled === true,
        allowedFolders: Array.isArray(data.allowedFolders) ? data.allowedFolders : [],
        available: data.available === true,
        supported: data.supported !== false,
      });
      return true;
    } catch (err) {
      const blocked = err instanceof ApiRequestError && err.code === 'NONO_FOLDER_PARENT';
      setError(blocked ? t('nono.folderBlocked') : (err instanceof Error ? err.message : t('nono.saveFailed')));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const addFolder = async (folderPath: string) => {
    if (!settings) {
      return;
    }
    const trimmed = folderPath.trim();
    if (!trimmed) {
      return;
    }
    if (settings.allowedFolders.includes(trimmed)) {
      setFolderDraft((current) => (current.trim() === trimmed ? '' : current));
      return;
    }
    const saved = await persist({
      enabled: settings.enabled,
      allowedFolders: [...settings.allowedFolders, trimmed],
    });
    if (saved) {
      setFolderDraft((current) => (current.trim() === trimmed ? '' : current));
    }
  };

  const removeFolder = async (folderPath: string) => {
    if (!settings) {
      return;
    }
    await persist({
      enabled: settings.enabled,
      allowedFolders: settings.allowedFolders.filter((folder) => folder !== folderPath),
    });
  };

  const statusLabel = !settings
    ? t('nono.checking')
    : !settings.supported
      ? t('nono.statusWindows')
      : settings.available
        ? t('nono.statusInstalled')
        : t('nono.statusMissing');

  return (
    <div className="space-y-8">
      <SettingsSection
        title={t('nono.sectionTitle')}
        description={t('nono.sectionDescription')}
      >
        <SettingsCard divided>
          <SettingsRow
            label={t('nono.enableLabel')}
            description={t('nono.enableDescription')}
          >
            {isLoading && !settings ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <SettingsToggle
                checked={settings?.enabled === true}
                onChange={(enabled) => {
                  if (!settings) {
                    return;
                  }
                  void persist({ enabled, allowedFolders: settings.allowedFolders });
                }}
                ariaLabel={t('nono.enableAriaLabel')}
                disabled={isSaving || !settings}
              />
            )}
          </SettingsRow>
          <div className="px-4 py-4">
            <p className="text-sm text-muted-foreground">{statusLabel}</p>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title={t('nono.foldersTitle')}
        description={t('nono.foldersDescription')}
      >
        <SettingsCard divided>
          <div className="space-y-3 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <InputGroup
                className="min-w-0 flex-1"
                data-disabled={isLoading || isSaving || !settings ? true : undefined}
              >
                <InputGroupInput
                  value={folderDraft}
                  placeholder={t('nono.folderPlaceholder')}
                  disabled={isLoading || isSaving || !settings}
                  onChange={(event) => setFolderDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void addFolder(folderDraft);
                    }
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    variant="secondary"
                    aria-label={t('nono.browseFolder')}
                    onClick={() => setBrowserOpen(true)}
                    disabled={isSaving || !settings}
                  >
                    <FolderOpen />
                    {t('nono.browseFolder')}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <Button
                type="button"
                size="sm"
                onClick={() => void addFolder(folderDraft)}
                disabled={isSaving || !settings || !folderDraft.trim()}
              >
                {t('nono.addFolder')}
              </Button>
            </div>
            {!settings || settings.allowedFolders.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                {isLoading ? t('nono.checking') : t('nono.foldersEmpty')}
              </p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {settings?.allowedFolders.map((folder) => (
                  <div key={folder} className="flex items-center justify-between gap-3 px-3 py-2">
                    <code className="min-w-0 truncate text-sm">{folder}</code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={t('nono.removeFolder')}
                      onClick={() => void removeFolder(folder)}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingsCard>
      </SettingsSection>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <BrokeredCredentialsSection nonoEnabled={settings ? settings.enabled : null} />

      <FolderBrowserModal
        isOpen={browserOpen}
        autoAdvanceOnSelect={false}
        layerClassName="z-[10050]"
        onClose={() => setBrowserOpen(false)}
        onFolderSelected={(folderPath) => {
          // The browser only fills the field. The folder is saved when the user clicks Add folder.
          setBrowserOpen(false);
          setFolderDraft(folderPath);
        }}
      />
    </div>
  );
}
