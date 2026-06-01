import { TerminalSquare } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ className }) {
  return (
    <div
      className={cn("grid size-9 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm", className)}
      aria-hidden="true"
    >
      <TerminalSquare className="size-5" />
    </div>
  );
}
