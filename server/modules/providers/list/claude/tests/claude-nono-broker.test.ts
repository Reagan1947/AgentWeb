import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBrokeredNonoProfile } from '@/modules/providers/list/claude/claude-nono-broker.js';

test('brokered nono profile names env vars and omits the secret', () => {
  const secret = 'super-secret-value';
  const plainSecret = 'plain-secret-value';
  const built = buildBrokeredNonoProfile({
    credentials: [{
      name: 'billing_api',
      upstream: 'https://api.example.com/v1',
      injectHeader: 'X-Api-Key',
      credentialFormat: '{}',
      note: 'billing account',
    }, {
      name: 'deploy_token',
      upstream: '',
      injectHeader: '',
      credentialFormat: '',
      note: 'CI token',
    }],
    claudeTempDir: '/tmp/cloudcli-claude',
  });
  const serialized = JSON.stringify(built.profile);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes(plainSecret), false);
  assert.equal(serialized.includes('deploy_token'), false);
  assert.match(serialized, /env:\/\/BILLING_API_TOKEN/);
  assert.match(serialized, /X-Api-Key/);
  assert.match(built.promptAppend, /\$BILLING_API_BASE_URL/);
  assert.match(built.promptAppend, /\$DEPLOY_TOKEN/);
  assert.match(built.promptAppend, /CI token/);
  assert.equal(built.promptAppend.includes(secret), false);
  assert.equal(built.promptAppend.includes(plainSecret), false);
  const profile = built.profile as {
    workdir: { access: string };
    filesystem: { allow: string[] };
  };
  assert.equal(profile.workdir.access, 'readwrite');
  assert.deepEqual(profile.filesystem.allow, ['$HOME/.claude', '/tmp/cloudcli-claude']);
});

test('brokered nono profile grants the configured folders and still omits secrets', () => {
  const built = buildBrokeredNonoProfile({
    credentials: [],
    claudeTempDir: '/tmp/cloudcli-claude',
    allowedFolders: ['/srv/notes', '/srv/notes'],
  });
  const profile = built.profile as { filesystem: { allow: string[] } };
  assert.deepEqual(profile.filesystem.allow, ['$HOME/.claude', '/tmp/cloudcli-claude', '/srv/notes']);
  assert.equal(JSON.stringify(built.profile).includes('super-secret'), false);
});
