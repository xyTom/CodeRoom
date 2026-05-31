import { CircleCheck, Clock, UserPlus, Users } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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

  if (room?.candidateAdmitted) {
    const names = room.candidateNames.length ? room.candidateNames.join(", ") : "Candidate";
    status = `${names} admitted. The workspace link is active for both sides.`;
    buttonText = "Admitted";
    statusLabel = "admitted";
    StatusIcon = CircleCheck;
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
  }

  return (
    <Card className={cn(fill ? "h-full min-h-0" : "shrink-0")}>
      <CardHeader>
        <div>
          <CardTitle>Candidate</CardTitle>
          <CardDescription>Admission and workspace access</CardDescription>
        </div>
        <CardAction>
          <Badge variant={statusLabel === "admitted" ? "secondary" : "outline"}>{statusLabel}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert>
          <StatusIcon />
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="flex-col items-stretch">
        <Button size="lg" type="button" disabled={disabled} onClick={onAdmit}>
          {admitting ? <Spinner data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
          {buttonText}
        </Button>
      </CardFooter>
    </Card>
  );
}
