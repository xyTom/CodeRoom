import { CircleCheck, Clock, UserPlus, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function CandidatePanel({ session, onAdmit, admitting, fill = false }) {
  const room = session?.room;
  let status = "No candidate waiting yet.";
  let buttonText = "Waiting";
  let disabled = true;
  let statusLabel = "idle";
  let StatusIcon = Users;
  let statusTitle = "No one in the lobby";

  if (room?.candidateAdmitted) {
    const names = room.candidateNames.length ? room.candidateNames.join(", ") : "Candidate";
    status = `${names} admitted. The workspace link is active for both sides.`;
    buttonText = "Admitted";
    statusLabel = "admitted";
    StatusIcon = CircleCheck;
    statusTitle = "Candidate admitted";
  } else if (room?.candidateWaiting) {
    const seen = room.candidateLastSeen
      ? new Date(room.candidateLastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    const names = room.candidateNames.length ? room.candidateNames.join(", ") : "Candidate";
    status = `${names} waiting${seen ? ` since ${seen}` : ""}.`;
    buttonText = admitting ? "Admitting..." : "Admit candidate";
    disabled = admitting;
    statusLabel = "waiting";
    StatusIcon = Clock;
    statusTitle = "Candidate waiting";
  }

  return (
    <Card size="sm" className={cn("shadow-sm", fill ? "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]" : "shrink-0")}>
      <CardHeader className="border-b">
        <CardTitle>Candidate</CardTitle>
        <CardDescription>Lobby admission</CardDescription>
        <CardAction>
          <Badge variant={statusLabel === "admitted" ? "secondary" : "outline"}>{statusLabel}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-col justify-center gap-3">
        <Alert>
          <StatusIcon />
          <AlertTitle>{statusTitle}</AlertTitle>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="flex-col items-stretch border-t pt-3">
        <Button size="sm" type="button" disabled={disabled} onClick={onAdmit}>
          {admitting ? <Spinner data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
          {buttonText}
        </Button>
      </CardFooter>
    </Card>
  );
}
