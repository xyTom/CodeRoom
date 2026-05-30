import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "coderoom:zoom-window";
const MIN_WIDTH = 340;
const MIN_HEIGHT = 240;
const EDGE = 12;

function defaultBounds() {
  const width = Math.min(520, Math.max(MIN_WIDTH, window.innerWidth - EDGE * 2));
  const height = Math.min(360, Math.max(MIN_HEIGHT, window.innerHeight - 92));
  return {
    width,
    height,
    x: Math.max(EDGE, window.innerWidth - width - 20),
    y: Math.max(76, window.innerHeight - height - 20),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampBounds(bounds) {
  const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - EDGE * 2);
  const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - 76 - EDGE);
  const width = clamp(bounds.width, MIN_WIDTH, maxWidth);
  const height = clamp(bounds.height, MIN_HEIGHT, maxHeight);
  return {
    width,
    height,
    x: clamp(bounds.x, EDGE, Math.max(EDGE, window.innerWidth - width - EDGE)),
    y: clamp(bounds.y, 70, Math.max(70, window.innerHeight - height - EDGE)),
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

export function FloatingZoomWindow({ visible, loading, joined, containerRef, onClose }) {
  const [bounds, setBounds] = useState(readStoredBounds);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bounds));
  }, [bounds]);

  useEffect(() => {
    const onResize = () => setBounds((current) => clampBounds(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const style = useMemo(
    () => ({
      left: `${bounds.x}px`,
      top: `${bounds.y}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
    }),
    [bounds],
  );

  function startDrag(event) {
    if (event.button !== 0) {
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

  return (
    <div className="zoom-floating-window" style={style} hidden={!visible}>
      <div className="zoom-window-bar" onPointerDown={startDrag}>
        <strong>{joined ? "Zoom" : loading ? "Starting Zoom" : "Zoom"}</strong>
        <Button
          variant="secondary"
          size="icon"
          type="button"
          title="Hide Zoom"
          aria-label="Hide Zoom"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          <X data-icon="inline-start" />
        </Button>
      </div>
      <div className="zoom-container" ref={containerRef} />
      {loading && !joined ? <div className="zoom-loading">Loading Zoom...</div> : null}
      <div className="zoom-resize-handle" title="Resize Zoom" onPointerDown={startResize} />
    </div>
  );
}
