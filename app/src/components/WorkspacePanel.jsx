import { Monitor, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyIcon, EmptyTitle } from "@/components/ui/empty";

export function WorkspacePanel({ ready, available, title = "Workspace", revision, onReload }) {
  const showFrame = ready && available;
  const src = showFrame ? `/ide/?reload=${revision}` : "about:blank";

  return (
    <Card className="workspace-surface grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" type="button" onClick={onReload} disabled={!showFrame}>
            <RefreshCw data-icon="inline-start" />
            Reload
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 overflow-hidden p-0">
        {!showFrame && (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyIcon>
                <Monitor />
              </EmptyIcon>
              <EmptyTitle>Workspace starting</EmptyTitle>
              <EmptyDescription>code-server will open here when it is ready.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {showFrame && <iframe key={revision} src={src} title="Interview workspace" />}
      </CardContent>
    </Card>
  );
}
