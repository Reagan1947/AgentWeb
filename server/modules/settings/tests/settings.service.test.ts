import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createSettingsService } from '../settings.service.js';

type Dependencies = Parameters<typeof createSettingsService>[0];

function dependencies(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    apiKeys: { list: () => [], create: () => ({}), remove: () => false, toggle: () => false },
    credentials: { list: () => [], create: () => ({}), remove: () => false, toggle: () => false },
    brokeredCredentials: {
      list: () => [],
      create: () => ({ id: 1, name: 'billing_api' }),
      remove: () => false,
      toggle: () => false,
    },
    nonoAvailable: () => false,
    nonoSupported: () => true,
    nonoSettings: {
      read: () => undefined,
      save: () => undefined,
    },
    notifications: {
      getPreferences: () => undefined,
      updatePreferences: () => ({}),
      createEnabledEvent: () => ({}),
      notifyUser: () => undefined,
    },
    pushSubscriptions: { save: () => undefined, remove: () => undefined },
    getVapidPublicKey: () => null,
    ...overrides,
  };
}

test('listApiKeys redacts secret values through the service boundary', () => {
  const service = createSettingsService(dependencies({
    apiKeys: {
      list: () => [{ id: 1, api_key: '1234567890-secret' }],
      create: () => ({}), remove: () => false, toggle: () => false,
    },
  }));
  assert.equal(service.listApiKeys(1).apiKeys[0]?.api_key, '1234567890...');
});

test('subscribeToPush persists the subscription and enables Web Push', () => {
  const operations: string[] = [];
  const service = createSettingsService(dependencies({
    pushSubscriptions: {
      save: (_id, endpoint) => operations.push(`save:${endpoint}`),
      remove: () => undefined,
    },
    notifications: {
      getPreferences: () => ({ channels: { webPush: false } }),
      updatePreferences: () => { operations.push('preferences'); return {}; },
      createEnabledEvent: () => ({ code: 'push.enabled' }),
      notifyUser: () => { operations.push('notify'); },
    },
  }));

  service.subscribeToPush(1, {
    endpoint: 'https://push.example.test',
    keys: { p256dh: 'key', auth: 'auth' },
  });
  assert.deepEqual(operations, ['save:https://push.example.test', 'preferences', 'notify']);
});

test('listBrokeredCredentials returns metadata and never the stored secret', () => {
  const service = createSettingsService(dependencies({
    brokeredCredentials: {
      list: () => [{
        id: 4,
        name: 'billing_api',
        upstream: 'https://api.example.com',
        inject_header: 'Authorization',
        credential_format: 'Bearer {}',
        is_active: 1,
        created_at: '2026-11-04',
      }],
      create: () => ({ id: 4, name: 'billing_api' }),
      remove: () => false,
      toggle: () => false,
    },
    nonoAvailable: () => true,
  }));
  const listed = service.listBrokeredCredentials(1);
  assert.equal(listed.nonoAvailable, true);
  assert.equal(listed.credentials[0]?.kind, 'api');
  assert.equal(listed.credentials[0]?.note, null);
  assert.equal(listed.credentials[0]?.tokenEnv, 'BILLING_API_TOKEN');
  assert.equal(listed.credentials[0]?.baseUrlEnv, 'BILLING_API_BASE_URL');
  assert.equal('secret' in (listed.credentials[0] ?? {}), false);
});

test('createBrokeredCredential stores a plain secret without an upstream', () => {
  const stored: {
    current: { upstream: string; note: string | null; secret: string } | null;
  } = { current: null };
  const service = createSettingsService(dependencies({
    brokeredCredentials: {
      list: () => [],
      create: (input) => {
        stored.current = input;
        return { id: 2, name: 'deploy_token' };
      },
      remove: () => false,
      toggle: () => false,
    },
  }));
  const created = service.createBrokeredCredential(1, {
    name: 'deploy_token',
    note: 'CI deploy token',
    secret: 'super-secret',
  });
  assert.equal(created.success, true);
  assert.equal(stored.current?.upstream, '');
  assert.equal(stored.current?.note, 'CI deploy token');
  assert.equal(stored.current?.secret, 'super-secret');
});

test('createBrokeredCredential rejects a non-https upstream and does not store it', () => {
  let created = 0;
  const service = createSettingsService(dependencies({
    brokeredCredentials: {
      list: () => [],
      create: () => {
        created += 1;
        return { id: 1, name: 'billing_api' };
      },
      remove: () => false,
      toggle: () => false,
    },
  }));
  assert.throws(
    () => service.createBrokeredCredential(1, {
      name: 'billing_api',
      upstream: 'http://api.example.com',
      injectHeader: 'Authorization',
      credentialFormat: 'Bearer {}',
      secret: 'super-secret',
    }),
    (error: unknown) => error instanceof Error && error.message.includes('https'),
  );
  assert.equal(created, 0);
});

test('nono settings default to off and reject a relative folder', () => {
  const service = createSettingsService(dependencies());
  assert.deepEqual(service.getNonoSettings(1), {
    enabled: false,
    allowedFolders: [],
    available: false,
    supported: true,
  });
  assert.throws(
    () => service.updateNonoSettings(1, { enabled: true, allowedFolders: ['notes'] }),
    (error: unknown) => error instanceof Error && error.message.includes('absolute'),
  );
});

test('nono settings store an enabled choice and canonical absolute folders', () => {
  let stored: unknown;
  const service = createSettingsService(dependencies({
    nonoAvailable: () => true,
    nonoSettings: {
      read: () => stored,
      save: (_userId, settings) => {
        stored = settings;
      },
    },
  }));
  const homeFolder = path.join(os.homedir(), 'nono-notes');
  assert.throws(
    () => service.updateNonoSettings(1, { enabled: true, allowedFolders: ['/'] }),
    (error: unknown) => error instanceof Error && error.message.includes('absolute'),
  );
  const saved = service.updateNonoSettings(1, {
    enabled: true,
    allowedFolders: ['/tmp/nono-allow/', '/tmp/nono-allow', '~/nono-notes'],
  });
  assert.equal(saved.enabled, true);
  assert.equal(saved.available, true);
  assert.deepEqual(saved.allowedFolders, ['/tmp/nono-allow', homeFolder]);
  assert.deepEqual(service.getNonoSettings(1).allowedFolders, ['/tmp/nono-allow', homeFolder]);
});

test('nono settings reject the home directory and any folder containing it', () => {
  const service = createSettingsService(dependencies());
  for (const folder of ['~', path.dirname(os.homedir())]) {
    if (folder === path.parse(os.homedir()).root) {
      continue;
    }
    assert.throws(
      () => service.updateNonoSettings(1, { enabled: true, allowedFolders: [folder] }),
      (error: unknown) => error instanceof Error && error.message.includes('home directory'),
    );
  }
});

test('stored nono settings drop a folder covering the home directory', () => {
  const service = createSettingsService(dependencies({
    nonoSettings: {
      read: () => ({ enabled: true, allowedFolders: ['~', '/tmp/nono-keep'] }),
      save: () => undefined,
    },
  }));
  assert.deepEqual(service.getNonoSettings(1).allowedFolders, ['/tmp/nono-keep']);
});
