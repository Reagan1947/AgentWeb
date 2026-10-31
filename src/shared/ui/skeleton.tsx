import type * as React from 'react'

import { cn } from '@/shared/utils'

/** shadcn/ui Skeleton. The sidebar uses it while a project’s sessions load; other feature modules import it from the shared UI barrel. */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-primary/10', className)}
      {...props}
    />
  )
}

export { Skeleton }
