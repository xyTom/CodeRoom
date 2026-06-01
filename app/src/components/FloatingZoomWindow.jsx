import { useEffect, useMemo, useState } from "react";
import { Grip, Maximize2, Minimize2, PhoneOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "coderoom:zoom-window:v2";
const MIN_WIDTH = 340;
const MIN_HEIGHT = 240;
const EDGE = 16;

function defaultBounds() {
  const width = Math.min(520, Math.max(MIN_WIDTH, window.innerWidth - EDGE * 2));
  const height = Math.min(340, Math.max(MIN_HEIGHT, window.innerHeight - 112));
  return {
    width,
    height,
    x: Math.max(EDGE, window.innerWidth - width - EDGE),
    y: Math.max(88, window.innerHeight - height - EDGE),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampBounds(bounds) {
  const maxWidth = Math.max(MIN_WIDTH, Math.min(720, window.innerWidth - EDGE * 2));
  const maxHeight = Math.max(MIN_HEIGHT, Math.min(520, window.innerHeight - 88 - EDGE));
  const width = clamp(bounds.width, MIN_WIDTH, maxWidth);
  const height = clamp(bounds.height, MIN_HEIGHT, maxHeight);
  return {
    width,
    height,
    x: clamp(bounds.x, EDGE, Math.max(EDGE, window.innerWidth - width - EDGE)),
    y: clamp(bounds.y, 88, Math.max(88, window.innerHeight - height - EDGE)),
  };
}

function readStoredBounds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? clampBounds(JSON.parse(raw)) : defaultBounds();
  } catch {
    return defaultBounds();
  }
}

export function FloatingZoomWindow({ visible, loading, joined, mounted, containerRef, onClose, onLeave }) {
  const [bounds, setBounds] = useState(readStoredBounds);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bounds));
    }
  }, [bounds, expanded]);

  useEffect(() => {
    const onResize = () => setBounds((current) => clampBounds(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const style = useMemo(
    () =>
      expanded
        ? {
            left: "1rem",
            top: "5rem",
            right: "1rem",
            bottom: "1rem",
            width: "auto",
            height: "auto",
          }
        : {
            left: `${bounds.x}px`,
            top: `${bounds.y}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
          },
    [bounds, expanded],
  );

  function startDrag(event) {
    if (expanded || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = bounds;
    event.currentTarget.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      setBounds(
        clampBounds({
          ...initial,
          x: initial.x + moveEvent.clientX - startX,
          y: initial.y + moveEvent.clientY - startY,
        }),
      );
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startResize(event) {
    if (expanded) {
      return;
    }
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = bounds;
    event.currentTarget.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      setBounds(
        clampBounds({
          ...initial,
          width: initial.width + moveEvent.clientX - startX,
          height: initial.height + moveEvent.clientY - startY,
        }),
      );
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (!visible && !joined && !loading && !mounted) {
    return null;
  }

  return (
    <Card
      className={cn(
        "fixed z-[60] grid grid-rows-[3.25rem_minmax(0,1fr)] gap-0 overflow-hidden rounded-3xl border bg-card p-0 shadow-2xl ring-1 ring-foreground/10",
        expanded ? "max-[700px]:grid-rows-[3.75rem_minmax(0,1fr)]" : "",
      )}
      style={visible ? style : { ...style, display: "none" }}
    >
      <CardHeader
        className="grid-cols-[minmax(0,1fr)_auto] cursor-move select-none border-b bg-card/95 px-3 py-2"
        onPointerDown={startDrag}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", joined ? "bg-primary" : loading ? "bg-muted-foreground" : "bg-muted")} />
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{joined ? "Zoom meeting" : loading ? "Starting Zoom" : "Zoom meeting"}</CardTitle>
            <CardDescription className="truncate text-xs">{expanded ? "Expanded meeting view" : "Floating meeting window"}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            title={expanded ? "Restore Zoom" : "Expand Zoom"}
            aria-label={expanded ? "Restore Zoom" : "Expand Zoom"}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <Minimize2 data-icon="inline-start" /> : <Maximize2 data-icon="inline-start" />}
          </Button>
          {joined ? (
            <Button variant="destructive" size="icon-sm" type="button" title="Leave Zoom" aria-label="Leave Zoom" onClick={onLeave}>
              <PhoneOff data-icon="inline-start" />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon-sm" type="button" title="Hide Zoom" aria-label="Hide Zoom" onClick={onClose}>
            <X data-icon="inline-start" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative min-h-0 overflow-hidden p-0">
        <div className="h-full w-full bg-muted" ref={containerRef} />
        {loading && !joined ? (
          <div className="absolute inset-0 grid place-items-center bg-muted/95 text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-3 rounded-3xl border bg-card px-6 py-5 shadow-sm">
              <Spinner />
              <div className="text-center">
                <div className="font-medium text-foreground">Preparing the meeting</div>
                <div className="text-xs text-muted-foreground">Connecting to Zoom Video SDK...</div>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
      {!expanded ? (
        <div
          className="absolute bottom-1 right-1 grid size-7 cursor-nwse-resize place-items-center rounded-2xl bg-card/80 text-muted-foreground shadow-sm ring-1 ring-border"
          title="Resize Zoom"
          onPointerDown={startResize}
        >
          <Grip className="size-3" />
        </div>
      ) : null}
    </Card>
  );
}
