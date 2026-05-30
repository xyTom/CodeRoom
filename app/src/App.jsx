import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  admitCandidate,
  getMessages,
  getSession,
  getZoomSession,
  inviteZoom,
  sendMessage,
  subscribeRoomEvents,
} from "./api.js";
import { CandidateLobby } from "./components/CandidateLobby.jsx";
import { FloatingZoomWindow } from "./components/FloatingZoomWindow.jsx";
import { CandidateRoom, InterviewerRoom } from "./components/RoomLayouts.jsx";
import { Topbar } from "./components/Topbar.jsx";
import { ZoomInviteBanner } from "./components/ZoomInviteBanner.jsx";
import { Spinner } from "@/components/ui/spinner";
import { loadZoomToolkit } from "./zoomToolkit.js";

function canJoinZoom(session) {
  if (!session?.zoom?.enabled) {
    return false;
  }
  if (session.role === "candidate") {
    return session.room.candidateAdmitted && Boolean(session.room.zoomInviteAt);
  }
  return true;
}

function zoomNoticeFor(session, joined) {
  if (!session?.zoom?.enabled) {
    return "Zoom is not configured. Add ZOOM_VIDEO_SDK_KEY and ZOOM_VIDEO_SDK_SECRET to enable video.";
  }

  if (session.role === "candidate") {
    if (joined) {
      return "Zoom is open in a floating window.";
    }
    if (session.room.zoomInviteAt) {
      return "The interviewer invited you to join Zoom.";
    }
    return "Zoom will be available after the interviewer invites you.";
  }

  if (joined && session.room.zoomInviteAt) {
    return "Zoom is open. Candidate invitation sent.";
  }
  if (joined) {
    return "Zoom is open. Invite the candidate when ready.";
  }
  return "Join Zoom first, then invite the candidate.";
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export function App() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatStatus, setChatStatus] = useState("connecting");
  const [workspaceRevision, setWorkspaceRevision] = useState(Date.now());
  const [admitting, setAdmitting] = useState(false);
  const [zoomJoined, setZoomJoined] = useState(false);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomError, setZoomError] = useState("");
  const zoomContainerRef = useRef(null);

  const refreshSession = useCallback(async () => {
    try {
      const nextSession = await getSession();
      setSession(nextSession);
    } catch (error) {
      console.error(error);
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    refreshSession();
    const timer = window.setInterval(refreshSession, 2000);
    return () => window.clearInterval(timer);
  }, [refreshSession]);

  useEffect(() => {
    getMessages()
      .then((data) => setMessages(data.messages || []))
      .catch((error) => console.error(error));

    return subscribeRoomEvents({
      onOpen: () => setChatStatus("live"),
      onError: () => setChatStatus("reconnecting"),
      onMessage: (message) => setMessages((current) => [...current, message]),
      onRoom: refreshSession,
    });
  }, [refreshSession]);

  useEffect(() => {
    document.body.classList.toggle("zoom-enabled", Boolean(session?.zoom?.enabled));
    return () => document.body.classList.remove("zoom-enabled");
  }, [session?.zoom?.enabled]);

  async function handleSendMessage(text) {
    try {
      await sendMessage(text);
    } catch (error) {
      console.error(error);
      setChatStatus("send failed");
    }
  }

  async function handleAdmitCandidate() {
    setAdmitting(true);
    try {
      await admitCandidate();
      await refreshSession();
    } finally {
      setAdmitting(false);
    }
  }

  async function handleInviteZoom() {
    try {
      await inviteZoom();
      await refreshSession();
    } catch (error) {
      console.error(error);
      setZoomError(`Could not send Zoom invite: ${error.message}`);
    }
  }

  async function handleJoinZoom() {
    let currentSession = session;
    if (!currentSession) {
      currentSession = await getSession();
      setSession(currentSession);
    }
    if (!canJoinZoom(currentSession)) {
      return;
    }
    if (zoomJoined) {
      setZoomVisible(true);
      return;
    }

    setZoomLoading(true);
    setZoomError("");
    setZoomVisible(true);
    await waitForPaint();

    try {
      const zoom = await getZoomSession();
      const uitoolkit = await loadZoomToolkit(zoom.uiToolkitVersion);
      const container = zoomContainerRef.current;

      if (!uitoolkit || !container) {
        throw new Error("Zoom UI Toolkit did not load");
      }

      container.textContent = "";
      uitoolkit.joinSession(container, {
        videoSDKJWT: zoom.videoSDKJWT,
        sessionName: zoom.sessionName,
        userName: zoom.userName,
        sessionPasscode: zoom.sessionPasscode,
        featuresOptions: {
          video: { enable: true },
          audio: { enable: true },
          share: { enable: true },
          chat: { enable: true },
          users: { enable: true },
          settings: { enable: true },
        },
      });

      setZoomJoined(true);

      const closeSession = () => {
        setZoomJoined(false);
        setZoomVisible(false);
      };

      if (typeof uitoolkit.onSessionClosed === "function") {
        uitoolkit.onSessionClosed(closeSession);
      }
      if (typeof uitoolkit.onSessionDestroyed === "function") {
        uitoolkit.onSessionDestroyed(() => {
          if (typeof uitoolkit.destroy === "function") {
            uitoolkit.destroy();
          }
        });
      }
    } catch (error) {
      console.error(error);
      setZoomVisible(false);
      setZoomError(`Could not start Zoom: ${error.message}`);
    } finally {
      setZoomLoading(false);
    }
  }

  const zoomProps = useMemo(() => {
    const joinable = canJoinZoom(session);
    return {
      joined: zoomJoined,
      loading: zoomLoading,
      notice: zoomError || zoomNoticeFor(session, zoomJoined),
      canJoin: joinable,
      canInvite: Boolean(session?.role === "interviewer" && zoomJoined && session.room.candidateAdmitted),
      onJoin: handleJoinZoom,
      onInvite: handleInviteZoom,
    };
  }, [session, zoomError, zoomJoined, zoomLoading]);

  if (!session) {
    return (
      <div className="flex min-h-full items-center justify-center gap-3 bg-muted text-muted-foreground">
        <div className="grid size-10 place-items-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground">
          CR
        </div>
        <Spinner />
        <span>Loading room...</span>
      </div>
    );
  }

  const candidateWaiting = session.role === "candidate" && !session.room.candidateAdmitted;
  const showInvite =
    session.zoom.enabled &&
    session.role === "candidate" &&
    Boolean(session.room.zoomInviteAt) &&
    !zoomJoined;

  return (
    <div className="h-full min-h-0 bg-muted">
      <div className="grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <Topbar session={session} />
        {candidateWaiting ? (
          <CandidateLobby session={session} />
        ) : session.role === "candidate" ? (
          <CandidateRoom
            session={session}
            messages={messages}
            chatStatus={chatStatus}
            workspaceRevision={workspaceRevision}
            onReloadWorkspace={() => setWorkspaceRevision(Date.now())}
            onSendMessage={handleSendMessage}
            zoomProps={zoomProps}
          />
        ) : (
          <InterviewerRoom
            session={session}
            messages={messages}
            chatStatus={chatStatus}
            admitting={admitting}
            workspaceRevision={workspaceRevision}
            onAdmit={handleAdmitCandidate}
            onReloadWorkspace={() => setWorkspaceRevision(Date.now())}
            onSendMessage={handleSendMessage}
            zoomProps={zoomProps}
          />
        )}
      </div>
      <FloatingZoomWindow
        visible={zoomVisible}
        loading={zoomLoading}
        joined={zoomJoined}
        containerRef={zoomContainerRef}
        onClose={() => setZoomVisible(false)}
      />
      <ZoomInviteBanner show={showInvite} invitedBy={session.room.zoomInviteBy} onJoin={handleJoinZoom} />
    </div>
  );
}
