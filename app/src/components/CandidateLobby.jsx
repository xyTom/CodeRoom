import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function CandidateLobby({ session }) {
  return (
    <main className="lobby-layout">
      <Card className="lobby-card grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <CardHeader>
          <CardTitle>Waiting room</CardTitle>
          <CardAction>
            <Badge variant="outline">candidate</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid place-items-center">
          <Empty>
            <EmptyHeader>
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
