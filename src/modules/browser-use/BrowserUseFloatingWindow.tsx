import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minus, MonitorPlay, X } from 'lucide-react';

import { cn } from '@/shared/utils';
import { CHAT_HEADER_ACTIONS_PORTAL } from '@/shared/constants';
import { usePortalTarget } from '@/shared/hooks/usePortalTarget';
import { useLiveBrowserSession } from '@/modules/browser-use/hooks/useLiveBrowserSession';

type BrowserUseFloatingWindowProps = {
  /** False while the Browser tab itself is showing, or on mobile. */
  enabled: boolean;
  /** Increased by the Browser tab's pop-out button; each change reopens a closed or minimized window. */
  openRequest: number;
  /** True while the chat tab is showing; the minimized chip then sits beside chat's export button. */
  isChatVisible: boolean;
  onOpenBrowserTab: () => void;
};

type WindowGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PointerGesture = {
  kind: 'move' | 'resize';
  pointerX: number;
  pointerY: number;
  start: WindowGeometry;
};

const GEOMETRY_STORAGE_KEY = 'browserUseFloatingWindowGeometry';
const HEADER_HEIGHT = 36;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 220;
const EDGE_MARGIN = 16;

function readStoredGeometry(): WindowGeometry {
  try {
    const stored = JSON.parse(localStorage.getItem(GEOMETRY_STORAGE_KEY) || 'null') as WindowGeometry | null;
    if (stored && [stored.x, stored.y, stored.width, stored.height].every(Number.isFinite)) {
      return stored;
    }
  } catch {
    // Fall through to the default corner.
  }

  const width = 480;
  const height = width * (900 / 1440) + HEADER_HEIGHT;
  return {
    x: window.innerWidth - width - EDGE_MARGIN * 2,
    y: window.innerHeight - height - EDGE_MARGIN * 5,
    width,
    height,
  };
}

/** Keeps the window on screen after the browser window shrinks. */
function clampToViewport(geometry: WindowGeometry): WindowGeometry {
  const width = Math.min(Math.max(geometry.width, MIN_WIDTH), window.innerWidth - EDGE_MARGIN * 2);
  const height = Math.min(Math.max(geometry.height, MIN_HEIGHT), window.innerHeight - EDGE_MARGIN * 2);
  return {
    width,
    height,
    x: Math.min(Math.max(geometry.x, EDGE_MARGIN), window.innerWidth - width - EDGE_MARGIN),
    y: Math.min(Math.max(geometry.y, EDGE_MARGIN), window.innerHeight - height - EDGE_MARGIN),
  };
}

