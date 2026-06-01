import { Clock, TerminalSquare } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CandidateLobby({ session }) {
  const admitted = Boolean(session?.room?.candidateAdmitted);

  return (
    <main className="grid min-h-0 place-items-center bg-muted p-5">
      <Card size="sm" className="w-full max-w-xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>Waiting room</CardTitle>
          <CardDescription>{session?.sessionName || "Interview room"}</CardDescription>
          <CardAction>
            <Badge variant="outline">candidate</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <TerminalSquare />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">CodeRoom is ready</div>
              <div className="text-xs text-muted-foreground">Keep this tab open while the interviewer admits you.</div>
            </div>
          </div>
          <Alert>
            <Clock />
            <AlertTitle>{admitted ? "Approved" : "Waiting for approval"}</AlertTitle>
            <AlertDescription>
              {admitted ? "Opening the shared workspace now..." : "The interviewer will let you in when they are ready."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </main>
  );
}
