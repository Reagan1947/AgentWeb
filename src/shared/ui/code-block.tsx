import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckIcon, CopyIcon } from 'lucide-react';

import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/utils';

const codeBlockVariants = cva(
  'group/code-block relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg border bg-muted/50',
  {
    variants: {
      variant: {
        default: 'border-border',
        destructive: 'border-destructive/40 bg-destructive/5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type CodeBlockProps = React.ComponentProps<'div'> &
  VariantProps<typeof codeBlockVariants> & {
    /** Small blocks sit inside a trace step; default blocks are message fences. */
    size?: 'default' | 'sm';
  };

/** Frame for code, terminal output and stack traces. Used by chat markdown and tool rows. */
export function CodeBlock({ className, variant = 'default', size = 'default', ...props }: CodeBlockProps) {
  return (
    <div
      data-slot="code-block"
      data-variant={variant}
      data-size={size}
      className={cn(codeBlockVariants({ variant }), size === 'sm' && 'text-xs', className)}
      {...props}
    />
  );
}

/** Title row of a code block. Used by chat markdown fences. */
export function CodeBlockHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="code-block-header"
      className={cn('flex min-w-0 shrink-0 items-center gap-2 px-3 pt-2', className)}
      {...props}
    />
  );
}

/** Language or filename in a code block header. Used by chat markdown fences. */
export function CodeBlockTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="code-block-title"
      className={cn('min-w-0 truncate text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

/** Action slot of a code block, pushed to the end of the header. Used by chat markdown fences. */
export function CodeBlockActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="code-block-actions"
      className={cn('ml-auto flex shrink-0 items-center', className)}
      {...props}
    />
  );
}

type CodeBlockCopyButtonProps = React.ComponentProps<typeof Button> & {
  /** The exact text placed on the clipboard. Line numbers are not included. */
  value: string;
};

/** Copies a code block's text. Used where a fence does not already own its own copy control. */
export function CodeBlockCopyButton({
  value,
  variant = 'ghost',
  size = 'icon',
  className,
  onClick,
  ...props
}: CodeBlockCopyButtonProps) {
  // Flips the icon for two seconds after a successful write so the click has a result.
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <>
      <Button
        data-slot="code-block-copy-button"
        data-copied={copied || undefined}
        type="button"
        variant={variant}
        size={size}
        aria-label={copied ? 'Copied' : 'Copy'}
        className={cn('h-7 w-7', className)}
        onClick={(event) => {
          onClick?.(event);
          navigator.clipboard
            .writeText(value)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
        {...props}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Copied' : ''}
      </span>
    </>
  );
}

type CodeBlockContentProps = React.ComponentProps<'pre'> & {
  wrap?: boolean;
  lineNumbers?: boolean;
  startLine?: number;
};

/** Scrollable body of a code block. Always left to right. Used by command output and stack traces. */
export function CodeBlockContent({
  className,
  children,
  style,
  wrap = false,
  lineNumbers = false,
  startLine = 1,
  ...props
}: CodeBlockContentProps) {
  return (
    <pre
      data-slot="code-block-content"
      data-wrap={wrap || undefined}
      data-numbered={lineNumbers || undefined}
      dir="ltr"
      tabIndex={0}
      style={{ counterReset: `line ${startLine - 1}`, ...style }}
      className={cn(
        'min-h-0 min-w-0 overflow-auto px-3 py-2 text-left font-mono text-xs outline-none',
        wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
        className,
      )}
      {...props}
    >
      <code data-slot="code-block-code" className="block min-w-0">
        {lineNumbers && typeof children === 'string'
          ? children
              .replace(/\n$/, '')
              .split('\n')
              .map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>)
          : children}
      </code>
    </pre>
  );
}

const codeBlockLineVariants = cva('relative block min-h-[1.25em]', {
  variants: {
    variant: {
      default: '',
      added: 'bg-emerald-500/15',
      removed: 'bg-destructive/15',
      highlighted: 'bg-primary/10',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type CodeBlockLineProps = React.ComponentProps<'span'> & VariantProps<typeof codeBlockLineVariants>;

/** One line inside a numbered or diff code block. Keeps a newline when the line is blank so copies stay intact. */
export function CodeBlockLine({ className, variant = 'default', children, ...props }: CodeBlockLineProps) {
  const empty =
    children === undefined ||
    children === null ||
    children === '' ||
    (Array.isArray(children) && children.length === 0);

  return (
    <span
      data-slot="code-block-line"
      data-variant={variant}
      className={cn(codeBlockLineVariants({ variant }), className)}
      {...props}
    >
      <span data-slot="code-block-line-content" className="min-w-0">
        {empty ? '\n' : children}
      </span>
    </span>
  );
}

/** Optional footer under a code block. Used when a fence needs a note below the code. */
export function CodeBlockFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="code-block-footer"
      className={cn('flex min-w-0 shrink-0 items-center px-3 pb-2 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}
