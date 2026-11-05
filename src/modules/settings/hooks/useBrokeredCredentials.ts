import { useCallback, useEffect, useState } from 'react';

import { api } from '@/shared/api';
import type { BrokeredCredentialItem } from '@/shared/types';

type BrokeredCredentialsResponse = {
  credentials?: BrokeredCredentialItem[];
  nonoAvailable?: boolean;
  success?: boolean;
  error?: string | { message?: string };
};

const errorMessage = (payload: BrokeredCredentialsResponse | undefined, fallback: string) => {
  if (typeof payload?.error === 'string') {
    return payload.error;
  }
  return payload?.error?.message || fallback;
};

/** Loads and edits Agent Vault secrets for the nono settings tab. */
export function useBrokeredCredentials(confirmDeleteText: string) {
  // Saved secrets as the server lists them. The value is never in this state.
  const [credentials, setCredentials] = useState<BrokeredCredentialItem[]>([]);
  // False when the server cannot find nono, so API secrets will not be brokered.
  const [nonoAvailable, setNonoAvailable] = useState(true);
  // True until the first list request settles.
  const [loading, setLoading] = useState(true);
  // The create form stays closed until the user asks to add a secret.
  const [showForm, setShowForm] = useState(false);
  // Draft slug. It becomes the environment variable name agents are told to use.
  const [name, setName] = useState('');
  // Optional description shown next to the secret. It is not the secret itself.
  const [note, setNote] = useState('');
  // When true, the secret is also an https API call and the extra fields are sent.
  const [callApi, setCallApi] = useState(false);
  // Draft https upstream. Empty unless the secret should call an API.
  const [upstream, setUpstream] = useState('');
  // Draft header the proxy should set. Defaults to Authorization.
  const [injectHeader, setInjectHeader] = useState('Authorization');
  // Bearer {} or a raw header value. This is the only format the server accepts.
  const [credentialFormat, setCredentialFormat] = useState('Bearer {}');
  // Draft secret. Cleared after a successful save and never loaded back from the server.
  const [secret, setSecret] = useState('');
  // Toggles the draft secret between a password field and plain text while the form is open.
  const [showSecret, setShowSecret] = useState(false);
  // Last save or delete failure, shown above the form.
  const [error, setError] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    try {
      const response = await api.settings.brokeredCredentials();
      const payload = await response.json() as BrokeredCredentialsResponse;
      setCredentials(payload.credentials || []);
      setNonoAvailable(payload.nonoAvailable !== false);
    } catch (fetchError) {
      console.error('Error fetching Agent Vault secrets:', fetchError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCredentials();
  }, [fetchCredentials]);

  const createCredential = useCallback(async () => {
    if (!name.trim() || !secret.trim() || (callApi && !upstream.trim())) {
      return;
    }
    try {
      setError(null);
      const response = await api.settings.createBrokeredCredential({
        name: name.trim(),
        note: note.trim(),
        secret,
        ...(callApi
          ? {
            upstream: upstream.trim(),
            injectHeader: injectHeader.trim(),
            credentialFormat,
          }
          : {}),
      });
      const payload = await response.json() as BrokeredCredentialsResponse;
      if (!response.ok || payload.success === false) {
        setError(errorMessage(payload, 'Failed to save the secret'));
        return;
      }
      setName('');
      setNote('');
      setCallApi(false);
      setUpstream('');
      setInjectHeader('Authorization');
      setCredentialFormat('Bearer {}');
      setSecret('');
      setShowSecret(false);
      setShowForm(false);
      await fetchCredentials();
    } catch (createError) {
      console.error('Error creating Agent Vault secret:', createError);
      setError('Failed to save the secret');
    }
  }, [callApi, credentialFormat, fetchCredentials, injectHeader, name, note, secret, upstream]);

  const deleteCredential = useCallback(async (credentialId: number) => {
    if (!window.confirm(confirmDeleteText)) {
      return;
    }
    try {
      const response = await api.settings.deleteBrokeredCredential(credentialId);
      if (!response.ok) {
        const payload = await response.json() as BrokeredCredentialsResponse;
        setError(errorMessage(payload, 'Failed to delete the secret'));
        return;
      }
      await fetchCredentials();
    } catch (deleteError) {
      console.error('Error deleting Agent Vault secret:', deleteError);
    }
  }, [confirmDeleteText, fetchCredentials]);

  const toggleCredential = useCallback(async (credentialId: number, isActive: boolean) => {
    try {
      const response = await api.settings.toggleBrokeredCredential(credentialId, !isActive);
      if (!response.ok) {
        const payload = await response.json() as BrokeredCredentialsResponse;
        setError(errorMessage(payload, 'Failed to update the secret'));
        return;
      }
      await fetchCredentials();
    } catch (toggleError) {
      console.error('Error toggling Agent Vault secret:', toggleError);
    }
  }, [fetchCredentials]);

  return {
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
  };
}
