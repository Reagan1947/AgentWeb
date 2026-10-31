import * as React from 'react';

import { cn } from '@/shared/utils';

/** Used by the chat transcript to stack consecutive rows from the same sender. */
export function MessageGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-group"
      className={cn('flex min-w-0 flex-col gap-2', className)}
      {...props}
    />
  );
}

type MessageProps = React.ComponentProps<'div'> & {
  /** Which side of the thread the row sits on. End is the person's turn. */
  align?: 'start' | 'end';
};

/** Used by the chat transcript as the row around one turn: avatar, body, header and footer. */
export function Message({ className, align = 'start', ...props }: MessageProps) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        'group/message relative flex w-full min-w-0 gap-3 data-[align=end]:flex-row-reverse',
        className,
      )}
      {...props}
    />
  );
}

/** Avatar slot of Message, aligned to the bottom of the row. Used by the chat transcript. */
export function MessageAvatar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    />
  );
}

/** Body slot of Message. Used by the chat transcript for the header, bubble and footer. */
export function MessageContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-content"
      className={cn('flex w-full min-w-0 flex-col break-words', className)}
      {...props}
    />
  );
}

/** Name row of Message. Stays at the start of the body. Used by the chat transcript. */
export function MessageHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-header"
      className={cn('mb-1 flex max-w-full min-w-0 items-center text-sm font-medium', className)}
      {...props}
    />
  );
}

/** Actions and timestamp under a message. Follows the row's side. Used by the chat transcript. */
export function MessageFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        'mt-1 flex max-w-full min-w-0 items-center gap-1 group-data-[align=end]/message:justify-end',
        className,
      )}
      {...props}
    />
  );
}
