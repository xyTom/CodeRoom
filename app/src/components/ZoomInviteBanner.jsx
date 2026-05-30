import { Video } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ZoomInviteBanner({ show, invitedBy, onJoin }) {
  if (!show) {
    return null;
  }

  return (
    <Alert className="fixed bottom-5 right-5 z-[70] flex w-[min(26.25rem,calc(100vw-2rem))] items-center justify-between gap-3 bg-card shadow-xl">
      <AlertDescription>Zoom invite{invitedBy ? ` from ${invitedBy}` : ""}.</AlertDescription>
      <Button type="button" onClick={onJoin}>
        <Video data-icon="inline-start" />
        Join
      </Button>
    </Alert>
  );
}
