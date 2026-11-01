import * as React from 'react';

import { cn } from '@/shared/utils';

type MessageScrollerContextValue = {
  /** The element the transcript scrolls. The chat session hook writes scrollTop here too. */
  viewportRef: React.MutableRefObject<HTMLDivElement | null>;
};

const MessageScrollerContext = React.createContext<MessageScrollerContextValue | null>(null);

function useMessageScrollerContext() {
  const context = React.useContext(MessageScrollerContext);
  if (!context) {
    throw new Error('Message scroller parts must be used within MessageScrollerProvider');
  }
  return context;
}

type MessageScrollerProviderProps = {
  children: React.ReactNode;
};

/**
 * Owns the transcript viewport ref. Used by the chat message pane.
 *
 * Opening position, streamed follow and history prepend stay in the chat
 * session hook, which already drives this viewport through the forwarded ref.
 */
export function MessageScrollerProvider({ children }: MessageScrollerProviderProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const value = React.useMemo(() => ({ viewportRef }), []);
  return <MessageScrollerContext.Provider value={value}>{children}</MessageScrollerContext.Provider>;
}

/** Frame around the transcript viewport. Used by the chat message pane. */
export function MessageScroller({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-scroller"
      className={cn('relative flex size-full min-h-0 flex-col overflow-hidden', className)}
      {...props}
    />
  );
}

function assignRef<T>(ref: React.ForwardedRef<T>, node: T | null) {
  if (typeof ref === 'function') {
    ref(node);
  } else if (ref) {
    ref.current = node;
  }
}

/** The scrollable transcript. Used by the chat message pane; its ref is the session hook's scroll container. */
export const MessageScrollerViewport = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    const { viewportRef } = useMessageScrollerContext();
    return (
      <div
        ref={(node) => {
          viewportRef.current = node;
          assignRef(ref, node);
        }}
        data-slot="message-scroller-viewport"
        className={cn('size-full min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain', className)}
        {...props}
      />
    );
  },
);
MessageScrollerViewport.displayName = 'MessageScrollerViewport';

/** Column of transcript rows. Used by the chat message pane. */
export function MessageScrollerContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-scroller-content"
      className={cn('flex h-max min-h-full flex-col', className)}
      {...props}
    />
  );
}

type MessageScrollerItemProps = React.ComponentProps<'div'> & {
  messageId: string;
  /** Marks the row a new turn should settle on. The session hook performs that scroll. */
  scrollAnchor?: boolean;
};

/** One transcript row boundary. Used by the chat message pane around each lazy row. */
export function MessageScrollerItem({
  className,
  messageId,
  scrollAnchor = false,
  ...props
}: MessageScrollerItemProps) {
  return (
    <div
      data-slot="message-scroller-item"
      data-message-id={messageId}
      data-scroll-anchor={scrollAnchor || undefined}
      className={cn('min-w-0 shrink-0', className)}
      {...props}
    />
  );
}
