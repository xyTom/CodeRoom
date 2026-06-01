import * as React from "react"

import { cn } from "@/lib/utils"

const CardContext = React.createContext({
  size: "default",
})

function Card({
  children,
  className,
  size = "default",
  ...props
}) {
  return (
    <CardContext.Provider value={{ size }}>
      <div
        data-slot="card"
        data-size={size}
        className={cn(
          "group/card flex flex-col bg-card text-card-foreground shadow-sm",
          "gap-0 overflow-hidden rounded-[min(var(--radius-4xl),24px)] py-2 text-sm ring-1 ring-foreground/5 has-[>img:first-child]:pt-0 dark:ring-foreground/10 *:[img:first-child]:rounded-t-[min(var(--radius-4xl),24px)] *:[img:last-child]:rounded-b-[min(var(--radius-4xl),24px)]",
          className
        )}
        {...props}>
        {children}
      </div>
    </CardContext.Provider>
  );
}

function CardHeader({
  className,
  ...props
}) {
  const { size } = React.useContext(CardContext)

  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        "rounded-t-[min(var(--radius-4xl),24px)] px-5 [.border-b]:pb-5",
        size === "sm" && "px-3 [.border-b]:pb-3",
        className
      )}
      {...props} />
  );
}

function CardTitle({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-heading text-base font-medium", className)}
      {...props} />
  );
}

function CardDescription({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props} />
  );
}

function CardAction({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props} />
  );
}

function CardContent({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-0", className)}
      {...props} />
  );
}

function CardFooter({
  className,
  ...props
}) {
  const { size } = React.useContext(CardContext)

  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center",
        "rounded-b-[min(var(--radius-4xl),24px)] px-5 [.border-t]:pt-5",
        size === "sm" && "px-3 [.border-t]:pt-3",
        className
      )}
      {...props} />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
