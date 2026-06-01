import * as React from "react"

import { cn } from "@/lib/utils"

const CardContext = React.createContext({
  size: "default",
  variant: "default",
})

function Card({
  children,
  className,
  size = "default",
  variant = "default",
  ...props
}) {
  return (
    <CardContext.Provider value={{ size, variant }}>
      <div
        data-slot="card"
        data-size={size}
        data-variant={variant}
        className={cn(
          "group/card flex flex-col bg-card text-card-foreground shadow-sm",
          variant === "panel"
            ? "gap-0 overflow-hidden rounded-[min(var(--radius-4xl),24px)] py-2 text-sm ring-1 ring-foreground/5 has-[>img:first-child]:pt-0 dark:ring-foreground/10 *:[img:first-child]:rounded-t-[min(var(--radius-4xl),24px)] *:[img:last-child]:rounded-b-[min(var(--radius-4xl),24px)]"
            : size === "sm"
              ? "gap-4 rounded-xl border py-3"
              : "gap-6 rounded-xl border py-6",
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
  const { size, variant } = React.useContext(CardContext)

  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        variant === "panel"
          ? "rounded-t-[min(var(--radius-4xl),24px)] px-5 [.border-b]:pb-5"
          : "px-6 [.border-b]:pb-6",
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
  const { variant } = React.useContext(CardContext)

  return (
    <div
      data-slot="card-title"
      className={cn(
        variant === "panel" ? "font-heading text-base font-medium" : "leading-none font-semibold",
        className
      )}
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
  const { size, variant } = React.useContext(CardContext)

  return (
    <div
      data-slot="card-content"
      className={cn(
        variant === "panel" ? "px-0" : "px-6",
        size === "sm" && variant !== "panel" && "px-3",
        className
      )}
      {...props} />
  );
}

function CardFooter({
  className,
  ...props
}) {
  const { size, variant } = React.useContext(CardContext)

  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center",
        variant === "panel"
          ? "rounded-b-[min(var(--radius-4xl),24px)] px-5 [.border-t]:pt-5"
          : "px-6 [.border-t]:pt-6",
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
