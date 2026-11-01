import * as React from 'react';
import { ArrowUpIcon, SquareIcon } from 'lucide-react';

import { cn } from '@/shared/utils';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea, Tooltip } from '@/shared/ui';

/* ─── Context ────────────────────────────────────────────────────── */

type PromptInputStatus = 'ready' | 'submitted' | 'streaming' | 'error';

type PromptInputContextValue = {
  status: PromptInputStatus;
};

const PromptInputContext = React.createContext<PromptInputContextValue | null>(null);

/** Read by PromptInputSubmit, which is only ever rendered inside PromptInput. */
const usePromptInput = () => {
  const context = React.useContext(PromptInputContext);
  if (!context) {
    throw new Error('PromptInput components must be used within PromptInput');
  }
  return context;
};

/* ─── PromptInput (root form) ────────────────────────────────────── */

export type PromptInputProps = {
  status?: PromptInputStatus;
} & React.FormHTMLAttributes<HTMLFormElement>;

/**
 * Composer form shell, used by ChatComposer.
 *
 * The visible box is an InputGroup. Status, submit behavior and the extra
 * composer controls stay here; InputGroup only supplies the field chrome.
 */
export const PromptInput = React.forwardRef<HTMLFormElement, PromptInputProps>(
  ({ className, status = 'ready', children, ...props }, ref) => {
    const contextValue = React.useMemo(() => ({ status }), [status]);

    return (
      <PromptInputContext.Provider value={contextValue}>
        <form ref={ref} data-slot="prompt-input" {...props}>
          <InputGroup
            className={cn(
              'overflow-hidden rounded-lg border-border bg-card dark:bg-card',
              'has-[[data-slot=input-group-control]:focus-visible]:border-primary/40 has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/40',
              className
            )}
          >
            {children}
          </InputGroup>
        </form>
      </PromptInputContext.Provider>
    );
  }
);
PromptInput.displayName = 'PromptInput';

/* ─── PromptInputHeader ──────────────────────────────────────────── */

/** Attachment row above the composer textarea, used by ChatComposer. */
export const PromptInputHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <InputGroupAddon
    ref={ref}
    align="block-start"
    data-slot="prompt-input-header"
    className={className}
    {...props}
  />
));
PromptInputHeader.displayName = 'PromptInputHeader';

/* ─── PromptInputBody ────────────────────────────────────────────── */

/** Wrapper around the composer textarea and its mention highlight, used by ChatComposer. */
export const PromptInputBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="prompt-input-body"
    className={cn('relative w-full self-stretch', className)}
    {...props}
  />
));
PromptInputBody.displayName = 'PromptInputBody';

/* ─── PromptInputTextarea ────────────────────────────────────────── */

/** Message textarea, used by ChatComposer. Grows from the composer's own resize logic. */
export const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <InputGroupTextarea
    ref={ref}
    data-slot="input-group-control"
    className={cn(
      'chat-input-placeholder min-h-0 max-h-[40vh] px-3 py-3 text-sm leading-6 placeholder:text-muted-foreground/50 sm:max-h-[300px]',
      className
    )}
    {...props}
  />
));
PromptInputTextarea.displayName = 'PromptInputTextarea';

/* ─── PromptInputFooter ──────────────────────────────────────────── */

/**
 * Toolbar under the composer textarea, used by ChatComposer.
 * Keeps data-slot="prompt-input-footer" so the permission-name fit measurement can find it.
 */
export const PromptInputFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <InputGroupAddon
    ref={ref}
    align="block-end"
    data-slot="prompt-input-footer"
    className={cn('flex-wrap', className)}
    {...props}
  />
));
PromptInputFooter.displayName = 'PromptInputFooter';

/* ─── PromptInputTools ───────────────────────────────────────────── */

/** Left-hand tool cluster in the composer footer, used by ChatComposer. */
export const PromptInputTools = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="prompt-input-tools"
    className={cn('flex items-center gap-1', className)}
    {...props}
  />
));
PromptInputTools.displayName = 'PromptInputTools';

/* ─── PromptInputButton ──────────────────────────────────────────── */

export type PromptInputButtonTooltip = {
  content: React.ReactNode;
  shortcut?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

export type PromptInputButtonProps = {
  tooltip?: PromptInputButtonTooltip;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

/** Icon button in the composer footer, used by ChatComposer, ComposerToolsMenu and VoiceInputButton. */
export const PromptInputButton = React.forwardRef<HTMLButtonElement, PromptInputButtonProps>(
  ({ className, tooltip, children, ...props }, ref) => {
    const button = (
      <InputGroupButton
        ref={ref}
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn('rounded-md', className)}
        {...props}
      >
        {children}
      </InputGroupButton>
    );

    if (tooltip) {
      return (
        <Tooltip
          content={
            tooltip.shortcut ? (
              <span className="flex items-center gap-1.5">
                {tooltip.content}
                <kbd className="rounded bg-white/20 px-1 text-[10px]">{tooltip.shortcut}</kbd>
              </span>
            ) : (
              tooltip.content
            )
          }
          position={tooltip.side ?? 'top'}
        >
          {button}
        </Tooltip>
      );
    }

    return button;
  }
);
PromptInputButton.displayName = 'PromptInputButton';

/* ─── PromptInputSubmit ──────────────────────────────────────────── */

export type PromptInputSubmitProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/** Send/stop button of the composer, used by ChatComposer. */
export const PromptInputSubmit = React.forwardRef<HTMLButtonElement, PromptInputSubmitProps>(
  ({ className, children, ...props }, ref) => {
    // The status comes from the PromptInput root, which is the only place it is set.
    const { status } = usePromptInput();
    const isActive = status === 'submitted' || status === 'streaming';

    return (
      <InputGroupButton
        ref={ref}
        type={isActive ? 'button' : 'submit'}
        variant="default"
        size="icon-sm"
        className={cn('shrink-0 rounded-md', className)}
        {...props}
      >
        {children ?? (isActive ? (
          <SquareIcon className="size-3.5 fill-current" />
        ) : (
          <ArrowUpIcon className="size-4" />
        ))}
      </InputGroupButton>
    );
  }
);
PromptInputSubmit.displayName = 'PromptInputSubmit';
