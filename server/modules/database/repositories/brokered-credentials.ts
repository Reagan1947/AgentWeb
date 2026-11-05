/**
 * Agent Vault secrets.
 *
 * A row is any secret the user wants agents to use, not only an API key.
 * The settings API lists every column except `secret`. Runtimes read `secret`
 * only to place it in an agent environment, or, when `upstream` is set, in the
 * nono parent process that swaps it for a phantom token.
 */

import { getConnection } from '@/modules/database/connection.js';
import type {
  BrokeredCredentialPublicRow,
  BrokeredCredentialSecretRow,
} from '@/shared/types.js';

export const brokeredCredentialsDb = {
  /** Lists a user's vault secrets without the secret value. */
  listPublic(userId: number): BrokeredCredentialPublicRow[] {
    const db = getConnection();
    return db
      .prepare(
        `SELECT id, name, note, upstream, inject_header, credential_format, is_active, created_at
         FROM brokered_api_credentials
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
      .all(userId) as BrokeredCredentialPublicRow[];
  },

  /** Active secrets, for the process that starts an agent. */
  listActiveSecrets(userId: number): BrokeredCredentialSecretRow[] {
    const db = getConnection();
    return db
      .prepare(
        `SELECT id, name, note, upstream, inject_header, credential_format, is_active, created_at, secret
         FROM brokered_api_credentials
         WHERE user_id = ? AND is_active = 1
         ORDER BY name ASC`,
      )
      .all(userId) as BrokeredCredentialSecretRow[];
  },

  /** Stores a secret. The caller must already have validated the fields. */
  create(input: {
    userId: number;
    name: string;
    note: string | null;
    upstream: string;
    injectHeader: string;
    credentialFormat: string;
    secret: string;
  }): { id: number; name: string } {
    const db = getConnection();
    const result = db
      .prepare(
        `INSERT INTO brokered_api_credentials
         (user_id, name, note, upstream, inject_header, credential_format, secret)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.userId,
        input.name,
        input.note,
        input.upstream,
        input.injectHeader,
        input.credentialFormat,
        input.secret,
      );
    return { id: Number(result.lastInsertRowid), name: input.name };
  },

  /** Removes one credential owned by the user. */
  delete(userId: number, credentialId: number): boolean {
    const db = getConnection();
    const result = db
      .prepare('DELETE FROM brokered_api_credentials WHERE id = ? AND user_id = ?')
      .run(credentialId, userId);
    return result.changes > 0;
  },

  /** Enables or disables a credential without deleting the stored secret. */
  toggle(userId: number, credentialId: number, isActive: boolean): boolean {
    const db = getConnection();
    const result = db
      .prepare(
        'UPDATE brokered_api_credentials SET is_active = ? WHERE id = ? AND user_id = ?',
      )
      .run(isActive ? 1 : 0, credentialId, userId);
    return result.changes > 0;
  },
};
