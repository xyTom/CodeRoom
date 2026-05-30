import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export function Topbar({ session }) {
  const roleText = session?.name ? `${session.role}: ${session.name}` : session?.role || "role";
  const workspaceReady = Boolean(session?.workspace?.ready);
  const workspaceAvailable = session?.role !== "candidate" || session?.room?.candidateAdmitted;
  const workspaceText = workspaceReady && workspaceAvailable ? "workspace ready" : "workspace starting";

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b bg-card px-4 py-3 text-card-foreground shadow-sm max-[900px]:items-start max-[900px]:flex-col">
      <div className="brand-row compact min-w-0">
        <div className="brand-mark">CR</div>
        <div className="min-w-0">
          <h1 className="truncate font-semibold tracking-tight">CodeRoom</h1>
          <p className="truncate text-sm text-muted-foreground">{session?.sessionName || "Loading room..."}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{roleText}</Badge>
        <Badge variant={workspaceReady && workspaceAvailable ? "secondary" : "outline"}>{workspaceText}</Badge>
        <a className={buttonVariants({ variant: "ghost", size: "sm" })} href="/logout">
          <LogOut data-icon="inline-start" />
          Leave
        </a>
      </div>
    </header>
  );
}
