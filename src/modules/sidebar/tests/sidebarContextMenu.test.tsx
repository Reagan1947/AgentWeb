import assert from 'node:assert/strict';

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { test, vi } from 'vitest';

import type { Project, SessionWithProvider, SidebarProjectListProps } from '@/shared/types';

/**
 * Project sessions keep their age, and open the same options from the "…"
 * button or a right-click. The row itself has no card fill.
 */

vi.mock('@/shared/api', () => ({
  api: {
    providerSessionId: () => Promise.resolve({
      ok: true,
      json: async () => ({ data: { sessionId: 'provider-session' } }),
    }),
    providers: {
      capabilities: () => Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { providers: [] } }),
      }),
    },
  },
}));

const { default: SidebarSessionItem } = await import('@/modules/sidebar/SidebarSessionItem');

const t = ((key: string) => key) as unknown as SidebarProjectListProps['t'];
const NOW = new Date('2026-08-21T10:00:00.000Z');
const noop = () => {};

const PROJECT = {
  projectId: 'project-1',
  name: 'project-1',
  displayName: 'project one',
  fullPath: '/tmp/project-1',
  sessions: [],
} as unknown as Project;

const SESSION = {
  id: 's1',
  summary: 'session one',
  lastActivity: '2026-08-21T09:59:00.000Z',
  __provider: 'claude',
} as unknown as SessionWithProvider;

test('a project session row keeps its age and opens its menu from the … button or a right-click', () => {
  const onStartEditingSession = vi.fn();
  const { container } = render(
    <SidebarSessionItem
      project={PROJECT}
      session={SESSION}
      selectedSession={null}
      isProcessing={false}
      hasBackgroundWork={false}
      needsAttention={false}
      currentTime={NOW}
      isEditing={false}
      renameDraft=""
      onRenameDraftChange={noop}
      onStartEditingSession={onStartEditingSession}
      onCancelEditingSession={noop}
      onSaveEditingSession={noop}
      onProjectSelect={noop}
      onSessionSelect={noop}
      onDeleteSession={noop}
      isSelecting={false}
      isChecked={false}
      onToggleSessionSelected={noop}
      t={t}
    />,
  );

  assert.match(container.textContent ?? '', /1m/, 'the compact age stays on the row');

  const row = container.querySelector('a[href="/session/s1"]');
  assert.ok(row);
  assert.equal(row.className.includes('bg-card'), false, 'an expanded session has no card fill');

  const button = container.querySelector('button[aria-label^="Session options"]');
  assert.ok(button, 'hover reveals a … button for the same menu');
  const highlight = button.parentElement;
  assert.equal(highlight?.className.includes('hover:bg-accent'), true, 'the hover fill covers the … button');
  assert.equal(highlight?.className.includes('hover:bg-accent/50'), false, 'session hover matches the selected fill');
  assert.equal(highlight?.contains(row), true);
  assert.equal(row.className.includes('hover:bg-accent/50'), false, 'the link does not paint a shorter fill');
  fireEvent.click(button);
  assert.ok(document.body.querySelector('[role="menu"]'));
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal(document.body.querySelector('[role="menu"]'), null);

  fireEvent.contextMenu(row);

  const menu = document.body.querySelector('[role="menu"]');
  assert.ok(menu);
  assert.equal(menu.getAttribute('aria-label'), 'Session options for session one');
  const rename = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
    .find((item) => item.textContent?.includes('Rename session'));
  assert.ok(rename);
  fireEvent.click(rename);
  assert.deepEqual(onStartEditingSession.mock.calls, [['project-1', 's1', 'session one']]);
});
