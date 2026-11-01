import { useEffect, useRef, useState } from 'react';

import { api, readApiJson } from '@/shared/api';
import type { BrowserUseSession } from '@/shared/types';

const LIVE_SESSION_POLL_INTERVAL_MS = 3000;

function pickLiveSession(sessions: BrowserUseSession[]): BrowserUseSession | null {
  const ready = [...sessions].reverse().filter((session) => session.status === 'ready');
  return ready.find((session) => session.debugUrl) || ready[0] || null;
}

/**
 * Polls agent browser sessions while `enabled` and returns the one currently
 * driving the browser. `openSignal` increases each time an agent starts a
 * session the hook has not seen, so the floating window can pop back open.
 */
export function useLiveBrowserSession(enabled: boolean) {
  // The session the floating window shows; null hides the window entirely.
  const [liveSession, setLiveSession] = useState<BrowserUseSession | null>(null);
  // Bumped when a new ready session appears; the window reopens when it changes.
  const [openSignal, setOpenSignal] = useState(0);
  // Null until the first poll, so sessions that already existed do not count as new.
  const knownSessionIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const response = await api.browserUse.sessions({ compact: true });
        const data = await readApiJson<{ data: { sessions: BrowserUseSession[] } }>(response);
        if (cancelled) return;

        const sessions = data.data.sessions;
        const previousIds = knownSessionIds.current;
        knownSessionIds.current = new Set(sessions.map((session) => session.id));
        if (previousIds && sessions.some((session) => session.status === 'ready' && !previousIds.has(session.id))) {
          setOpenSignal((value) => value + 1);
        }
        setLiveSession(pickLiveSession(sessions));
      } catch {
        // A failed poll keeps the last frame; the next poll retries.
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), LIVE_SESSION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return { liveSession: enabled ? liveSession : null, openSignal };
}
