import * as React from "react";

import { cn } from "@/lib/utils";

const Empty = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="empty"
    className={cn("flex min-h-[180px] flex-col items-center justify-center gap-4 p-6 text-center", className)}
    {...props}
  />
));
Empty.displayName = "Empty";

const EmptyHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="empty-header" className={cn("flex flex-col items-center gap-2", className)} {...props} />
));
EmptyHeader.displayName = "EmptyHeader";

const EmptyTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} data-slot="empty-title" className={cn("text-base font-semibold", className)} {...props} />
));
EmptyTitle.displayName = "EmptyTitle";

const EmptyDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="empty-description"
    className={cn("max-w-sm text-sm text-muted-foreground", className)}
    {...props}
  />
));
EmptyDescription.displayName = "EmptyDescription";

const EmptyIcon = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="empty-icon"
    className={cn("grid size-10 place-items-center rounded-md bg-muted text-muted-foreground [&_svg]:size-5", className)}
    {...props}
  />
));
EmptyIcon.displayName = "EmptyIcon";

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyIcon };
