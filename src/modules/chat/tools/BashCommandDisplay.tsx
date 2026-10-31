import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';

import { cn,copyTextToClipboard } from '@/shared/utils';
import {
  CodeBlock,
  CodeBlockContent,
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/shared/ui';
import { ToolStatusBadge } from '@/modules/chat/tools/ToolStatusBadge';
import { useIsExportingTranscript } from '@/modules/chat/context/TranscriptRenderContext';
import type { ToolStatus } from '@/shared/types';

type BashCommandDisplayProps = {
  command: string;
  description?: string;
  /** Combined stdout/stderr from the tool result (empty while running). */
  output?: string;
  isError?: boolean;
  status?: ToolStatus;
  defaultOpen?: boolean;
};

/**
 * Codex-in-VSCode style command row: a compact, single-line command with a
 * chevron on the left. When the command produced output, the row becomes a
 * dropdown that expands to reveal the output inline. Theme-integrated surfaces
 * keep it clean in both light and dark mode; consecutive commands stack tightly
 * into a clean list.
 *
 * Rendered by chat's ToolRenderer for shell tools (Bash and friends).
 */
export const BashCommandDisplay: React.FC<BashCommandDisplayProps> = ({
  command,
  description,
  output,
  isError = false,
  status,
  defaultOpen = false,
}) => {
  const { t } = useTranslation();
  const trimmedOutput = (output || '').replace(/\s+$/, '');
  const hasOutput = trimmedOutput.length > 0;
  const outputLineCount = hasOutput ? trimmedOutput.split('\n').length : 0;
  const isRunning = status === 'running';
  // `open` is raised by an effect once output arrives (below). A document is
  // rendered without effects, so it would show every command and no output.
  const isExporting = useIsExportingTranscript();
  const [openState, setOpen] = useState(false);
  const open = openState || isExporting;
  const [copied, setCopied] = useState(false);

  // Output often arrives after this component first mounts, so apply the
  // auto-open intent once when there is finally something to show. After that
  // the user is in control of the toggle. Errors intentionally do NOT
  // auto-expand — the red border and status badge already signal the failure,
  // and the output stays one click away.
  const autoAppliedRef = useRef(false);
  useEffect(() => {
    if (!autoAppliedRef.current && hasOutput && defaultOpen) {
      autoAppliedRef.current = true;
      setOpen(true);
    }
  }, [hasOutput, defaultOpen]);

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    const didCopy = await copyTextToClipboard(command);
    if (!didCopy) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const commandTitle = (
    <TraceLine
      status={isError ? 'error' : isRunning ? 'running' : undefined}
      className="min-w-0 flex-1"
    >
      <TraceIcon className="font-mono text-xs font-semibold text-emerald-500">$</TraceIcon>
      {/* Not a <code> tag: the global `.chat-message code` rule forces
          `white-space: pre-wrap !important`, which would defeat `truncate`. */}
      <TraceTitle
        className={cn(
          'font-mono text-foreground',
          open ? 'whitespace-pre-wrap break-all' : undefined,
        )}
      >
        {command}
      </TraceTitle>
      {isRunning && (
        <span className="h-2.5 w-2.5 flex-shrink-0 animate-spin rounded-full border-[1.5px] border-muted-foreground/30 border-t-emerald-400" />
      )}
      {status && status !== 'running' && <ToolStatusBadge status={status} className="flex-shrink-0" />}
      {!open && hasOutput && !isRunning && (
        <TraceDescription className="text-[10px] transition-opacity group-hover/cmd:opacity-0">
          {outputLineCount} {outputLineCount === 1 ? 'line' : 'lines'}
        </TraceDescription>
      )}
    </TraceLine>
  );

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      onKeyDown={(event) => event.stopPropagation()}
      className="flex-shrink-0 rounded p-0.5 text-muted-foreground/60 opacity-0 transition-all hover:bg-foreground/10 hover:text-foreground focus:opacity-100 group-hover/cmd:opacity-100"
      title={t('chat:misc.copyCommand')}
      aria-label={t('chat:misc.copyCommand')}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );

  return (
    <Trace className="group/cmd my-1">
      {hasOutput ? (
        <TraceCollapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-1">
            <TraceCollapsibleTrigger className="min-w-0 flex-1">{commandTitle}</TraceCollapsibleTrigger>
            {copyButton}
          </div>
          {description && !open && (
            <div className="truncate pl-[18px] text-[11px] italic text-muted-foreground/70">{description}</div>
          )}
          <TraceCollapsibleContent>
            {description && (
              <div className="pb-1 text-[11px] italic text-muted-foreground/70">{description}</div>
            )}
            <CodeBlock size="sm" variant={isError ? 'destructive' : 'default'}>
              <CodeBlockContent
                wrap
                className={cn(
                  'max-h-80',
                  isError ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                )}
              >
                {trimmedOutput}
              </CodeBlockContent>
            </CodeBlock>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      ) : (
        <div className="flex items-center gap-1">
          {commandTitle}
          {copyButton}
        </div>
      )}
    </Trace>
  );
};
