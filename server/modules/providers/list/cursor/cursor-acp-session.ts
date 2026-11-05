import { randomUUID } from 'node:crypto';
import type { Readable, Writable } from 'node:stream';

import {
  appendFilesInputTag,
  appendImagesInputTag,
} from '@/shared/image-attachments.js';
import { notifyRunFailed, notifyRunStopped } from '@/modules/notifications/index.js';
import { ensureCursorAcpSessionStore } from '@/modules/providers/list/cursor/cursor-session-store.js';
import type { ProviderPermissionDecision } from '@/shared/types.js';
import { createCompleteMessage, createNormalizedMessage, flattenPromptForWindowsShell } from '@/shared/utils.js';

/**
 * Headless `cursor-agent -p` has no approval channel: every tool that needs
 * permission is answered by an always-deny provider and reported as
 * "User rejected" before Agent Web can draw a prompt. The ACP server is the
 * CLI mode that actually asks the client, so the chat banner can answer.
 */
const ACP_ARGS = ['--trust', 'acp'];

type JsonRpcId = string | number;

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: JsonRpcId | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string; data?: { message?: string } };
};

type PendingRpc = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type ApprovalEntry = {
  requestId: string;
  toolName: string;
  input: unknown;
  sessionId: string;
  receivedAt: Date;
  resolve: (decision: ProviderPermissionDecision) => void;
};

type CursorProcess = {
  stdout: Readable | null;
  stderr: Readable | null;
  stdin: Writable | null;
  aborted?: boolean;
  kill(signal?: NodeJS.Signals): boolean;
  on(event: 'close', listener: (code: number | null) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
};

type SpawnCursor = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: ['pipe', 'pipe', 'pipe']; env: NodeJS.ProcessEnv },
) => CursorProcess;

type CursorWriter = {
  send(data: unknown): void;
  setSessionId?(sessionId: string): void;
  userId?: string | number | null;
};

type CursorAcpRunInput = {
  command: string;
  options: {
    sessionId?: string;
    cwd?: string;
    projectPath?: string;
    permissionMode?: string;
    images?: unknown;
    files?: unknown;
    sessionSummary?: string;
  };
  providerSessionId: string | null;
  resolvedModel: string | null;
  writer: CursorWriter;
  processes: Map<string, CursorProcess>;
  spawnImpl: SpawnCursor;
  isInstalled?: () => Promise<boolean>;
  extraEnv?: NodeJS.ProcessEnv;
};

const pendingApprovals = new Map<string, ApprovalEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Used by the Cursor runtime to decide between headless `-p` and an ACP session that can show approvals. */
export function cursorNeedsInteractiveApproval(options: {
  skipPermissions?: boolean;
  permissionMode?: string;
  toolsSettings?: { skipPermissions?: boolean };
} | null | undefined): boolean {
  if (!options) {
    return true;
  }
  if (options.skipPermissions || options.toolsSettings?.skipPermissions) {
    return false;
  }
  return options.permissionMode !== 'bypassPermissions';
}

/**
 * Turns one ACP `session/request_permission` into the tool name and input the
 * chat permission banner renders. Used by the Cursor ACP session.
 */
export function describeCursorPermissionRequest(params: unknown): { toolName: string; input: unknown } {
  const request = isRecord(params) ? params : {};
  const toolCall = isRecord(request.toolCall) ? request.toolCall : {};
  const title = typeof toolCall.title === 'string' ? toolCall.title.trim() : '';
  const kind = typeof toolCall.kind === 'string' ? toolCall.kind : '';
  const text = permissionContentText(toolCall.content);
  const toolName = kind === 'execute' ? 'Shell' : (title || 'Tool');
  const command = title.replace(/^`/, '').replace(/`$/, '');
  const input = kind === 'execute'
    ? { command: command || text }
    : (text || title || toolCall.rawInput || null);
  return { toolName, input };
}

