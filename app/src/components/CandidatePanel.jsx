import { UserPlus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function CandidatePanel({ session, onAdmit, admitting }) {
  const room = session?.room;
  let status = "No candidate waiting yet.";
  let buttonText = "Waiting";
  let disabled = true;

  if (room?.candidateAdmitted) {
    const names = room.candidateNames.length ? room.candidateNames.join(", ") : "Candidate";
    status = `${names} admitted. The workspace link is active for both sides.`;
    buttonText = "Admitted";
  } else if (room?.candidateWaiting) {
    const seen = room.candidateLastSeen
      ? new Date(room.candidateLastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    const names = room.candidateNames.length ? room.candidateNames.join(", ") : "Candidate";
    status = `${names} waiting${seen ? ` since ${seen}` : ""}.`;
    buttonText = admitting ? "Admitting..." : "Admit candidate";
    disabled = admitting;
  }

  return (
    <Card className="lobby-panel grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader>
        <CardTitle>Candidate</CardTitle>
        <CardAction>
          <Button type="button" disabled={disabled} onClick={onAdmit}>
            {admitting ? <Spinner data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
            {buttonText}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
