import { Video } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ZoomInviteBanner({ show, invitedBy, onJoin }) {
  if (!show) {
    return null;
  }

  return (
    <Alert className="zoom-invite-banner">
      <AlertDescription>Zoom invite{invitedBy ? ` from ${invitedBy}` : ""}.</AlertDescription>
      <Button type="button" onClick={onJoin}>
        <Video data-icon="inline-start" />
        Join
      </Button>
    </Alert>
  );
}
