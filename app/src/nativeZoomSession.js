const SDK_CDN_PREFIX = "https://source.zoom.us/videosdk";
const VIDEO_QUALITY_720P = 3;

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

function safeCall(fn) {
  try {
    return fn?.();
  } catch (error) {
    console.error(error);
    return undefined;
  }
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
  shareVideo.hidden = true;

  const shareCanvas = document.createElement("canvas");
  shareCanvas.className = "zoom-native-share-media";
  shareCanvas.hidden = true;

  const remoteShareContainer = document.createElement("video-player-container");
  remoteShareContainer.className = "zoom-native-remote-share";
  remoteShareContainer.hidden = true;

  const remoteShareViewport = document.createElement("div");
  remoteShareViewport.className = "zoom-native-share-viewport";

  const remoteSharePlayer = document.createElement("video-player");
  remoteSharePlayer.className = "zoom-native-share-player";
  remoteShareViewport.appendChild(remoteSharePlayer);
  remoteShareContainer.appendChild(remoteShareViewport);

  const shareHint = document.createElement("div");
  shareHint.className = "zoom-native-share-hint";
  shareHint.hidden = true;

  const videoContainer = document.createElement("video-player-container");
  videoContainer.className = "zoom-native-video-grid";
  videoContainer.hidden = true;

  shareStage.append(shareVideo, shareCanvas, remoteShareContainer, shareHint);
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
  const pauseShareButton = appendButton(controls, "zoom-native-button", "Pause", "Pause screen share");
  const optimizeShareButton = appendButton(controls, "zoom-native-button", "Optimize video", "Optimize shared video");
  const leaveButton = appendButton(controls, "zoom-native-button zoom-native-button-danger", "Leave", "Leave Zoom");

  pauseShareButton.hidden = true;
  optimizeShareButton.hidden = true;
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
    remoteShareViewport,
    remoteSharePlayer,
    shareHint,
    videoContainer,
    status,
    audioButton,
    videoButton,
    shareButton,
    pauseShareButton,
    optimizeShareButton,
    leaveButton,
  };
}

function createVideoTile(userId, displayName) {
  const tile = document.createElement("div");
  tile.className = "zoom-native-video-tile";

  const player = document.createElement("video-player");
  player.className = "zoom-native-video-player";

  const name = document.createElement("span");
  name.className = "zoom-native-video-name";
  name.textContent = displayName || `User ${userId}`;

  tile.append(player, name);
  return { tile, player, name };
}

function setStageMode(ui, mode) {
  ui.root.dataset.mode = mode;
  ui.empty.hidden = mode !== "empty";
  ui.shareStage.hidden = mode !== "share";
  ui.videoContainer.hidden = mode !== "video";
}

function getCurrentUserId(client) {
  return client.getSessionInfo?.()?.userId || client.getCurrentUserInfo?.()?.userId;
}

function getUsers(client) {
  return client.getAllUser?.() || [];
}

function getUser(client, userId) {
  return getUsers(client).find((user) => user.userId === userId);
}

function userName(client, userId) {
  return getUser(client, userId)?.displayName || getUser(client, userId)?.userName || `User ${userId}`;
}

function fitInside(containerWidth, containerHeight, contentWidth, contentHeight) {
  if (contentWidth > 0 && contentHeight > 0) {
    const ratio = Math.min(containerWidth / contentWidth, containerHeight / contentHeight);
    return {
      width: Math.max(1, Math.floor(contentWidth * ratio)),
      height: Math.max(1, Math.floor(contentHeight * ratio)),
    };
  }
  return {
    width: Math.max(1, Math.floor(containerWidth)),
    height: Math.max(1, Math.floor(containerHeight)),
  };
}

function setElementSize(element, width, height) {
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.style.maxWidth = "100%";
  element.style.maxHeight = "100%";
}

function applyFillStyle(element) {
  element.style.width = "100%";
  element.style.height = "100%";
  element.style.maxWidth = "100%";
  element.style.maxHeight = "100%";
  element.style.objectFit = "contain";
}

