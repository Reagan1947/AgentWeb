import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildBrokeredNonoProfile, resolveWorktreeGitDir } from '@/modules/providers/list/claude/claude-nono-broker.js';

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

test('brokered nono profile opens the server port only when API secrets turn on the proxy', () => {
  const credential = {
    name: 'billing_api',
    upstream: 'https://api.example.com',
    injectHeader: 'Authorization',
    credentialFormat: 'Bearer {}',
  };
  const withSecret = buildBrokeredNonoProfile({
    credentials: [credential],
    claudeTempDir: '/tmp/c',
    serverPort: 3001,
  }).profile as { network: { connect_port: number[] } };
  const withoutSecret = buildBrokeredNonoProfile({
    credentials: [],
    claudeTempDir: '/tmp/c',
    serverPort: 3001,
  }).profile as { network: { connect_port: number[] } };
  assert.deepEqual(withSecret.network.connect_port, [3001]);
  assert.deepEqual(withoutSecret.network.connect_port, []);
});

test('brokered nono profile grants Claude config files and read-only runtime folders', () => {
  const profile = buildBrokeredNonoProfile({
    credentials: [],
    claudeTempDir: '/tmp/c',
    readFolders: ['/app', '/app'],
  }).profile as { filesystem: { allow_file: string[]; read: string[] }; groups: { include: string[] } };
  assert.deepEqual(profile.filesystem.read, ['/app']);
  assert.ok(profile.filesystem.allow_file.includes('$HOME/.claude.json'));
  assert.ok(profile.groups.include.includes('node_runtime'));
});

test('resolveWorktreeGitDir finds the shared .git only for a linked worktree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nono-worktree-'));
  try {
    const worktree = path.join(root, 'worktree');
    const plain = path.join(root, 'plain');
    fs.mkdirSync(worktree);
    fs.mkdirSync(path.join(plain, '.git'), { recursive: true });
    fs.writeFileSync(path.join(worktree, '.git'), 'gitdir: /srv/repo/.git/worktrees/feature\n');
    assert.equal(resolveWorktreeGitDir(worktree), '/srv/repo/.git');
    assert.equal(resolveWorktreeGitDir(plain), null);
    assert.equal(resolveWorktreeGitDir(path.join(root, 'missing')), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
