import * as React from 'react';

import { cn } from '@/shared/utils';

/** Shortest overlay thumb, so a long list still leaves a grabbable pill. */
const THUMB_MIN_HEIGHT_PX = 28;
/** How long the thumb stays visible after scrolling stops, when the pointer has left. */
const THUMB_IDLE_HIDE_MS = 700;

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Draws a thin overlay thumb and hides the native scrollbar so the thumb
   * does not reserve width. The sidebar list uses this.
   */
  overlayScrollbar?: boolean;
  /**
   * Softens rows that are sliding out of the top or bottom edge. The sidebar
   * list uses this instead of a hard clip against the header and footer.
   */
  edgeFade?: boolean;
};

type ScrollEdgeOverflow = {
  top: boolean;
  bottom: boolean;
};

/** A few pixels of movement before an edge fade appears, so a resting list stays sharp. */
const EDGE_OVERFLOW_THRESHOLD_PX = 2;

/**
 * Blur stacked toward the clipped edge. The outer layers cover less of the
 * strip, so a row dissolves as it leaves instead of staying equally fuzzy.
 */
const SCROLL_EDGE_BLUR_LAYERS = [
  { blur: 1, clearAt: 100 },
  { blur: 2, clearAt: 72 },
  { blur: 5, clearAt: 46 },
  { blur: 10, clearAt: 24 },
] as const;

function scrollEdgeMask(edge: 'top' | 'bottom', clearAt: number) {
  const direction = edge === 'top' ? 'to bottom' : 'to top';
  return `linear-gradient(${direction}, black 0%, transparent ${clearAt}%)`;
}

/** Fades the rows themselves, so a clipped edge dissolves instead of ending on a hard cut. */
function scrollViewportMask(edge: ScrollEdgeOverflow) {
  if (!edge.top && !edge.bottom) return 'none';
  const top = edge.top ? 'transparent 0px, black 28px' : 'black 0px';
  const bottom = edge.bottom ? 'black calc(100% - 28px), transparent 100%' : 'black 100%';
  return `linear-gradient(to bottom, ${top}, ${bottom})`;
}

