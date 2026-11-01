import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  cursorAcpPermissions,
  cursorNeedsInteractiveApproval,
  describeCursorPermissionRequest,
  matchAcpModelId,
  runCursorAcpSession,
} from '@/modules/providers/list/cursor/cursor-acp-session.js';
import {
  ensureCursorAcpSessionStore,
  resolveCursorStoreDbPath,
} from '@/modules/providers/list/cursor/cursor-session-store.js';
import { CursorSessionsProvider } from '@/modules/providers/list/cursor/cursor-sessions.provider.js';
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

test('stored Cursor model names map onto the ids the ACP server lists', () => {
  const models = {
    availableModels: [
      { modelId: 'default[]' },
      { modelId: 'gpt-5.5[context=272k,reasoning=medium,fast=false]' },
      { modelId: 'gpt-5.5-mini[fast=true]' },
    ],
  };
  assert.equal(matchAcpModelId('auto', models), 'default[]');
  assert.equal(matchAcpModelId('gpt-5.5', models), 'gpt-5.5[context=272k,reasoning=medium,fast=false]');
  assert.equal(matchAcpModelId('gpt-5.5-mini', models), 'gpt-5.5-mini[fast=true]');
  assert.equal(matchAcpModelId('not-offered', models), null);
  assert.equal(matchAcpModelId('auto', undefined), null);
});

test('a chat started with -p is copied where ACP can load it, and history then reads the ACP copy', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'cursor-store-'));
  try {
    const projectPath = '/work/project';
    const cwdId = crypto.createHash('md5').update(projectPath).digest('hex');
    const printDirectory = path.join(root, 'chats', cwdId, 'chat-1');
    mkdirSync(printDirectory, { recursive: true });
    writeFileSync(path.join(printDirectory, 'store.db'), 'print');

    assert.equal(resolveCursorStoreDbPath('chat-1', projectPath, root), path.join(printDirectory, 'store.db'));

    ensureCursorAcpSessionStore('chat-1', projectPath, root);
    const acpStore = path.join(root, 'acp-sessions', 'chat-1', 'store.db');
    assert.equal(readFileSync(acpStore, 'utf8'), 'print');
    assert.equal(resolveCursorStoreDbPath('chat-1', projectPath, root), acpStore);

    writeFileSync(acpStore, 'acp turn');
    ensureCursorAcpSessionStore('chat-1', projectPath, root);
    assert.equal(readFileSync(acpStore, 'utf8'), 'acp turn');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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

type AcpLine = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: { outcome?: { optionId?: string } };
};

/** A fake `cursor-agent acp` whose replies come from `onLine`. */
function scriptedCursor(onLine: (message: AcpLine, child: FakeCursor) => void): FakeCursor {
  const child = fakeCursor();
  let buffer = '';
  child.stdin.on('data', (chunk: Buffer | string) => {
    buffer += chunk.toString();
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (line) {
        onLine(JSON.parse(line) as AcpLine, child);
      }
    }
  });
  return child;
}

function update(child: FakeCursor, body: Record<string, unknown>): void {
  writeMessage(child, { jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'acp', update: body } });
}