function permissionContentText(content: unknown): string {
  if (!Array.isArray(content)) {
    return '';
  }
  return content.map((block) => {
    if (!isRecord(block)) {
      return '';
    }
    if (typeof block.text === 'string') {
      return block.text;
    }
    if (isRecord(block.content) && typeof block.content.text === 'string') {
      return block.content.text;
    }
    return '';
  }).filter((part) => part.length > 0).join('\n');
}

function optionIdForDecision(params: unknown, decision: ProviderPermissionDecision): string {
  const request = isRecord(params) ? params : {};
  const options = Array.isArray(request.options) ? request.options : [];
  const want = decision.allow
    ? (decision.rememberEntry ? 'allow_always' : 'allow_once')
    : 'reject_once';
  const match = options.find((option) => isRecord(option) && option.kind === want && typeof option.optionId === 'string');
  if (match && isRecord(match) && typeof match.optionId === 'string') {
    return match.optionId;
  }
  if (!decision.allow) {
    return 'reject-once';
  }
  return decision.rememberEntry ? 'allow-always' : 'allow-once';
}

function acceptsEditWithoutPrompt(permissionMode: string | undefined, kind: string): boolean {
  return permissionMode === 'acceptEdits' && (kind === 'edit' || kind === 'read');
}

/** Used by the provider runtime service so a chat permission response reaches the waiting Cursor ACP call. */
export const cursorAcpPermissions = {
  resolve(requestId: string, decision: ProviderPermissionDecision): void {
    const entry = pendingApprovals.get(requestId);
    if (!entry) {
      return;
    }
    pendingApprovals.delete(requestId);
    entry.resolve(decision);
  },

  listPending(sessionId: string): Array<{
    requestId: string;
    toolName: string;
    input: unknown;
    sessionId: string;
    receivedAt: Date;
  }> {
    return [...pendingApprovals.values()]
      .filter((entry) => entry.sessionId === sessionId)
      .map((entry) => ({
        requestId: entry.requestId,
        toolName: entry.toolName,
        input: entry.input,
        sessionId: entry.sessionId,
        receivedAt: entry.receivedAt,
      }));
  },
};

function waitForApproval(entry: Omit<ApprovalEntry, 'resolve'>): Promise<ProviderPermissionDecision> {
  return new Promise((resolve) => {
    pendingApprovals.set(entry.requestId, { ...entry, resolve });
  });
}

function cancelSessionApprovals(sessionId: string): void {
  for (const [requestId, entry] of pendingApprovals) {
    if (entry.sessionId !== sessionId) {
      continue;
    }
    pendingApprovals.delete(requestId);
    entry.resolve({ allow: false, message: 'Permission request cancelled' });
  }
}

/**
 * Speaks newline-delimited JSON-RPC with `cursor-agent acp`.
 * Used by `runCursorAcpSession` and by the Cursor ACP tests.
 */
export class CursorAcpConnection {
  private nextId = 1;
  private buffer = '';
  private readonly pending = new Map<JsonRpcId, PendingRpc>();

  constructor(
    private readonly writeLine: (line: string) => void,
    private readonly onRequest: (message: JsonRpcMessage) => Promise<unknown>,
    private readonly onNotification: (message: JsonRpcMessage) => void,
  ) {}

  pushStdout(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '').trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line) {
        this.consumeLine(line);
      }
      newline = this.buffer.indexOf('\n');
    }
  }

  failPending(error: Error): void {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      pending.reject(error);
    }
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write({ jsonrpc: '2.0', id, method, params });
    });
  }

  respond(id: JsonRpcId, result: unknown): void {
    this.write({ jsonrpc: '2.0', id, result });
  }

  private write(message: JsonRpcMessage): void {
    this.writeLine(`${JSON.stringify(message)}\n`);
  }

  private consumeLine(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }

    if (message.method && message.id !== undefined && message.id !== null) {
      void this.onRequest(message).then(
        (result) => this.respond(message.id as JsonRpcId, result),
        (error: unknown) => this.respond(message.id as JsonRpcId, {
          outcome: { outcome: 'cancelled', reason: error instanceof Error ? error.message : 'Request failed' },
        }),
      );
      return;
    }

    if (message.id !== undefined && message.id !== null && (Object.prototype.hasOwnProperty.call(message, 'result') || message.error)) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.data?.message || message.error.message || 'Cursor ACP request failed'));
        return;
      }
      pending.resolve(message.result);
      return;
    }

    if (message.method) {
      this.onNotification(message);
    }
  }
}

