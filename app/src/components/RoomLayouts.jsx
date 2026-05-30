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
    <main className="grid min-h-0 min-w-0 grid-cols-[minmax(30rem,1fr)_minmax(18rem,22rem)] gap-3 overflow-hidden p-3 max-[900px]:grid-cols-1 max-[900px]:overflow-visible">
      <section className="min-h-0 min-w-0 max-[900px]:min-h-[70vh]">
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
    <main className="grid min-h-0 min-w-0 grid-cols-[minmax(17rem,20rem)_minmax(28rem,1fr)_minmax(18rem,22rem)] gap-3 overflow-hidden p-3 max-[1180px]:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)] max-[1180px]:grid-rows-[minmax(0,1fr)_minmax(18rem,32vh)] max-[900px]:grid-cols-1 max-[900px]:grid-rows-none max-[900px]:overflow-visible">
      <aside className="flex min-h-0 min-w-0 flex-col gap-3 overflow-auto max-[1180px]:row-span-2 max-[900px]:row-auto">
        <CandidatePanel session={session} onAdmit={onAdmit} admitting={admitting} />
        <ZoomPanel session={session} {...zoomProps} />
      </aside>
      <section className="min-h-0 min-w-0 max-[900px]:min-h-[70vh]">
        <WorkspacePanel
          ready={session.workspace.ready}
          available
          revision={workspaceRevision}
          onReload={onReloadWorkspace}
        />
      </section>
      <aside className="min-h-0 min-w-0 max-[1180px]:min-h-72">
        <ChatPanel messages={messages} status={chatStatus} onSend={onSendMessage} />
      </aside>
    </main>
  );
}