function getDomain(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Used by the project-workspace module to keep the agent's live browser visible over chat and the other tabs. */
export default function BrowserUseFloatingWindow({
  enabled,
  openRequest,
  isChatVisible,
  onOpenBrowserTab,
}: BrowserUseFloatingWindowProps) {
  const { t } = useTranslation('settings');
  const { liveSession, openSignal } = useLiveBrowserSession(enabled);
  // A new agent session or a pop-out request changes this, which reopens the window.
  const windowSignal = `${openSignal}:${openRequest}`;
  // Position and size the user dragged to, restored across reloads.
  const [geometry, setGeometry] = useState<WindowGeometry>(readStoredGeometry);
  // The windowSignal the user closed or minimized at.
  const [closedAtSignal, setClosedAtSignal] = useState<string | null>(null);
  const [minimizedAtSignal, setMinimizedAtSignal] = useState<string | null>(null);
  // True during a drag or resize, so the iframe stops swallowing pointer events.
  const [isInteracting, setIsInteracting] = useState(false);
  const gesture = useRef<PointerGesture | null>(null);
  const registeredChatHeaderSlot = usePortalTarget(CHAT_HEADER_ACTIONS_PORTAL);
  // The chat pane stays mounted behind other tabs, so its slot only counts while chat is showing.
  const chatHeaderSlot = isChatVisible ? registeredChatHeaderSlot : null;

  if (!enabled || !liveSession || closedAtSignal === windowSignal) {
    return null;
  }

  const label = liveSession.title || getDomain(liveSession.url) || t('browserUse.sessionFallback');

  if (minimizedAtSignal === windowSignal) {
    // Without the chat header slot (empty chat, or another tab is showing) the
    // chip floats where that header sits.
    const inChatHeader = Boolean(chatHeaderSlot);
    const chip = (
      <button
        type="button"
        onClick={() => setMinimizedAtSignal(null)}
        title={t('browserUse.floatingRestore')}
        className={cn(
          'flex h-8 max-w-[200px] items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground',
          !inChatHeader && 'fixed right-6 top-20 z-40 shadow-lg',
        )}
      >
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
        <MonitorPlay className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    );
    return chatHeaderSlot ? createPortal(chip, chatHeaderSlot) : chip;
  }

  const frame = clampToViewport(geometry);

  const startGesture = (kind: PointerGesture['kind']) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { kind, pointerX: event.clientX, pointerY: event.clientY, start: frame };
    setIsInteracting(true);
  };

  const moveGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active) return;
    const dx = event.clientX - active.pointerX;
    const dy = event.clientY - active.pointerY;
    if (active.kind === 'move') {
      setGeometry({ ...active.start, x: active.start.x + dx, y: active.start.y + dy });
      return;
    }
    // The handle sits on the top-left corner, so the bottom-right corner stays put.
    const width = Math.max(MIN_WIDTH, active.start.width - dx);
    const height = Math.max(MIN_HEIGHT, active.start.height - dy);
    setGeometry({
      x: active.start.x + active.start.width - width,
      y: active.start.y + active.start.height - height,
      width,
      height,
    });
  };

  const endGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (!gesture.current) return;
    gesture.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsInteracting(false);
    setGeometry((current) => {
      const settled = clampToViewport(current);
      localStorage.setItem(GEOMETRY_STORAGE_KEY, JSON.stringify(settled));
      return settled;
    });
  };

  const hasLiveView = Boolean(liveSession.debugUrl);

  return (
    <div
      className="fixed z-40 flex flex-col overflow-hidden rounded-lg border border-border bg-neutral-950 shadow-2xl"
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    >
      <div
        className="flex shrink-0 cursor-move select-none items-center gap-2 border-b border-white/10 bg-neutral-900 px-2 text-xs text-white/80"
        style={{ height: HEADER_HEIGHT }}
        onPointerDown={startGesture('move')}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <button
          type="button"
          onClick={onOpenBrowserTab}
          title={t('browserUse.floatingOpenTab')}
          aria-label={t('browserUse.floatingOpenTab')}
          className="rounded p-1 hover:bg-white/10"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setMinimizedAtSignal(windowSignal)}
          title={t('browserUse.floatingMinimize')}
          aria-label={t('browserUse.floatingMinimize')}
          className="rounded p-1 hover:bg-white/10"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setClosedAtSignal(windowSignal)}
          title={t('browserUse.floatingClose')}
          aria-label={t('browserUse.floatingClose')}
          className="rounded p-1 hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className={cn('relative min-h-0 flex-1', isInteracting && 'pointer-events-none')}>
        {hasLiveView && liveSession.debugUrl ? (
          <iframe
            src={liveSession.debugUrl}
            title={t('browserUse.liveViewTitle')}
            referrerPolicy="no-referrer"
            allow="clipboard-read; clipboard-write; fullscreen"
            className="h-full w-full border-0 bg-neutral-950"
          />
        ) : liveSession.screenshotDataUrl ? (
          <img
            src={liveSession.screenshotDataUrl}
            alt={t('browserUse.screenshotAlt')}
            className="h-full w-full object-contain"
          />
        ) : null}
      </div>

      <div
        className="absolute left-0 top-0 h-3.5 w-3.5 cursor-nwse-resize rounded-tl-lg border-l-2 border-t-2 border-transparent hover:border-primary"
        onPointerDown={startGesture('resize')}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      />
    </div>
  );
}
