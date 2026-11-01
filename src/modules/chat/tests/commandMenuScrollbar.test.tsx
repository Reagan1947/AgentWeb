import assert from 'node:assert/strict';

import { render } from '@testing-library/react';
import { test, vi } from 'vitest';

import CommandMenu from '@/modules/chat/composer/CommandMenu';
import { i18n } from '@/modules/i18n';

/**
 * Typing / opens the slash-command palette. Its list uses the overlay thumb
 * instead of a native scrollbar that would take width from the command rows.
 */

const commands = Array.from({ length: 12 }, (_, index) => ({
  name: `/command-${index}`,
  description: 'A command',
  namespace: 'builtin',
}));

test('the slash command palette scrolls with an overlay thumb', () => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  i18n.changeLanguage('en');

  const { getByRole } = render(
    <CommandMenu
      isOpen
      commands={commands}
      onClose={() => {}}
      position={{ top: 0, left: 16, bottom: 80 }}
    />,
  );

  const menu = getByRole('listbox', { name: 'Available commands' });
  assert.equal(menu.style.overflowY, 'hidden');
  assert.ok(menu.querySelector('.scrollbar-hide'));
  assert.ok(menu.querySelector('[data-overlay-thumb]'));
  assert.equal(
    (menu.firstElementChild as HTMLElement).style.getPropertyValue('--slash-menu-max-height').includes('calc('),
    true,
  );
});
