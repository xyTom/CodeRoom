import { Video } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ZoomInviteBanner({ show, invitedBy, onJoin }) {
  if (!show) {
    return null;
  }

  return (
    <Alert className="fixed bottom-4 right-4 z-[70] grid w-[min(25rem,calc(100vw-2rem))] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-card shadow-xl">
      <Video />
      <div className="min-w-0">
        <AlertTitle>Meeting invite</AlertTitle>
        <AlertDescription className="truncate">Zoom invite{invitedBy ? ` from ${invitedBy}` : ""}.</AlertDescription>
      </div>
      <Button size="sm" type="button" onClick={onJoin}>
        <Video data-icon="inline-start" />
        Join
      </Button>
    </Alert>
  );
}
