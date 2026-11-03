import assert from 'node:assert/strict';
import test from 'node:test';

import { stripClaudeImageScaleNotes } from '@/shared/utils.js';

const NOTE_2200 =
  '[Image: original 2200x2340, displayed at 1870x1988. Multiply coordinates by 1.18 to map to original image.]';
const NOTE_2360 =
  '[Image: original 2360x2340, displayed at 1932x1916. Multiply coordinates by 1.22 to map to original image.]';

test('a scale note on its own is removed', () => {
  assert.equal(stripClaudeImageScaleNotes(NOTE_2360), '');
  assert.equal(stripClaudeImageScaleNotes(`\n${NOTE_2200}\n`), '');
});

test('scale notes are removed from around text the user wrote', () => {
  assert.equal(
    stripClaudeImageScaleNotes(`${NOTE_2360}\n\nlook at the diagram`),
    'look at the diagram',
  );
  assert.equal(
    stripClaudeImageScaleNotes(`before\n${NOTE_2200}\n${NOTE_2360}\nafter`),
    'before\nafter',
  );
});

test('an integer scale factor is removed the same way', () => {
  assert.equal(
    stripClaudeImageScaleNotes(
      '[Image: original 100x80, displayed at 100x80. Multiply coordinates by 1 to map to original image.]',
    ),
    '',
  );
});

test('text that only resembles a scale note is kept', () => {
  const prose = 'See [Image: original sketch] in the doc.';
  assert.equal(stripClaudeImageScaleNotes(prose), prose);
  assert.equal(stripClaudeImageScaleNotes('  plain text\n'), '  plain text\n');
});
