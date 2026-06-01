const SDK_CDN_PREFIX = "https://source.zoom.us/videosdk";
const VIDEO_QUALITY_720P = 3;
const ICON_NODES = {
  mic: [
    ["path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }],
    ["path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }],
    ["line", { x1: "12", x2: "12", y1: "19", y2: "22" }],
  ],
  "mic-off": [
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22" }],
    ["path", { d: "M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" }],
    ["path", { d: "M5 10v2a7 7 0 0 0 12 5" }],
    ["path", { d: "M15 9.34V5a3 3 0 0 0-5.68-1.33" }],
    ["path", { d: "M9 9v3a3 3 0 0 0 5.12 2.12" }],
    ["line", { x1: "12", x2: "12", y1: "19", y2: "22" }],
  ],
  video: [
    ["path", { d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" }],
    ["rect", { x: "2", y: "6", width: "14", height: "12", rx: "2" }],
  ],
  "video-off": [
    ["path", { d: "M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" }],
    ["path", { d: "M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" }],
    ["path", { d: "m2 2 20 20" }],
  ],
  "screen-share": [
    ["path", { d: "M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" }],
    ["path", { d: "M8 21h8" }],
    ["path", { d: "M12 17v4" }],
    ["path", { d: "m17 8 5-5" }],
    ["path", { d: "M17 3h5v5" }],
  ],
  "screen-share-off": [
    ["path", { d: "M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3" }],
    ["path", { d: "M8 21h8" }],
    ["path", { d: "M12 17v4" }],
    ["path", { d: "m22 3-5 5" }],
    ["path", { d: "m17 3 5 5" }],
  ],
  pause: [
    ["rect", { x: "14", y: "4", width: "4", height: "16", rx: "1" }],
    ["rect", { x: "6", y: "4", width: "4", height: "16", rx: "1" }],
  ],
  play: [["polygon", { points: "6 3 20 12 6 21 6 3" }]],
  film: [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
    ["path", { d: "M7 3v18" }],
    ["path", { d: "M3 7.5h4" }],
    ["path", { d: "M3 12h18" }],
    ["path", { d: "M3 16.5h4" }],
    ["path", { d: "M17 3v18" }],
    ["path", { d: "M17 7.5h4" }],
    ["path", { d: "M17 16.5h4" }],
  ],
  "phone-off": [
    [
      "path",
      {
        d: "M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91",
      },
    ],
    ["line", { x1: "22", x2: "2", y1: "2", y2: "22" }],
  ],
};

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

function createIcon(iconName, className = "zoom-native-button-icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add(...className.split(" ").filter(Boolean));

  for (const [tag, attrs] of ICON_NODES[iconName] || []) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) {
      node.setAttribute(key, String(value));
    }
    svg.appendChild(node);
  }

  return svg;
}

function setButtonVisual(button, label, iconName, state = "") {
  const labelNode = document.createElement("span");
  labelNode.className = "zoom-native-button-label";
  labelNode.textContent = label;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.dataset.state = state;
  button.replaceChildren(createIcon(iconName), labelNode);
}

function appendButton(parent, className, text, title, iconName) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  setButtonVisual(button, title || text, iconName);
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
  empty.setAttribute("aria-live", "polite");

  const emptyCard = document.createElement("div");
  emptyCard.className = "zoom-native-empty-card";

  const emptyIcon = createIcon("film", "zoom-native-empty-icon");

  const emptyTitle = document.createElement("div");
  emptyTitle.className = "zoom-native-empty-title";
  emptyTitle.textContent = "Zoom connected";

  const emptyDescription = document.createElement("div");
  emptyDescription.className = "zoom-native-empty-description";
  emptyDescription.textContent = "Waiting for cameras or screen share.";

  emptyCard.append(emptyIcon, emptyTitle, emptyDescription);
  empty.appendChild(emptyCard);

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

  const shareControlBar = document.createElement("div");
  shareControlBar.className = "zoom-native-share-control-bar";
  shareControlBar.hidden = true;

  const shareControlText = document.createElement("span");
  shareControlText.className = "zoom-native-share-control-text";
  shareControlText.textContent = "Sharing screen";
  shareControlBar.appendChild(shareControlText);

  const sharePauseButton = appendButton(
    shareControlBar,
    "zoom-native-share-control-button",
    "Pause share",
    "Pause share",
    "pause",
  );
  const shareStopButton = appendButton(
    shareControlBar,
    "zoom-native-share-control-button zoom-native-share-control-stop",
    "Stop share",
    "Stop share",
    "screen-share-off",
  );

  const videoContainer = document.createElement("video-player-container");
  videoContainer.className = "zoom-native-video-grid";
  videoContainer.dataset.count = "0";
  videoContainer.hidden = true;

  shareStage.append(shareVideo, shareCanvas, remoteShareContainer, shareHint, shareControlBar);
  stage.append(empty, shareStage, videoContainer);

  const footer = document.createElement("div");
  footer.className = "zoom-native-controls";

  const status = document.createElement("div");
  status.className = "zoom-native-status";
  status.textContent = zoom.sessionName || "Zoom session";

  const controls = document.createElement("div");
  controls.className = "zoom-native-button-row";

  const audioButton = appendButton(controls, "zoom-native-button", "Join audio", "Join audio", "mic");
  const videoButton = appendButton(controls, "zoom-native-button", "Start video", "Start video", "video-off");
  const shareButton = appendButton(controls, "zoom-native-button", "Share screen", "Share screen", "screen-share");
  const optimizeShareButton = appendButton(
    controls,
    "zoom-native-button",
    "Optimize video",
    "Optimize shared video",
    "film",
  );
  const leaveButton = appendButton(controls, "zoom-native-button zoom-native-button-danger", "Leave Zoom", "Leave Zoom", "phone-off");

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
    shareControlBar,
    shareControlText,
    sharePauseButton,
    shareStopButton,
    videoContainer,
    emptyTitle,
    emptyDescription,
    status,
    audioButton,
    videoButton,
    shareButton,
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

  const meta = document.createElement("div");
  meta.className = "zoom-native-video-meta";

  const status = document.createElement("span");
  status.className = "zoom-native-video-status";
  status.textContent = "Camera on";

  meta.append(name, status);
  tile.append(player, meta);
  return { tile, player, name, status };
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
    const active = Boolean(userId && tileUserId === userId);
    item.tile.classList.toggle("zoom-native-video-tile-active", active);
    item.status.textContent = active ? "Speaking" : "Camera on";
  }
}

