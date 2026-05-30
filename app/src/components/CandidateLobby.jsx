import { UserRoundCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function CandidateLobby({ session }) {
  return (
    <main className="grid min-h-0 place-items-center bg-muted p-5">
      <Card className="min-h-72 w-full max-w-xl">
        <CardHeader>
          <CardTitle>Waiting room</CardTitle>
          <CardAction>
            <Badge variant="outline">candidate</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid place-items-center">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserRoundCheck />
              </EmptyMedia>
              <EmptyTitle>Waiting for interviewer approval</EmptyTitle>
              <EmptyDescription>
                {session?.room?.candidateAdmitted
                  ? "Approved. Opening the workspace..."
                  : "The interviewer has not admitted this candidate yet."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </main>
  );
}
