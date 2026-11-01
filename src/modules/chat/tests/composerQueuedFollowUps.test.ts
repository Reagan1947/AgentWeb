import assert from 'node:assert/strict';

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, test, vi } from 'vitest';

import { useChatComposerState } from '@/modules/chat/hooks/useChatComposerState';
import { readDraftText, resetChatDrafts, writeDraftText } from '@/shared/chatDrafts';
import type { BackgroundSendChoice, ChatMessage, PermissionMode, Project, ProjectSession, SessionActivityMap } from '@/shared/types';

/**
 * Follow-ups submitted while a turn runs are each their own queued turn.
 * They used to be joined into one prompt; every accepted follow-up must now
 * stay a separate entry, in order, and the queue must show each of them.
 *
 * The server is faked at the HTTP boundary with the drafts contract the real
 * server implements, so these tests see what would be stored in
 * `session_drafts.queued_message` (what the dispatcher sends), not only what
 * the rows render.
 */

type StoredQueued = { id: string; content: string; options?: Record<string, unknown>; attachments: unknown[] };
type StoredDraft = { text: string; queuedMessages: StoredQueued[] };

const PROJECT: Project = { projectId: 'project-1', displayName: 'Project One', fullPath: '/tmp/project-one' };
const SESSION_1: ProjectSession = { id: 'session-1' };
const SESSION_2: ProjectSession = { id: 'session-2' };

let server: Map<string, StoredDraft>;
let refuseQueueing = false;
// Held open by a test to keep an upload in flight (e.g. across a session switch).
let uploadGate: Promise<void> | null = null;
// Held open by a test to keep an append's response in flight. The server has
// already applied the append by then, as a real one would before answering.
let appendGate: Promise<void> | null = null;
// Held open by a test to keep a clear from reaching the store, as a request
// that took a slower connection would.
let clearGate: Promise<void> | null = null;
let appendRequestCount = 0;
let nextQueuedId = 1;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const dropIfEmpty = (scope: string) => {
  const draft = server.get(scope);
  if (draft && !draft.text && draft.queuedMessages.length === 0) {
    server.delete(scope);
  }
};

// The drafts endpoints, as the server implements them.
const fakeServer = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const path = String(url);
  const method = init?.method ?? 'GET';
  const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
  const scope = String(body.scope ?? '');

  if (path.includes('/api/assets/files')) {
    await uploadGate;
    const form = init?.body instanceof FormData ? init.body : new FormData();
    const files = form.getAll('files') as File[];
    return json({ attachments: files.map((file) => ({ name: file.name, path: `/uploads/${file.name}` })) });
  }

  if (path.endsWith('/api/user/drafts/queued-message')) {
    if (method === 'POST') {
      appendRequestCount += 1;
      if (refuseQueueing) {
        await appendGate;
        return json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
      }
      const message = body.queuedMessage as StoredQueued;
      const current = server.get(scope) ?? { text: '', queuedMessages: [] };
      const existingAt = typeof message.id === 'string'
        ? current.queuedMessages.findIndex((entry) => entry.id === message.id)
        : -1;
      if (existingAt >= 0 && typeof message.id === 'string') {
        const queuedMessages = current.queuedMessages.slice();
        queuedMessages[existingAt] = {
          id: message.id,
          content: message.content,
          options: message.options ?? current.queuedMessages[existingAt]?.options,
          attachments: message.attachments ?? [],
        };
        server.set(scope, { ...current, queuedMessages });
        await appendGate;
        return json({ success: true, queuedMessages });
      }
      const id = typeof message.id === 'string' && message.id
        ? message.id
        : `q${nextQueuedId++}`;
      const entry: StoredQueued = {
        id,
        content: message.content,
        options: message.options,
        attachments: message.attachments ?? [],
      };
      const queuedMessages = current.queuedMessages.slice();
      const index = typeof body.index === 'number' ? body.index : queuedMessages.length;
      queuedMessages.splice(Math.max(0, Math.min(index, queuedMessages.length)), 0, entry);
      server.set(scope, { ...current, queuedMessages });
      await appendGate;
      return json({ success: true, queuedMessages });
    }
    if (method === 'DELETE') {
      await clearGate;
      const current = server.get(scope);
      if (current) {
        const id = typeof body.id === 'string' ? body.id : '';
        server.set(scope, {
          ...current,
          queuedMessages: id ? current.queuedMessages.filter((entry) => entry.id !== id) : [],
        });
        dropIfEmpty(scope);
      }
      return json({ success: true });
    }
  }

  if (path.endsWith('/api/user/drafts')) {
    if (method === 'GET') {
      return json({ success: true, drafts: [...server].map(([draftScope, draft]) => ({ scope: draftScope, ...draft })) });
    }
    if (method === 'PUT') {
      const text = typeof body.text === 'string' ? body.text : '';
      const current = server.get(scope) ?? { text: '', queuedMessages: [] };
      server.set(scope, body.queuedMessage === undefined
        ? { ...current, text }
        : { text, queuedMessages: [] });
      dropIfEmpty(scope);
      return json({ success: true });
    }
    if (method === 'DELETE') {
      server.delete(scope);
      return json({ success: true });
    }
  }

  return json([]);
};

