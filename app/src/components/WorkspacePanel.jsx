import { Monitor, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function WorkspacePanel({ ready, available, title = "Workspace", revision, onReload }) {
  const showFrame = ready && available;
  const src = showFrame ? `/ide/?reload=${revision}` : "about:blank";
  const emptyTitle = available ? "Workspace starting" : "Waiting for approval";

  return (
    <Card size="sm" className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <Button variant="outline" size="icon-sm" type="button" onClick={onReload} disabled={!showFrame}>
            <RefreshCw />
            <span className="sr-only">Reload workspace</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 overflow-hidden p-0">
        {!showFrame && (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Monitor />
              </EmptyMedia>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              {available ? <EmptyDescription>code-server will open here when it is ready.</EmptyDescription> : null}
            </EmptyHeader>
          </Empty>
        )}
        {showFrame && <iframe className="h-full w-full border-0 bg-card" key={revision} src={src} title="Interview workspace" />}
      </CardContent>
    </Card>
  );
}
