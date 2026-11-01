import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  closeConnection,
  getConnection,
  initializeDatabase,
  sessionDraftsDb,
  userPreferencesDb,
} from '@/modules/database/index.js';

const USER_ID = 1;

async function withDatabase(runTest: () => void | Promise<void>): Promise<void> {
  const previousDatabasePath = process.env.DATABASE_PATH;
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'user-prefs-db-'));
  const databasePath = path.join(tempDirectory, 'auth.db');

  closeConnection();
  process.env.DATABASE_PATH = databasePath;
  await writeFile(databasePath, '');
  await initializeDatabase();

  // Both tables cascade from users(id), so a row has to exist to write against.
  getConnection()
    .prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)')
    .run(USER_ID, 'tester', 'hash');

  try {
    await runTest();
  } finally {
    closeConnection();
    if (previousDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = previousDatabasePath;
    }
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

test('preferences round-trip every JSON shape a setting can take', async () => {
  await withDatabase(() => {
    userPreferencesDb.savePreferences(USER_ID, {
      theme: 'dark',
      tasksEnabled: false,
      claudePermissions: { allowedTools: ['Read'], skipPermissions: true },
    });

    assert.deepEqual(userPreferencesDb.getPreferences(USER_ID), {
      theme: 'dark',
      tasksEnabled: false,
      claudePermissions: { allowedTools: ['Read'], skipPermissions: true },
    });
  });
});

test('saving preferences merge-patches instead of replacing the whole set', async () => {
  await withDatabase(() => {
    userPreferencesDb.savePreferences(USER_ID, { theme: 'dark', userLanguage: 'de' });
    userPreferencesDb.savePreferences(USER_ID, { theme: 'light' });

    assert.deepEqual(userPreferencesDb.getPreferences(USER_ID), {
      theme: 'light',
      userLanguage: 'de',
    });
  });
});

test('a preference set to undefined is removed', async () => {
  await withDatabase(() => {
    userPreferencesDb.savePreferences(USER_ID, { theme: 'dark', userLanguage: 'de' });
    userPreferencesDb.savePreferences(USER_ID, { userLanguage: undefined });

    assert.deepEqual(userPreferencesDb.getPreferences(USER_ID), { theme: 'dark' });
  });
});

test('one unreadable preference value does not cost the user the others', async () => {
  await withDatabase(() => {
    userPreferencesDb.savePreferences(USER_ID, { theme: 'dark' });
    getConnection()
      .prepare(
        `INSERT INTO user_preferences (user_id, preference_key, preference_value)
         VALUES (?, ?, ?)`
      )
      .run(USER_ID, 'broken', 'not json');

    assert.deepEqual(userPreferencesDb.getPreferences(USER_ID), { theme: 'dark' });
  });
});

test('drafts round-trip text and queued message per scope', async () => {
  await withDatabase(() => {
    sessionDraftsDb.saveDraft(USER_ID, 'session-a', { text: 'half typed', queuedMessage: null });
    sessionDraftsDb.saveDraft(USER_ID, 'project:p1', {
      text: '',
      queuedMessage: { content: 'run it' },
    });

    const drafts = sessionDraftsDb.getDrafts(USER_ID);
    const byScope = new Map(drafts.map((draft) => [draft.scope, draft]));

    assert.equal(byScope.get('session-a')?.text, 'half typed');
    assert.deepEqual(byScope.get('session-a')?.queuedMessages, []);
    assert.equal(byScope.get('project:p1')?.text, '');
    assert.deepEqual(byScope.get('project:p1')?.queuedMessages.map((message) => message.content), ['run it']);
  });
});

test('saving an empty draft deletes the row rather than keeping a blank one', async () => {
  await withDatabase(() => {
    sessionDraftsDb.saveDraft(USER_ID, 'session-a', { text: 'typed', queuedMessage: null });
    sessionDraftsDb.saveDraft(USER_ID, 'session-a', { text: '', queuedMessage: null });

    assert.deepEqual(sessionDraftsDb.getDrafts(USER_ID), []);
  });
});

test('deleteDraft removes only the named scope', async () => {
  await withDatabase(() => {
    sessionDraftsDb.saveDraft(USER_ID, 'session-a', { text: 'a', queuedMessage: null });
    sessionDraftsDb.saveDraft(USER_ID, 'session-b', { text: 'b', queuedMessage: null });

    sessionDraftsDb.deleteDraft(USER_ID, 'session-a');

    assert.deepEqual(
      sessionDraftsDb.getDrafts(USER_ID).map((draft) => draft.scope),
      ['session-b'],
    );
  });
});

const queuedIn = (scope: string) => (
  sessionDraftsDb.getDrafts(USER_ID).find((draft) => draft.scope === scope)?.queuedMessages ?? []
);

const queuedContents = (scope: string) => queuedIn(scope).map((message) => message.content);

// What the dispatcher holds after listing a scope's queued message.
const claimCandidate = (scope: string) => {
  const row = getConnection()
    .prepare('SELECT queued_message FROM session_drafts WHERE user_id = ? AND draft_scope = ?')
    .get(USER_ID, scope) as { queued_message: string };
  const parsed = JSON.parse(row.queued_message) as unknown;
  const head = Array.isArray(parsed) ? parsed[0] : parsed;
  return {
    userId: USER_ID,
    sessionId: scope,
    queuedMessage: head,
    claimToken: row.queued_message,
  };
};

test('follow-ups queued while one waits are kept as separate turns, in order', async () => {
  await withDatabase(() => {
    sessionDraftsDb.saveDraftText(USER_ID, 'session-a', 'still typing');

    const first = sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', {
      content: 'A', options: { model: 'sonnet' }, attachments: [{ name: 'a.png' }],
    });
    const second = sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', {
      content: 'B', attachments: [],
    });
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', {
      content: 'C', options: { model: 'opus' }, attachments: [{ name: 'c.txt' }],
    });

    assert.equal(first.queuedMessages.length, 1);
    assert.equal(second.queuedMessages.length, 2);
    assert.deepEqual(queuedContents('session-a'), ['A', 'B', 'C']);
    assert.deepEqual(queuedIn('session-a').map((message) => message.options?.model ?? null), ['sonnet', null, 'opus']);
    assert.deepEqual(queuedIn('session-a').flatMap((message) => message.attachments), [{ name: 'a.png' }, { name: 'c.txt' }]);
    assert.equal(sessionDraftsDb.getDrafts(USER_ID)[0]?.text, 'still typing', 'the draft text is untouched');

    const firstId = first.queuedMessages[0]?.id ?? '';
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', {
      id: firstId,
      content: 'A revised',
      options: { model: 'sonnet' },
      attachments: [{ name: 'a.png' }],
    });
    assert.deepEqual(queuedContents('session-a'), ['A revised', 'B', 'C'], 'an edit replaces that turn and leaves the others');
    assert.equal(queuedIn('session-a')[0]?.id, firstId);
  });
});

