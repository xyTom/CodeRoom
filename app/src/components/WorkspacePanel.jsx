import { Monitor, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function WorkspacePanel({ ready, available, title = "Workspace", revision, onReload }) {
  const showFrame = ready && available;
  const src = showFrame ? `/ide/?reload=${revision}` : "about:blank";
  const emptyTitle = available ? "Workspace is warming up" : "Waiting for approval";
  const emptyDescription = available
    ? "code-server will appear here as soon as the interview workspace is ready."
    : "The candidate workspace opens after the interviewer admits the candidate.";

  return (
    <Card variant="panel" size="sm" className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] shadow-sm">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <div className="flex items-center gap-2">
            {available ? <Badge variant={showFrame ? "secondary" : "outline"}>{showFrame ? "ready" : "starting"}</Badge> : null}
            <Button variant="outline" size="icon-sm" type="button" onClick={onReload} disabled={!showFrame}>
              <RefreshCw />
              <span className="sr-only">Reload workspace</span>
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 overflow-hidden bg-background p-0">
        {!showFrame && (
          <Empty className="h-full border-0 p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Monitor />
              </EmptyMedia>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
            {available ? (
              <div className="flex w-full max-w-sm flex-col gap-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ) : null}
          </Empty>
        )}
        {showFrame && <iframe className="h-full w-full border-0 bg-background" key={revision} src={src} title="Interview workspace" />}
      </CardContent>
    </Card>
  );
}
