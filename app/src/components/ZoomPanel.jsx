import { Radio, UserPlus, Video } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const primaryText = joined ? "Show meeting" : "Join meeting";
  const inviteText = isInterviewer ? "Invite candidate" : "Invite interviewer";
  const showNotice = Boolean(
    notice && (!enabled || !joined || notice !== "Zoom is open in the floating window."),
  );

  return (
    <Card size="sm" className={cn("shadow-sm", fill ? "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]" : "shrink-0")}>
      <CardHeader className="border-b">
        <CardTitle>Video room</CardTitle>
        <CardDescription>{joined ? "Meeting window is available" : "Zoom Video SDK"}</CardDescription>
        <CardAction>
          <Badge variant={enabled ? "secondary" : "outline"}>{enabled ? "enabled" : "offline"}</Badge>
        </CardAction>
      </CardHeader>
      {showNotice ? (
        <CardContent className="flex min-h-0 flex-col justify-center gap-3">
          <Alert>
            {joined ? <Radio /> : <Video />}
            <AlertTitle>{joined ? "Meeting is running" : enabled ? "Ready when you are" : "Video unavailable"}</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        </CardContent>
      ) : null}
      <CardFooter className="flex-col items-stretch gap-2 border-t pt-3">
        <Button size="sm" type="button" disabled={!canJoin || loading} onClick={onJoin}>
          {loading ? <Spinner data-icon="inline-start" /> : <Video data-icon="inline-start" />}
          {primaryText}
        </Button>
        <Button variant="outline" size="sm" type="button" disabled={!canInvite || loading} onClick={onInvite}>
          <UserPlus data-icon="inline-start" />
          {inviteText}
        </Button>
      </CardFooter>
    </Card>
  );
}
