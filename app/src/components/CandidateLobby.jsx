import { CheckCircle2, Clock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function CandidateLobby({ session }) {
  const admitted = Boolean(session?.room?.candidateAdmitted);
  const name = session?.name?.trim();

  return (
    <main className="grid min-h-0 place-items-center bg-muted p-5">
      <Card size="sm" className="w-full max-w-md shadow-sm">
        <CardContent className="flex flex-col items-center gap-5 px-6 py-10 text-center">
          <div
            className={cn(
              "relative grid size-16 place-items-center rounded-full",
              admitted ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
            )}
          >
            {admitted ? null : <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
            {admitted ? <CheckCircle2 className="relative size-7" /> : <Clock className="relative size-7" />}
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-xl font-medium text-foreground">
              {admitted ? "You're in" : "Waiting for approval"}
            </h1>
            <p className="text-pretty text-sm leading-6 text-muted-foreground">
              {admitted
                ? "Opening the shared workspace for you now."
                : `Hang tight${name ? `, ${name}` : ""}. Your interviewer will let you in shortly — keep this tab open and you'll join automatically.`}
            </p>
          </div>

          {admitted ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              <span>Loading workspace…</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="size-2 rounded-full bg-primary" />
              Connected
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
