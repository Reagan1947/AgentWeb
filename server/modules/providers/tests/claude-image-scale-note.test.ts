import assert from 'node:assert/strict';
import test from 'node:test';

import { ClaudeSessionsProvider } from '@/modules/providers/list/claude/claude-sessions.provider.js';

const provider = new ClaudeSessionsProvider();
const SESSION_ID = 'claude-image-scale-note-1';

const NOTE =
  '[Image: original 2360x2340, displayed at 1932x1916. Multiply coordinates by 1.22 to map to original image.]';

test('a user turn that is only an image scale note produces no message', () => {
  const messages = provider.normalizeMessage({
    type: 'user',
    uuid: 'img-note-1',
    timestamp: '2026-11-01T15:49:04.778Z',
    message: { role: 'user', content: NOTE },
  }, SESSION_ID);

  assert.deepEqual(messages, []);
});

test('an image scale note in front of a prompt leaves the prompt', () => {
  const [row, ...rest] = provider.normalizeMessage({
    type: 'user',
    uuid: 'img-note-2',
    timestamp: '2026-11-01T15:49:04.778Z',
    message: { role: 'user', content: `${NOTE}\nlook at the first page` },
  }, SESSION_ID);

  assert.equal(rest.length, 0);
  assert.equal(row.role, 'user');
  assert.equal(row.content, 'look at the first page');
  assert.equal(row.transcriptAnchorId, 'img-note-2');
});

test('a scale note beside image blocks keeps the image and drops the note', () => {
  const [row, ...rest] = provider.normalizeMessage({
    type: 'user',
    uuid: 'img-note-3',
    timestamp: '2026-11-01T15:49:04.778Z',
    message: {
      role: 'user',
      content: [
        { type: 'text', text: NOTE },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } },
      ],
    },
  }, SESSION_ID);

  assert.equal(rest.length, 0);
  assert.equal(row.role, 'user');
  assert.equal(row.content, '');
  assert.deepEqual(row.images, [{ data: 'data:image/png;base64,QUJD' }]);
});

test('a scale note in front of a text block leaves that text and its image', () => {
  const [row, ...rest] = provider.normalizeMessage({
    type: 'user',
    uuid: 'img-note-4',
    timestamp: '2026-11-01T15:49:04.778Z',
    message: {
      role: 'user',
      content: [
        { type: 'text', text: `${NOTE}\nWhat is wrong with this diagram?` },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } },
      ],
    },
  }, SESSION_ID);

  assert.equal(rest.length, 0);
  assert.equal(row.content, 'What is wrong with this diagram?');
  assert.deepEqual(row.images, [{ data: 'data:image/png;base64,QUJD' }]);
});