// What the server's dispatcher does when the session goes idle: take the
// queued message off the queue to send it.
const dispatcherClaims = (scope: string): StoredQueued | null => {
  const draft = server.get(scope);
  const claimed = draft?.queuedMessages[0] ?? null;
  if (draft) {
    server.set(scope, { ...draft, queuedMessages: draft.queuedMessages.slice(1) });
    dropIfEmpty(scope);
  }
  return claimed;
};

type Props = {
  session: ProjectSession;
  isLoading: boolean;
  model: string;
  processingSessions?: SessionActivityMap;
};

const render = (initialProps: Partial<Props> = {}) => {
  const errors: ChatMessage[] = [];
  const view = renderHook(
    ({ session, isLoading, model, processingSessions }: Props) => useChatComposerState({
      selectedProject: PROJECT,
      selectedSession: session,
      currentSessionId: session.id ?? null,
      provider: 'claude',
      permissionMode: 'default',
      cyclePermissionMode: () => undefined,
      resolvePermissionModeForProvider: () => 'default' as PermissionMode,
      currentProviderModel: model,
      currentProviderEffort: 'medium',
      isLoading,
      processingSessions,
      canAbortSession: false,
      tokenBudget: null,
      sendMessage: () => undefined,
      scrollToBottom: () => undefined,
      addMessage: (message) => {
        if (message.type === 'error') errors.push(message);
      },
      setIsUserScrolledUp: () => undefined,
      setPendingPermissionRequests: () => undefined,
    }),
    { initialProps: { session: SESSION_1, isLoading: true, model: 'model-1', ...initialProps } },
  );
  return { view, errors };
};

type View = ReturnType<typeof render>['view'];

const submit = async (view: View, text: string, files: File[] = []) => {
  await act(async () => {
    view.result.current.setInput(text);
    view.result.current.setAttachedFiles(files);
  });
  await act(async () => {
    await view.result.current.handleSubmit({ preventDefault: () => undefined } as never);
  });
};

const queuedOnServer = (scope = 'session-1') => server.get(scope)?.queuedMessages ?? [];
const queuedContents = (scope = 'session-1') => queuedOnServer(scope).map((message) => message.content);

const hold = () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  return { gate, release };
};

// Presses Enter without waiting for the submit to finish.
const startSubmit = (view: View) => {
  let pending!: Promise<void>;
  act(() => {
    pending = view.result.current.handleSubmit({ preventDefault: () => undefined } as never);
  });
  return pending;
};

beforeEach(() => {
  server = new Map();
  refuseQueueing = false;
  uploadGate = null;
  appendGate = null;
  clearGate = null;
  appendRequestCount = 0;
  nextQueuedId = 1;
  resetChatDrafts();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(fakeServer));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetChatDrafts();
  localStorage.clear();
});

