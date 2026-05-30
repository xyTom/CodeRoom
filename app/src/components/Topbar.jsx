import { LogOut, TerminalSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Topbar({ session }) {
  const roleText = session?.name ? `${session.role}: ${session.name}` : session?.role || "role";
  const workspaceReady = Boolean(session?.workspace?.ready);
  const workspaceAvailable = session?.role !== "candidate" || session?.room?.candidateAdmitted;
  const workspaceText = workspaceReady && workspaceAvailable ? "workspace ready" : "workspace starting";

  return (
    <header className="relative z-20 flex min-h-16 items-center justify-between gap-4 border-b bg-card px-4 py-3 text-card-foreground max-[900px]:items-start max-[900px]:flex-col">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <TerminalSquare />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight">CodeRoom</h1>
          <p className="truncate text-xs text-muted-foreground">{session?.sessionName || "Loading room..."}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <Badge>{roleText}</Badge>
        <Badge variant={workspaceReady && workspaceAvailable ? "secondary" : "outline"}>{workspaceText}</Badge>
        <Button variant="ghost" size="sm" asChild>
          <a href="/logout">
            <LogOut data-icon="inline-start" />
            Leave
          </a>
        </Button>
      </div>
    </header>
  );
}
