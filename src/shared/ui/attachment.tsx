import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/utils'
import { Button } from '@/shared/ui/Button'

type AttachmentState = 'idle' | 'uploading' | 'processing' | 'error' | 'done'

const attachmentVariants = cva(
  'group/attachment relative flex w-fit min-w-0 max-w-full shrink-0 flex-wrap rounded-xl border bg-card text-card-foreground transition-colors focus-within:ring-1 focus-within:ring-ring/50 has-[>a]:hover:bg-muted/50 has-[>button]:hover:bg-muted/50 data-[state=idle]:border-dashed data-[state=error]:border-destructive/30',
  {
    variants: {
      size: {
        default:
          'gap-2 text-sm has-[[data-slot=attachment-media]]:p-2 has-[[data-slot=attachment-content]]:px-2.5 has-[[data-slot=attachment-content]]:py-2',
        sm: 'gap-2.5 text-xs has-[[data-slot=attachment-media]]:p-1.5 has-[[data-slot=attachment-content]]:px-2 has-[[data-slot=attachment-content]]:py-1.5',
        xs: 'gap-1.5 rounded-lg text-xs has-[[data-slot=attachment-media]]:p-1 has-[[data-slot=attachment-content]]:px-1.5 has-[[data-slot=attachment-content]]:py-1',
      },
      orientation: {
        horizontal: 'min-w-40 items-center',
        vertical: 'w-24 flex-col has-[[data-slot=attachment-content]]:w-[7.5rem]',
      },
    },
  }
)

type AttachmentProps = React.ComponentProps<'div'> &
  VariantProps<typeof attachmentVariants> & {
    state?: AttachmentState
  }

/** shadcn/ui Attachment. The chat composer uses it for each file waiting to be sent. */
const Attachment = React.forwardRef<HTMLDivElement, AttachmentProps>(
  ({ className, state = 'done', size = 'default', orientation = 'horizontal', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="attachment"
        data-state={state}
        data-size={size}
        data-orientation={orientation}
        className={cn(attachmentVariants({ size, orientation }), className)}
        {...props}
      />
    )
  }
)
Attachment.displayName = 'Attachment'

const attachmentMediaVariants = cva(
  "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[size=xs]/attachment:rounded-md group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive group-data-[orientation=vertical]/attachment:[&_[data-slot=spinner]]:!size-6 [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        icon: '',
        image:
          'opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 [&_img]:aspect-square [&_img]:w-full [&_img]:object-cover',
      },
    },
    defaultVariants: {
      variant: 'icon',
    },
  }
)

type AttachmentMediaProps = React.ComponentProps<'div'> & VariantProps<typeof attachmentMediaVariants>

/** shadcn/ui AttachmentMedia. Holds the file icon or image preview inside an Attachment. */
const AttachmentMedia = React.forwardRef<HTMLDivElement, AttachmentMediaProps>(
  ({ className, variant = 'icon', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="attachment-media"
        data-variant={variant}
        className={cn(attachmentMediaVariants({ variant }), className)}
        {...props}
      />
    )
  }
)
AttachmentMedia.displayName = 'AttachmentMedia'

/** shadcn/ui AttachmentContent. Wraps an attachment's name and file details. */
const AttachmentContent = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="attachment-content"
        className={cn(
          'min-w-0 max-w-full flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1',
          className
        )}
        {...props}
      />
    )
  }
)
AttachmentContent.displayName = 'AttachmentContent'

/** shadcn/ui AttachmentTitle. The file name on an Attachment. */
const AttachmentTitle = React.forwardRef<HTMLSpanElement, React.ComponentProps<'span'>>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="attachment-title"
        className={cn(
          'block min-w-0 max-w-full truncate font-medium group-data-[state=processing]/attachment:animate-pulse group-data-[state=uploading]/attachment:animate-pulse',
          className
        )}
        {...props}
      />
    )
  }
)
AttachmentTitle.displayName = 'AttachmentTitle'

/** shadcn/ui AttachmentDescription. The file size or error under an attachment's name. */
const AttachmentDescription = React.forwardRef<HTMLSpanElement, React.ComponentProps<'span'>>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="attachment-description"
        className={cn(
          'mt-0.5 block min-w-0 max-w-full truncate text-xs text-muted-foreground group-data-[state=error]/attachment:text-destructive/80',
          className
        )}
        {...props}
      />
    )
  }
)
AttachmentDescription.displayName = 'AttachmentDescription'

/** shadcn/ui AttachmentActions. The remove control's slot on an Attachment. */
const AttachmentActions = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="attachment-actions"
        className={cn(
          'relative z-20 flex shrink-0 items-center group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:right-1 group-data-[orientation=vertical]/attachment:top-1 group-data-[orientation=vertical]/attachment:gap-1',
          className
        )}
        {...props}
      />
    )
  }
)
AttachmentActions.displayName = 'AttachmentActions'

type AttachmentActionProps = React.ComponentProps<typeof Button>

/** shadcn/ui AttachmentAction. The chat composer uses it to remove a pending file. */
const AttachmentAction = React.forwardRef<HTMLButtonElement, AttachmentActionProps>(
  ({ className, variant = 'ghost', type = 'button', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        data-slot="attachment-action"
        type={type}
        variant={variant}
        className={cn('size-6 rounded-md p-0', className)}
        {...props}
      />
    )
  }
)
AttachmentAction.displayName = 'AttachmentAction'

type AttachmentTriggerProps = React.ComponentProps<'button'>

/**
 * shadcn/ui AttachmentTrigger. Covers the attachment so a click opens the file,
 * while the actions above it stay independently clickable.
 */
const AttachmentTrigger = React.forwardRef<HTMLButtonElement, AttachmentTriggerProps>(
  ({ className, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-slot="attachment-trigger"
        type={type}
        className={cn('absolute inset-0 z-10 outline-none', className)}
        {...props}
      />
    )
  }
)
AttachmentTrigger.displayName = 'AttachmentTrigger'

/** shadcn/ui AttachmentGroup. Lays pending composer files in one scrolling row. */
const AttachmentGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="attachment-group"
        className={cn(
          'flex min-w-0 snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_[data-slot=attachment]]:flex-none [&_[data-slot=attachment]]:snap-start',
          className
        )}
        {...props}
      />
    )
  }
)
AttachmentGroup.displayName = 'AttachmentGroup'

export {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
}
