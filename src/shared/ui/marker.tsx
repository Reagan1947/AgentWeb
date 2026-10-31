import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/utils';

const markerVariants = cva('flex w-full min-w-0 items-center gap-2 text-xs text-muted-foreground', {
  variants: {
    variant: {
      default: '',
      separator: 'py-0.5',
      border: 'border-y border-border/60 py-1',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type MarkerProps = React.ComponentProps<'div'> & VariantProps<typeof markerVariants>;

/** A note or divider between turns. Used by the chat transcript for compaction and task notices. */
export function Marker({ className, variant = 'default', ...props }: MarkerProps) {
  return (
    <div
      data-slot="marker"
      data-variant={variant}
      className={cn(markerVariants({ variant }), className)}
      {...props}
    />
  );
}

/** Icon slot of Marker, hidden from assistive tech. Used by the chat transcript. */
export function MarkerIcon({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="marker-icon"
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center', className)}
      {...props}
    />
  );
}

/** Text slot of Marker. Used by the chat transcript. */
export function MarkerContent({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="marker-content"
      className={cn('min-w-0 break-words', className)}
      {...props}
    />
  );
}
