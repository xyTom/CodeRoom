import { UserPlus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function CandidatePanel({ session, onAdmit, admitting }) {
  const room = session?.room;
  let status = "No candidate waiting yet.";
  let buttonText = "Waiting";
  let disabled = true;
  let statusLabel = "idle";

  if (room?.candidateAdmitted) {
    const names = room.candidateNames.length ? room.candidateNames.join(", ") : "Candidate";
    status = `${names} admitted. The workspace link is active for both sides.`;
    buttonText = "Admitted";
    statusLabel = "admitted";
  } else if (room?.candidateWaiting) {
    const seen = room.candidateLastSeen
      ? new Date(room.candidateLastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    const names = room.candidateNames.length ? room.candidateNames.join(", ") : "Candidate";
    status = `${names} waiting${seen ? ` since ${seen}` : ""}.`;
    buttonText = admitting ? "Admitting..." : "Admit candidate";
    disabled = admitting;
    statusLabel = "waiting";
  }

  return (
    <Card className="shrink-0">
      <CardHeader>
        <div>
          <CardTitle>Candidate</CardTitle>
          <CardDescription>Admission and workspace access</CardDescription>
        </div>
        <CardAction>
          <Badge variant={statusLabel === "admitted" ? "secondary" : "outline"}>{statusLabel}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Alert>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
        <Button className="w-full" type="button" disabled={disabled} onClick={onAdmit}>
          {admitting ? <Spinner data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}
