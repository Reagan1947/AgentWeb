import assert from 'node:assert/strict';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { test, vi } from 'vitest';

import type { AppTab } from '@/shared/types';

/**
 * The workspace header switches views through shadcn Tabs. Optional views stay
 * out of the list until their flags are on, and choosing a tab reports that
 * view back to the workspace.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const labels: Record<string, string> = {
        'tabs.chat': 'Chat',
        'tabs.shell': 'Shell',
        'tabs.files': 'Files',
        'tabs.git': 'Source Control',
        'tabs.tasks': 'Tasks',
        'tabs.browser': 'Browser',
      };
      return labels[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

vi.mock('@/modules/plugins', () => ({
  usePlugins: () => ({
    plugins: [
      { name: 'notes', displayName: 'Notes', icon: 'notes.svg', enabled: true },
      { name: 'hidden', displayName: 'Hidden', icon: 'hidden.svg', enabled: false },
    ],
  }),
  PluginIcon: () => <span data-testid="plugin-icon" />,
}));

const { default: WorkspaceTabs } = await import('@/modules/project-workspace/WorkspaceTabs');

function Harness({
  initialTab = 'chat',
  shouldShowTasksTab = false,
  shouldShowBrowserTab = false,
}: {
  initialTab?: AppTab;
  shouldShowTasksTab?: boolean;
  shouldShowBrowserTab?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);
  return (
    <WorkspaceTabs
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      shouldShowTasksTab={shouldShowTasksTab}
      shouldShowBrowserTab={shouldShowBrowserTab}
    />
  );
}

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'));

test('lists the built-in views and enabled plugins, with the active view selected', () => {
  render(<Harness />);

  assert.deepEqual(tabNames(), ['Chat', 'Shell', 'Files', 'Source Control', 'Notes']);
  assert.equal(screen.getByRole('tab', { name: 'Chat' }).textContent, '');
  assert.equal(screen.getByRole('tab', { name: 'Chat' }).getAttribute('aria-selected'), 'true');
  assert.equal(screen.getByRole('tab', { name: 'Shell' }).getAttribute('aria-selected'), 'false');
  assert.equal(screen.getByRole('tablist', { name: 'Workspace views' }) !== null, true);
});

test('adds Tasks and Browser only when those views are enabled', () => {
  render(<Harness shouldShowTasksTab shouldShowBrowserTab />);

  assert.deepEqual(tabNames(), ['Chat', 'Shell', 'Files', 'Source Control', 'Browser', 'Tasks', 'Notes']);
});

test('selects a view from a click and from the arrow keys', async () => {
  render(<Harness />);

  // Radix selects a tab on mouse down, then moves to the next tab after the arrow key's focus settles.
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Shell' }), { button: 0 });
  assert.equal(screen.getByRole('tab', { name: 'Shell' }).getAttribute('aria-selected'), 'true');

  await act(async () => {
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Shell' }), { key: 'ArrowRight' });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(screen.getByRole('tab', { name: 'Files' }).getAttribute('aria-selected'), 'true');
});
