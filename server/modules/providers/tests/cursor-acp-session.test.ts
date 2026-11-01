import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  cursorAcpPermissions,
  cursorNeedsInteractiveApproval,
  describeCursorPermissionRequest,
  runCursorAcpSession,
} from '@/modules/providers/list/cursor/cursor-acp-session.js';
import type { NormalizedMessage } from '@/shared/types.js';

test('Cursor asks for approval unless permissions are skipped or bypassed', () => {
  assert.equal(cursorNeedsInteractiveApproval({ permissionMode: 'default' }), true);
  assert.equal(cursorNeedsInteractiveApproval({ permissionMode: 'acceptEdits' }), true);
  assert.equal(cursorNeedsInteractiveApproval({ permissionMode: 'plan' }), true);
  assert.equal(cursorNeedsInteractiveApproval({ permissionMode: 'bypassPermissions' }), false);
  assert.equal(cursorNeedsInteractiveApproval({
    permissionMode: 'default',
    toolsSettings: { skipPermissions: true },
  }), false);
  assert.equal(cursorNeedsInteractiveApproval({ skipPermissions: true }), false);
});

test('Cursor permission text names the MCP tool and the shell command', () => {
  const mcp = describeCursorPermissionRequest({
    toolCall: {
      title: 'cloudcli-browser: browser_create_session',
      kind: 'other',
      content: [{ type: 'content', content: { type: 'text', text: '{}' } }],
    },
  });
  assert.equal(mcp.toolName, 'cloudcli-browser: browser_create_session');
  assert.equal(mcp.input, '{}');

  const shell = describeCursorPermissionRequest({
    toolCall: { title: '`echo hello`', kind: 'execute' },
  });
  assert.equal(shell.toolName, 'Shell');
  assert.deepEqual(shell.input, { command: 'echo hello' });
});

type FakeCursor = EventEmitter & {
  stdout: PassThrough;
  stderr: PassThrough;
  stdin: PassThrough;
  aborted?: boolean;
  kill: () => boolean;
};

function fakeCursor(): FakeCursor {
  const child = new EventEmitter() as FakeCursor;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.kill = () => {
    setTimeout(() => child.emit('close', 0), 0);
    return true;
  };
  return child;
}

function writeMessage(child: FakeCursor, message: unknown): void {
  child.stdout.write(`${JSON.stringify(message)}\n`);
}

test('an ACP permission request reaches the chat banner before the tool runs', async () => {
  const child = fakeCursor();
  const sent: NormalizedMessage[] = [];
  let allowOption = '';
  let promptId: number | undefined;
  let buffer = '';

  child.stdin.on('data', (chunk: Buffer | string) => {
    buffer += chunk.toString();
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (!line) {
        continue;
      }
      const message = JSON.parse(line) as {
        id?: number;
        method?: string;
        result?: { outcome?: { optionId?: string } };
      };
      if (message.method === 'initialize' && message.id !== undefined) {
        writeMessage(child, { jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1 } });
        continue;
      }
      if (message.method === 'session/new' && message.id !== undefined) {
        writeMessage(child, { jsonrpc: '2.0', id: message.id, result: { sessionId: 'acp-1' } });
        continue;
      }
      if (message.method === 'session/prompt' && message.id !== undefined) {
        promptId = message.id;
        writeMessage(child, {
          jsonrpc: '2.0',
          id: 900,
          method: 'session/request_permission',
          params: {
            sessionId: 'acp-1',
            toolCall: {
              toolCallId: 'call-1',
              title: 'cloudcli-browser: browser_create_session',
              kind: 'other',
              content: [{ type: 'content', content: { type: 'text', text: '{}' } }],
            },
            options: [
              { optionId: 'allow-once', kind: 'allow_once' },
              { optionId: 'reject-once', kind: 'reject_once' },
            ],
          },
        });
        continue;
      }
      if (message.id === 900) {
        allowOption = message.result?.outcome?.optionId || '';
        writeMessage(child, {
          jsonrpc: '2.0',
          method: 'session/update',
          params: {
            sessionId: 'acp-1',
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: 'opened' },
            },
          },
        });
        writeMessage(child, { jsonrpc: '2.0', id: promptId, result: { stopReason: 'end_turn' } });
      }
    }
  });

  await runCursorAcpSession({
    command: 'open google',
    options: { sessionId: 'app-session', cwd: process.cwd(), permissionMode: 'default' },
    providerSessionId: null,
    resolvedModel: null,
    writer: {
      send(message) {
        const normalized = message as NormalizedMessage;
        sent.push(normalized);
        if (normalized.kind === 'permission_request' && normalized.requestId) {
          cursorAcpPermissions.resolve(normalized.requestId, { allow: true });
        }
      },
    },
    processes: new Map(),
    spawnImpl: () => child,
  });

  assert.equal(allowOption, 'allow-once');
  assert.equal(sent.some((message) => message.kind === 'session_created' && message.newSessionId === 'acp-1'), true);
  const request = sent.find((message) => message.kind === 'permission_request');
  assert.equal(request?.toolName, 'cloudcli-browser: browser_create_session');
  assert.equal(sent.some((message) => message.kind === 'permission_resolved'), true);
  assert.equal(sent.some((message) => message.kind === 'stream_delta' && message.content === 'opened'), true);
  assert.equal(sent.some((message) => message.kind === 'complete' && message.exitCode === 0), true);
  assert.deepEqual(cursorAcpPermissions.listPending('app-session'), []);
});

test('a resumed Cursor session loads instead of starting a new ACP chat', async () => {
  const child = fakeCursor();
  const methods: string[] = [];
  let buffer = '';

  child.stdin.on('data', (chunk: Buffer | string) => {
    buffer += chunk.toString();
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (!line) {
        continue;
      }
      const message = JSON.parse(line) as { id?: number; method?: string };
      if (!message.method || message.id === undefined) {
        continue;
      }
      methods.push(message.method);
      if (message.method === 'initialize') {
        writeMessage(child, { jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1 } });
      } else if (message.method === 'session/load') {
        writeMessage(child, { jsonrpc: '2.0', id: message.id, result: { sessionId: 'existing-chat' } });
      } else if (message.method === 'session/prompt') {
        writeMessage(child, { jsonrpc: '2.0', id: message.id, result: { stopReason: 'end_turn' } });
      }
    }
  });

  await runCursorAcpSession({
    command: 'continue',
    options: { sessionId: 'app-session', cwd: process.cwd(), permissionMode: 'default' },
    providerSessionId: 'existing-chat',
    resolvedModel: null,
    writer: { send() {} },
    processes: new Map(),
    spawnImpl: () => child,
  });

  assert.deepEqual(methods, ['initialize', 'session/load', 'session/prompt']);
});