test('a follow-up queued after the dispatcher claimed the waiting message is queued on its own', async () => {
  await withDatabase(() => {
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'A', attachments: [] });
    assert.equal(sessionDraftsDb.claimQueuedMessage(claimCandidate('session-a')), true);

    const result = sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'B', attachments: [] });

    assert.deepEqual(result.queuedMessages.map((message) => message.content), ['B']);
    assert.deepEqual(queuedContents('session-a'), ['B'], 'A is not sent a second time');
  });
});

test('a claim listed before a follow-up was appended no longer matches, so it is not sent short', async () => {
  await withDatabase(() => {
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'A', attachments: [] });
    const listedBeforeB = claimCandidate('session-a');
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'B', attachments: [] });

    assert.equal(sessionDraftsDb.claimQueuedMessage(listedBeforeB), false);
    assert.deepEqual(queuedContents('session-a'), ['A', 'B']);
  });
});

test('saving draft text leaves the queued message alone and keeps the row while it waits', async () => {
  await withDatabase(() => {
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'A', attachments: [] });

    sessionDraftsDb.saveDraftText(USER_ID, 'session-a', 'typing the next one');
    assert.deepEqual(queuedContents('session-a'), ['A']);

    sessionDraftsDb.saveDraftText(USER_ID, 'session-a', '');
    assert.deepEqual(queuedContents('session-a'), ['A']);

    // After a claim, a text save must not bring the sent message back.
    assert.equal(sessionDraftsDb.claimQueuedMessage(claimCandidate('session-a')), true);
    sessionDraftsDb.saveDraftText(USER_ID, 'session-a', 'x');
    assert.deepEqual(queuedIn('session-a'), []);

    // And once nothing is left, the row goes.
    sessionDraftsDb.saveDraftText(USER_ID, 'session-a', '');
    assert.deepEqual(sessionDraftsDb.getDrafts(USER_ID), []);
  });
});

