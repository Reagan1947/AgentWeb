import { randomUUID } from 'node:crypto';

import { getConnection } from '@/modules/database/connection.js';
import type { QueuedChatMessage } from '@/shared/types.js';
import { readQueuedChatMessage, readQueuedChatMessages } from '@/shared/utils.js';

/**
 * One chat scope's unsent state: the text still in the composer, plus the
 * turns queued behind an in-flight one. Both are optional — a scope can hold
 * only a draft, only a queue, or both.
 */
export type SessionDraftRecord = {
  scope: string;
  text: string;
  queuedMessages: QueuedChatMessage[];
  updatedAt: string;
};

type DraftRow = {
  draft_scope: string;
  draft_text: string;
  queued_message: string | null;
  updated_at: string;
};

/** A server-owned queued turn together with the exact stored value used to claim it once. */
export type QueuedSessionMessageRecord = {
  userId: number;
  sessionId: string;
  queuedMessage: unknown;
  claimToken: string;
};

type QueuedMessageRow = {
  user_id: number;
  draft_scope: string;
  queued_message: string;
};

/** A queued message that no longer parses is treated as absent, not fatal. */
function parseQueuedMessage(raw: string | null): unknown | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * The queue as it will be stored: each entry can be sent on its own, and one
 * that was saved before ids existed gets a stable id from its position.
 */
function normalizeQueue(value: unknown): QueuedChatMessage[] {
  return readQueuedChatMessages(value).map((message, index) => (
    message.id ? message : { ...message, id: `legacy-${index}` }
  ));
}

/** The turns waiting in a scope's queue, oldest first. */
function readStoredQueue(userId: number, scope: string): QueuedChatMessage[] {
  const row = getConnection()
    .prepare('SELECT queued_message FROM session_drafts WHERE user_id = ? AND draft_scope = ?')
    .get(userId, scope) as { queued_message: string | null } | undefined;
  return normalizeQueue(parseQueuedMessage(row?.queued_message ?? null));
}

/** Stores a scope's queue without touching its draft text. An empty queue clears it. */
function writeStoredQueue(userId: number, scope: string, messages: QueuedChatMessage[]): void {
  const db = getConnection();
  if (messages.length === 0) {
    db.prepare(
      `UPDATE session_drafts
       SET queued_message = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND draft_scope = ?`
    ).run(userId, scope);
    sessionDraftsDb.deleteEmptyDraft(userId, scope);
    return;
  }

  db.prepare(
    `INSERT INTO session_drafts (user_id, draft_scope, draft_text, queued_message, updated_at)
     VALUES (?, ?, '', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, draft_scope) DO UPDATE SET
       queued_message = excluded.queued_message,
       updated_at = CURRENT_TIMESTAMP`
  ).run(userId, scope, JSON.stringify(messages));
}

function toRecord(row: DraftRow): SessionDraftRecord {
  return {
    scope: row.draft_scope,
    text: row.draft_text,
    queuedMessages: normalizeQueue(parseQueuedMessage(row.queued_message)),
    updatedAt: row.updated_at,
  };
}

