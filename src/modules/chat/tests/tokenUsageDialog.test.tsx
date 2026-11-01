import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import '@/modules/i18n';
import CommandResultModal from '@/modules/chat/modals/CommandResultModal';
import type { CostCommandData, ProviderModelActions } from '@/shared/types';

const providerModelActions: ProviderModelActions = {
  create: async () => {},
  update: async () => {},
  remove: async () => {},
  setCustomModelsOnly: async () => {},
};

const renderUsage = (data: CostCommandData, onClose = vi.fn()) => {
  render(
    <CommandResultModal
      payload={{ kind: 'cost', data }}
      onClose={onClose}
      providerModelCatalog={{}}
      providerModelActions={providerModelActions}
      activeProvider="claude"
      activeProviderModel="claude-sonnet"
      currentSessionId={null}
      onSelectProviderModel={async () => ({ scope: 'default', model: 'claude-sonnet' })}
    />,
  );
  return onClose;
};

describe('token usage dialog', () => {
  it('shows the session counts in an alert dialog', () => {
    renderUsage({
      tokenUsage: { used: 404_009, total: 160_000 },
      tokenBreakdown: { input: 300_000, output: 104_009 },
      provider: 'claude',
      model: 'claude-sonnet',
    });

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Token Usage')).toBeTruthy();
    expect(screen.getByText('Input, output, and total token counts for this session.')).toBeTruthy();
    expect(screen.getByText('404,009')).toBeTruthy();
    expect(screen.getByText('300,000')).toBeTruthy();
    expect(screen.getByText('104,009')).toBeTruthy();
    expect(screen.queryByText('Context window')).toBeNull();
    expect(screen.queryByText('Unavailable')).toBeNull();
    expect(screen.getByText('Claude')).toBeTruthy();
    expect(screen.getByText('claude-sonnet')).toBeTruthy();
  });

  it('shows the context window only when it is larger than the tokens used', () => {
    renderUsage({
      tokenUsage: { used: 1_200, total: 200_000 },
      provider: 'cursor',
      model: 'gpt-5',
    });

    expect(screen.getByText('1,200')).toBeTruthy();
    expect(screen.getByText('200,000')).toBeTruthy();
    expect(screen.queryByText('Input tokens')).toBeNull();
    expect(screen.getByText('Cursor')).toBeTruthy();
  });

  it('closes from the alert dialog action', () => {
    const onClose = renderUsage({
      tokenUsage: { used: 10, total: 100 },
      model: 'claude-sonnet',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
