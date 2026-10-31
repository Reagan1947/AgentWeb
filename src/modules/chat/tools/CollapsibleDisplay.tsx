import React from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
} from '@/shared/ui';
import { cn } from '@/shared/utils';
import { useIsExportingTranscript } from '@/modules/chat/context/TranscriptRenderContext';

type CollapsibleDisplayProps = {
  toolName: string;
  toolId?: string;
  title: string;
  /** Extra classes for the title, e.g. `font-mono` for a file name that cannot be clicked. */
  titleClassName?: string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  onTitleClick?: () => void;
  children: React.ReactNode;
  showRawParameters?: boolean;
  rawContent?: string;
  className?: string;
  toolCategory?: string;
};

/**
 * Rendered by chat's ToolRenderer for tools configured to show their input and
 * result inside an expandable trace step, and by BashEditDiff for each file a
 * Bash command changed, so those read like the Edit rows.
 *
 * A clickable title stays a separate button from the disclosure chevron, so
 * opening the file does not also toggle the step.
 */
export const CollapsibleDisplay: React.FC<CollapsibleDisplayProps> = ({
  toolName,
  title,
  titleClassName,
  defaultOpen = false,
  action,
  badge,
  onTitleClick,
  children,
  showRawParameters = false,
  rawContent,
  className = '',
}) => {
  const isExporting = useIsExportingTranscript();
  const headerClassName =
    'flex w-full items-center gap-1.5 py-0.5 text-xs group-data-[state=open]/section:sticky group-data-[state=open]/section:top-0 group-data-[state=open]/section:z-10 group-data-[state=open]/section:bg-background';

  return (
    <Trace className={className}>
      <TraceCollapsible defaultOpen={defaultOpen || isExporting} className="group/section my-1">
        {onTitleClick ? (
          <div className={headerClassName}>
            <TraceCollapsibleTrigger className="p-0.5" />
            {toolName && (
              <span className="flex-shrink-0 font-medium text-muted-foreground">{toolName}</span>
            )}
            {toolName && <span className="flex-shrink-0 text-[10px] text-muted-foreground/40">/</span>}
            <button
              type="button"
              onClick={onTitleClick}
              className={cn(
                'min-w-0 flex-1 truncate text-left font-mono text-primary transition-colors hover:text-primary/80 hover:underline',
                titleClassName,
              )}
            >
              {title}
            </button>
            {badge && <span className="ml-auto flex-shrink-0">{badge}</span>}
            {action && <span className="ml-1 flex-shrink-0">{action}</span>}
          </div>
        ) : (
          <TraceCollapsibleTrigger className={headerClassName}>
            <TraceLine className="min-w-0 flex-1">
              {toolName && <span className="flex-shrink-0 font-medium">{toolName}</span>}
              {toolName && <span className="flex-shrink-0 text-[10px] text-muted-foreground/40">/</span>}
              <TraceTitle className={cn('flex-1 text-left', titleClassName)}>{title}</TraceTitle>
            </TraceLine>
            {badge && <span className="ml-auto flex-shrink-0">{badge}</span>}
            {action && <span className="ml-1 flex-shrink-0">{action}</span>}
          </TraceCollapsibleTrigger>
        )}

        <TraceCollapsibleContent>
          {children}
          {showRawParameters && rawContent && (
            <Collapsible className="mt-2">
              <CollapsibleTrigger className="flex items-center gap-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                <svg
                  className="h-2.5 w-2.5 flex-shrink-0 transition-transform duration-150 data-[state=open]:rotate-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                raw params
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-1 overflow-hidden whitespace-pre-wrap break-words rounded border border-border/40 bg-muted p-2 font-mono text-[11px] text-muted-foreground">
                  {rawContent}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
};
