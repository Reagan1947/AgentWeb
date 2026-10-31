import { memo, useState } from 'react';
import { BookMarked } from 'lucide-react';

import type { MemoryCitation } from '@/shared/types';
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/shared/ui';

/**
 * Footnote listing the stored memory an assistant reply drew on.
 *
 * Codex appends this as a machine-readable block at the end of the reply, which
 * reads as stray markup in the prose. The backend lifts it out and the reply
 * keeps the provenance here instead: collapsed to a single line, expandable to
 * the file ranges and what each contributed.
 *
 * Rendered by chat's MessageComponent under any assistant message whose
 * provider reported citations.
 */
export const MemoryCitations = memo(({ citations }: { citations: MemoryCitation[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (citations.length === 0) {
    return null;
  }

  return (
    <Trace className="mt-2">
      <TraceCollapsible open={isOpen} onOpenChange={setIsOpen}>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <BookMarked />
            </TraceIcon>
            <TraceTitle>
              Used {citations.length} {citations.length === 1 ? 'memory' : 'memories'}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <ul className="space-y-1">
            {citations.map((citation) => (
              <li key={citation.source} className="text-[11px] leading-snug">
                <span className="font-mono text-muted-foreground">{citation.source}</span>
                {citation.note && (
                  <span className="ml-1.5 text-muted-foreground/70">{citation.note}</span>
                )}
              </li>
            ))}
          </ul>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
});
MemoryCitations.displayName = 'MemoryCitations';