export const sessionDraftsDb = {
  /**
   * Returns every draft the user has, newest first.
   *
   * The client pulls the whole set once per load: drafts are short strings, and
   * having them all up front means switching sessions restores a draft written
   * on another device without a round trip.
   */
  getDrafts(userId: number): SessionDraftRecord[] {
    const db = getConnection();
    const rows = db
      .prepare(
        `SELECT draft_scope, draft_text, queued_message, updated_at
         FROM session_drafts
         WHERE user_id = ?
         ORDER BY datetime(updated_at) DESC`
      )
      .all(userId) as DraftRow[];

    return rows.map(toRecord);
  },

  /**
   * Lists the first queued turn of each real chat session.
   *
   * The claim token is the whole stored queue, so a message added after this
   * listing no longer matches and is not dropped when the first turn is taken.
   */
  listQueuedMessages(): QueuedSessionMessageRecord[] {
    const rows = getConnection()
      .prepare(
        `SELECT drafts.user_id, drafts.draft_scope, drafts.queued_message
         FROM session_drafts AS drafts
         INNER JOIN sessions ON sessions.session_id = drafts.draft_scope
         WHERE drafts.queued_message IS NOT NULL`
      )
      .all() as QueuedMessageRow[];

    return rows.flatMap((row) => {
      const head = normalizeQueue(parseQueuedMessage(row.queued_message))[0];
      if (!head) {
        return [];
      }
      return [{
        userId: row.user_id,
        sessionId: row.draft_scope,
        queuedMessage: head,
        claimToken: row.queued_message,
      }];
    });
  },

  /**
   * Atomically takes the first queued turn, leaving the rest, only if the
   * queue has not changed since it was listed.
   */
  claimQueuedMessage(candidate: QueuedSessionMessageRecord): boolean {
    const queue = normalizeQueue(parseQueuedMessage(candidate.claimToken));
    if (queue.length === 0) {
      return false;
    }
    const rest = queue.slice(1);
    const result = getConnection()
      .prepare(
        `UPDATE session_drafts
         SET queued_message = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND draft_scope = ? AND queued_message = ?`
      )
      .run(
        rest.length > 0 ? JSON.stringify(rest) : null,
        candidate.userId,
        candidate.sessionId,
        candidate.claimToken,
      );
    if (result.changes > 0 && rest.length === 0) {
      sessionDraftsDb.deleteEmptyDraft(candidate.userId, candidate.sessionId);
    }
    return result.changes > 0;
  },

  /**
   * Restores a claim lost to the narrow race where another run starts first.
   *
   * The restored turn goes back to the front, as its own turn. A message the
   * user queued after the claim stays behind it, so neither is lost and the
   * order they were queued in is kept.
   */
  restoreQueuedMessage(candidate: QueuedSessionMessageRecord): void {
    const restored = readQueuedChatMessage(candidate.queuedMessage);
    if (!restored) {
      return;
    }

    const db = getConnection();
    db.transaction(() => {
      const queuedSinceClaim = readStoredQueue(candidate.userId, candidate.sessionId);
      const id = restored.id && !queuedSinceClaim.some((message) => message.id === restored.id)
        ? restored.id
        : randomUUID();
      writeStoredQueue(candidate.userId, candidate.sessionId, [
        { ...restored, id },
        ...queuedSinceClaim,
      ]);
    })();
  },

  /**
   * Queues a message to be sent when the session is next idle, after any
   * message already queued for it.
   *
   * Each message is its own turn. Reading and writing in one transaction keeps
   * this exact against the dispatcher, which claims the stored queue: once the
   * first message has been claimed for sending, this one is queued behind
   * whatever else arrived, and nothing is sent twice. `index` inserts the
   * message at that position instead, which is how a removed turn is put back
   * where it was; the message's id is kept only for that insert. An id that is
   * already in the queue replaces that turn in place, which is how an edit
   * writes the revised text back without moving it or adding a second copy.
   */
  appendQueuedMessage(
    userId: number,
    scope: string,
    message: QueuedChatMessage,
    index?: number | null,
  ): { queuedMessages: QueuedChatMessage[] } {
    const db = getConnection();
    return db.transaction(() => {
      const current = readStoredQueue(userId, scope);
      const queuedMessages = current.slice();
      const existingAt = message.id
        ? queuedMessages.findIndex((entry) => entry.id === message.id)
        : -1;
      if (existingAt >= 0 && message.id) {
        const previous = queuedMessages[existingAt];
        queuedMessages[existingAt] = {
          ...previous,
          ...message,
          id: message.id,
          options: message.options ?? previous.options,
        };
        writeStoredQueue(userId, scope, queuedMessages);
        return { queuedMessages };
      }
      const keepId = index != null && Boolean(message.id);
      const at = index == null
        ? queuedMessages.length
        : Math.max(0, Math.min(Math.trunc(index), queuedMessages.length));
      queuedMessages.splice(at, 0, { ...message, id: keepId ? message.id : randomUUID() });
      writeStoredQueue(userId, scope, queuedMessages);
      return { queuedMessages };
    })();
  },

  /** Removes one queued turn by id, leaving the rest and the draft text. */
  removeQueuedMessage(userId: number, scope: string, id: string): void {
    const db = getConnection();
    db.transaction(() => {
      const current = readStoredQueue(userId, scope);
      const next = current.filter((message) => message.id !== id);
      if (next.length === current.length) {
        return;
      }
      writeStoredQueue(userId, scope, next);
    })();
  },

  /** Removes a scope's queued message (edited back into the composer or deleted), keeping its text. */
  clearQueuedMessage(userId: number, scope: string): void {
    const db = getConnection();
    db.transaction(() => {
      db.prepare(
        `UPDATE session_drafts
         SET queued_message = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND draft_scope = ?`
      ).run(userId, scope);
      sessionDraftsDb.deleteEmptyDraft(userId, scope);
    })();
  },

  /**
   * Removes a row left with neither text nor a queued message: after its last
   * queued turn is claimed, its queued message is cleared, or its text emptied.
   */
  deleteEmptyDraft(userId: number, scope: string): void {
    getConnection()
      .prepare(
        `DELETE FROM session_drafts
         WHERE user_id = ? AND draft_scope = ? AND draft_text = '' AND queued_message IS NULL`
      )
      .run(userId, scope);
  },

  /**
   * Writes one scope's composer text and leaves its queued message alone, or
   * deletes the row when neither is left.
   *
   * The composer saves its text on a debounce, from whatever copy of the queue
   * that page last saw. Writing only the text keeps that save from putting back
   * a queued message the dispatcher has already sent, or from replacing one that
   * another tab has added to.
   */
  saveDraftText(userId: number, scope: string, text: string): void {
    const db = getConnection();
    db.transaction(() => {
      db.prepare(
        `INSERT INTO session_drafts (user_id, draft_scope, draft_text, queued_message, updated_at)
         VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, draft_scope) DO UPDATE SET
           draft_text = excluded.draft_text,
           updated_at = CURRENT_TIMESTAMP`
      ).run(userId, scope, text);
      sessionDraftsDb.deleteEmptyDraft(userId, scope);
    })();
  },

  /**
   * Writes one scope's draft, or deletes the row when nothing is left to keep.
   *
   * Deleting on empty is what stops the table growing a permanent row for every
   * session the user ever opened and typed a character into.
   */
  saveDraft(
    userId: number,
    scope: string,
    draft: { text: string; queuedMessage: unknown | null }
  ): void {
    const db = getConnection();

    if (!draft.text && draft.queuedMessage === null) {
      db.prepare('DELETE FROM session_drafts WHERE user_id = ? AND draft_scope = ?')
        .run(userId, scope);
      return;
    }

    const queued = draft.queuedMessage === null ? [] : normalizeQueue(draft.queuedMessage);
    db.prepare(
      `INSERT INTO session_drafts (user_id, draft_scope, draft_text, queued_message, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, draft_scope) DO UPDATE SET
         draft_text = excluded.draft_text,
         queued_message = excluded.queued_message,
         updated_at = CURRENT_TIMESTAMP`
    ).run(
      userId,
      scope,
      draft.text,
      queued.length > 0 ? JSON.stringify(queued) : null,
    );
  },

  deleteDraft(userId: number, scope: string): void {
    const db = getConnection();
    db.prepare('DELETE FROM session_drafts WHERE user_id = ? AND draft_scope = ?')
      .run(userId, scope);
  },
};
