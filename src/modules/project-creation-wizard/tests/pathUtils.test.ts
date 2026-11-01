import assert from 'node:assert/strict';

import { test } from 'vitest';

import { listAncestorPaths } from '@/modules/project-creation-wizard/utils/pathUtils';

test('lists unix ancestors from the filesystem root through the folder', () => {
  assert.deepEqual(listAncestorPaths('/Users/johli'), ['/', '/Users', '/Users/johli']);
});

test('keeps the filesystem root as a single entry', () => {
  assert.deepEqual(listAncestorPaths('/'), ['/']);
});

test('keeps the home shortcut until it has been resolved', () => {
  assert.deepEqual(listAncestorPaths('~'), ['~']);
  assert.deepEqual(listAncestorPaths('   '), ['~']);
});

test('lists windows ancestors from the drive root through the folder', () => {
  assert.deepEqual(listAncestorPaths('C:\\Users\\johli'), ['C:\\', 'C:\\Users', 'C:\\Users\\johli']);
});