function fitShareTargets(ui, stream, state) {
  if (ui.shareStage.hidden) {
    return;
  }

  const rect = ui.shareStage.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const stageWidth = Math.max(1, Math.round(rect.width));
  const stageHeight = Math.max(1, Math.round(rect.height));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const viewportSize = fitInside(
    stageWidth,
    stageHeight,
    state.sharedContentDimension.width,
    state.sharedContentDimension.height,
  );

  ui.shareVideo.width = stageWidth;
  ui.shareVideo.height = stageHeight;
  ui.shareCanvas.width = Math.max(1, Math.round(stageWidth * pixelRatio));
  ui.shareCanvas.height = Math.max(1, Math.round(stageHeight * pixelRatio));
  setElementSize(ui.remoteShareViewport, viewportSize.width, viewportSize.height);
  applyFillStyle(ui.remoteSharePlayer);

  if (state.activeShareUserId && typeof stream.updateSharingCanvasDimension === "function") {
    try {
      stream.updateSharingCanvasDimension(
        Math.max(1, Math.round(viewportSize.width * pixelRatio)),
        Math.max(1, Math.round(viewportSize.height * pixelRatio)),
      );
    } catch (error) {
      console.error(error);
    }
  }
}

function attachWithFallback(primary, fallback) {
  return Promise.resolve()
    .then(primary)
    .catch((error) =>
      Promise.resolve()
        .then(fallback)
        .catch(() => {
          throw error;
        }),
    );
}

function payloadMessage(payload, fallback) {
  if (payload?.message) {
    return payload.message;
  }
  if (payload?.reason) {
    return payload.reason;
  }
  if (payload?.type || payload?.code) {
    return [payload.type, payload.code].filter(Boolean).join(" ");
  }
  return fallback;
}

function createError(message) {
  try {
    return new Error(message);
  } catch {
    return { message };
  }
}

function videoStartOptions(stream) {
  const options = {
    hd: true,
    fullHd: true,
    originalRatio: true,
  };
  if (typeof stream.isBrowserSupportPTZ === "function") {
    options.ptz = Boolean(safeCall(() => stream.isBrowserSupportPTZ()));
  }
  return options;
}

function audioStartOptions() {
  return { highBitrate: true };
}

function setActiveTile(state, userId) {
  state.activeVideoUserId = userId || null;
  for (const [tileUserId, item] of state.videoTiles) {
    item.tile.classList.toggle("zoom-native-video-tile-active", Boolean(userId && tileUserId === userId));
  }
}

