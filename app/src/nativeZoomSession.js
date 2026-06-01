const SDK_CDN_PREFIX = "https://source.zoom.us/videosdk";
let sdkPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(script);
  });
}

function videoSdkVersion(zoom) {
  return String(zoom.videoSdkVersion || zoom.uiToolkitVersion || "2.4.0").replace(/-.*/, "");
}

async function loadZoomVideoSdk(version) {
  if (!sdkPromise) {
    const sources = [
      `${SDK_CDN_PREFIX}/zoom-video-${version}.min.js`,
      `${SDK_CDN_PREFIX}/${version}/zoom-video-${version}.min.js`,
    ];

    sdkPromise = sources
      .reduce(
        (promise, src) => promise.catch(() => loadScript(src)),
        Promise.reject(new Error("Trying Zoom Video SDK CDN sources")),
      )
      .catch((error) => {
        sdkPromise = null;
        throw error;
      });
  }

  await sdkPromise;
  const ZoomVideo = window.WebVideoSDK?.default;
  if (!ZoomVideo) {
    throw new Error("Zoom Video SDK did not load");
  }
  return ZoomVideo;
}

function appendButton(parent, className, text, title) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.title = title || text;
  parent.appendChild(button);
  return button;
}

function removeElementOrElements(value) {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((element) => element?.remove?.());
    return;
  }
  value.remove?.();
}

function createNativeZoomUi(container, zoom) {
  container.replaceChildren();

  const root = document.createElement("div");
  root.className = "zoom-native-root";

  const stage = document.createElement("div");
  stage.className = "zoom-native-stage";

  const empty = document.createElement("div");
  empty.className = "zoom-native-empty";
  empty.textContent = "Zoom connected";

  const shareStage = document.createElement("div");
  shareStage.className = "zoom-native-share-stage";
  shareStage.hidden = true;

  const shareVideo = document.createElement("video");
  shareVideo.className = "zoom-native-share-media";
  shareVideo.muted = true;
  shareVideo.autoplay = true;
  shareVideo.playsInline = true;

  const shareCanvas = document.createElement("canvas");
  shareCanvas.className = "zoom-native-share-media";

  const remoteShareContainer = document.createElement("video-player-container");
  remoteShareContainer.className = "zoom-native-remote-share";
  remoteShareContainer.hidden = true;

  const videoContainer = document.createElement("video-player-container");
  videoContainer.className = "zoom-native-video-grid";
  videoContainer.hidden = true;

  shareStage.append(shareVideo, shareCanvas, remoteShareContainer);
  stage.append(empty, shareStage, videoContainer);

  const footer = document.createElement("div");
  footer.className = "zoom-native-controls";

  const status = document.createElement("div");
  status.className = "zoom-native-status";
  status.textContent = zoom.sessionName || "Zoom session";

  const controls = document.createElement("div");
  controls.className = "zoom-native-button-row";

  const audioButton = appendButton(controls, "zoom-native-button", "Join audio", "Join audio");
  const videoButton = appendButton(controls, "zoom-native-button", "Start video", "Start video");
  const shareButton = appendButton(controls, "zoom-native-button", "Share", "Share screen");
  const leaveButton = appendButton(controls, "zoom-native-button zoom-native-button-danger", "Leave", "Leave Zoom");

  footer.append(status, controls);
  root.append(stage, footer);
  container.appendChild(root);

  return {
    root,
    stage,
    empty,
    shareStage,
    shareVideo,
    shareCanvas,
    remoteShareContainer,
    videoContainer,
    status,
    audioButton,
    videoButton,
    shareButton,
    leaveButton,
  };
}

function setStageMode(ui, mode) {
  ui.root.dataset.mode = mode;
  ui.empty.hidden = mode !== "empty";
  ui.shareStage.hidden = mode !== "share";
  ui.videoContainer.hidden = mode === "share";
}

function fitShareTargets(ui) {
  if (ui.shareStage.hidden) {
    return;
  }
  const rect = ui.shareStage.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  ui.shareVideo.width = width;
  ui.shareVideo.height = height;
  ui.shareCanvas.width = Math.max(1, Math.round(width * pixelRatio));
  ui.shareCanvas.height = Math.max(1, Math.round(height * pixelRatio));

  for (const element of ui.remoteShareContainer.querySelectorAll("video-player, video-player-container, canvas, video")) {
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.maxWidth = "100%";
    element.style.maxHeight = "100%";
    element.style.objectFit = "contain";
  }
}

