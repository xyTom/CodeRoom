import { useState } from "react";

import { CandidatePanel } from "./CandidatePanel.jsx";
import { ChatPanel } from "./ChatPanel.jsx";
import { WorkspacePanel } from "./WorkspacePanel.jsx";
import { ZoomPanel } from "./ZoomPanel.jsx";

const PANEL_HANDLE_SIZE = "0.75rem";
const COLLAPSE_THRESHOLD = 72;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampPanelWidth(value, max) {
  const width = clamp(value, 0, max);
  return width < COLLAPSE_THRESHOLD ? 0 : width;
}

function clampShare(value) {
  const share = clamp(value, 0, 100);
  if (share < 8) {
    return 0;
  }
  if (share > 92) {
    return 100;
  }
  return share;
}

function verticalRows(firstShare) {
  if (firstShare <= 0) {
    return `0px ${PANEL_HANDLE_SIZE} minmax(0, 1fr)`;
  }
  if (firstShare >= 100) {
    return `minmax(0, 1fr) ${PANEL_HANDLE_SIZE} 0px`;
  }
  return `${firstShare}% ${PANEL_HANDLE_SIZE} minmax(0, 1fr)`;
}

function beginResize(event, onDelta) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  const startX = event.clientX;
  const startY = event.clientY;
  event.currentTarget.setPointerCapture(event.pointerId);

  const onMove = (moveEvent) => onDelta(moveEvent.clientX - startX, moveEvent.clientY - startY);
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function ResizeHandle({ orientation, onPointerDown }) {
  const isVertical = orientation === "vertical";

  return (
    <div
      aria-label={isVertical ? "Resize side panel" : "Resize stacked panels"}
      aria-orientation={isVertical ? "vertical" : "horizontal"}
      className={
        isVertical
          ? "group grid min-h-0 cursor-col-resize place-items-center px-1 transition-colors hover:bg-muted/60 active:bg-muted"
          : "group grid min-w-0 cursor-row-resize place-items-center py-1 transition-colors hover:bg-muted/60 active:bg-muted"
      }
      role="separator"
      onPointerDown={onPointerDown}
    >
      <div
        className={
          isVertical
            ? "h-14 w-1 rounded-full bg-border transition-colors group-hover:bg-primary/40"
            : "h-1 w-14 rounded-full bg-border transition-colors group-hover:bg-primary/40"
        }
      />
    </div>
  );
}

function CandidateSideStack({ session, messages, chatStatus, onSendMessage, zoomProps, zoomShare, onResizeZoom }) {
  return (
    <div
      className="grid h-full min-h-0 min-w-0"
      style={{
        gridTemplateRows: verticalRows(zoomShare),
      }}
    >
      <section className="min-h-0 min-w-0 overflow-hidden">
        {zoomShare > 0 ? <ZoomPanel session={session} {...zoomProps} fill /> : null}
      </section>
      <ResizeHandle
        orientation="horizontal"
        onPointerDown={(event) => {
          const initial = zoomShare;
          beginResize(event, (_dx, dy) => onResizeZoom(initial, dy));
        }}
      />
      <section className="min-h-0 min-w-0 overflow-hidden">
        {zoomShare < 100 ? <ChatPanel messages={messages} status={chatStatus} onSend={onSendMessage} /> : null}
      </section>
    </div>
  );
}

function InterviewerSideStack({ session, admitting, onAdmit, zoomProps, candidateShare, onResizeCandidate }) {
  return (
    <div
      className="grid h-full min-h-0 min-w-0"
      style={{
        gridTemplateRows: verticalRows(candidateShare),
      }}
    >
      <section className="min-h-0 min-w-0 overflow-hidden">
        {candidateShare > 0 ? <CandidatePanel session={session} onAdmit={onAdmit} admitting={admitting} fill /> : null}
      </section>
      <ResizeHandle
        orientation="horizontal"
        onPointerDown={(event) => {
          const initial = candidateShare;
          beginResize(event, (_dx, dy) => onResizeCandidate(initial, dy));
        }}
      />
      <section className="min-h-0 min-w-0 overflow-hidden">
        {candidateShare < 100 ? <ZoomPanel session={session} {...zoomProps} fill /> : null}
      </section>
    </div>
  );
}