/** Painted over a scroll edge. The mask keeps the blur strongest at the clip and clear toward the list. */
function ScrollEdgeFade({ edge, active }: { edge: 'top' | 'bottom'; active: boolean }) {
  const isTop = edge === 'top';
  return (
    <div
      data-scroll-edge={edge}
      data-active={active ? 'true' : 'false'}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 z-[1] h-7 transition-opacity duration-200',
        isTop ? 'top-0' : 'bottom-0',
        active ? 'opacity-100' : 'opacity-0',
      )}
    >
      {SCROLL_EDGE_BLUR_LAYERS.map((layer) => {
        const maskImage = scrollEdgeMask(edge, layer.clearAt);
        return (
          <div
            key={layer.blur}
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${layer.blur}px)`,
              WebkitBackdropFilter: `blur(${layer.blur}px)`,
              maskImage,
              WebkitMaskImage: maskImage,
            }}
          />
        );
      })}
      <div
        className={cn(
          'absolute inset-0',
          isTop
            ? 'bg-gradient-to-b from-background/90 via-background/50 to-transparent'
            : 'bg-gradient-to-t from-background/90 via-background/50 to-transparent',
        )}
      />
    </div>
  );
}

type ThumbDrag = {
  pointerId: number;
  startY: number;
  startScrollTop: number;
  overflow: number;
  maxOffset: number;
};

/**
 * Thumb size and offset for an overlay scrollbar. Returns null when the
 * viewport already shows everything, so the thumb stays hidden.
 */
function overlayThumbGeometry(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  trackHeight: number,
): { height: number; offset: number } | null {
  const overflow = scrollHeight - clientHeight;
  if (overflow <= 1 || trackHeight <= 0) return null;

  const height = Math.min(
    trackHeight,
    Math.max(THUMB_MIN_HEIGHT_PX, (clientHeight / scrollHeight) * trackHeight),
  );
  const maxOffset = trackHeight - height;
  const offset = maxOffset <= 0 ? 0 : (scrollTop / overflow) * maxOffset;
  return { height, offset };
}

/** Used by the file-tree and sidebar modules for consistently styled scroll containers. The sidebar passes `overlayScrollbar` so its list keeps a thin thumb that does not take width from the rows, and `edgeFade` so rows soften as they scroll past the header and footer. */
export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, overlayScrollbar = false, edgeFade = false, ...props }, ref) => {
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const trackRef = React.useRef<HTMLDivElement | null>(null);
    const thumbRef = React.useRef<HTMLDivElement | null>(null);
    const hoveringRef = React.useRef(false);
    const draggingRef = React.useRef<ThumbDrag | null>(null);
    const hideTimerRef = React.useRef<number | null>(null);
    const thumbActiveRef = React.useRef(false);
    const canScrollRef = React.useRef(false);
    const previousUserSelectRef = React.useRef('');

    // True while the pointer is over the list or a scroll just happened, so the
    // thumb can fade out once the list is idle instead of staying on screen.
    const [thumbActive, setThumbActive] = React.useState(false);
    // True only when the content is taller than the viewport. The thumb is
    // omitted from layout until then, including when the project list is short.
    const [canScroll, setCanScroll] = React.useState(false);
    // Which edges are clipping rows. The fade stays off at a resting edge so the
    // first and last visible rows are not blurred while the list is parked there.
    const [edgeOverflow, setEdgeOverflow] = React.useState<ScrollEdgeOverflow>({ top: false, bottom: false });

    const setThumbActiveState = React.useCallback((active: boolean) => {
      if (thumbActiveRef.current === active) return;
      thumbActiveRef.current = active;
      setThumbActive(active);
    }, []);

    const clearHideTimer = React.useCallback(() => {
      if (hideTimerRef.current === null) return;
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }, []);

    const scheduleHide = React.useCallback(() => {
      clearHideTimer();
      if (hoveringRef.current || draggingRef.current) return;
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null;
        setThumbActiveState(false);
      }, THUMB_IDLE_HIDE_MS);
    }, [clearHideTimer, setThumbActiveState]);

    const revealThumb = React.useCallback(() => {
      setThumbActiveState(true);
      scheduleHide();
    }, [scheduleHide, setThumbActiveState]);

    const syncEdges = React.useCallback(() => {
      if (!edgeFade) return;
      const viewport = viewportRef.current;
      if (!viewport) return;

      const overflow = viewport.scrollHeight - viewport.clientHeight;
      const top = viewport.scrollTop > EDGE_OVERFLOW_THRESHOLD_PX;
      const bottom = overflow > EDGE_OVERFLOW_THRESHOLD_PX
        && viewport.scrollTop < overflow - EDGE_OVERFLOW_THRESHOLD_PX;
      setEdgeOverflow((current) => (
        current.top === top && current.bottom === bottom ? current : { top, bottom }
      ));
    }, [edgeFade]);

    const syncThumb = React.useCallback(() => {
      syncEdges();
      const viewport = viewportRef.current;
      const track = trackRef.current;
      const thumb = thumbRef.current;
      if (!viewport || !track || !thumb) return;

      const geometry = overlayThumbGeometry(
        viewport.scrollTop,
        viewport.scrollHeight,
        viewport.clientHeight,
        track.clientHeight,
      );
      const nextCanScroll = geometry !== null;
      if (canScrollRef.current !== nextCanScroll) {
        canScrollRef.current = nextCanScroll;
        setCanScroll(nextCanScroll);
      }
      if (!geometry) return;

      thumb.style.height = `${geometry.height}px`;
      thumb.style.transform = `translate3d(0, ${geometry.offset}px, 0)`;
    }, [syncEdges]);

    const setViewportRef = React.useCallback((node: HTMLDivElement | null) => {
      viewportRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }, [ref]);

    React.useEffect(() => {
      if (!overlayScrollbar) return undefined;

      syncThumb();
      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || typeof ResizeObserver === 'undefined') {
        return () => clearHideTimer();
      }

      // The viewport box stays the same height when projects are added; the
      // content box is what grows, and that is what changes the thumb.
      const observer = new ResizeObserver(() => syncThumb());
      observer.observe(viewport);
      if (content) observer.observe(content);

      return () => {
        observer.disconnect();
        clearHideTimer();
        if (draggingRef.current) {
          document.body.style.userSelect = previousUserSelectRef.current;
          draggingRef.current = null;
        }
      };
    }, [clearHideTimer, overlayScrollbar, syncThumb]);

    const endDrag = React.useCallback((pointerId: number) => {
      const drag = draggingRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      draggingRef.current = null;
      document.body.style.userSelect = previousUserSelectRef.current;
      scheduleHide();
    }, [scheduleHide]);

    const onThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (!canScrollRef.current) return;
      const viewport = viewportRef.current;
      const thumb = thumbRef.current;
      if (!viewport || !thumb) return;

      const geometry = overlayThumbGeometry(
        viewport.scrollTop,
        viewport.scrollHeight,
        viewport.clientHeight,
        trackRef.current?.clientHeight ?? 0,
      );
      if (!geometry) return;

      if (!Number.isFinite(event.clientY)) return;
      event.preventDefault();
      event.stopPropagation();
      previousUserSelectRef.current = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      draggingRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startScrollTop: viewport.scrollTop,
        overflow: viewport.scrollHeight - viewport.clientHeight,
        maxOffset: (trackRef.current?.clientHeight ?? 0) - geometry.height,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      revealThumb();
    };

    const onThumbPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = draggingRef.current;
      const viewport = viewportRef.current;
      if (!drag || !viewport || drag.pointerId !== event.pointerId || drag.maxOffset <= 0) return;

      if (!Number.isFinite(event.clientY)) return;
      const delta = event.clientY - drag.startY;
      viewport.scrollTop = drag.startScrollTop + (delta / drag.maxOffset) * drag.overflow;
      syncThumb();
    };

    return (
      <div
        className={cn(className, overlayScrollbar && 'group/scroll isolate', 'relative overflow-hidden')}
        {...props}
        onPointerEnter={overlayScrollbar ? (event) => {
          props.onPointerEnter?.(event);
          hoveringRef.current = true;
          if (canScrollRef.current) revealThumb();
        } : props.onPointerEnter}
        onPointerLeave={overlayScrollbar ? (event) => {
          props.onPointerLeave?.(event);
          hoveringRef.current = false;
          if (!draggingRef.current) scheduleHide();
        } : props.onPointerLeave}
      >
        {/* Inner container keeps border radius while allowing momentum scrolling on touch devices. */}
        <div
          ref={setViewportRef}
          className={cn(
            'h-full w-full rounded-[inherit]',
            overlayScrollbar
              // z-0 traps sticky project rows (z-10) in this viewport so their
              // opaque background cannot paint over the overlay thumb.
              // pr-3 narrows the tree so that thumb, which sits on the
              // viewport's right edge, has a gap instead of covering the rows.
              ? 'relative z-0 scrollbar-hide overflow-x-hidden overflow-y-auto overscroll-y-contain pr-3'
              : 'overflow-auto',
          )}
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            ...(edgeFade ? {
              maskImage: scrollViewportMask(edgeOverflow),
              WebkitMaskImage: scrollViewportMask(edgeOverflow),
            } : {}),
          }}
          onScroll={overlayScrollbar ? () => {
            syncThumb();
            if (canScrollRef.current) revealThumb();
          } : undefined}
        >
          {overlayScrollbar ? <div ref={contentRef}>{children}</div> : children}
        </div>
        {edgeFade && (
          <>
            <ScrollEdgeFade edge="top" active={edgeOverflow.top} />
            <ScrollEdgeFade edge="bottom" active={edgeOverflow.bottom} />
          </>
        )}
        {overlayScrollbar && (
          <div
            ref={trackRef}
            className="pointer-events-none absolute bottom-1.5 right-0 top-1.5 z-10 w-2.5"
          >
            <div
              ref={thumbRef}
              data-overlay-thumb=""
              aria-hidden="true"
              onPointerDown={onThumbPointerDown}
              onPointerMove={onThumbPointerMove}
              onPointerUp={(event) => endDrag(event.pointerId)}
              onPointerCancel={(event) => endDrag(event.pointerId)}
              className={cn(
                'group/thumb absolute inset-x-0 top-0',
                canScroll ? 'block' : 'hidden',
                thumbActive
                  ? 'pointer-events-auto'
                  : 'pointer-events-none group-hover/scroll:pointer-events-auto',
              )}
            >
              {/* The hit target stays the full track. The pill is the visible bar:
                  a bit wider than the old clipped stroke, with semicircular caps. */}
              <div
                className={cn(
                  'absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-foreground/40 transition-opacity duration-200 ease-out group-hover/thumb:bg-foreground/70',
                  thumbActive
                    ? 'opacity-100'
                    : 'opacity-0 group-hover/scroll:opacity-100',
                )}
              />
            </div>
          </div>
        )}
      </div>
    );
  },
);

ScrollArea.displayName = 'ScrollArea';