test('two chats waiting at once each get their own approval, even when the CLI reuses request ids', async () => {
  const pendingIds: Record<string, string> = {};
  const answered: Record<string, string> = {};
  let bothWaiting: () => void = () => {};
  const waiting = new Promise<void>((resolve) => {
    bothWaiting = resolve;
  });

  const runChat = (appSessionId: string) => {
    let promptId: number | undefined;
    const child = scriptedCursor((message, cursor) => {
      if (message.method === 'initialize' || message.method === 'session/new') {
        writeMessage(cursor, { jsonrpc: '2.0', id: message.id, result: { sessionId: `acp-${appSessionId}` } });
      } else if (message.method === 'session/prompt') {
        promptId = message.id;
        writeMessage(cursor, {
          jsonrpc: '2.0',
          id: 0,
          method: 'session/request_permission',
          params: {
            toolCall: { toolCallId: 'call', title: '`echo hi`', kind: 'execute' },
            options: [
              { optionId: 'allow-once', kind: 'allow_once' },
              { optionId: 'reject-once', kind: 'reject_once' },
            ],
          },
        });
      } else if (message.id === 0 && !message.method) {
        answered[appSessionId] = message.result?.outcome?.optionId || '';
        writeMessage(cursor, { jsonrpc: '2.0', id: promptId, result: { stopReason: 'end_turn' } });
      }
    });

    return runCursorAcpSession({
      command: 'run echo',
      options: { sessionId: appSessionId, cwd: process.cwd(), permissionMode: 'default' },
      providerSessionId: null,
      resolvedModel: null,
      writer: {
        send(raw) {
          const message = raw as NormalizedMessage;
          if (message.kind === 'permission_request' && message.requestId) {
            pendingIds[appSessionId] = message.requestId;
            if (Object.keys(pendingIds).length === 2) {
              bothWaiting();
            }
          }
        },
      },
      processes: new Map(),
      spawnImpl: () => child,
    });
  };

  const first = runChat('chat-a');
  const second = runChat('chat-b');
  await waiting;
  assert.notEqual(pendingIds['chat-a'], pendingIds['chat-b']);

  cursorAcpPermissions.resolve(pendingIds['chat-a'], { allow: true });
  cursorAcpPermissions.resolve(pendingIds['chat-b'], { allow: false });
  await Promise.all([first, second]);

  assert.deepEqual(answered, { 'chat-a': 'allow-once', 'chat-b': 'reject-once' });
});

test('a chat that was stopped before Cursor saved it starts a fresh ACP session instead of failing', async () => {
  const methods: string[] = [];
  const sent: NormalizedMessage[] = [];
  const child = scriptedCursor((message, cursor) => {
    if (!message.method || message.id === undefined) {
      return;
    }
    methods.push(message.method);
    if (message.method === 'session/load') {
      writeMessage(cursor, {
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32602, message: 'Invalid params', data: { message: 'Session "never-saved" not found' } },
      });
    } else if (message.method === 'session/new') {
      writeMessage(cursor, { jsonrpc: '2.0', id: message.id, result: { sessionId: 'fresh-chat' } });
    } else {
      writeMessage(cursor, { jsonrpc: '2.0', id: message.id, result: {} });
    }
  });

  await runCursorAcpSession({
    command: 'hello again',
    options: { sessionId: 'app-session', cwd: process.cwd(), permissionMode: 'default' },
    providerSessionId: 'never-saved',
    resolvedModel: null,
    writer: { send(message) { sent.push(message as NormalizedMessage); } },
    processes: new Map(),
    spawnImpl: () => child,
  });

  assert.deepEqual(methods, ['initialize', 'session/load', 'session/new', 'session/prompt']);
  assert.equal(sent.some((message) => message.kind === 'session_created' && message.newSessionId === 'fresh-chat'), true);
  assert.equal(sent.some((message) => message.kind === 'complete' && message.exitCode === 0), true);
});

