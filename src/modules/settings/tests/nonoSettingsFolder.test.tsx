import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@/modules/i18n';
import NonoSettingsTab from '@/modules/settings/tabs/nono-settings/NonoSettingsTab';

// Picking a folder in the browser only fills the path field. The folder is
// saved when the user clicks Add folder.

type SavedNono = { enabled: boolean; allowedFolders: string[] };

const saved: SavedNono[] = [];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

type SettingsApiModule = {
  api: {
    settings: Record<string, (...args: never[]) => Promise<Response>>;
  };
};

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<SettingsApiModule>();
  return {
    ...actual,
    api: {
      ...actual.api,
      settings: {
        ...actual.api.settings,
        nono: async () => json({
          enabled: true,
          allowedFolders: ['/already'],
          available: true,
          supported: true,
        }),
        saveNono: async (settings: SavedNono) => {
          saved.push(settings);
          return json({ ...settings, available: true, supported: true });
        },
        brokeredCredentials: async () => json({ credentials: [], nonoAvailable: true }),
      },
    },
  };
});

vi.mock('@/modules/project-creation-wizard', async () => {
  const ReactModule = await import('react');
  return {
    FolderBrowserModal: ({
      isOpen,
      onFolderSelected,
    }: {
      isOpen: boolean;
      onFolderSelected: (folderPath: string, advanceToConfirm: boolean) => void;
    }) => (
      isOpen
        ? ReactModule.createElement('button', {
          type: 'button',
          onClick: () => onFolderSelected('/tmp/picked', false),
        }, 'Use picked folder')
        : null
    ),
  };
});

const pathField = () => screen.getByPlaceholderText('/absolute/path/to/folder') as HTMLInputElement;

describe('Nono extra folders', () => {
  beforeEach(() => {
    saved.length = 0;
  });

  it('writes a browsed folder into the field and saves it only from Add folder', async () => {
    render(<NonoSettingsTab />);

    const input = await screen.findByPlaceholderText('/absolute/path/to/folder') as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));

    const browse = screen.getByRole('button', { name: 'Browse' });
    expect(browse.closest('[data-slot="input-group"]')).not.toBeNull();

    fireEvent.click(browse);
    fireEvent.click(screen.getByRole('button', { name: 'Use picked folder' }));

    expect(pathField().value).toBe('/tmp/picked');
    expect(saved).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));

    await waitFor(() => {
      expect(saved).toEqual([
        { enabled: true, allowedFolders: ['/already', '/tmp/picked'] },
      ]);
    });
    expect(pathField().value).toBe('');
  });
});
