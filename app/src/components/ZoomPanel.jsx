import { UserPlus, Video } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function ZoomPanel({
  session,
  joined,
  loading,
  notice,
  canJoin,
  canInvite,
  onJoin,
  onInvite,
}) {
  const isInterviewer = session?.role === "interviewer";
  const enabled = Boolean(session?.zoom?.enabled);
  const primaryText = joined ? "Show Zoom" : "Join Zoom";

  return (
    <Card className="shrink-0">
      <CardHeader>
        <div>
          <CardTitle>Video room</CardTitle>
          <CardDescription>Zoom session controls</CardDescription>
        </div>
        <CardAction>
          <Badge variant={enabled ? "secondary" : "outline"}>{enabled ? "enabled" : "offline"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
        <div className="grid gap-2">
          <Button type="button" disabled={!canJoin || loading} onClick={onJoin}>
            {loading ? <Spinner data-icon="inline-start" /> : <Video data-icon="inline-start" />}
            {primaryText}
          </Button>
          {isInterviewer && (
            <Button variant="outline" type="button" disabled={!canInvite || loading} onClick={onInvite}>
              <UserPlus data-icon="inline-start" />
              Invite candidate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