function updateBody(params: unknown): Record<string, unknown> {
  if (!isRecord(params)) {
    return {};
  }
  return isRecord(params.update) ? params.update : params;
}

/**
 * ACP lists models as `name[option=value,...]` (Auto is `default[]`), while
 * Agent Web stores the plain `-p` names such as `auto` or `gpt-5.5`. Returns
 * the ACP id for the stored name, or null when this server does not offer it.
 */
export function matchAcpModelId(model: string | null | undefined, models: unknown): string | null {
  if (!model || !isRecord(models) || !Array.isArray(models.availableModels)) {
    return null;
  }
  const wanted = model === 'auto' ? 'default' : model;
  for (const entry of models.availableModels) {
    const modelId = isRecord(entry) && typeof entry.modelId === 'string' ? entry.modelId : '';
    if (modelId === model || modelId === wanted || modelId.startsWith(`${wanted}[`)) {
      return modelId;
    }
  }
  return null;
}

function textOf(content: unknown): string {
  if (!isRecord(content)) {
    return '';
  }
  return typeof content.text === 'string' ? content.text : '';
}

/** Used by the Cursor runtime for every turn that still needs a visible approval. */
export async function runCursorAcpSession(input: CursorAcpRunInput): Promise<void> {
  const sessionId = input.options.sessionId || '';
  const cwd = input.options.cwd || input.options.projectPath || process.cwd();
  const processKey = sessionId || `cursor-${Date.now()}`;
  const child = input.spawnImpl('cursor-agent', ACP_ARGS, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...input.extraEnv },
  });
  input.processes.set(processKey, child);

  let completeSent = false;
  let settled = false;
  let acceptUpdates = false;
  const sawToolCall = new Set<string>();
  const stderrChunks: string[] = [];

  const send = (fields: Omit<Parameters<typeof createNormalizedMessage>[0], 'provider'>) => {
    input.writer.send(createNormalizedMessage({
      ...fields,
      sessionId: sessionId || null,
      provider: 'cursor',
    } as Parameters<typeof createNormalizedMessage>[0]));
  };

  // ACP streams a thought a few words at a time. The chat renders every
  // `thinking` message as its own row, so one thought is sent as one message.
  let thoughtBuffer = '';
  const flushThought = () => {
    if (thoughtBuffer.trim()) {
      send({ kind: 'thinking', content: thoughtBuffer });
    }
    thoughtBuffer = '';
  };

  // The chat folds every `stream_delta` into one live row until `stream_end`,
  // and Cursor stores each reply segment around a tool call as its own row. A
  // segment left open merges with the next one, matches nothing on disk, and
  // is then never retired by the history refresh.
  let messageOpen = false;
  const closeMessage = () => {
    if (messageOpen) {
      send({ kind: 'stream_end' });
    }
    messageOpen = false;
  };

  const deferredToolCalls = new Set<string>();
  const emitToolUse = (toolId: string, update: Record<string, unknown>) => {
    sawToolCall.add(toolId);
    const rawInput = update.rawInput;
    const mcpArgs = isRecord(rawInput) && typeof rawInput.providerIdentifier === 'string' ? rawInput.args : undefined;
    send({
      kind: 'tool_use',
      toolId,
      toolName: typeof update.title === 'string' ? update.title : 'Tool',
      toolInput: mcpArgs ?? rawInput,
    });
  };

  const finish = (code: number | null, error?: Error) => {
    if (settled) {
      return;
    }
    settled = true;
    cancelSessionApprovals(sessionId);
    input.processes.delete(processKey);
    if (!child.aborted && !completeSent) {
      completeSent = true;
      input.writer.send(createCompleteMessage({
        provider: 'cursor',
        sessionId: sessionId || null,
        exitCode: code ?? 1,
      }));
    }
    const userId = input.writer.userId || null;
    if (child.aborted) {
      return;
    }
    if ((code ?? 1) === 0 && !error) {
      notifyRunStopped({
        userId,
        provider: 'cursor',
        sessionId: sessionId || null,
        sessionName: input.options.sessionSummary ?? null,
        stopReason: 'completed',
      } as Parameters<typeof notifyRunStopped>[0]);
      return;
    }
    notifyRunFailed({
      userId,
      provider: 'cursor',
      sessionId: sessionId || null,
      sessionName: input.options.sessionSummary ?? null,
      error: error?.message || stderrChunks.join('').trim() || `Cursor ACP exited with code ${code}`,
    } as Parameters<typeof notifyRunFailed>[0]);
  };

  const connection = new CursorAcpConnection(
    (line) => {
      child.stdin?.write(line);
    },
    async (message) => {
      if (message.method !== 'session/request_permission') {
        return {};
      }
      const described = describeCursorPermissionRequest(message.params);
      const kind = isRecord(message.params) && isRecord(message.params.toolCall) && typeof message.params.toolCall.kind === 'string'
        ? message.params.toolCall.kind
        : '';
      // The CLI numbers its JSON-RPC requests per process, so two chats waiting
      // at once would share an id and one click would answer the wrong chat.
      const requestId = `cursor-acp-${randomUUID()}`;

      if (acceptsEditWithoutPrompt(input.options.permissionMode, kind)) {
        return {
          outcome: {
            outcome: 'selected',
            optionId: optionIdForDecision(message.params, { allow: true }),
          },
        };
      }

      closeMessage();
      flushThought();
      const decisionPromise = waitForApproval({
        requestId,
        toolName: described.toolName,
        input: described.input,
        sessionId,
        receivedAt: new Date(),
      });
      send({
        kind: 'permission_request',
        requestId,
        toolName: described.toolName,
        input: described.input,
      });
      const decision = await decisionPromise;
      send({ kind: 'permission_resolved', requestId });
      if (!decision.allow) {
        return {
          outcome: {
            outcome: 'selected',
            optionId: optionIdForDecision(message.params, decision),
          },
        };
      }
      return {
        outcome: {
          outcome: 'selected',
          optionId: optionIdForDecision(message.params, decision),
        },
      };
    },
    (message) => {
      if (!acceptUpdates || message.method !== 'session/update') {
        return;
      }
      const update = updateBody(message.params);
      const sessionUpdate = typeof update.sessionUpdate === 'string' ? update.sessionUpdate : '';
      if (sessionUpdate === 'agent_thought_chunk') {
        closeMessage();
        thoughtBuffer += textOf(update.content);
        return;
      }
      flushThought();
      if (sessionUpdate === 'agent_message_chunk') {
        const text = textOf(update.content);
        if (text) {
          messageOpen = true;
          send({ kind: 'stream_delta', content: text });
        }
        return;
      }
      closeMessage();
      if (sessionUpdate === 'tool_call') {
        const toolId = typeof update.toolCallId === 'string' ? update.toolCallId : '';
        if (!toolId || sawToolCall.has(toolId)) {
          return;
        }
        // MCP calls open as a generic "MCP: tool" and name the real tool in
        // the first update, so the row waits for that name.
        if (update.title === 'MCP: tool') {
          deferredToolCalls.add(toolId);
          return;
        }
        emitToolUse(toolId, update);
        return;
      }
      if (sessionUpdate === 'tool_call_update') {
        const toolId = typeof update.toolCallId === 'string' ? update.toolCallId : '';
        const status = typeof update.status === 'string' ? update.status : '';
        if (toolId && !sawToolCall.has(toolId) && (typeof update.title === 'string' || !deferredToolCalls.has(toolId) || status === 'completed' || status === 'failed')) {
          deferredToolCalls.delete(toolId);
          emitToolUse(toolId, update);
        }
        if (status === 'completed' || status === 'failed') {
          const output = update.rawOutput ?? update.content;
          const content = typeof output === 'string' ? output : JSON.stringify(output ?? '');
          send({
            kind: 'tool_result',
            toolId,
            toolResult: {
              content: content.slice(0, 4000),
              isError: status === 'failed',
            },
          });
        }
      }
    },
  );

  child.stdout?.on('data', (chunk: Buffer | string) => {
    connection.pushStdout(chunk.toString());
  });
  child.stderr?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString();
    if (text.trim()) {
      stderrChunks.push(text);
    }
  });
  child.on('close', () => {
    connection.failPending(new Error('Cursor ACP exited before the turn finished'));
  });
  child.on('error', (error) => {
    connection.failPending(new Error(`Cursor ACP process failed to start: ${error.message}`));
  });

  const closed = new Promise<number | null>((resolve) => {
    child.on('close', (code) => resolve(code));
    child.on('error', () => resolve(1));
  });

  try {
    await connection.request('initialize', {
      protocolVersion: 1,
      clientInfo: { name: 'agent-web', version: '0.0.0' },
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
    });

    if (input.providerSessionId) {
      ensureCursorAcpSessionStore(input.providerSessionId, cwd);
    }
    type OpenedSession = { sessionId?: string; models?: unknown };
    let created: OpenedSession | null = null;
    let resumed = Boolean(input.providerSessionId);
    if (input.providerSessionId) {
      try {
        created = await connection.request('session/load', {
          sessionId: input.providerSessionId,
          cwd,
          mcpServers: [],
        }) as OpenedSession;
      } catch (error) {
        // A chat stopped before its first turn finished is never written to
        // disk, so there is no history to lose by starting a fresh one.
        if (!(error instanceof Error) || !/not found/i.test(error.message)) {
          throw error;
        }
        resumed = false;
      }
    }
    if (!resumed) {
      created = await connection.request('session/new', { cwd, mcpServers: [] }) as OpenedSession;
    }
    const providerSessionId = (resumed ? input.providerSessionId : created?.sessionId) || input.providerSessionId;
    if (providerSessionId && !resumed) {
      input.writer.setSessionId?.(providerSessionId);
      send({ kind: 'session_created', newSessionId: providerSessionId });
    }

    const acpModelId = matchAcpModelId(input.resolvedModel, created?.models);
    if (acpModelId && providerSessionId) {
      try {
        await connection.request('session/set_model', {
          sessionId: providerSessionId,
          modelId: acpModelId,
        });
      } catch {
        // A model the ACP server does not expose should not block the turn.
      }
    }

    if (input.options.permissionMode === 'plan' && providerSessionId) {
      try {
        await connection.request('session/set_mode', {
          sessionId: providerSessionId,
          modeId: 'plan',
        });
      } catch {
        // Plan mode is a preference. The turn can still run without it.
      }
    }

    const prompt = flattenPromptForWindowsShell(appendFilesInputTag(
      appendImagesInputTag(input.command || '', input.options.images),
      input.options.files,
    ));
    acceptUpdates = true;
    await connection.request('session/prompt', {
      sessionId: providerSessionId,
      prompt: [{ type: 'text', text: prompt }],
    });
    flushThought();
    closeMessage();
    if (!child.aborted && !completeSent) {
      completeSent = true;
      input.writer.send(createCompleteMessage({
        provider: 'cursor',
        sessionId: sessionId || null,
        exitCode: 0,
      }));
    }
    child.kill('SIGTERM');
    finish(0);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    if (!child.aborted) {
      const installed = input.isInstalled ? await input.isInstalled() : true;
      send({
        kind: 'error',
        content: installed
          ? failure.message
          : 'Cursor CLI is not installed. Please install it from https://cursor.com',
      });
    }
    child.kill('SIGTERM');
    finish(1, failure);
    if (!child.aborted) {
      throw failure;
    }
  } finally {
    connection.failPending(new Error('Cursor ACP session closed'));
    await Promise.race([
      closed,
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
  }
}
