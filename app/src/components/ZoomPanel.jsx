import { CircleOff, Radio, UserPlus, Video } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function ZoomPanel({
  session,
  joined,
  loading,
  notice,
  canJoin,
  canInvite,
  onJoin,
  onInvite,
  fill = false,
}) {
  const isInterviewer = session?.role === "interviewer";
  const enabled = Boolean(session?.zoom?.enabled);
  const primaryText = joined ? "Show Zoom" : "Join Zoom";
  const StatusIcon = enabled ? Radio : CircleOff;
  const showNotice = Boolean(notice && (!enabled || !joined || session?.role === "candidate"));

  return (
    <Card className={cn(fill ? "h-full min-h-0" : "shrink-0")}>
      <CardHeader>
        <div>
          <CardTitle>Video room</CardTitle>
          <CardDescription>Zoom session controls</CardDescription>
        </div>
        <CardAction>
          <Badge variant={enabled ? "secondary" : "outline"}>{enabled ? "enabled" : "offline"}</Badge>
        </CardAction>
      </CardHeader>
      {showNotice ? (
        <CardContent>
          <Alert>
            <StatusIcon />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        </CardContent>
      ) : null}
      <CardFooter className="flex-col items-stretch gap-2">
        <Button size="lg" type="button" disabled={!canJoin || loading} onClick={onJoin}>
          {loading ? <Spinner data-icon="inline-start" /> : <Video data-icon="inline-start" />}
          {primaryText}
        </Button>
        {isInterviewer && (
          <Button variant="outline" size="lg" type="button" disabled={!canInvite || loading} onClick={onInvite}>
            <UserPlus data-icon="inline-start" />
            Invite candidate
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
