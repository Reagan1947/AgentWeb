import crypto from 'node:crypto';
import { cpSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { sanitizeLeafDirectoryName } from '@/shared/utils.js';

const CURSOR_ROOT = path.join(os.homedir(), '.cursor');

function printChatDirectory(sessionId: string, projectPath: string, root: string): string {
  const cwdId = crypto.createHash('md5').update(projectPath || process.cwd()).digest('hex');
  return path.join(root, 'chats', cwdId, sanitizeLeafDirectoryName(sessionId, 'cursor session id'));
}

function acpSessionDirectory(sessionId: string, root: string): string {
  return path.join(root, 'acp-sessions', sanitizeLeafDirectoryName(sessionId, 'cursor session id'));
}

/**
 * Finds the `store.db` that holds one Cursor chat. `cursor-agent acp` keeps
 * chats under `acp-sessions/<id>`, while `cursor-agent -p` keeps them under
 * `chats/<md5(cwd)>/<id>`. The ACP copy wins because it is the one new turns
 * write to. Used by the Cursor sessions provider to read history.
 */
export function resolveCursorStoreDbPath(sessionId: string, projectPath: string, root: string = CURSOR_ROOT): string {
  const acpStore = path.join(acpSessionDirectory(sessionId, root), 'store.db');
  if (existsSync(acpStore)) {
    return acpStore;
  }
  return path.join(printChatDirectory(sessionId, projectPath, root), 'store.db');
}

/**
 * `session/load` only looks in `acp-sessions`, so a chat started with
 * `cursor-agent -p` is "not found" there. Both modes use the same store
 * format, so copying the folder once lets ACP resume it with its history.
 * The original folder is left untouched. Used by the Cursor ACP session.
 */
export function ensureCursorAcpSessionStore(sessionId: string, projectPath: string, root: string = CURSOR_ROOT): void {
  const acpDirectory = acpSessionDirectory(sessionId, root);
  if (existsSync(path.join(acpDirectory, 'store.db'))) {
    return;
  }
  const printDirectory = printChatDirectory(sessionId, projectPath, root);
  if (!existsSync(path.join(printDirectory, 'store.db'))) {
    return;
  }
  cpSync(printDirectory, acpDirectory, { recursive: true });
}