function updateVideoGridState(ui, state) {
  ui.videoContainer.dataset.count = String(state.videoTiles.size);
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
    setButtonVisual(
      ui.shareButton,
      state.sharing ? "Stop share" : "Share screen",
      state.sharing ? "screen-share-off" : "screen-share",
      state.sharing ? "active" : "",
    );
    ui.shareControlBar.hidden = !state.sharing;
    ui.shareControlText.textContent = state.sharePaused ? "Sharing paused" : "Sharing screen";
    if (state.sharing) {
      ui.shareHint.hidden = false;
      ui.shareHint.textContent = state.sharePaused ? "Screen share paused" : "You are sharing your screen";
    }
    setButtonVisual(
      ui.sharePauseButton,
      state.sharePaused ? "Resume share" : "Pause share",
      state.sharePaused ? "play" : "pause",
    );
    setButtonVisual(ui.shareStopButton, "Stop share", "screen-share-off");
    ui.optimizeShareButton.hidden =
      !state.sharing ||
      typeof stream.isSupportOptimizedForSharedVideo !== "function" ||
      !stream.isSupportOptimizedForSharedVideo();
    setButtonVisual(
      ui.optimizeShareButton,
      state.optimizedShare ? "Video optimized" : "Optimize video",
      "film",
      state.optimizedShare ? "active" : "",
    );
  }

  function updateAudioButton() {
    const currentUser = client.getCurrentUserInfo?.() || {};
    if (!state.audioJoined) {
      setButtonVisual(ui.audioButton, "Join audio", "mic");
    } else if (currentUser.muted) {
      setButtonVisual(ui.audioButton, "Unmute", "mic-off", "muted");
    } else {
      setButtonVisual(ui.audioButton, "Mute", "mic", "active");
    }
  }

  function updateVideoButton() {
    setButtonVisual(
      ui.videoButton,
      state.videoStarted ? "Stop video" : "Start video",
      state.videoStarted ? "video" : "video-off",
      state.videoStarted ? "active" : "muted",
    );
  }

  function updateParticipants() {
    const users = getUsers(client);
    ui.status.textContent = `${zoom.sessionName || "Zoom session"} · ${users.length || 1} participant${users.length === 1 ? "" : "s"}`;
    ui.emptyTitle.textContent = users.length > 1 ? "No screen share active" : "Waiting for the other participant";
    ui.emptyDescription.textContent =
      users.length > 1 ? "Start video or share your screen to bring the stage to life." : "You are connected. The other participant will appear here when they join.";

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
    updateVideoGridState(ui, state);

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
      updateVideoGridState(ui, state);
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
    updateVideoGridState(ui, state);
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
        updateVideoButton();
      } else {
        await attachWithFallback(() => stream.startVideo(videoStartOptions(stream)), () => stream.startVideo());
        state.videoStarted = true;
        updateVideoButton();
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
        state.optimizedShare = false;
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
      ui.shareHint.textContent = "Choose a screen or window to share";
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
      state.optimizedShare = false;
      ui.shareHint.hidden = true;
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
    ui.sharePauseButton.removeEventListener("click", toggleSharePause);
    ui.shareStopButton.removeEventListener("click", toggleShare);
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
    state.optimizedShare = false;
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
  ui.sharePauseButton.addEventListener("click", toggleSharePause);
  ui.shareStopButton.addEventListener("click", toggleShare);
  ui.optimizeShareButton.addEventListener("click", toggleOptimizeShare);
  ui.leaveButton.addEventListener("click", leave);

  setStageMode(ui, "empty");
  updateParticipants();
  updateAudioButton();
  updateVideoButton();
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