test('clearing the queued message keeps the draft text, and drops an emptied row', async () => {
  await withDatabase(() => {
    sessionDraftsDb.saveDraftText(USER_ID, 'session-a', 'keep me');
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'A', attachments: [] });
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-b', { content: 'B', attachments: [] });

    sessionDraftsDb.clearQueuedMessage(USER_ID, 'session-a');
    sessionDraftsDb.clearQueuedMessage(USER_ID, 'session-b');

    assert.deepEqual(
      sessionDraftsDb.getDrafts(USER_ID).map((draft) => [draft.scope, draft.text, draft.queuedMessages]),
      [['session-a', 'keep me', []]],
    );
  });
});

test('a slash command is queued as its own later turn, in either order', async () => {
  await withDatabase(() => {
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'fix the test', attachments: [] });
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: '/compact', attachments: [] });
    assert.deepEqual(queuedContents('session-a'), ['fix the test', '/compact']);

    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-b', { content: '  /review src', attachments: [] });
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-b', { content: 'then fix it', attachments: [] });
    assert.deepEqual(queuedContents('session-b'), ['  /review src', 'then fix it']);
  });
});

test('a claim restored after losing a race goes back in front of a follow-up queued meanwhile', async () => {
  await withDatabase(() => {
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'A', attachments: [{ name: 'a.png' }] });
    const claimed = claimCandidate('session-a');
    assert.equal(sessionDraftsDb.claimQueuedMessage(claimed), true);
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'B', options: { model: 'opus' }, attachments: [] });

    sessionDraftsDb.restoreQueuedMessage(claimed);

    assert.deepEqual(queuedIn('session-a').map((message) => ({
      content: message.content,
      options: message.options ?? null,
      attachments: message.attachments,
    })), [
      { content: 'A', options: null, attachments: [{ name: 'a.png' }] },
      { content: 'B', options: { model: 'opus' }, attachments: [] },
    ]);
  });
});

test('an attachments-only message stays its own turn ahead of a later text', async () => {
  await withDatabase(() => {
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: '', attachments: [{ name: 'a.png' }] });

    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'B', attachments: [] });

    assert.deepEqual(queuedIn('session-a').map((message) => ({
      content: message.content,
      attachments: message.attachments,
    })), [
      { content: '', attachments: [{ name: 'a.png' }] },
      { content: 'B', attachments: [] },
    ]);
  });
});

test('a claim restored after its emptied row was removed is written back', async () => {
  await withDatabase(() => {
    sessionDraftsDb.appendQueuedMessage(USER_ID, 'session-a', { content: 'A', attachments: [] });
    const claimed = claimCandidate('session-a');
    assert.equal(sessionDraftsDb.claimQueuedMessage(claimed), true);
    sessionDraftsDb.deleteEmptyDraft(USER_ID, 'session-a');
    assert.deepEqual(sessionDraftsDb.getDrafts(USER_ID), []);

    sessionDraftsDb.restoreQueuedMessage(claimed);

    const restored = queuedIn('session-a');
    assert.deepEqual(restored.map(({ content, attachments }) => ({ content, attachments })), [
      { content: 'A', attachments: [] },
    ]);
    assert.equal(typeof restored[0]?.id, 'string');
  });
});
