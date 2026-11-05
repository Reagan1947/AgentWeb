import { Eye, EyeOff, Plus, Trash2, Vault } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useBrokeredCredentials } from '@/modules/settings/hooks/useBrokeredCredentials';
import { Button, Input } from '@/shared/ui';

type BrokeredCredentialsSectionProps = {
  /** Null while the nono switch is still loading, so a disabled warning does not flash. */
  nonoEnabled: boolean | null;
};

/** Rendered by NonoSettingsTab so a user can save secrets for any agent. */
export default function BrokeredCredentialsSection({ nonoEnabled }: BrokeredCredentialsSectionProps) {
  const { t } = useTranslation('settings');
  const {
    credentials,
    nonoAvailable,
    loading,
    showForm,
    setShowForm,
    name,
    setName,
    note,
    setNote,
    callApi,
    setCallApi,
    upstream,
    setUpstream,
    injectHeader,
    setInjectHeader,
    credentialFormat,
    setCredentialFormat,
    secret,
    setSecret,
    showSecret,
    setShowSecret,
    error,
    createCredential,
    deleteCredential,
    toggleCredential,
  } = useBrokeredCredentials(t('apiKeys.brokered.confirmDelete'));
  const hasApiSecret = credentials.some((credential) => credential.kind === 'api');

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Vault className="h-5 w-5" />
          <h3 className="text-lg font-semibold">{t('apiKeys.brokered.title')}</h3>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" />
          {t('apiKeys.brokered.addButton')}
        </Button>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{t('apiKeys.brokered.description')}</p>
      {!loading && hasApiSecret && nonoEnabled === false && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">{t('nono.apiSecretsPaused')}</p>
      )}
      {!loading && hasApiSecret && nonoEnabled === true && !nonoAvailable && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">{t('apiKeys.brokered.nonoMissing')}</p>
      )}
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {showForm && (
        <div className="mb-4 space-y-3 rounded-lg border bg-card p-4">
          <Input
            placeholder={t('apiKeys.brokered.form.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
          <Input
            placeholder={t('apiKeys.brokered.form.note')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            autoComplete="off"
          />
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              placeholder={t('apiKeys.brokered.form.secret')}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              className="pr-10"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              aria-label={showSecret ? t('common:misc.hideToken') : t('common:misc.showToken')}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={callApi}
              onChange={(event) => setCallApi(event.target.checked)}
            />
            {t('apiKeys.brokered.form.callApi')}
          </label>
          {callApi && (
            <>
              <p className="text-sm text-muted-foreground">{t('apiKeys.brokered.form.callApiHelp')}</p>
              <Input
                placeholder={t('apiKeys.brokered.form.upstream')}
                value={upstream}
                onChange={(event) => setUpstream(event.target.value)}
                autoComplete="off"
              />
              <Input
                placeholder={t('apiKeys.brokered.form.header')}
                value={injectHeader}
                onChange={(event) => setInjectHeader(event.target.value)}
                autoComplete="off"
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={credentialFormat}
                onChange={(event) => setCredentialFormat(event.target.value)}
              >
                <option value="Bearer {}">{t('apiKeys.brokered.form.formatBearer')}</option>
                <option value="{}">{t('apiKeys.brokered.form.formatRaw')}</option>
              </select>
            </>
          )}
          <div className="flex gap-2">
            <Button onClick={createCredential}>{t('apiKeys.brokered.form.addButton')}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t('apiKeys.brokered.form.cancelButton')}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('apiKeys.loading')}</p>
      ) : credentials.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">{t('apiKeys.brokered.empty')}</p>
      ) : (
        <div className="space-y-3">
          {credentials.map((credential) => (
            <div key={credential.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{credential.name}</div>
                  {credential.note && (
                    <div className="text-sm text-muted-foreground">{credential.note}</div>
                  )}
                  {credential.kind === 'api' ? (
                    <>
                      <div className="text-sm text-muted-foreground">{credential.upstream}</div>
                      <div className="text-sm text-muted-foreground">
                        {credential.injectHeader}: {credential.credentialFormat}
                      </div>
                      <div className="mt-1 text-sm">
                        {t('apiKeys.brokered.variables', {
                          baseUrl: `$${credential.baseUrlEnv}`,
                          token: `$${credential.tokenEnv}`,
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 text-sm">
                      {t('apiKeys.brokered.secretVariable', {
                        variable: `$${credential.tokenEnv}`,
                      })}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t('apiKeys.brokered.created')} {new Date(credential.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleCredential(credential.id, credential.isActive)}
                  >
                    {credential.isActive ? t('apiKeys.status.active') : t('apiKeys.status.inactive')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteCredential(credential.id)}
                    aria-label={t('apiKeys.brokered.confirmDelete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
