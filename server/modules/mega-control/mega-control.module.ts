import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Router } from 'express';

import { createMegaControlAgentRouter, createMegaControlUserRouter } from './mega-control.routes.js';
import { createMegaControlService } from './mega-control.service.js';

// The Dockerfile moves the packaged binary here and puts a script at its old path, because
// mega-exec starts the server from that old path. Only this module starts the real one.
const SERVER_BINARY = '/usr/bin/mega-cmd-server.real';
const CLIENT_BINARY = '/usr/bin/mega-exec';
const STATUS_TIMEOUT_MS = 8_000;
const MAX_SYNC_OUTPUT_LENGTH = 4_000;

const megaDirectory = path.join(os.homedir(), '.megaCmd');

/** A short allow list, so the server gets neither a dead proxy address nor this app's secrets. */
function serverEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ['HOME', 'PATH', 'USER', 'LANG', 'LC_ALL']) {
    if (process.env[name]) {
      environment[name] = process.env[name];
    }
  }
  return environment;
}

function listServerPids(): number[] {
  return fs.readdirSync('/proc')
    .filter((entry) => /^\d+$/.test(entry))
    .filter((entry) => {
      try {
        // A zombie has no exe link, and the helper script's exe is bash, so neither matches.
        return fs.readlinkSync(`/proc/${entry}/exe`) === SERVER_BINARY;
      } catch {
        return false;
      }
    })
    .map(Number);
}

function isSandboxed(pid: number): boolean {
  try {
    // Landlock requires no_new_privs and nothing else in this container sets it.
    return /^NoNewPrivs:\s*1$/m.test(fs.readFileSync(`/proc/${pid}/status`, 'utf8'));
  } catch {
    return false;
  }
}

function startServer(): number {
  const child = spawn(SERVER_BINARY, ['--do-not-log-to-stdout'], {
    argv0: 'mega-cmd-server',
    cwd: os.homedir(),
    env: serverEnvironment(),
    detached: true,
    stdio: 'ignore',
  });
  child.once('error', (error) => console.error('[mega-control] MEGAcmd failed to start:', error.message));
  if (child.pid === undefined) {
    throw new Error('MEGAcmd failed to start.');
  }
  child.unref();
  return child.pid;
}

function readSyncOutput(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      CLIENT_BINARY,
      ['sync'],
      { cwd: os.homedir(), env: serverEnvironment(), timeout: STATUS_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error?.killed) {
          resolve(null);
          return;
        }
        resolve(`${stdout}${stderr}`.trim().slice(0, MAX_SYNC_OUTPUT_LENGTH));
      },
    );
  });
}

/** Helpers run inside the sandbox and can read this folder, which is on nono's allow list. */
function writeAgentToken(): string {
  const token = randomBytes(32).toString('hex');
  fs.mkdirSync(megaDirectory, { recursive: true, mode: 0o700 });
  const tokenPath = path.join(megaDirectory, '.agentweb-control-token');
  fs.writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });
  return token;
}

/** Used by the server entrypoint to mount the MEGA routes and start MEGAcmd when it boots. */
export function createMegaControlModule(): {
  userRoutes: Router;
  agentRoutes: Router;
  ensureRunningOnStartup: () => Promise<void>;
} {
  const installed = fs.existsSync(SERVER_BINARY);
  const service = createMegaControlService({
    isInstalled: () => installed,
    listServerPids,
    isSandboxed,
    sendSignal: (pid, signal) => process.kill(pid, signal),
    startServer,
    readSyncOutput,
    wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  });

  return {
    userRoutes: createMegaControlUserRouter(service),
    // Without MEGAcmd there is nothing to control, so a random token nobody can read shuts these routes.
    agentRoutes: createMegaControlAgentRouter(service, installed ? writeAgentToken() : randomBytes(32).toString('hex')),
    ensureRunningOnStartup: async () => {
      // Nothing can sync before a login. The first mega-login starts the server through the helper.
      if (installed && fs.existsSync(path.join(megaDirectory, 'session'))) {
        const result = await service.ensureRunning();
        console.log('[mega-control] startup:', result.action, result.error ?? '');
      }
    },
  };
}
