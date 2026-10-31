import assert from 'node:assert/strict';

import { fireEvent, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { test } from 'vitest';

import type { SidebarSearchMode } from '@/shared/types';
import SidebarViewMenu from '@/modules/sidebar/SidebarViewMenu';

/**
 * The sidebar switches Projects, Conversations, Running and Archive from one
 * select. The list is opened with the keyboard: a pointer event in jsdom does
 * not carry the button state Radix checks before it toggles.
 */

const LABELS: Record<string, string> = {
  'search.modeProjects': 'Projects',
  'search.modeConversations': 'Conversations',
  'search.modeRunning': 'Running',
  'search.modeArchived': 'Archive',
};

const t = ((key: string, fallback?: string) => LABELS[key] ?? fallback ?? key) as unknown as TFunction;

const renderMenu = (searchMode: SidebarSearchMode, runningSessionsCount = 0) => {
  const changes: SidebarSearchMode[] = [];
  render(
    <SidebarViewMenu
      searchMode={searchMode}
      onSearchModeChange={(mode) => changes.push(mode)}
      runningSessionsCount={runningSessionsCount}
      t={t}
    />,
  );
  return changes;
};

const openMenu = () => {
  const trigger = screen.getByRole('combobox');
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
};

test('the trigger shows the open view and the menu lists every view', () => {
  renderMenu('projects');

  assert.equal(screen.getByRole('combobox', { name: 'Projects' }).getAttribute('aria-expanded'), 'false');
  assert.equal(screen.queryByRole('option', { name: 'Conversations' }), null);

  openMenu();

  // While the list is open Radix hides the rest of the page, including the trigger.
  assert.equal(
    screen.getByRole('combobox', { name: 'Projects', hidden: true }).getAttribute('aria-expanded'),
    'true',
  );
  assert.equal(screen.getByRole('option', { name: 'Projects' }).getAttribute('data-state'), 'checked');
  assert.ok(screen.getByRole('option', { name: 'Conversations' }));
  assert.ok(screen.getByRole('option', { name: 'Running' }));
  assert.ok(screen.getByRole('option', { name: 'Archive' }));
});

test('choosing a view from the menu switches to it', () => {
  const changes = renderMenu('projects');

  openMenu();
  fireEvent.click(screen.getByRole('option', { name: 'Conversations' }));

  assert.deepEqual(changes, ['conversations']);
});

test('a running-session count stays on the trigger for the other views', () => {
  renderMenu('conversations', 3);

  const trigger = screen.getByRole('combobox', { name: /Conversations/ });
  assert.match(trigger.textContent ?? '', /3/);

  openMenu();
  assert.match(screen.getByRole('option', { name: /Running/ }).textContent ?? '', /3/);
});