test('follow-ups A, B and C queued during one turn are all kept, in order, and the card shows them all', async () => {
  const { view } = render();

  await submit(view, 'follow-up A');
  await submit(view, 'follow-up B', [new File(['b'], 'b.txt', { type: 'text/plain' })]);
  view.rerender({ session: SESSION_1, isLoading: true, model: 'model-2' });
  await submit(view, 'follow-up C');

  assert.deepEqual(queuedContents(), ['follow-up A', 'follow-up B', 'follow-up C'], 'all three will be sent, in order, as their own turns');
  assert.deepEqual(queuedOnServer()[1]?.attachments, [{ name: 'b.txt', path: '/uploads/b.txt' }]);
  assert.equal(queuedOnServer()[0]?.options?.model, 'model-1');
  assert.equal(queuedOnServer()[2]?.options?.model, 'model-2', 'each turn keeps the options it was queued with');
  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['follow-up A', 'follow-up B', 'follow-up C']);
  assert.equal(view.result.current.queuedDrafts[1]?.attachments.length, 1);
  assert.equal(view.result.current.input, '');
});

test('a follow-up queued after the server sent the waiting one is queued alone, so nothing is sent twice', async () => {
  const { view } = render();
  await submit(view, 'follow-up A');

  // The turn ended and the dispatcher took A, before this page heard about it.
  assert.equal(dispatcherClaims('session-1')?.content, 'follow-up A');
  assert.equal(view.result.current.queuedDrafts[0]?.content, 'follow-up A', 'the row has not caught up yet');

  await submit(view, 'follow-up B');

  assert.deepEqual(queuedContents(), ['follow-up B']);
  assert.equal(view.result.current.queuedDrafts[0]?.content, 'follow-up B', 'the row shows what will be sent');
});

test('typing after the server sent the queued message does not bring it back', async () => {
  const { view } = render();
  await submit(view, 'follow-up A');
  dispatcherClaims('session-1');

  // The user keeps writing the next follow-up; the text save is debounced.
  await act(async () => { view.result.current.setInput('still writing the next one'); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1_300)); });

  assert.equal(server.get('session-1')?.text, 'still writing the next one', 'the text was saved');
  assert.deepEqual(queuedOnServer(), [], 'and A, already sent, is not queued again');
});

test('queueing behind background work adds to a message already waiting there', async () => {
  const background: SessionActivityMap = new Map([[
    'session-1',
    { statusText: null, canInterrupt: false, startedAt: 1, background: true, tasks: [] },
  ]]);
  const { view } = render({ isLoading: false, processingSessions: background });

  const queueBehindWork = async (text: string) => {
    await act(async () => { view.result.current.setInput(text); });
    let pending!: Promise<void>;
    act(() => {
      pending = view.result.current.handleSubmit({ preventDefault: () => undefined } as never);
    });
    await waitFor(() => assert.notEqual(view.result.current.backgroundSendPrompt, null));
    await act(async () => {
      view.result.current.resolveBackgroundSendPrompt('queue' as BackgroundSendChoice);
      await pending;
    });
  };

  await queueBehindWork('after the job: A');
  await queueBehindWork('after the job: B');

  assert.deepEqual(queuedContents(), ['after the job: A', 'after the job: B']);
  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['after the job: A', 'after the job: B']);
});

test('editing one queued turn brings that turn back and leaves the others queued', async () => {
  const fileA = new File(['a'], 'a.txt', { type: 'text/plain' });
  const fileB = new File(['b'], 'b.txt', { type: 'text/plain' });
  const { view } = render();
  await submit(view, 'follow-up A', [fileA]);
  await submit(view, 'follow-up B', [fileB]);

  const firstId = view.result.current.queuedDrafts[0]?.id ?? '';
  await act(async () => { view.result.current.editQueuedDraft(firstId); });

  assert.equal(view.result.current.input, 'follow-up A');
  assert.deepEqual(view.result.current.attachedFiles.map((file) => file.name), ['a.txt']);
  assert.equal(view.result.current.isEditingQueuedDraft, true);
  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['follow-up A', 'follow-up B']);
  await waitFor(() => assert.deepEqual(queuedContents(), ['follow-up A', 'follow-up B']));
});

