import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';

import {
  Button,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Shimmer,
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/shared/ui';
import { usePermission } from '@/modules/chat/context/PermissionContext';
import { MarkdownContent } from '@/modules/chat/tools/ContentRenderers/MarkdownContent';

type PlanDisplayProps = {
  title: string;
  content: string;
  defaultOpen?: boolean;
  isStreaming?: boolean;
  showRawParameters?: boolean;
  rawContent?: string;
  toolName: string;
  toolId?: string;
};

/**
 * Rendered by chat's ToolRenderer for plan tools (ExitPlanMode), showing the
 * proposed plan inline together with its build/revise permission decision.
 */
export const PlanDisplay: React.FC<PlanDisplayProps> = ({
  title,
  content,
  defaultOpen = false,
  isStreaming = false,
  showRawParameters = false,
  rawContent,
  toolName: _toolName,
}) => {
  const { t } = useTranslation();
  const permissionCtx = usePermission();

  const pendingRequest = permissionCtx?.pendingPermissionRequests.find(
    (r) => r.toolName === 'ExitPlanMode' || r.toolName === 'exit_plan_mode'
  );

  const handleBuild = () => {
    if (pendingRequest && permissionCtx) {
      permissionCtx.handlePermissionDecision(pendingRequest.requestId, { allow: true });
    }
  };

  const handleRevise = () => {
    if (pendingRequest && permissionCtx) {
      permissionCtx.handlePermissionDecision(pendingRequest.requestId, {
        allow: false,
        message: t('chat:misc.userAskedRevise'),
      });
    }
  };

  return (
    <Trace className="my-1">
      <TraceCollapsible defaultOpen={defaultOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine status={isStreaming ? 'running' : undefined}>
            <TraceIcon>
              <FileText />
            </TraceIcon>
            <TraceTitle className="text-sm font-semibold text-foreground">
              {isStreaming ? <Shimmer>{title}</Shimmer> : title}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          {content ? (
            <MarkdownContent
              content={content}
              className="prose prose-sm max-w-none dark:prose-invert"
            />
          ) : isStreaming ? (
            <div className="py-2">
              <Shimmer>Generating plan...</Shimmer>
            </div>
          ) : null}

          {showRawParameters && rawContent && (
            <Collapsible className="mt-3">
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

      {pendingRequest && (
        <div className="mt-2 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevise}
            className="text-muted-foreground"
          >
            Revise
          </Button>
          <Button size="sm" onClick={handleBuild}>
            Build{' '}
            <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 py-0.5 font-mono text-[10px]">
              ⌘↩
            </kbd>
          </Button>
        </div>
      )}
    </Trace>
  );
};
