import React, { useState } from 'react';
import { XIcon } from 'lucide-react';

import {
  CodeBlock,
  CodeBlockContent,
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/shared/ui';
import { Markdown } from '@/modules/chat/transcript/Markdown';

type ToolErrorDisplayProps = {
  /** Full error text; rendered as markdown when expanded. */
  content: string;
  /** Localized "Error" label shown in the header. */
  label: string;
};

/** A thrown error with frames, as opposed to a sentence the tool returned. */
function looksLikeStack(content: string) {
  return /(?:^|\n)\s*at .+:\d+(?::\d+)?/.test(content);
}

/**
 * Collapsed-by-default error step for non-Bash tool results. A stack is shown
 * as a code block; other failures stay markdown.
 *
 * Rendered by chat's MessageComponent for failed tool results.
 */
export const ToolErrorDisplay: React.FC<ToolErrorDisplayProps> = ({ content, label }) => {
  const trimmedContent = content.trim();
  const hasContent = trimmedContent.length > 0;
  const [open, setOpen] = useState(false);
  const isStack = looksLikeStack(trimmedContent);
  const preview = trimmedContent.split('\n')[0] ?? '';

  if (!hasContent) {
    return (
      <Trace className="mt-2">
        <TraceLine status="error">
          <TraceIcon>
            <XIcon />
          </TraceIcon>
          <TraceTitle>{label}</TraceTitle>
        </TraceLine>
      </Trace>
    );
  }

  return (
    <Trace className="mt-2">
      <TraceCollapsible open={open} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger className="w-full">
          <TraceLine status="error" className="min-w-0 flex-1">
            <TraceIcon>
              <XIcon />
            </TraceIcon>
            <TraceTitle className="font-medium">{label}</TraceTitle>
            {!open && (
              /* Not a <code> tag: the global `.chat-message code` rule forces
                 `white-space: pre-wrap !important`, which would defeat `truncate`. */
              <span className="min-w-0 flex-1 truncate text-xs">{preview}</span>
            )}
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          {isStack ? (
            <CodeBlock size="sm" variant="destructive">
              <CodeBlockContent wrap>{trimmedContent}</CodeBlockContent>
            </CodeBlock>
          ) : (
            <Markdown className="prose prose-sm prose-red max-w-none font-serif dark:prose-invert">
              {trimmedContent}
            </Markdown>
          )}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
};