export function CandidateRoom({
  session,
  messages,
  chatStatus,
  workspaceRevision,
  onReloadWorkspace,
  onSendMessage,
  zoomProps,
}) {
  const [sideWidth, setSideWidth] = useState(344);
  const [zoomShare, setZoomShare] = useState(38);

  return (
    <main className="mx-auto min-h-0 w-full max-w-[1800px] overflow-hidden px-2 pb-2 max-[900px]:overflow-auto max-[900px]:px-3 max-[900px]:pb-3">
      <div
        className="hidden h-full min-h-0 min-w-0 min-[901px]:grid"
        style={{
          gridTemplateColumns: `minmax(0, 1fr) ${PANEL_HANDLE_SIZE} ${sideWidth}px`,
        }}
      >
        <section className="min-h-0 min-w-0 overflow-hidden">
          <WorkspacePanel
            ready={session.workspace.ready}
            available={session.room.candidateAdmitted}
            revision={workspaceRevision}
            onReload={onReloadWorkspace}
          />
        </section>
        <ResizeHandle
          orientation="vertical"
          onPointerDown={(event) => {
            const initial = sideWidth;
            beginResize(event, (dx) => setSideWidth(clampPanelWidth(initial - dx, 520)));
          }}
        />
        <aside className="min-h-0 min-w-0 overflow-hidden">
          <CandidateSideStack
            session={session}
            messages={messages}
            chatStatus={chatStatus}
            onSendMessage={onSendMessage}
            zoomProps={zoomProps}
            zoomShare={zoomShare}
            onResizeZoom={(initial, dy) => setZoomShare(clampShare(initial + dy / 4))}
          />
        </aside>
      </div>

      <div className="grid min-h-0 min-w-0 grid-cols-1 gap-3 min-[901px]:hidden">
        <section className="min-h-[70vh] min-w-0">
          <WorkspacePanel
            ready={session.workspace.ready}
            available={session.room.candidateAdmitted}
            revision={workspaceRevision}
            onReload={onReloadWorkspace}
          />
        </section>
        <aside className="flex min-h-0 min-w-0 flex-col gap-3 overflow-auto">
          <ZoomPanel session={session} {...zoomProps} />
          <ChatPanel messages={messages} status={chatStatus} onSend={onSendMessage} />
        </aside>
      </div>
    </main>
  );
}

export function InterviewerRoom({
  session,
  messages,
  chatStatus,
  admitting,
  workspaceRevision,
  onAdmit,
  onReloadWorkspace,
  onSendMessage,
  zoomProps,
}) {
  const [leftWidth, setLeftWidth] = useState(316);
  const [rightWidth, setRightWidth] = useState(344);
  const [candidateShare, setCandidateShare] = useState(40);

  return (
    <main className="mx-auto min-h-0 w-full max-w-[1800px] overflow-hidden px-2 pb-2 max-[900px]:overflow-auto max-[900px]:px-3 max-[900px]:pb-3">
      <div
        className="hidden h-full min-h-0 min-w-0 min-[1181px]:grid"
        style={{
          gridTemplateColumns: `${leftWidth}px ${PANEL_HANDLE_SIZE} minmax(0, 1fr) ${PANEL_HANDLE_SIZE} ${rightWidth}px`,
        }}
      >
        <aside className="min-h-0 min-w-0 overflow-hidden">
          <InterviewerSideStack
            session={session}
            admitting={admitting}
            onAdmit={onAdmit}
            zoomProps={zoomProps}
            candidateShare={candidateShare}
            onResizeCandidate={(initial, dy) => setCandidateShare(clampShare(initial + dy / 4))}
          />
        </aside>
        <ResizeHandle
          orientation="vertical"
          onPointerDown={(event) => {
            const initial = leftWidth;
            beginResize(event, (dx) => setLeftWidth(clampPanelWidth(initial + dx, 500)));
          }}
        />
        <section className="min-h-0 min-w-0 overflow-hidden">
          <WorkspacePanel ready={session.workspace.ready} available revision={workspaceRevision} onReload={onReloadWorkspace} />
        </section>
        <ResizeHandle
          orientation="vertical"
          onPointerDown={(event) => {
            const initial = rightWidth;
            beginResize(event, (dx) => setRightWidth(clampPanelWidth(initial - dx, 520)));
          }}
        />
        <aside className="min-h-0 min-w-0 overflow-hidden">
          <ChatPanel messages={messages} status={chatStatus} onSend={onSendMessage} />
        </aside>
      </div>

      <div className="grid min-h-0 min-w-0 grid-cols-[minmax(18rem,23rem)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_minmax(19rem,34vh)] gap-3 min-[1181px]:hidden max-[900px]:grid-cols-1 max-[900px]:grid-rows-none">
        <aside className="flex min-h-0 min-w-0 flex-col gap-3 overflow-auto max-[900px]:row-auto">
          <CandidatePanel session={session} onAdmit={onAdmit} admitting={admitting} />
          <ZoomPanel session={session} {...zoomProps} />
        </aside>
        <section className="min-h-0 min-w-0 max-[900px]:min-h-[70vh]">
          <WorkspacePanel ready={session.workspace.ready} available revision={workspaceRevision} onReload={onReloadWorkspace} />
        </section>
        <aside className="min-h-0 min-w-0 max-[1180px]:col-span-2 max-[900px]:col-span-1 max-[900px]:min-h-72">
          <ChatPanel messages={messages} status={chatStatus} onSend={onSendMessage} />
        </aside>
      </div>
    </main>
  );
}
