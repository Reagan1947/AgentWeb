import type { ReactNode } from 'react';
import { ChevronDownIcon, PencilIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/shared/utils';

/** Steer mark from the provided icon, used in place of the Steer label. */
function SteerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M63 319.002728C63 310.164665 68.88939 307.094967 76.135681 312.133403L305.864319 471.866597C313.118955 476.910836 313.11061 485.094967 305.864319 490.133403L76.135681 649.866597C68.881045 654.910836 63 651.828468 63 642.997272L63 319.002728ZM384 226C384 208.326888 398.323547 194 415.996983 194L736.003017 194C753.674463 194 768 208.323002 768 226 768 243.673112 753.676453 258 736.003017 258L415.996983 258C398.325537 258 384 243.676998 384 226ZM383 482C383 464.326888 397.323097 450 414.998006 450L901.001994 450C918.674005 450 933 464.323002 933 482 933 499.673112 918.676903 514 901.001994 514L414.998006 514C397.325995 514 383 499.676998 383 482ZM386 736C386 718.326888 400.323547 704 417.996983 704L738.003017 704C755.674463 704 770 718.323002 770 736 770 753.673112 755.676453 768 738.003017 768L417.996983 768C400.325537 768 386 753.676998 386 736Z"
      />
    </svg>
  );
}

type QueueItem = { id: string; text: string };

type QueueProps = {
  items: QueueItem[];
  onSteer: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Folds the list away so the composer can show a compact queue button instead. */
  onCollapse: () => void;
  label?: ReactNode;
  className?: string;
};

/**
 * Messages queued while the agent is busy, used by ChatComposer above the prompt.
 *
 * Each row is one turn, in the order it will be sent. Hovering a row shows
 * steer (send it now, interrupting the current turn), edit, and delete. The
 * corner control collapses the list into the processing-row button.
 */
export function Queue({ items, onSteer, onEdit, onDelete, onCollapse, label = 'Queued', className }: QueueProps) {
  const { t } = useTranslation('chat');

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-slot="queue"
      className={cn('grid gap-1 rounded-xl border border-border bg-muted/40 p-1.5', className)}
    >
      <div className="flex items-center justify-between gap-2 pl-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          {items.length}
          {' '}
          {label}
        </span>
        <button
          type="button"
          aria-label={t('input.queue.collapse', { defaultValue: 'Collapse queue' })}
          onClick={onCollapse}
          className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronDownIcon className="size-3.5" aria-hidden />
        </button>
      </div>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="group/q flex min-h-8 items-center gap-2 rounded-lg bg-card px-2 py-1 text-sm shadow-sm ring-1 ring-border"
          >
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-5">
              {item.text}
            </span>
            <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-focus-within/q:opacity-100 group-hover/q:opacity-100 [@media(pointer:coarse)]:opacity-100">
              <button
                type="button"
                aria-label={t('input.queue.steer', { defaultValue: 'Steer' })}
                onClick={() => onSteer(item.id)}
                className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <SteerIcon className="size-5" />
              </button>
              <button
                type="button"
                aria-label={t('input.queue.edit', { defaultValue: 'Edit queued message' })}
                onClick={() => onEdit(item.id)}
                className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <PencilIcon className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={t('input.queue.delete', { defaultValue: 'Delete queued message' })}
                onClick={() => onDelete(item.id)}
                className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <XIcon className="size-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