test('a streamed thought becomes one row and an MCP call is named after the real tool', async () => {
  const sent: NormalizedMessage[] = [];
  const child = scriptedCursor((message, cursor) => {
    if (message.method === 'session/prompt') {
      update(cursor, { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Let me ' } });
      update(cursor, { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'list sessions.' } });
      update(cursor, { sessionUpdate: 'tool_call', toolCallId: 'mcp-1', title: 'MCP: tool', kind: 'other', status: 'pending', rawInput: {} });
      update(cursor, {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'mcp-1',
        title: 'cloudcli-browser: browser_list_sessions',
        rawInput: { providerIdentifier: 'cloudcli-browser', toolName: 'browser_list_sessions', args: { limit: 1 } },
      });
      update(cursor, { sessionUpdate: 'tool_call_update', toolCallId: 'mcp-1', status: 'completed', rawOutput: { success: true } });
      writeMessage(cursor, { jsonrpc: '2.0', id: message.id, result: { stopReason: 'end_turn' } });
    } else if (message.id !== undefined && message.method) {
      writeMessage(cursor, { jsonrpc: '2.0', id: message.id, result: { sessionId: 'acp' } });
    }
  });

  await runCursorAcpSession({
    command: 'list',
    options: { sessionId: 'app-session', cwd: process.cwd(), permissionMode: 'default' },
    providerSessionId: null,
    resolvedModel: null,
    writer: { send(message) { sent.push(message as NormalizedMessage); } },
    processes: new Map(),
    spawnImpl: () => child,
  });

  const thoughts = sent.filter((message) => message.kind === 'thinking');
  assert.deepEqual(thoughts.map((message) => message.content), ['Let me list sessions.']);
  const toolUses = sent.filter((message) => message.kind === 'tool_use');
  assert.equal(toolUses.length, 1);
  assert.equal(toolUses[0].toolName, 'cloudcli-browser: browser_list_sessions');
  assert.deepEqual(toolUses[0].toolInput, { limit: 1 });
  assert.equal(sent.some((message) => message.kind === 'tool_result' && message.toolId === 'mcp-1'), true);
});

test('reply text on either side of a tool call streams as two separate segments', async () => {
  const sent: NormalizedMessage[] = [];
  const child = scriptedCursor((message, cursor) => {
    if (message.method === 'session/prompt') {
      update(cursor, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Let me ' } });
      update(cursor, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'look.' } });
      update(cursor, { sessionUpdate: 'tool_call', toolCallId: 'grep-1', title: 'Grep', kind: 'search', rawInput: {} });
      update(cursor, { sessionUpdate: 'tool_call_update', toolCallId: 'grep-1', status: 'completed', rawOutput: 'hit' });
      update(cursor, { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Found it.' } });
      update(cursor, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Here it is.' } });
      writeMessage(cursor, { jsonrpc: '2.0', id: message.id, result: { stopReason: 'end_turn' } });
    } else if (message.id !== undefined && message.method) {
      writeMessage(cursor, { jsonrpc: '2.0', id: message.id, result: { sessionId: 'acp' } });
    }
  });

  await runCursorAcpSession({
    command: 'find it',
    options: { sessionId: 'app-session', cwd: process.cwd(), permissionMode: 'default' },
    providerSessionId: null,
    resolvedModel: null,
    writer: { send(message) { sent.push(message as NormalizedMessage); } },
    processes: new Map(),
    spawnImpl: () => child,
  });

  const timeline = sent
    .filter((message) => message.kind !== 'session_created')
    .map((message) => (message.kind === 'stream_delta' ? `delta:${message.content}` : message.kind));
  assert.deepEqual(timeline, [
    'delta:Let me ',
    'delta:look.',
    'stream_end',
    'tool_use',
    'tool_result',
    'thinking',
    'delta:Here it is.',
    'stream_end',
    'complete',
  ]);
});

test('Cursor history is stamped back from the last write, in transcript order', () => {
  const provider = new CursorSessionsProvider();
  const lastWrittenAt = Date.parse('2026-11-01T13:00:00.000Z');
  const messages = provider.normalizeCursorBlobs([
    { id: 'a', sequence: 1, rowid: 1, content: { role: 'user', content: 'question' } },
    { id: 'b', sequence: 2, rowid: 2, content: { role: 'assistant', content: [{ type: 'reasoning', text: 'thinking' }] } },
    { id: 'c', sequence: 3, rowid: 3, content: { role: 'assistant', content: 'answer' } },
  ], 'app-session', lastWrittenAt);

  const times = messages.map((message) => Date.parse(message.timestamp));
  assert.equal(times[times.length - 1], lastWrittenAt);
  assert.deepEqual([...times].sort((left, right) => left - right), times);
  assert.equal(new Set(times).size, times.length);
});
