import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '@/modules/i18n';
import { Queue } from '@/modules/chat/composer/Queue';

const items = [
  { id: 'a', text: 'Also update the changelog' },
  { id: 'b', text: 'Then open a draft pull request' },
];

describe('Queue', () => {
  it('steers, edits, and deletes the hovered row', () => {
    const onSteer = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <Queue
        items={items}
        onSteer={onSteer}
        onEdit={onEdit}
        onDelete={onDelete}
        onCollapse={() => undefined}
        label="Queued"
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Steer' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit queued message' })[1]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete queued message' })[0]!);

    expect(onSteer).toHaveBeenCalledWith('a');
    expect(onEdit).toHaveBeenCalledWith('b');
    expect(onDelete).toHaveBeenCalledWith('a');
    expect(screen.getByText('Also update the changelog')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('does not reorder a focused row with Alt+ArrowDown', () => {
    render(
      <Queue
        items={items}
        onSteer={() => undefined}
        onEdit={() => undefined}
        onDelete={() => undefined}
        onCollapse={() => undefined}
      />,
    );

    const first = screen.getByText('Also update the changelog').closest('li');
    expect(first).toBeTruthy();
    fireEvent.keyDown(first!, { key: 'ArrowDown', altKey: true });

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]?.textContent).toContain('Also update the changelog');
    expect(rows[1]?.textContent).toContain('Then open a draft pull request');
  });

  it('collapses from the corner control', () => {
    const onCollapse = vi.fn();
    render(
      <Queue
        items={items}
        onSteer={() => undefined}
        onEdit={() => undefined}
        onDelete={() => undefined}
        onCollapse={onCollapse}
        label="Queued"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse queue' }));
    expect(onCollapse).toHaveBeenCalledOnce();
  });
});
