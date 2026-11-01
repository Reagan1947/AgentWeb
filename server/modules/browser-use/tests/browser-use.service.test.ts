import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { browserUseService, resolveBrowserMcpCommand } from '@/modules/browser-use/browser-use.service.js';

test('browser monitor list starts empty without agent sessions', async () => {
  const sessions = await browserUseService.listSessions();

  assert.deepEqual(sessions, []);
});

test('browser MCP uses the compiled entry with an absolute node path', () => {
  const moduleDirectory = path.join('/app', 'dist-server', 'server', 'modules', 'browser-use');
  const command = resolveBrowserMcpCommand({
    moduleDirectory,
    nodePath: '/usr/local/bin/node',
    tsxCliPath: '/app/node_modules/tsx/dist/cli.mjs',
    cloudcliPath: '/usr/local/bin/cloudcli',
    fileExists: (filePath) => filePath.endsWith(`${path.sep}browser-use-mcp.js`),
  });

  assert.deepEqual(command, {
    command: '/usr/local/bin/node',
    args: [path.join(moduleDirectory, 'browser-use-mcp.js')],
  });
});

test('browser MCP uses tsx for the source entry when the compiled script is absent', () => {
  const moduleDirectory = path.join('/app', 'server', 'modules', 'browser-use');
  const command = resolveBrowserMcpCommand({
    moduleDirectory,
    nodePath: '/usr/local/bin/node',
    tsxCliPath: '/app/node_modules/tsx/dist/cli.mjs',
    cloudcliPath: null,
    fileExists: (filePath) => filePath.endsWith(`${path.sep}browser-use-mcp.ts`),
  });

  assert.deepEqual(command, {
    command: '/usr/local/bin/node',
    args: [
      '/app/node_modules/tsx/dist/cli.mjs',
      '--tsconfig',
      path.join('/app', 'server', 'tsconfig.json'),
      path.join(moduleDirectory, 'browser-use-mcp.ts'),
    ],
  });
});

test('browser MCP uses an absolute cloudcli path only when that executable exists', () => {
  const command = resolveBrowserMcpCommand({
    moduleDirectory: path.join('/app', 'server', 'modules', 'browser-use'),
    nodePath: '/usr/local/bin/node',
    tsxCliPath: null,
    cloudcliPath: '/opt/homebrew/bin/cloudcli',
    fileExists: () => false,
  });

  assert.deepEqual(command, {
    command: '/opt/homebrew/bin/cloudcli',
    args: ['browser-use-mcp'],
  });
});

test('browser MCP registration fails instead of writing a missing cloudcli command', () => {
  assert.throws(
    () => resolveBrowserMcpCommand({
      moduleDirectory: path.join('/app', 'server', 'modules', 'browser-use'),
      nodePath: '/usr/local/bin/node',
      tsxCliPath: null,
      cloudcliPath: null,
      fileExists: () => false,
    }),
    /cloudcli command is available/,
  );
});