test('cancelling an edit puts that turn back and clears the composer', async () => {
  const { view } = render();
  await submit(view, 'follow-up A');
  await submit(view, 'follow-up B');

  const firstId = view.result.current.queuedDrafts[0]?.id ?? '';
  await act(async () => { view.result.current.editQueuedDraft(firstId); });
  await act(async () => { view.result.current.setInput('rewritten'); });
  await act(async () => { view.result.current.cancelQueuedEdit(); });

  assert.equal(view.result.current.input, '');
  assert.equal(view.result.current.isEditingQueuedDraft, false);
  await waitFor(() => assert.deepEqual(queuedContents(), ['follow-up A', 'follow-up B']));
});

test('deleting one queued turn leaves the others', async () => {
  const { view } = render();
  await submit(view, 'follow-up A');
  await submit(view, 'follow-up B');

  const firstId = view.result.current.queuedDrafts[0]?.id ?? '';
  await act(async () => { view.result.current.deleteQueuedDraft(firstId); });

  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['follow-up B']);
  await waitFor(() => assert.deepEqual(queuedContents(), ['follow-up B']));
});

test('a message queued from another tab is kept and shown when this tab queues one', async () => {
  // Another tab (or this page before a reload) queued A; this page has not heard of it.
  server.set('session-1', {
    text: '',
    queuedMessages: [{ id: 'other', content: 'from the other tab', attachments: [] }],
  });
  const { view } = render();

  await submit(view, 'from this tab');

  assert.deepEqual(queuedContents(), ['from the other tab', 'from this tab']);
  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['from the other tab', 'from this tab']);
});

test('the card follows the server when another tab adds to the queued message', async () => {
  const { view } = render();
  await submit(view, 'follow-up A');
  server.set('session-1', {
    text: '',
    queuedMessages: [
      { id: 'a', content: 'follow-up A', attachments: [] },
      { id: 'other', content: 'from the other tab', attachments: [] },
    ],
  });

  // The rows re-read the server every 5 s while they are shown.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5_300)); });

  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['follow-up A', 'from the other tab']);
}, 10_000);

test('a follow-up the server does not accept stays in the composer, with an error, and no card', async () => {
  const { view, errors } = render();
  refuseQueueing = true;

  await submit(view, 'follow-up A');

  assert.equal(view.result.current.input, 'follow-up A', 'the message is kept for another try');
  assert.deepEqual(view.result.current.queuedDrafts, [], 'no row for a message nothing will send');
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.content, 'Failed to queue message: Internal server error', 'what the server said');
});

test('a slash command is queued as its own turn after the message already waiting', async () => {
  const { view, errors } = render();
  await submit(view, 'fix the failing test');

  await submit(view, '/compact');

  assert.deepEqual(queuedContents(), ['fix the failing test', '/compact']);
  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['fix the failing test', '/compact']);
  assert.equal(view.result.current.input, '');
  assert.equal(errors.length, 0);
});

test('switching sessions during the upload still queues the follow-up behind the earlier one', async () => {
  const { view } = render();
  await submit(view, 'follow-up A');

  let releaseUpload!: () => void;
  uploadGate = new Promise((resolve) => { releaseUpload = resolve; });
  await act(async () => {
    view.result.current.setInput('follow-up B');
    view.result.current.setAttachedFiles([new File(['b'], 'b.txt', { type: 'text/plain' })]);
  });
  let pending!: Promise<void>;
  act(() => {
    pending = view.result.current.handleSubmit({ preventDefault: () => undefined } as never);
  });
  view.rerender({ session: SESSION_2, isLoading: true, model: 'model-1' });
  await act(async () => {
    releaseUpload();
    await pending;
  });

  assert.deepEqual(queuedContents('session-1'), ['follow-up A', 'follow-up B']);
  assert.deepEqual(view.result.current.queuedDrafts, [], 'the session now open has no rows of its own');
  assert.equal(readDraftText('session-1'), '', 'and going back will not offer B to be queued again');
});

