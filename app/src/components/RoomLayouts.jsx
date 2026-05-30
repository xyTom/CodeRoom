import { CandidatePanel } from "./CandidatePanel.jsx";
import { ChatPanel } from "./ChatPanel.jsx";
import { WorkspacePanel } from "./WorkspacePanel.jsx";
import { ZoomPanel } from "./ZoomPanel.jsx";

export function CandidateRoom({
  session,
  messages,
  chatStatus,
  workspaceRevision,
  onReloadWorkspace,
  onSendMessage,
  zoomProps,
}) {
  return (
    <main className="candidate-grid">
      <div className="candidate-workspace-panel">
        <WorkspacePanel
          ready={session.workspace.ready}
          available={session.room.candidateAdmitted}
          revision={workspaceRevision}
          onReload={onReloadWorkspace}
        />
      </div>
      <div className="resize-handle vertical" data-resize="candidate-dock" title="Resize panels" />
      <aside className="candidate-dock">
        <ZoomPanel session={session} {...zoomProps} />
        <ChatPanel messages={messages} status={chatStatus} onSend={onSendMessage} />
      </aside>
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
  return (
    <main className="interviewer-grid">
      <CandidatePanel session={session} onAdmit={onAdmit} admitting={admitting} />
      <div className="resize-handle vertical interviewer-col-handle" data-resize="interviewer-left" title="Resize panels" />

      <ZoomPanel session={session} {...zoomProps} />
      <div className="resize-handle horizontal interviewer-row-handle" data-resize="interviewer-top" title="Resize call and workspace" />

      <ChatPanel messages={messages} status={chatStatus} onSend={onSendMessage} />

      <div className="interviewer-workspace-panel">
        <WorkspacePanel
          ready={session.workspace.ready}
          available
          revision={workspaceRevision}
          onReload={onReloadWorkspace}
        />
      </div>
    </main>
  );
}
