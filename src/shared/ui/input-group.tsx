import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/utils'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/textarea'

/**
 * shadcn/ui InputGroup. The chat composer's prompt field uses it as the
 * visual shell around the textarea, attachment row and toolbar. The project
 * creation wizard and Nono settings use it so a folder browser button sits
 * inside a path field.
 */
const InputGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="input-group"
        role="group"
        className={cn(
          'group/input-group relative flex w-full items-center rounded-md border border-input shadow-sm outline-none transition-[color,box-shadow] dark:bg-input/30',
          'h-9 has-[>textarea]:h-auto',

          'has-[>[data-align=inline-start]]:[&>input]:pl-2',
          'has-[>[data-align=inline-end]]:[&>input]:pr-2',
          'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:items-stretch has-[>[data-align=block-start]]:[&>input]:pb-3',
          'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:items-stretch has-[>[data-align=block-end]]:[&>input]:pt-3',

          'has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-ring',

          'has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40',

          className
        )}
        {...props}
      />
    )
  }
)
InputGroup.displayName = 'InputGroup'

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text select-none items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        'inline-start':
          'order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]',
        'inline-end':
          'order-last pr-3 has-[>button]:mr-[-0.4rem] has-[>kbd]:mr-[-0.35rem]',
        'block-start':
          '[.border-b]:pb-3 order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5',
        'block-end':
          '[.border-t]:pt-3 order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  }
)

type InputGroupAddonProps = React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>

/** shadcn/ui InputGroupAddon. The chat composer uses it for the attachment row and the toolbar. The project creation wizard and Nono settings use it to hold the folder browser button. */
const InputGroupAddon = React.forwardRef<HTMLDivElement, InputGroupAddonProps>(
  ({ className, align = 'inline-start', onClick, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        data-slot="input-group-addon"
        data-align={align}
        className={cn(inputGroupAddonVariants({ align }), className)}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) {
            return
          }
          const target = event.target
          if (!(target instanceof Element) || target.closest('button, a, input, textarea, select')) {
            return
          }
          event.currentTarget.parentElement
            ?.querySelector<HTMLElement>('[data-slot="input-group-control"]')
            ?.focus()
        }}
        {...props}
      />
    )
  }
)
InputGroupAddon.displayName = 'InputGroupAddon'

const inputGroupButtonVariants = cva('flex items-center gap-2 text-sm shadow-none', {
  variants: {
    size: {
      xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
      sm: 'h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5',
      'icon-xs': "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
      'icon-sm': 'size-8 p-0 has-[>svg]:p-0',
    },
  },
  defaultVariants: {
    size: 'xs',
  },
})

type InputGroupButtonProps = Omit<React.ComponentProps<typeof Button>, 'size'> &
  VariantProps<typeof inputGroupButtonVariants>

/** shadcn/ui InputGroupButton. The chat composer's footer icon buttons use it. The project creation wizard and Nono settings use it for the folder browser inside a path field. */
const InputGroupButton = React.forwardRef<HTMLButtonElement, InputGroupButtonProps>(
  ({ className, type = 'button', variant = 'ghost', size = 'xs', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        type={type}
        data-size={size}
        variant={variant}
        className={cn(inputGroupButtonVariants({ size }), className)}
        {...props}
      />
    )
  }
)
InputGroupButton.displayName = 'InputGroupButton'

/** shadcn/ui InputGroupText. Sits in an InputGroupAddon when the addon is a label rather than a control. */
const InputGroupText = React.forwardRef<HTMLSpanElement, React.ComponentProps<'span'>>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
          className
        )}
        {...props}
      />
    )
  }
)
InputGroupText.displayName = 'InputGroupText'

/** shadcn/ui InputGroupInput. The borderless control inside an InputGroup. The project creation wizard and Nono settings use it for a path field. */
const InputGroupInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        data-slot="input-group-control"
        className={cn(
          'h-9 flex-1 rounded-none border-0 bg-transparent py-1 shadow-none focus-visible:ring-0 dark:bg-transparent',
          className
        )}
        {...props}
      />
    )
  }
)
InputGroupInput.displayName = 'InputGroupInput'

/** shadcn/ui InputGroupTextarea. The chat composer's message field renders through this. */
const InputGroupTextarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <Textarea
        ref={ref}
        data-slot="input-group-control"
        className={cn(
          'flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent',
          className
        )}
        {...props}
      />
    )
  }
)
InputGroupTextarea.displayName = 'InputGroupTextarea'

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
