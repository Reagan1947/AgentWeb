import * as React from 'react';
import { ChevronRightIcon } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/Collapsible';
import { cn } from '@/shared/utils';

/** A list of agent steps. Used by the chat transcript for tools, plans, commands and citations. */
export function Trace({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="trace"
      className={cn('flex w-full min-w-0 flex-col gap-0.5', className)}
      {...props}
    />
  );
}

type TraceLineProps = React.ComponentProps<'span'> & {
  /** Running pulses the title, error tints it, pending fades it. */
  status?: 'running' | 'error' | 'pending';
};

/** One step: icon, title, optional detail. Used inside Trace by the chat transcript. */
export function TraceLine({ className, status, ...props }: TraceLineProps) {
  return (
    <span
      data-slot="trace-line"
      data-status={status}
      className={cn(
        'flex w-fit max-w-full min-w-0 items-center gap-1.5 text-xs text-muted-foreground',
        status === 'error' && 'text-destructive',
        status === 'pending' && 'opacity-60',
        status === 'running' && '[&_[data-slot=trace-title]]:animate-pulse',
        className,
      )}
      {...props}
    />
  );
}

/** Icon slot of a trace line, hidden from assistive tech. Used by the chat transcript. */
export function TraceIcon({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="trace-icon"
      aria-hidden="true"
      className={cn('flex size-3.5 shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:size-3.5', className)}
      {...props}
    />
  );
}

/** Accessible name of a trace line. Used by the chat transcript. */
export function TraceTitle({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="trace-title"
      className={cn('min-w-0 truncate', className)}
      {...props}
    />
  );
}

/** Secondary detail on a trace line, such as a count or duration. Used by the chat transcript. */
export function TraceDescription({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="trace-description"
      className={cn('shrink-0 tabular-nums text-muted-foreground/70', className)}
      {...props}
    />
  );
}

type TraceCollapsibleProps = {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children?: React.ReactNode;
};

/** An expandable trace step. Used by the chat transcript when a step has detail. */
export function TraceCollapsible({ className, ...props }: TraceCollapsibleProps) {
  return (
    <Collapsible
      data-slot="trace-collapsible"
      className={cn('flex w-full min-w-0 flex-col', className)}
      {...props}
    />
  );
}

/** Header button of a trace step. Appends the disclosure chevron. Used by the chat transcript. */
export function TraceCollapsibleTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger>) {
  return (
    <CollapsibleTrigger
      data-slot="trace-collapsible-trigger"
      className={cn(
        'group/trace-collapsible-trigger flex w-fit max-w-full min-w-0 items-center gap-1 text-left text-muted-foreground outline-none hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
      <TraceIcon className="transition-transform group-data-[state=open]/trace-collapsible-trigger:rotate-90">
        <ChevronRightIcon />
      </TraceIcon>
    </CollapsibleTrigger>
  );
}

/** Detail under a trace step. Used by the chat transcript for command output, plans and citations. */
export function TraceCollapsibleContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent data-slot="trace-collapsible-content" {...props}>
      <div
        data-slot="trace-collapsible-content-inner"
        className={cn('min-w-0 break-words pl-[18px] pt-1 text-muted-foreground', className)}
      >
        {children}
      </div>
    </CollapsibleContent>
  );
}
