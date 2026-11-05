const STOP_POLL_INTERVAL_MS = 500;
const STOP_TIMEOUT_MS = 15_000;
const KILL_TIMEOUT_MS = 3_000;
// A server that cannot load or find its lock exits at once, so this is long enough to catch that.
const START_SETTLE_MS = 2_000;

type MegaControlDependencies = {
  isInstalled: () => boolean;
  /** PIDs of live server processes. Zombies must not be included. */
  listServerPids: () => number[];
  /** True when the process inherited a nono sandbox, which also means a proxy that will die with it. */
  isSandboxed: (pid: number) => boolean;
  sendSignal: (pid: number, signal: NodeJS.Signals) => void;
  /** Starts a server outside any sandbox and returns its PID. */
  startServer: () => number;
  /** The output of `mega-sync`, or null when the server does not answer. */
  readSyncOutput: () => Promise<string | null>;
  wait: (milliseconds: number) => Promise<void>;
};

type MegaControlResult = {
  success: boolean;
  action: 'started' | 'restarted' | 'already-running' | 'none';
  pid: number | null;
  error?: string;
};

/** Used by the mega-control module to start and restart MEGAcmd from outside the nono sandbox. */
export function createMegaControlService(dependencies: MegaControlDependencies) {
  // Agents and the settings page can ask at the same moment. Two overlapping restarts would race
  // on MEGAcmd's lock file, so every change waits for the one before it.
  let pendingChange: Promise<unknown> = Promise.resolve();

  function runExclusive(change: () => Promise<MegaControlResult>): Promise<MegaControlResult> {
    const result = pendingChange.then(change, change);
    pendingChange = result.catch(() => undefined);
    return result;
  }

  async function waitForExit(pids: number[], timeoutMs: number): Promise<boolean> {
    for (let waited = 0; ; waited += STOP_POLL_INTERVAL_MS) {
      const running = dependencies.listServerPids();
      if (!pids.some((pid) => running.includes(pid))) {
        return true;
      }
      if (waited >= timeoutMs) {
        return false;
      }
      await dependencies.wait(STOP_POLL_INTERVAL_MS);
    }
  }

  async function stopRunningServers(): Promise<void> {
    const pids = dependencies.listServerPids();
    pids.forEach((pid) => dependencies.sendSignal(pid, 'SIGTERM'));
    if (await waitForExit(pids, STOP_TIMEOUT_MS)) {
      return;
    }
    const remaining = dependencies.listServerPids().filter((pid) => pids.includes(pid));
    remaining.forEach((pid) => dependencies.sendSignal(pid, 'SIGKILL'));
    if (!(await waitForExit(remaining, KILL_TIMEOUT_MS))) {
      throw new Error(`MEGAcmd did not stop: ${remaining.join(', ')}`);
    }
  }

  async function startAndConfirm(action: 'started' | 'restarted'): Promise<MegaControlResult> {
    const pid = dependencies.startServer();
    await dependencies.wait(START_SETTLE_MS);
    if (!dependencies.listServerPids().includes(pid)) {
      return { success: false, action, pid: null, error: 'MEGAcmd exited right after it started.' };
    }
    return { success: true, action, pid };
  }

  function notInstalled(): MegaControlResult {
    return { success: false, action: 'none', pid: null, error: 'MEGAcmd is not installed in this image.' };
  }

  return {
    /** Starts the server if none is running, and replaces one that inherited a sandbox. */
    ensureRunning(): Promise<MegaControlResult> {
      return runExclusive(async () => {
        if (!dependencies.isInstalled()) {
          return notInstalled();
        }
        const pids = dependencies.listServerPids();
        if (pids.length === 0) {
          return startAndConfirm('started');
        }
        if (pids.some((pid) => dependencies.isSandboxed(pid))) {
          await stopRunningServers();
          return startAndConfirm('restarted');
        }
        return { success: true, action: 'already-running', pid: pids[0] ?? null };
      });
    },

    restart(): Promise<MegaControlResult> {
      return runExclusive(async () => {
        if (!dependencies.isInstalled()) {
          return notInstalled();
        }
        await stopRunningServers();
        return startAndConfirm('restarted');
      });
    },

    /** A live process proves little: this bug left one running with no network, so also ask it to answer. */
    async getStatus() {
      if (!dependencies.isInstalled()) {
        return { installed: false, running: false, pid: null, sandboxed: false, responding: false, syncOutput: null };
      }
      const pid = dependencies.listServerPids()[0] ?? null;
      if (pid === null) {
        return { installed: true, running: false, pid, sandboxed: false, responding: false, syncOutput: null };
      }
      const syncOutput = await dependencies.readSyncOutput();
      return {
        installed: true,
        running: true,
        pid,
        sandboxed: dependencies.isSandboxed(pid),
        responding: syncOutput !== null,
        syncOutput,
      };
    },
  };
}