test('what the user types while a follow-up is being queued stays in the composer', async () => {
  const { view } = render();
  const response = hold();
  appendGate = response.gate;

  await act(async () => { view.result.current.setInput('follow-up A'); });
  const pending = startSubmit(view);
  await waitFor(() => assert.equal(appendRequestCount, 1));
  assert.equal(view.result.current.input, '', 'the composer empties when the message is taken');

  // The next follow-up, typed before the server has answered.
  await act(async () => { view.result.current.setInput('the next one, typed meanwhile'); });
  await act(async () => {
    response.release();
    await pending;
  });

  assert.equal(view.result.current.input, 'the next one, typed meanwhile');
  assert.equal(readDraftText('session-1'), 'the next one, typed meanwhile');
  assert.deepEqual(queuedContents(), ['follow-up A']);
  assert.equal(view.result.current.queuedDrafts[0]?.content, 'follow-up A');
});

test('a follow-up the server refuses goes back in front of what was typed meanwhile', async () => {
  const fileA = new File(['a'], 'a.txt', { type: 'text/plain' });
  const fileC = new File(['c'], 'c.txt', { type: 'text/plain' });
  const { view, errors } = render();
  refuseQueueing = true;
  const response = hold();
  appendGate = response.gate;

  await act(async () => {
    view.result.current.setInput('follow-up A');
    view.result.current.setAttachedFiles([fileA]);
  });
  const pending = startSubmit(view);
  await waitFor(() => assert.equal(appendRequestCount, 1));
  await act(async () => {
    view.result.current.setInput('more');
    view.result.current.setAttachedFiles([fileC]);
  });
  await act(async () => {
    response.release();
    await pending;
  });

  assert.equal(view.result.current.input, 'follow-up A\n\nmore');
  assert.deepEqual(view.result.current.attachedFiles.map((file) => file.name), ['a.txt', 'c.txt']);
  assert.deepEqual(view.result.current.queuedDrafts, []);
  assert.equal(errors.length, 1);
});

test('Enter pressed again while a follow-up is being queued neither sends it twice nor drops the next one', async () => {
  const { view } = render();
  const response = hold();
  appendGate = response.gate;

  await act(async () => { view.result.current.setInput('follow-up A'); });
  const first = startSubmit(view);
  await waitFor(() => assert.equal(appendRequestCount, 1));
  const again = startSubmit(view);
  await act(async () => { view.result.current.setInput('follow-up B'); });
  const next = startSubmit(view);
  await act(async () => {
    response.release();
    await Promise.all([first, again, next]);
  });

  const queued = queuedContents().join('|');
  const kept = view.result.current.input;
  assert.ok(
    (queued === 'follow-up A' && kept === 'follow-up B')
      || (queued === 'follow-up A|follow-up B' && kept === ''),
    `A is queued once and B is either queued after it or still in the composer (queued ${JSON.stringify(queued)}, composer ${JSON.stringify(kept)})`,
  );
});

test('Enter pressed while a refused follow-up is still being answered keeps both, in the order they were typed', async () => {
  const { view, errors } = render();
  refuseQueueing = true;
  const response = hold();
  appendGate = response.gate;

  await act(async () => { view.result.current.setInput('follow-up A'); });
  const first = startSubmit(view);
  await waitFor(() => assert.equal(appendRequestCount, 1));
  await act(async () => { view.result.current.setInput('follow-up B'); });
  const next = startSubmit(view);
  await act(async () => {
    response.release();
    await Promise.all([first, next]);
  });

  assert.equal(view.result.current.input, 'follow-up A\n\nfollow-up B', 'B waits in the composer, behind A');
  assert.equal(appendRequestCount, 1, 'B is not sent while A is still being answered');
  assert.equal(errors.length, 1);
  assert.deepEqual(queuedOnServer(), []);
});

