import { Clock } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CandidateLobby({ session }) {
  return (
    <main className="grid min-h-0 place-items-center bg-muted p-5">
      <Card size="sm" className="min-h-48 w-full max-w-xl">
        <CardHeader>
          <CardTitle>Waiting room</CardTitle>
          <CardAction>
            <Badge variant="outline">candidate</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Alert>
            <Clock />
            <AlertDescription>
              {session?.room?.candidateAdmitted
                ? "Approved. Opening the workspace..."
                : "Waiting for interviewer approval."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </main>
  );
}
