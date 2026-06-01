import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";

export function Topbar({ session }) {
  const roleText = session?.name ? `${session.role}: ${session.name}` : session?.role || "role";

  return (
    <header className="relative z-20 border-b bg-background/95 px-4 py-2.5 text-foreground shadow-sm">
      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-3 max-[900px]:items-start max-[900px]:flex-col">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">CodeRoom</h1>
            <p className="truncate text-xs text-muted-foreground">{session?.sessionName || "Loading interview room..."}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <Badge variant="secondary">{roleText}</Badge>
          <Button variant="outline" size="sm" asChild>
            <a href="/logout">
              <LogOut data-icon="inline-start" />
              Leave
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