test('Enter while editing writes that turn back in place and does not send it', async () => {
  const { view } = render();
  await submit(view, 'follow-up A');
  await submit(view, 'follow-up B');

  const firstId = view.result.current.queuedDrafts[0]?.id ?? '';
  await act(async () => { view.result.current.editQueuedDraft(firstId); });
  await act(async () => { view.result.current.setInput('follow-up A, revised'); });
  await act(async () => {
    await view.result.current.handleSubmit({ preventDefault: () => undefined } as never);
  });

  assert.equal(view.result.current.input, '');
  assert.equal(view.result.current.isEditingQueuedDraft, false);
  assert.deepEqual(queuedContents(), ['follow-up A, revised', 'follow-up B']);
  assert.equal(queuedOnServer()[0]?.id, firstId);
  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['follow-up A, revised', 'follow-up B']);
});

test('Edit used while a follow-up is being queued takes back only the message it showed', async () => {
  const { view } = render();
  await submit(view, 'follow-up A');

  const response = hold();
  appendGate = response.gate;
  await act(async () => { view.result.current.setInput('follow-up B'); });
  const pending = startSubmit(view);
  // The server has appended B, but this page has not heard back yet.
  await waitFor(() => assert.deepEqual(queuedContents(), ['follow-up A', 'follow-up B']));
  const firstId = view.result.current.queuedDrafts[0]?.id ?? '';
  await act(async () => { view.result.current.editQueuedDraft(firstId); });
  await act(async () => {
    response.release();
    await pending;
  });

  assert.equal(view.result.current.input, 'follow-up A', 'A is in the composer to edit, and still queued');
  await waitFor(() => assert.deepEqual(queuedContents(), ['follow-up A', 'follow-up B']));
  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['follow-up A', 'follow-up B']);
});

test('Edit after another tab queued its own turn still brings back this tab\'s files', async () => {
  const fileA = new File(['a'], 'a.txt', { type: 'text/plain' });
  const { view } = render();
  await submit(view, 'follow-up A', [fileA]);
  const ownId = view.result.current.queuedDrafts[0]?.id ?? '';
  server.set('session-1', {
    text: '',
    queuedMessages: [
      { id: ownId, content: 'follow-up A', attachments: [{ name: 'a.txt', path: '/uploads/a.txt' }] },
      { id: 'other', content: 'from the other tab', attachments: [{ name: 'x.txt', path: '/uploads/x.txt' }] },
    ],
  });

  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5_300)); });
  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['follow-up A', 'from the other tab']);
  await act(async () => { view.result.current.editQueuedDraft(ownId); });

  assert.equal(view.result.current.input, 'follow-up A');
  assert.deepEqual(view.result.current.attachedFiles.map((file) => file.name), ['a.txt']);
  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['follow-up A', 'from the other tab']);
}, 10_000);

test('a tab that is shown again catches up with the queue at once', async () => {
  const { view } = render();
  await submit(view, 'follow-up A');
  server.set('session-1', {
    text: '',
    queuedMessages: [
      { id: 'a', content: 'follow-up A', attachments: [] },
      { id: 'other', content: 'from the other tab', attachments: [] },
    ],
  });

  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });

  await waitFor(
    () => assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['follow-up A', 'from the other tab']),
    { timeout: 1_000 },
  );
});