function applyVideoElementStyle(element) {
  element.classList.add("zoom-native-video-tile");
  element.style.width = "100%";
  element.style.height = "100%";
  element.style.maxWidth = "100%";
  element.style.maxHeight = "100%";
}

export async function startNativeZoomSession(container, zoom, callbacks = {}) {
  const ZoomVideo = await loadZoomVideoSdk(videoSdkVersion(zoom));
  const client = ZoomVideo.createClient();
  const ui = createNativeZoomUi(container, zoom);
  const state = {
    disposed: false,
    audioJoined: false,
    videoStarted: false,
    sharing: false,
    activeShareUserId: null,
    videoElements: new Map(),
    listeners: [],
  };

  await client.init("en-US", "Global", {
    patchJsMedia: true,
    stayAwake: true,
    leaveOnPageUnload: true,
  });
  await client.join(zoom.sessionName, zoom.videoSDKJWT, zoom.userName, zoom.sessionPasscode || "");

  const stream = client.getMediaStream();

  function updateParticipants() {
    const users = client.getAllUser?.() || [];
    ui.status.textContent = `${zoom.sessionName || "Zoom session"} · ${users.length || 1} participant${users.length === 1 ? "" : "s"}`;
    ui.empty.textContent = users.length > 1 ? "No screen share active" : "Waiting for the other participant";
    if (!state.activeShareUserId && state.videoElements.size === 0) {
      setStageMode(ui, "empty");
    }
  }

  async function attachVideo(userId) {
    if (state.disposed || state.videoElements.has(userId)) {
      return;
    }
    try {
      const element = await stream.attachVideo(userId, 3);
      applyVideoElementStyle(element);
      ui.videoContainer.appendChild(element);
      state.videoElements.set(userId, element);
      if (!state.activeShareUserId) {
        setStageMode(ui, "video");
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function detachVideo(userId) {
    try {
      await stream.detachVideo(userId);
    } catch (error) {
      console.error(error);
    }
    state.videoElements.get(userId)?.remove?.();
    state.videoElements.delete(userId);
    if (!state.activeShareUserId && state.videoElements.size === 0) {
      setStageMode(ui, "empty");
    }
  }

  async function attachRemoteShare(userId) {
    if (state.disposed || state.activeShareUserId === userId) {
      return;
    }
    if (state.activeShareUserId) {
      await detachRemoteShare(state.activeShareUserId);
    }
    try {
      ui.remoteShareContainer.replaceChildren();
      ui.remoteShareContainer.hidden = false;
      ui.shareVideo.hidden = true;
      ui.shareCanvas.hidden = true;
      const element = await stream.attachShareView(userId);
      applyVideoElementStyle(element);
      ui.remoteShareContainer.appendChild(element);
      state.activeShareUserId = userId;
      setStageMode(ui, "share");
      requestAnimationFrame(() => fitShareTargets(ui));
    } catch (error) {
      console.error(error);
    }
  }

  async function detachRemoteShare(userId) {
    if (!userId) {
      return;
    }
    try {
      removeElementOrElements(await stream.detachShareView(userId));
    } catch (error) {
      console.error(error);
    }
    if (state.activeShareUserId === userId) {
      state.activeShareUserId = null;
    }
    ui.remoteShareContainer.replaceChildren();
    ui.remoteShareContainer.hidden = true;
    if (!state.sharing) {
      setStageMode(ui, state.videoElements.size ? "video" : "empty");
    }
  }

  async function toggleAudio() {
    try {
      const currentUser = client.getCurrentUserInfo();
      if (!state.audioJoined || currentUser.muted === undefined) {
        await stream.startAudio();
        state.audioJoined = true;
      } else if (currentUser.muted) {
        await stream.unmuteAudio();
      } else {
        await stream.muteAudio();
      }
      ui.audioButton.textContent = client.getCurrentUserInfo().muted ? "Unmute" : "Mute";
    } catch (error) {
      console.error(error);
      callbacks.onError?.(error);
    }
  }

  async function toggleVideo() {
    const userId = client.getCurrentUserInfo().userId;
    try {
      if (state.videoStarted) {
        await stream.stopVideo();
        await detachVideo(userId);
        state.videoStarted = false;
        ui.videoButton.textContent = "Start video";
      } else {
        await stream.startVideo();
        state.videoStarted = true;
        ui.videoButton.textContent = "Stop video";
        await attachVideo(userId);
      }
    } catch (error) {
      console.error(error);
      callbacks.onError?.(error);
    }
  }

  async function toggleShare() {
    try {
      if (state.sharing) {
        await stream.stopShareScreen();
        state.sharing = false;
        ui.shareButton.textContent = "Share";
        ui.shareVideo.hidden = true;
        ui.shareCanvas.hidden = true;
        setStageMode(ui, state.activeShareUserId ? "share" : state.videoElements.size ? "video" : "empty");
        return;
      }

      if (state.activeShareUserId) {
        await detachRemoteShare(state.activeShareUserId);
      }
      ui.remoteShareContainer.replaceChildren();
      ui.remoteShareContainer.hidden = true;
      setStageMode(ui, "share");
      fitShareTargets(ui);
      const canShareToVideo =
        typeof stream.isStartShareScreenWithVideoElement === "function" &&
        stream.isStartShareScreenWithVideoElement();

      if (canShareToVideo) {
        ui.shareVideo.hidden = false;
        ui.shareCanvas.hidden = true;
        await stream.startShareScreen(ui.shareVideo);
      } else {
        ui.shareVideo.hidden = true;
        ui.shareCanvas.hidden = false;
        await stream.startShareScreen(ui.shareCanvas);
      }
      state.sharing = true;
      ui.shareButton.textContent = "Stop share";
      requestAnimationFrame(() => fitShareTargets(ui));
    } catch (error) {
      state.sharing = false;
      ui.shareButton.textContent = "Share";
      console.error(error);
      callbacks.onError?.(error);
    }
  }

  async function leave() {
    if (state.disposed) {
      return;
    }
    state.disposed = true;
    resizeObserver.disconnect();
    for (const [eventName, listener] of state.listeners) {
      try {
        client.off?.(eventName, listener);
      } catch (error) {
        console.error(error);
      }
    }
    ui.audioButton.removeEventListener("click", toggleAudio);
    ui.videoButton.removeEventListener("click", toggleVideo);
    ui.shareButton.removeEventListener("click", toggleShare);
    ui.leaveButton.removeEventListener("click", leave);

    try {
      if (state.sharing) {
        await stream.stopShareScreen();
      }
    } catch (error) {
      console.error(error);
    }
    try {
      await client.leave();
    } catch (error) {
      console.error(error);
    }
    try {
      ZoomVideo.destroyClient?.();
    } catch (error) {
      console.error(error);
    }
    container.replaceChildren();
    callbacks.onClosed?.();
  }

  function addListener(eventName, listener) {
    client.on(eventName, listener);
    state.listeners.push([eventName, listener]);
  }

  addListener("user-added", () => updateParticipants());
  addListener("user-removed", () => updateParticipants());
  addListener("user-updated", () => updateParticipants());
  addListener("peer-video-state-change", (payload) => {
    if (payload.action === "Start") {
      attachVideo(payload.userId);
    } else {
      detachVideo(payload.userId);
    }
  });
  addListener("active-share-change", (payload) => {
    const currentUserId = client.getCurrentUserInfo().userId;
    if (payload.state === "Active" && payload.userId !== currentUserId) {
      attachRemoteShare(payload.userId);
    } else if (payload.state === "Inactive") {
      detachRemoteShare(payload.userId);
    }
  });
  addListener("passively-stop-share", () => {
    state.sharing = false;
    ui.shareButton.textContent = "Share";
    ui.shareVideo.hidden = true;
    ui.shareCanvas.hidden = true;
    setStageMode(ui, state.activeShareUserId ? "share" : state.videoElements.size ? "video" : "empty");
  });
  addListener("connection-change", (payload) => {
    if (["Closed", "Fail", "Ended"].includes(payload.state)) {
      leave();
    }
  });

  const resizeObserver = new ResizeObserver(() => fitShareTargets(ui));
  resizeObserver.observe(ui.shareStage);
  ui.audioButton.addEventListener("click", toggleAudio);
  ui.videoButton.addEventListener("click", toggleVideo);
  ui.shareButton.addEventListener("click", toggleShare);
  ui.leaveButton.addEventListener("click", leave);

  setStageMode(ui, "empty");
  updateParticipants();
  for (const user of client.getAllUser?.() || []) {
    if (user.bVideoOn) {
      attachVideo(user.userId);
    }
    if (user.sharerOn && user.userId !== client.getCurrentUserInfo().userId) {
      attachRemoteShare(user.userId);
    }
  }

  callbacks.onJoined?.();

  return {
    closeSession: leave,
    destroy: leave,
  };
}
