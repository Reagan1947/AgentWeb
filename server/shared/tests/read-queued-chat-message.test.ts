import assert from 'node:assert/strict';
import test from 'node:test';

import { readQueuedChatMessage, readQueuedChatMessages } from '@/shared/utils.js';

test('a stored queued message is read with its text, options and attachments', () => {
  assert.deepEqual(
    readQueuedChatMessage({ content: 'A', options: { model: 'opus' }, attachments: [{ name: 'a.png' }] }),
    { content: 'A', options: { model: 'opus' }, attachments: [{ name: 'a.png' }] },
  );
});

test('legacy image-only descriptors are read as attachments', () => {
  assert.deepEqual(
    readQueuedChatMessage({ content: '', images: [{ name: 'shot.png' }] }),
    { content: '', attachments: [{ name: 'shot.png' }] },
  );
});

test('options that are not a plain object are dropped', () => {
  assert.deepEqual(readQueuedChatMessage({ content: 'A', options: ['plan'] }), { content: 'A', attachments: [] });
});

test('a message with nothing to send reads as absent', () => {
  assert.equal(readQueuedChatMessage({ content: '  ', attachments: [] }), null);
  assert.equal(readQueuedChatMessage(null), null);
  assert.equal(readQueuedChatMessage(['A']), null);
});

test('a queue is an ordered list, and a legacy single message is a one-entry queue', () => {
  assert.deepEqual(readQueuedChatMessages([
    { id: 'a', content: 'A', attachments: [] },
    { content: '  ', attachments: [] },
    { id: 'b', content: 'B', options: { model: 'opus' }, attachments: [{ name: 'b.txt' }] },
  ]), [
    { id: 'a', content: 'A', attachments: [] },
    { id: 'b', content: 'B', options: { model: 'opus' }, attachments: [{ name: 'b.txt' }] },
  ]);
  assert.deepEqual(
    readQueuedChatMessages({ content: 'only', attachments: [] }),
    [{ content: 'only', attachments: [] }],
  );
  assert.deepEqual(readQueuedChatMessages(null), []);
});
