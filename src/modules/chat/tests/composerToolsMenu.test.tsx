import assert from 'node:assert/strict';

import { fireEvent, render } from '@testing-library/react';
import { test, vi } from 'vitest';

import { ComposerToolsMenu } from '@/modules/chat/composer/ComposerToolsMenu';
import { i18n } from '@/modules/i18n';
import type { SlashCommand } from '@/shared/types';

/**
 * The plus button opens attach and the command list. Show all commands
 * replaces that menu with a searchable, categorized command popup.
 */

const commands = [
  { name: '/help', description: 'Show help', namespace: 'builtin' },
  { name: '/cost', description: 'Token usage', namespace: 'builtin' },
  { name: '$figma', description: 'Figma skill', namespace: 'skill' },
] as SlashCommand[];

const renderMenu = (onCommandSelect: (command: SlashCommand) => void = () => {}) =>
  render(
    <ComposerToolsMenu
      slashCommandsCount={commands.length}
      commands={commands}
      frequentCommands={[]}
      onAttachFiles={() => {}}
      onCommandSelect={(command) => onCommandSelect(command)}
    />,
  );

const openMenu = (getByRole: ReturnType<typeof render>['getByRole']) => {
  fireEvent.keyDown(getByRole('button', { name: 'Attach files or show commands' }), { key: 'Enter' });
};

test('the plus button opens attach and show-commands', () => {
  i18n.changeLanguage('en');
  const { getByRole, queryByRole } = renderMenu();

  assert.equal(queryByRole('menuitem', { name: 'Attach files' }), null);

  openMenu(getByRole);

  assert.ok(getByRole('menuitem', { name: 'Attach files' }));
  assert.ok(getByRole('menuitem', { name: /Show all commands/ }));
  assert.equal(queryByRole('combobox', { name: 'Search commands' }), null);
});

test('show all commands replaces the menu with a searchable category list', () => {
  // jsdom ships no ResizeObserver, which the command list uses to track its scroll area.
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Element.prototype.scrollIntoView = () => undefined;
  i18n.changeLanguage('en');
  const selected: string[] = [];
  const { getByRole, queryByRole, getByText } = renderMenu((command) => selected.push(command.name));

  openMenu(getByRole);
  fireEvent.click(getByRole('menuitem', { name: /Show all commands/ }));

  assert.equal(queryByRole('menuitem', { name: 'Attach files' }), null);
  assert.ok(getByRole('combobox', { name: 'Search commands' }));
  assert.ok(getByText('Built-in Commands'));
  assert.ok(getByText('Skills'));
  assert.ok(getByText('/help'));
  assert.ok(getByText('$figma'));

  fireEvent.change(getByRole('combobox', { name: 'Search commands' }), { target: { value: 'figma' } });

  assert.equal(queryByRole('option', { name: /\/help/ }), null);
  assert.ok(getByRole('option', { name: /\$figma/ }));

  fireEvent.click(getByRole('option', { name: /\$figma/ }));
  assert.deepEqual(selected, ['$figma']);
});
