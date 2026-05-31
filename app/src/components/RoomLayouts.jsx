import { useState } from "react";

import { CandidatePanel } from "./CandidatePanel.jsx";
import { ChatPanel } from "./ChatPanel.jsx";
import { WorkspacePanel } from "./WorkspacePanel.jsx";
import { ZoomPanel } from "./ZoomPanel.jsx";

const PANEL_HANDLE_SIZE = "1.25rem";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
      aria-orientation={isVertical ? "vertical" : "horizontal"}
      className={
        isVertical
          ? "grid min-h-0 cursor-col-resize place-items-center"
          : "grid min-w-0 cursor-row-resize place-items-center"
      }
      role="separator"
      onPointerDown={onPointerDown}
    >
      <div className={isVertical ? "h-16 w-px rounded-full bg-border" : "h-px w-16 rounded-full bg-border"} />
    </div>
  );
}

function CandidateSideStack({ session, messages, chatStatus, onSendMessage, zoomProps, zoomShare, onResizeZoom }) {
  return (
    <div
      className="grid h-full min-h-0 min-w-0"
      style={{
        gridTemplateRows: `${zoomShare}% ${PANEL_HANDLE_SIZE} minmax(0, 1fr)`,
      }}
    >
      <section className="min-h-0 min-w-0 overflow-hidden">
        <ZoomPanel session={session} {...zoomProps} fill />
      </section>
      <ResizeHandle
        orientation="horizontal"
        onPointerDown={(event) => {
          const initial = zoomShare;
          beginResize(event, (_dx, dy) => onResizeZoom(initial, dy));
        }}
      />
      <section className="min-h-0 min-w-0 overflow-hidden">
        <ChatPanel messages={messages} status={chatStatus} onSend={onSendMessage} />
      </section>
    </div>
  );
}

function InterviewerSideStack({ session, admitting, onAdmit, zoomProps, candidateShare, onResizeCandidate }) {
  return (
    <div
      className="grid h-full min-h-0 min-w-0"
      style={{
        gridTemplateRows: `${candidateShare}% ${PANEL_HANDLE_SIZE} minmax(0, 1fr)`,
      }}
    >
      <section className="min-h-0 min-w-0 overflow-hidden">
        <CandidatePanel session={session} onAdmit={onAdmit} admitting={admitting} fill />
      </section>
      <ResizeHandle
        orientation="horizontal"
        onPointerDown={(event) => {
          const initial = candidateShare;
          beginResize(event, (_dx, dy) => onResizeCandidate(initial, dy));
        }}
      />
      <section className="min-h-0 min-w-0 overflow-hidden">
        <ZoomPanel session={session} {...zoomProps} fill />
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
  const [sideWidth, setSideWidth] = useState(390);
  const [zoomShare, setZoomShare] = useState(36);

  return (
    <main className="mx-auto min-h-0 w-full max-w-[1800px] overflow-hidden px-5 pb-5 max-[900px]:overflow-auto">
      <div
        className="hidden h-full min-h-0 min-w-0 min-[901px]:grid"
        style={{
          gridTemplateColumns: `minmax(32rem, 1fr) ${PANEL_HANDLE_SIZE} ${sideWidth}px`,
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
            beginResize(event, (dx) => setSideWidth(clamp(initial - dx, 320, 560)));
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
            onResizeZoom={(initial, dy) => setZoomShare(clamp(initial + dy / 4, 22, 68))}
          />
        </aside>
      </div>

      <div className="grid min-h-0 min-w-0 grid-cols-1 gap-5 min-[901px]:hidden">
        <section className="min-h-[70vh] min-w-0">
          <WorkspacePanel
            ready={session.workspace.ready}
            available={session.room.candidateAdmitted}
            revision={workspaceRevision}
            onReload={onReloadWorkspace}
          />
        </section>
        <aside className="flex min-h-0 min-w-0 flex-col gap-5 overflow-auto">
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
  const [leftWidth, setLeftWidth] = useState(360);
  const [rightWidth, setRightWidth] = useState(390);
  const [candidateShare, setCandidateShare] = useState(42);

  return (
    <main className="mx-auto min-h-0 w-full max-w-[1800px] overflow-hidden px-5 pb-5 max-[900px]:overflow-auto">
      <div
        className="hidden h-full min-h-0 min-w-0 min-[1181px]:grid"
        style={{
          gridTemplateColumns: `${leftWidth}px ${PANEL_HANDLE_SIZE} minmax(34rem, 1fr) ${PANEL_HANDLE_SIZE} ${rightWidth}px`,
        }}
      >
        <aside className="min-h-0 min-w-0 overflow-hidden">
          <InterviewerSideStack
            session={session}
            admitting={admitting}
            onAdmit={onAdmit}
            zoomProps={zoomProps}
            candidateShare={candidateShare}
            onResizeCandidate={(initial, dy) => setCandidateShare(clamp(initial + dy / 4, 24, 72))}
          />
        </aside>
        <ResizeHandle
          orientation="vertical"
          onPointerDown={(event) => {
            const initial = leftWidth;
            beginResize(event, (dx) => setLeftWidth(clamp(initial + dx, 300, 520)));
          }}
        />
        <section className="min-h-0 min-w-0 overflow-hidden">
          <WorkspacePanel ready={session.workspace.ready} available revision={workspaceRevision} onReload={onReloadWorkspace} />
        </section>
        <ResizeHandle
          orientation="vertical"
          onPointerDown={(event) => {
            const initial = rightWidth;
            beginResize(event, (dx) => setRightWidth(clamp(initial - dx, 320, 560)));
          }}
        />
        <aside className="min-h-0 min-w-0 overflow-hidden">
          <ChatPanel messages={messages} status={chatStatus} onSend={onSendMessage} />
        </aside>
      </div>

      <div className="grid min-h-0 min-w-0 grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_minmax(20rem,34vh)] gap-5 min-[1181px]:hidden max-[900px]:grid-cols-1 max-[900px]:grid-rows-none">
        <aside className="flex min-h-0 min-w-0 flex-col gap-5 overflow-auto max-[900px]:row-auto">
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
