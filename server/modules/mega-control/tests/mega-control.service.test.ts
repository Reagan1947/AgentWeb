import assert from 'node:assert/strict';
import test from 'node:test';

import { createMegaControlService } from '../mega-control.service.js';

type Dependencies = Parameters<typeof createMegaControlService>[0];

/** A fake process table: SIGTERM ends a process unless its PID is listed in `ignoresTerm`. */
function createFakeHost(options: {
  running?: number[];
  sandboxed?: number[];
  ignoresTerm?: number[];
  startedServerDies?: boolean;
} = {}) {
  const running = new Set(options.running ?? []);
  const signals: Array<[number, string]> = [];
  let started = 0;
  const dependencies: Dependencies = {
    isInstalled: () => true,
    listServerPids: () => [...running],
    isSandboxed: (pid) => (options.sandboxed ?? []).includes(pid),
    sendSignal: (pid, signal) => {
      signals.push([pid, signal]);
      if (signal === 'SIGKILL' || !(options.ignoresTerm ?? []).includes(pid)) {
        running.delete(pid);
      }
    },
    startServer: () => {
      started += 1;
      const pid = 1000 + started;
      if (!options.startedServerDies) {
        running.add(pid);
      }
      return pid;
    },
    readSyncOutput: async () => 'ID PATH',
    wait: async () => undefined,
  };
  return { dependencies, signals, startedCount: () => started };
}

test('ensureRunning starts a server when none is running', async () => {
  const host = createFakeHost();
  const result = await createMegaControlService(host.dependencies).ensureRunning();
  assert.deepEqual(result, { success: true, action: 'started', pid: 1001 });
});

test('ensureRunning leaves a healthy server alone', async () => {
  const host = createFakeHost({ running: [50] });
  const result = await createMegaControlService(host.dependencies).ensureRunning();
  assert.equal(result.action, 'already-running');
  assert.equal(host.startedCount(), 0);
  assert.deepEqual(host.signals, []);
});

test('ensureRunning replaces a server that inherited the sandbox', async () => {
  const host = createFakeHost({ running: [50], sandboxed: [50] });
  const result = await createMegaControlService(host.dependencies).ensureRunning();
  assert.equal(result.action, 'restarted');
  assert.deepEqual(host.signals, [[50, 'SIGTERM']]);
  assert.equal(result.pid, 1001);
});

test('restart escalates to SIGKILL when SIGTERM is ignored', async () => {
  const host = createFakeHost({ running: [50], ignoresTerm: [50] });
  const result = await createMegaControlService(host.dependencies).restart();
  assert.deepEqual(host.signals, [[50, 'SIGTERM'], [50, 'SIGKILL']]);
  assert.equal(result.success, true);
});

test('restart reports a server that exits straight after starting', async () => {
  const host = createFakeHost({ startedServerDies: true });
  const result = await createMegaControlService(host.dependencies).restart();
  assert.equal(result.success, false);
  assert.equal(result.pid, null);
});

test('overlapping requests do not start two servers', async () => {
  const host = createFakeHost();
  const service = createMegaControlService(host.dependencies);
  const [first, second] = await Promise.all([service.ensureRunning(), service.ensureRunning()]);
  assert.equal(host.startedCount(), 1);
  assert.equal(first.action, 'started');
  assert.equal(second.action, 'already-running');
});

test('getStatus reports a running server that does not answer', async () => {
  const host = createFakeHost({ running: [50], sandboxed: [50] });
  host.dependencies.readSyncOutput = async () => null;
  const status = await createMegaControlService(host.dependencies).getStatus();
  assert.deepEqual(status, {
    installed: true,
    running: true,
    pid: 50,
    sandboxed: true,
    responding: false,
    syncOutput: null,
  });
});

test('nothing runs when MEGAcmd is not installed', async () => {
  const host = createFakeHost();
  host.dependencies.isInstalled = () => false;
  const service = createMegaControlService(host.dependencies);
  assert.equal((await service.restart()).success, false);
  assert.equal((await service.getStatus()).installed, false);
  assert.equal(host.startedCount(), 0);
});