test('files of a message already sent do not come back with a follow-up queued after it', async () => {
  const fileA = new File(['a'], 'a.txt', { type: 'text/plain' });
  const fileB = new File(['b'], 'b.txt', { type: 'text/plain' });
  const { view } = render();
  await submit(view, 'follow-up A', [fileA]);
  // The dispatcher sent A; another tab then queued the same text again, without the file.
  dispatcherClaims('session-1');
  server.set('session-1', {
    text: '',
    queuedMessages: [{ id: 'again', content: 'follow-up A', attachments: [] }],
  });

  await submit(view, 'follow-up B', [fileB]);

  assert.deepEqual(view.result.current.queuedDrafts.map((draft) => draft.content), ['follow-up A', 'follow-up B']);
  assert.deepEqual(view.result.current.queuedDrafts[1]?.attachments.map((file) => file.name), ['b.txt']);
  assert.deepEqual(view.result.current.queuedDrafts[0]?.attachments, []);
});

test('a refused follow-up goes back to the session it was typed in, after a switch during the upload', async () => {
  const { view, errors } = render();
  refuseQueueing = true;
  const upload = hold();
  uploadGate = upload.gate;
  await act(async () => {
    view.result.current.setInput('follow-up B');
    view.result.current.setAttachedFiles([new File(['b'], 'b.txt', { type: 'text/plain' })]);
  });
  const pending = startSubmit(view);
  view.rerender({ session: SESSION_2, isLoading: true, model: 'model-1' });
  await act(async () => {
    upload.release();
    await pending;
  });

  assert.equal(errors.length, 1);
  assert.equal(readDraftText('session-1'), 'follow-up B', 'it is waiting there to be sent again');
  assert.equal(view.result.current.input, '', 'and not in the composer of the session now open');
});

test('a follow-up refused after a switch made while it was being queued goes back to the session it was typed in', async () => {
  const { view, errors } = render();
  refuseQueueing = true;
  const response = hold();
  appendGate = response.gate;
  await act(async () => { view.result.current.setInput('follow-up A'); });
  const pending = startSubmit(view);
  await waitFor(() => assert.equal(appendRequestCount, 1));
  view.rerender({ session: SESSION_2, isLoading: true, model: 'model-1' });
  await act(async () => { view.result.current.setInput('typed in session 2'); });
  await act(async () => {
    response.release();
    await pending;
  });

  assert.equal(errors.length, 1);
  assert.equal(readDraftText('session-1'), 'follow-up A', 'it is waiting there to be sent again');
  assert.equal(view.result.current.input, 'typed in session 2', 'the composer now open is left alone');
  assert.equal(readDraftText('session-2'), 'typed in session 2');
});

test('a follow-up refused after a switch keeps the draft written meanwhile in the session it was typed in', async () => {
  const { view, errors } = render();
  refuseQueueing = true;
  const response = hold();
  appendGate = response.gate;
  await act(async () => { view.result.current.setInput('follow-up A'); });
  const pending = startSubmit(view);
  await waitFor(() => assert.equal(appendRequestCount, 1));
  view.rerender({ session: SESSION_2, isLoading: true, model: 'model-1' });
  // Another device changed that session's draft meanwhile.
  writeDraftText('session-1', 'written on the laptop');
  await act(async () => {
    response.release();
    await pending;
  });

  assert.equal(errors.length, 1);
  assert.equal(readDraftText('session-1'), 'follow-up A\n\nwritten on the laptop', 'both are kept, the refused one first');
});

test('a session switch during the upload keeps a draft that changed in the session left', async () => {
  const { view } = render();
  const upload = hold();
  uploadGate = upload.gate;
  await act(async () => {
    view.result.current.setInput('follow-up B');
    view.result.current.setAttachedFiles([new File(['b'], 'b.txt', { type: 'text/plain' })]);
  });
  const pending = startSubmit(view);
  view.rerender({ session: SESSION_2, isLoading: true, model: 'model-1' });
  // Another device changed that session's draft meanwhile.
  writeDraftText('session-1', 'written on the laptop');
  await act(async () => {
    upload.release();
    await pending;
  });

  assert.deepEqual(queuedContents('session-1'), ['follow-up B']);
  assert.equal(readDraftText('session-1'), 'written on the laptop');
});
