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
import { BrandMark } from "./components/BrandMark.jsx";
import { FloatingZoomWindow } from "./components/FloatingZoomWindow.jsx";
import { CandidateRoom, InterviewerRoom } from "./components/RoomLayouts.jsx";
import { Topbar } from "./components/Topbar.jsx";
import { ZoomInviteBanner } from "./components/ZoomInviteBanner.jsx";
import { Spinner } from "@/components/ui/spinner";
import { startNativeZoomSession } from "./nativeZoomSession.js";

function canJoinZoom(session) {
  if (!session?.zoom?.enabled) {
    return false;
  }
  return session.role !== "candidate" || session.room.candidateAdmitted;
}

function zoomNoticeFor(session, joined) {
  if (!session?.zoom?.enabled) {
    return "Zoom is not configured. Add ZOOM_VIDEO_SDK_KEY and ZOOM_VIDEO_SDK_SECRET to enable video.";
  }

  if (joined) {
    return "Zoom is open in the floating window.";
  }

  if (session.role === "candidate" && !session.room.candidateAdmitted) {
    return "Waiting for interviewer approval.";
  }

  if (session.room.zoomInviteAt && session.room.zoomInviteByRole !== session.role) {
    return `Zoom invite from ${session.room.zoomInviteBy || "the other participant"}.`;
  }
  return "Join Zoom when ready, then invite the other participant.";
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  const [zoomMounted, setZoomMounted] = useState(false);
  const [zoomError, setZoomError] = useState("");
  const zoomContainerRef = useRef(null);
  const zoomControllerRef = useRef(null);
  const zoomCleanupTimerRef = useRef(null);
  const zoomDestroyedRef = useRef(false);
  const zoomSessionEndingRef = useRef(false);

  const clearZoomCleanupTimer = useCallback(() => {
    if (zoomCleanupTimerRef.current) {
      window.clearTimeout(zoomCleanupTimerRef.current);
      zoomCleanupTimerRef.current = null;
    }
  }, []);

  const destroyZoomController = useCallback((controller = zoomControllerRef.current) => {
    if (!controller || zoomDestroyedRef.current) {
      return;
    }

    try {
      if (typeof controller.destroy === "function") {
        controller.destroy();
      }
    } catch (error) {
      console.error(error);
    } finally {
      zoomDestroyedRef.current = true;
    }
  }, []);

  const finishZoomCleanup = useCallback(() => {
    clearZoomCleanupTimer();
    const controller = zoomControllerRef.current;
    const container = zoomContainerRef.current;

    destroyZoomController(controller);
    zoomControllerRef.current = null;
    zoomSessionEndingRef.current = false;

    setZoomJoined(false);
    setZoomLoading(false);
    setZoomVisible(false);

    requestAnimationFrame(() => {
      if (container && zoomContainerRef.current === container) {
        container.replaceChildren();
      }
      setZoomMounted(false);
    });
  }, [clearZoomCleanupTimer, destroyZoomController]);

  const scheduleZoomCleanup = useCallback(
    (delay = 1600) => {
      zoomSessionEndingRef.current = true;
      setZoomJoined(false);
      setZoomLoading(false);
      setZoomVisible(false);
      clearZoomCleanupTimer();
      zoomCleanupTimerRef.current = window.setTimeout(finishZoomCleanup, delay);
    },
    [clearZoomCleanupTimer, finishZoomCleanup],
  );

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

  useEffect(
    () => () => {
      clearZoomCleanupTimer();
      destroyZoomController();
    },
    [clearZoomCleanupTimer, destroyZoomController],
  );

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
    if (zoomJoined && !zoomSessionEndingRef.current) {
      setZoomVisible(true);
      return;
    }
    if (zoomSessionEndingRef.current) {
      setZoomLoading(true);
      await wait(1700);
      if (zoomSessionEndingRef.current) {
        finishZoomCleanup();
        await waitForPaint();
      }
    }

    setZoomLoading(true);
    setZoomError("");
    setZoomMounted(true);
    setZoomVisible(true);
    await waitForPaint();

    try {
      const container = zoomContainerRef.current;

      if (!container) {
        throw new Error("Zoom container did not mount");
      }

      const zoom = await getZoomSession();
      clearZoomCleanupTimer();
      zoomDestroyedRef.current = false;
      zoomSessionEndingRef.current = false;
      container.replaceChildren();

      const controller = await startNativeZoomSession(container, zoom, {
        onJoined: () => {
          setZoomJoined(true);
          setZoomLoading(false);
          setZoomVisible(true);
        },
        onClosed: () => {
          scheduleZoomCleanup(0);
        },
        onError: (error) => {
          const detail = error?.message || error?.reason;
          if (detail) {
            setZoomError(`Zoom error: ${detail}`);
          }
        },
      });

      zoomControllerRef.current = controller;
      setZoomJoined(true);
    } catch (error) {
      console.error(error);
      setZoomError(`Could not start Zoom: ${error.message}`);
      finishZoomCleanup();
    } finally {
      setZoomLoading(false);
    }
  }

  async function handleLeaveZoom() {
    const controller = zoomControllerRef.current;
    const container = zoomContainerRef.current;

    zoomSessionEndingRef.current = true;
    setZoomJoined(false);
    setZoomLoading(false);
    setZoomVisible(false);

    if (!controller || !container) {
      finishZoomCleanup();
      return;
    }

    try {
      if (controller && typeof controller.closeSession === "function") {
        await controller.closeSession(container);
        scheduleZoomCleanup();
        return;
      }
    } catch (error) {
      console.error(error);
    }

    finishZoomCleanup();
  }

  const zoomProps = useMemo(() => {
    const joinable = canJoinZoom(session);
    return {
      joined: zoomJoined,
      loading: zoomLoading,
      notice: zoomError || zoomNoticeFor(session, zoomJoined),
      canJoin: joinable,
      canInvite: Boolean(session?.zoom?.enabled && zoomJoined),
      onJoin: handleJoinZoom,
      onInvite: handleInviteZoom,
    };
  }, [session, zoomError, zoomJoined, zoomLoading]);

  if (!session) {
    return (
      <div className="flex min-h-full items-center justify-center gap-3 bg-muted text-muted-foreground">
        <BrandMark className="size-10" />
        <Spinner />
        <span>Loading room...</span>
      </div>
    );
  }

  const showInvite =
    session.zoom.enabled &&
    Boolean(session.room.zoomInviteAt) &&
    session.room.zoomInviteByRole !== session.role &&
    canJoinZoom(session) &&
    !zoomJoined;
  const candidateWaiting = session.role === "candidate" && !session.room.candidateAdmitted;

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
        mounted={zoomMounted}
        containerRef={zoomContainerRef}
        onClose={() => setZoomVisible(false)}
        onLeave={handleLeaveZoom}
      />
      <ZoomInviteBanner show={showInvite} invitedBy={session.room.zoomInviteBy} onJoin={handleJoinZoom} />
    </div>
  );
}
