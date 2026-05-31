import { useCallback, useEffect, useMemo, useState } from "react";
import { Grip, Maximize2, Minimize2, PhoneOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

function syncZoomLayout(container) {
  if (!container) {
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;
  const root = container.querySelector(".zoom-ui-toolkit-root");

  if (!root || width <= 0 || height <= 0) {
    return;
  }

  const app = root.querySelector("#uikit-container-app");
  const appInner = app?.firstElementChild;
  const header = root.querySelector("#uikit-header");
  const footer = root.querySelector("#zoom-ui-toolkit-controls");
  const main = root.querySelector(".uikit-main-content");
  const sidebar = main?.querySelector(".w-0.h-full");
  const mainHeight = Math.max(0, height - (header?.offsetHeight || 0) - (footer?.offsetHeight || 0));

  for (const element of [root, app, appInner].filter(Boolean)) {
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.minWidth = "0";
    element.style.minHeight = "0";
    element.style.maxWidth = "100%";
    element.style.maxHeight = "100%";
  }

  if (main) {
    main.style.width = `${width}px`;
    main.style.height = `${mainHeight}px`;
    main.style.minWidth = "0";
    main.style.minHeight = "0";
    main.style.maxWidth = "100%";
  }

  if (sidebar) {
    sidebar.style.height = `${mainHeight}px`;
  }

  window.dispatchEvent(new Event("resize"));
}

export function FloatingZoomWindow({ visible, loading, joined, containerRef, onClose, onLeave }) {
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

  const requestZoomLayoutSync = useCallback(() => {
    requestAnimationFrame(() => {
      syncZoomLayout(containerRef.current);
    });
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(requestZoomLayoutSync);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, requestZoomLayoutSync, joined]);

  useEffect(() => {
    if (visible) {
      requestZoomLayoutSync();
    }
  }, [bounds, expanded, requestZoomLayoutSync, visible]);

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

  if (!visible && !joined && !loading) {
    return null;
  }

  return (
    <Card
      className={cn(
        "fixed z-[60] grid gap-0 overflow-hidden p-0 shadow-xl",
        expanded ? "grid-rows-[3rem_minmax(0,1fr)]" : "grid-rows-[3rem_minmax(0,1fr)]",
      )}
      style={visible ? style : { ...style, display: "none" }}
    >
      <CardHeader className="grid-cols-[1fr_auto] cursor-move select-none border-b px-4 py-2" onPointerDown={startDrag}>
        <div className="min-w-0">
          <strong className="block truncate text-sm">{joined ? "Zoom session" : loading ? "Starting Zoom" : "Zoom"}</strong>
          <span className="block truncate text-xs text-muted-foreground">
            {expanded ? "Expanded view" : "Floating view"}
          </span>
        </div>
        <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            title={expanded ? "Restore Zoom" : "Expand Zoom"}
            aria-label={expanded ? "Restore Zoom" : "Expand Zoom"}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <Minimize2 data-icon="inline-start" /> : <Maximize2 data-icon="inline-start" />}
          </Button>
          {joined ? (
            <Button variant="destructive" size="icon" type="button" title="Leave Zoom" aria-label="Leave Zoom" onClick={onLeave}>
              <PhoneOff data-icon="inline-start" />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" type="button" title="Hide Zoom" aria-label="Hide Zoom" onClick={onClose}>
            <X data-icon="inline-start" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative min-h-0 overflow-hidden p-0">
        <div className="h-full w-full bg-muted" ref={containerRef} />
        {loading && !joined ? (
          <div className="absolute inset-0 grid place-items-center bg-muted text-sm text-muted-foreground">Loading Zoom...</div>
        ) : null}
      </CardContent>
      {!expanded ? (
        <div
          className="absolute bottom-0 right-0 grid size-7 cursor-nwse-resize place-items-center text-muted-foreground"
          title="Resize Zoom"
          onPointerDown={startResize}
        >
          <Grip className="size-3" />
        </div>
      ) : null}
    </Card>
  );
}
