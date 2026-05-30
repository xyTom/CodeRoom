import { UserPlus, Video } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Card className="video-panel grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader>
        <CardTitle>Call</CardTitle>
        <CardAction className="flex items-center gap-2">
          {isInterviewer && (
            <Button
              variant="outline"
              size="icon"
              type="button"
              disabled={!canInvite || loading}
              title="Invite candidate to Zoom"
              aria-label="Invite candidate to Zoom"
              onClick={onInvite}
            >
              <UserPlus data-icon="inline-start" />
            </Button>
          )}
          <Button
            size="icon"
            type="button"
            disabled={!canJoin || loading}
            title={joined ? "Show Zoom" : "Join Zoom"}
            aria-label={joined ? "Show Zoom" : "Join Zoom"}
            onClick={onJoin}
          >
            {loading ? <Spinner data-icon="inline-start" /> : <Video data-icon="inline-start" />}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