function reportZoomStatus(ui, callbacks, message) {
  ui.status.textContent = message;
  callbacks.onError?.(createError(message));
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
    sharePaused: false,
    optimizedShare: false,
    activeShareUserId: null,
    activeVideoUserId: null,
    sharedContentDimension: { width: 0, height: 0 },
    remoteShareUsesProvidedPlayer: true,
    videoTiles: new Map(),
    listeners: [],
  };

  await client.init("en-US", "Global", {
    patchJsMedia: true,
    stayAwake: true,
    leaveOnPageUnload: true,
  });
  await client.join(zoom.sessionName, zoom.videoSDKJWT, zoom.userName, zoom.sessionPasscode || "");

  const stream = client.getMediaStream();

  function updateShareButtons() {
    ui.shareButton.textContent = state.sharing ? "Stop share" : "Share";
    ui.pauseShareButton.hidden = !state.sharing;
    ui.pauseShareButton.textContent = state.sharePaused ? "Resume" : "Pause";
    ui.optimizeShareButton.hidden =
      !state.sharing ||
      typeof stream.isSupportOptimizedForSharedVideo !== "function" ||
      !stream.isSupportOptimizedForSharedVideo();
    ui.optimizeShareButton.textContent = state.optimizedShare ? "Video optimized" : "Optimize video";
  }

  function updateAudioButton() {
    const currentUser = client.getCurrentUserInfo?.() || {};
    ui.audioButton.textContent = state.audioJoined && !currentUser.muted ? "Mute" : state.audioJoined ? "Unmute" : "Join audio";
  }

  function updateParticipants() {
    const users = getUsers(client);
    ui.status.textContent = `${zoom.sessionName || "Zoom session"} · ${users.length || 1} participant${users.length === 1 ? "" : "s"}`;
    ui.empty.textContent = users.length > 1 ? "No screen share active" : "Waiting for the other participant";

    for (const [userId, item] of state.videoTiles) {
      item.name.textContent = userName(client, userId);
    }

    if (!state.activeShareUserId && !state.sharing && state.videoTiles.size === 0) {
      setStageMode(ui, "empty");
    }
  }

  async function attachVideo(userId) {
    if (state.disposed || state.videoTiles.has(userId)) {
      return;
    }

    const item = createVideoTile(userId, userName(client, userId));
    ui.videoContainer.appendChild(item.tile);
    state.videoTiles.set(userId, item);

    try {
      const result = await attachWithFallback(
        () => stream.attachVideo(userId, VIDEO_QUALITY_720P, item.player),
        () => stream.attachVideo(userId, VIDEO_QUALITY_720P),
      );
      if (result instanceof HTMLElement && result !== item.player) {
        applyFillStyle(result);
        item.player.replaceWith(result);
        item.player = result;
      }
      if (!state.activeShareUserId && !state.sharing) {
        setStageMode(ui, "video");
      }
      if (state.activeVideoUserId === userId) {
        setActiveTile(state, userId);
      }
    } catch (error) {
      console.error(error);
      item.tile.remove();
      state.videoTiles.delete(userId);
    }
  }

  async function detachVideo(userId) {
    try {
      await stream.detachVideo(userId);
    } catch (error) {
      console.error(error);
    }
    state.videoTiles.get(userId)?.tile?.remove?.();
    state.videoTiles.delete(userId);
    if (!state.activeShareUserId && !state.sharing && state.videoTiles.size === 0) {
      setStageMode(ui, "empty");
    }
  }

  function resetRemoteSharePlayer() {
    if (!ui.remoteShareViewport.contains(ui.remoteSharePlayer)) {
      ui.remoteShareViewport.replaceChildren(ui.remoteSharePlayer);
    }
    state.remoteShareUsesProvidedPlayer = true;
  }

  async function attachRemoteShare(userId) {
    if (state.disposed || state.activeShareUserId === userId) {
      return;
    }
    if (state.activeShareUserId) {
      await detachRemoteShare(state.activeShareUserId);
    }

    try {
      resetRemoteSharePlayer();
      ui.remoteShareContainer.hidden = false;
      ui.shareVideo.hidden = true;
      ui.shareCanvas.hidden = true;
      ui.shareHint.hidden = false;
      ui.shareHint.textContent = `Viewing ${userName(client, userId)}'s screen`;
      setStageMode(ui, "share");

      const result = await attachWithFallback(
        () => stream.attachShareView(userId, ui.remoteSharePlayer),
        () => stream.attachShareView(userId),
      );
      if (result instanceof HTMLElement && result !== ui.remoteSharePlayer) {
        applyFillStyle(result);
        ui.remoteShareViewport.replaceChildren(result);
        state.remoteShareUsesProvidedPlayer = false;
      }

      state.activeShareUserId = userId;
      requestAnimationFrame(() => fitShareTargets(ui, stream, state));
    } catch (error) {
      console.error(error);
      state.activeShareUserId = null;
      ui.remoteShareContainer.hidden = true;
      ui.shareHint.hidden = true;
      if (!state.sharing) {
        setStageMode(ui, state.videoTiles.size ? "video" : "empty");
      }
    }
  }

  async function detachRemoteShare(userId) {
    if (!userId) {
      return;
    }
    try {
      if (state.remoteShareUsesProvidedPlayer) {
        await stream.detachShareView(userId, ui.remoteSharePlayer);
      } else {
        removeElementOrElements(await stream.detachShareView(userId));
      }
    } catch (error) {
      console.error(error);
    }
    if (state.activeShareUserId === userId) {
      state.activeShareUserId = null;
    }
    resetRemoteSharePlayer();
    state.sharedContentDimension = { width: 0, height: 0 };
    ui.remoteShareContainer.hidden = true;
    ui.shareHint.hidden = true;
    if (!state.sharing) {
      setStageMode(ui, state.videoTiles.size ? "video" : "empty");
    }
  }

  function reconcileRemoteShare() {
    if (state.sharing) {
      return;
    }
    const currentUserId = getCurrentUserId(client);
    const activeShareUserId = safeCall(() => stream.getActiveShareUserId());
    if (activeShareUserId && activeShareUserId !== currentUserId) {
      attachRemoteShare(activeShareUserId);
      return;
    }

    const shareUsers =
      safeCall(() => stream.getShareUserList()) ||
      getUsers(client).filter((user) => user.sharerOn || user.bShareOn || user.isSharing);
    const remoteShare = shareUsers.find((user) => user.userId && user.userId !== currentUserId);

    if (remoteShare) {
      attachRemoteShare(remoteShare.userId);
    } else if (state.activeShareUserId) {
      detachRemoteShare(state.activeShareUserId);
    }
  }

  async function toggleAudio() {
    try {
      const currentUser = client.getCurrentUserInfo?.() || {};
      if (!state.audioJoined || currentUser.muted === undefined) {
        await attachWithFallback(() => stream.startAudio(audioStartOptions()), () => stream.startAudio());
        state.audioJoined = true;
      } else if (currentUser.muted) {
        await stream.unmuteAudio();
      } else {
        await stream.muteAudio();
      }
      updateAudioButton();
    } catch (error) {
      console.error(error);
      callbacks.onError?.(error);
    }
  }

  async function toggleVideo() {
    const userId = getCurrentUserId(client);
    try {
      if (state.videoStarted) {
        await stream.stopVideo();
        await detachVideo(userId);
        state.videoStarted = false;
        ui.videoButton.textContent = "Start video";
      } else {
        await attachWithFallback(() => stream.startVideo(videoStartOptions(stream)), () => stream.startVideo());
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
        state.sharePaused = false;
        ui.shareVideo.hidden = true;
        ui.shareCanvas.hidden = true;
        ui.shareHint.hidden = true;
        updateShareButtons();
        reconcileRemoteShare();
        setStageMode(ui, state.activeShareUserId ? "share" : state.videoTiles.size ? "video" : "empty");
        return;
      }

      if (state.activeShareUserId) {
        await detachRemoteShare(state.activeShareUserId);
      }
      ui.remoteShareContainer.hidden = true;
      ui.shareHint.hidden = false;
      ui.shareHint.textContent = "You are sharing your screen";
      setStageMode(ui, "share");
      fitShareTargets(ui, stream, state);

      const canShareToVideo =
        typeof stream.isStartShareScreenWithVideoElement === "function" &&
        stream.isStartShareScreenWithVideoElement();
      const shareTarget = canShareToVideo ? ui.shareVideo : ui.shareCanvas;
      ui.shareVideo.hidden = !canShareToVideo;
      ui.shareCanvas.hidden = canShareToVideo;

      await attachWithFallback(
        () => stream.startShareScreen(shareTarget, { requestReadReceipt: true }),
        () => stream.startShareScreen(shareTarget),
      );
      state.sharing = true;
      state.sharePaused = false;
      state.optimizedShare = Boolean(safeCall(() => stream.isOptimizeForSharedVideoEnabled()));
      updateShareButtons();
      requestAnimationFrame(() => fitShareTargets(ui, stream, state));
    } catch (error) {
      state.sharing = false;
      state.sharePaused = false;
      updateShareButtons();
      console.error(error);
      callbacks.onError?.(error);
    }
  }

  async function toggleSharePause() {
    if (!state.sharing) {
      return;
    }
    try {
      if (state.sharePaused) {
        await stream.resumeShareScreen?.();
        state.sharePaused = false;
      } else {
        await stream.pauseShareScreen?.();
        state.sharePaused = true;
      }
      updateShareButtons();
    } catch (error) {
      console.error(error);
      callbacks.onError?.(error);
    }
  }

  async function toggleOptimizeShare() {
    if (!state.sharing || typeof stream.enableOptimizeForSharedVideo !== "function") {
      return;
    }
    try {
      await stream.enableOptimizeForSharedVideo(!state.optimizedShare);
      state.optimizedShare = !state.optimizedShare;
      updateShareButtons();
    } catch (error) {
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
    ui.pauseShareButton.removeEventListener("click", toggleSharePause);
    ui.optimizeShareButton.removeEventListener("click", toggleOptimizeShare);
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

  addListener("user-added", () => {
    updateParticipants();
    reconcileRemoteShare();
  });
  addListener("user-removed", (payload) => {
    const removedUsers = Array.isArray(payload) ? payload : [payload];
    removedUsers.forEach((user) => {
      if (user?.userId) {
        detachVideo(user.userId);
        if (state.activeShareUserId === user.userId) {
          detachRemoteShare(user.userId);
        }
      }
    });
    updateParticipants();
  });
  addListener("user-updated", (payload) => {
    const users = Array.isArray(payload) ? payload : [payload];
    users.forEach((user) => {
      if (user?.userId && user.bVideoOn === false) {
        detachVideo(user.userId);
      } else if (user?.userId && user.bVideoOn === true) {
        attachVideo(user.userId);
      }
    });
    updateParticipants();
    reconcileRemoteShare();
  });
  addListener("current-audio-change", (payload = {}) => {
    const action = String(payload.action || "").toLowerCase();
    if (action === "leave") {
      state.audioJoined = false;
    } else if (action) {
      state.audioJoined = true;
    }
    updateAudioButton();
  });
  addListener("peer-video-state-change", (payload = {}) => {
    if (payload.action === "Start") {
      attachVideo(payload.userId);
    } else {
      detachVideo(payload.userId);
    }
  });
  addListener("video-active-change", (payload = {}) => {
    if (payload.state === "Active") {
      setActiveTile(state, payload.userId);
    } else if (payload.state === "Inactive" && state.activeVideoUserId === payload.userId) {
      setActiveTile(state, null);
    }
  });
  addListener("active-speaker", (payload = []) => {
    const [speaker] = Array.isArray(payload) ? payload : [payload];
    if (speaker?.userId) {
      setActiveTile(state, speaker.userId);
    }
  });
  addListener("active-media-failed", (payload = {}) => {
    reportZoomStatus(ui, callbacks, `Zoom media issue: ${payloadMessage(payload, "media failed")}`);
  });
  addListener("speaking-while-muted", () => {
    ui.status.textContent = "You are muted";
  });
  addListener("host-ask-unmute-audio", () => {
    ui.status.textContent = "The other participant asked you to unmute";
  });
  addListener("device-change", () => {
    updateAudioButton();
  });
  addListener("active-share-change", (payload = {}) => {
    const currentUserId = getCurrentUserId(client);
    if (payload.state === "Active" && payload.userId !== currentUserId) {
      attachRemoteShare(payload.userId);
    } else if (payload.state === "Inactive") {
      detachRemoteShare(payload.userId);
    }
  });
  addListener("share-content-dimension-change", ({ width, height } = {}) => {
    state.sharedContentDimension = { width: Number(width) || 0, height: Number(height) || 0 };
    fitShareTargets(ui, stream, state);
  });
  addListener("share-content-change", (payload = {}) => {
    const currentUserId = getCurrentUserId(client);
    if (payload.userId && payload.userId !== currentUserId && payload.userId !== state.activeShareUserId) {
      attachRemoteShare(payload.userId);
    }
  });
  addListener("peer-share-state-change", () => {
    reconcileRemoteShare();
  });
  addListener("passively-stop-share", () => {
    state.sharing = false;
    state.sharePaused = false;
    ui.shareVideo.hidden = true;
    ui.shareCanvas.hidden = true;
    ui.shareHint.hidden = true;
    updateShareButtons();
    reconcileRemoteShare();
    setStageMode(ui, state.activeShareUserId ? "share" : state.videoTiles.size ? "video" : "empty");
  });
  addListener("connection-change", (payload = {}) => {
    if (payload.state === "Reconnecting") {
      ui.status.textContent = "Zoom reconnecting...";
    } else if (payload.state === "Connected") {
      updateParticipants();
    } else if (["Closed", "Fail", "Ended"].includes(payload.state)) {
      leave();
    }
  });

  const resizeObserver = new ResizeObserver(() => fitShareTargets(ui, stream, state));
  resizeObserver.observe(ui.shareStage);
  ui.audioButton.addEventListener("click", toggleAudio);
  ui.videoButton.addEventListener("click", toggleVideo);
  ui.shareButton.addEventListener("click", toggleShare);
  ui.pauseShareButton.addEventListener("click", toggleSharePause);
  ui.optimizeShareButton.addEventListener("click", toggleOptimizeShare);
  ui.leaveButton.addEventListener("click", leave);

  setStageMode(ui, "empty");
  updateParticipants();
  updateAudioButton();
  updateShareButtons();
  for (const user of getUsers(client)) {
    if (user.bVideoOn) {
      attachVideo(user.userId);
    }
  }
  reconcileRemoteShare();

  callbacks.onJoined?.();

  return {
    closeSession: leave,
    destroy: leave,
  };
}
