import assert from 'node:assert/strict';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

import type { NormalizedMessage } from '@/shared/types';

/**
 * A thought streamed live is stored under a different id by providers such as
 * Cursor. Left in place after the refresh, it outlived the turn and sorted by
 * its own clock against the persisted history around it.
 */

const sessionMessages = vi.fn();

vi.mock('@/shared/api', () => ({
  api: {
    providers: {
      sessionMessages: (...args: unknown[]) => sessionMessages(...args),
    },
  },
}));

const row = (id: string, fields: Partial<NormalizedMessage>): NormalizedMessage => ({
  id,
  provider: 'cursor',
  sessionId: 'session-1',
  timestamp: `2026-01-01T00:00:0${id}.000Z`,
  ...fields,
} as NormalizedMessage);

const HISTORY = [
  row('1', { kind: 'text', role: 'user', content: 'question' }),
  row('2', { kind: 'thinking', content: 'Let me check.' }),
  row('3', { kind: 'text', role: 'assistant', content: 'answer' }),
];

function respondWith(messages: NormalizedMessage[]) {
  sessionMessages.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { messages, total: messages.length, hasMore: false } }),
  });
}

beforeEach(() => {
  sessionMessages.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

describe('history refresh', () => {
  it('retires a live thought once the transcript holds the same thought', async () => {
    respondWith([HISTORY[0]]);
    const { useSessionStore } = await import('@/modules/chat/hooks/useSessionStore');
    const { result } = renderHook(() => useSessionStore());
    await act(async () => {
      await result.current.fetchFromServer('session-1', { limit: 20, offset: 0 });
    });

    act(() => {
      result.current.appendRealtime('session-1', row('live', {
        kind: 'thinking',
        content: 'Let me check.\n',
        timestamp: '2026-01-01T00:00:00.500Z',
      }));
    });

    respondWith(HISTORY);
    await act(async () => {
      await result.current.refreshLatestFromServer('session-1');
    });

    assert.deepEqual(
      result.current.getMessages('session-1').map((message) => message.content),
      ['question', 'Let me check.', 'answer'],
    );
  });
});
