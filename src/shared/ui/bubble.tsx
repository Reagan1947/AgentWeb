import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/utils';

/** Used by the chat transcript to stack consecutive bubbles from one sender. */
export function BubbleGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="bubble-group"
      className={cn('flex min-w-0 flex-col gap-1', className)}
      {...props}
    />
  );
}

const bubbleVariants = cva(
  'relative flex w-fit min-w-0 max-w-full flex-col rounded-2xl border px-3 py-2 text-sm shadow-sm',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        muted: 'border-border/60 bg-muted/60 text-foreground dark:bg-gray-800/60',
        tinted: 'border-primary/20 bg-primary/10 text-foreground',
        outline: 'border-border bg-transparent text-foreground',
        ghost: 'border-transparent bg-transparent text-foreground shadow-none',
        destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type BubbleProps = React.ComponentProps<'div'> &
  VariantProps<typeof bubbleVariants> & {
    /** Which corner of the bubble is squared off, matching the side the row sits on. */
    align?: 'start' | 'end';
  };

/** The framed surface of one message. Used by the chat transcript inside Message. */
export function Bubble({ variant = 'default', align = 'start', className, ...props }: BubbleProps) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(
        bubbleVariants({ variant }),
        align === 'end' ? 'rounded-br-md' : 'rounded-bl-md',
        className,
      )}
      {...props}
    />
  );
}

/** Text slot of Bubble. Used by the chat transcript for the message body. */
export function BubbleContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="bubble-content"
      className={cn('w-fit max-w-full min-w-0 break-words', className)}
      {...props}
    />
  );
}

type BubbleReactionsProps = React.ComponentProps<'div'> & {
  align?: 'start' | 'end';
  side?: 'top' | 'bottom';
};

/** Reaction chips anchored to a bubble edge. Available to any message that needs them. */
export function BubbleReactions({
  side = 'bottom',
  align = 'end',
  className,
  ...props
}: BubbleReactionsProps) {
  return (
    <div
      data-slot="bubble-reactions"
      data-align={align}
      data-side={side}
      className={cn(
        'absolute z-10 flex w-fit items-center justify-center rounded-full border bg-background px-1.5 py-0.5 text-xs shadow-sm',
        side === 'top' ? '-top-2' : '-bottom-2',
        align === 'end' ? 'right-2' : 'left-2',
        className,
      )}
      {...props}
    />
  );
}
