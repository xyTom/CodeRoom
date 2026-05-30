import crypto from "node:crypto";
import http from "node:http";
import net from "node:net";
import { URLSearchParams } from "node:url";

const APP_HOST = process.env.INTERVIEW_APP_HOST || "0.0.0.0";
const APP_PORT = Number(process.env.INTERVIEW_APP_PORT || "8080");
const IDE_HOST = process.env.IDE_INTERNAL_HOST || "127.0.0.1";
const IDE_PORT = Number(process.env.IDE_INTERNAL_PORT || "8081");
const ROOM_PASSWORD = process.env.ROOM_PASSWORD || "";
const INTERVIEWER_TOKEN = process.env.INTERVIEWER_TOKEN || "";
const CANDIDATE_TOKEN = process.env.CANDIDATE_TOKEN || "";
const SESSION_NAME = process.env.INTERVIEW_SESSION_NAME || `coderoom-${Date.now()}`;
const SESSION_DURATION_MINUTES = Number(process.env.SESSION_DURATION_MINUTES || "120");

const ZOOM_VIDEO_SDK_KEY = process.env.ZOOM_VIDEO_SDK_KEY || "";
const ZOOM_VIDEO_SDK_SECRET = process.env.ZOOM_VIDEO_SDK_SECRET || "";
const ZOOM_SESSION_NAME = process.env.ZOOM_SESSION_NAME || SESSION_NAME;
const ZOOM_SESSION_PASSCODE = process.env.ZOOM_SESSION_PASSCODE || "";
const ZOOM_UI_TOOLKIT_VERSION = process.env.ZOOM_UI_TOOLKIT_VERSION || "2.4.0-1";

const COOKIE_NAME = "coderoom_token";
const NAME_COOKIE_NAME = "coderoom_name";
const MAX_MESSAGES = 200;
const messages = [];
const sseClients = new Set();
const roomState = {
  candidateWaiting: false,
  candidateAdmitted: false,
  candidateLastSeen: null,
  admittedAt: null,
  candidateNames: new Set(),
  interviewerNames: new Set(),
  zoomInviteAt: null,
  zoomInviteBy: "",
};

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function getRoleFromToken(token) {
  if (INTERVIEWER_TOKEN && timingSafeEqual(token, INTERVIEWER_TOKEN)) {
    return "interviewer";
  }
  if (CANDIDATE_TOKEN && timingSafeEqual(token, CANDIDATE_TOKEN)) {
    return "candidate";
  }
  if (!INTERVIEWER_TOKEN && !CANDIDATE_TOKEN && process.env.NODE_ENV !== "production") {
    return "interviewer";
  }
  return null;
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME] || "";
  const role = getRoleFromToken(token);
  if (!role) {
    return null;
  }
  return { role, token, name: sanitizeDisplayName(cookies[NAME_COOKIE_NAME] || "") };
}

function sanitizeDisplayName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function setNameCookie(res, name) {
  res.setHeader(
    "Set-Cookie",
    `${NAME_COOKIE_NAME}=${encodeURIComponent(name)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.max(
      1800,
      SESSION_DURATION_MINUTES * 60,
    )}`,
  );
}

function markSeen(session) {
  if (!session?.name) {
    return;
  }
  if (session.role === "candidate") {
    markCandidateSeen(session);
    return;
  }
  roomState.interviewerNames.add(session.name);
}

function markCandidateSeen(session) {
  roomState.candidateWaiting = true;
  roomState.candidateLastSeen = new Date().toISOString();
  if (session?.name) {
    roomState.candidateNames.add(session.name);
  }
}

function serializeRoomState() {
  return {
    candidateWaiting: roomState.candidateWaiting,
    candidateAdmitted: roomState.candidateAdmitted,
    candidateLastSeen: roomState.candidateLastSeen,
    admittedAt: roomState.admittedAt,
    candidateNames: Array.from(roomState.candidateNames),
    interviewerNames: Array.from(roomState.interviewerNames),
    zoomInviteAt: roomState.zoomInviteAt,
    zoomInviteBy: roomState.zoomInviteBy,
  };
}

function setRoomCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.max(
      1800,
      SESSION_DURATION_MINUTES * 60,
    )}`,
  );
}

function clearRoomCookie(res) {
  res.setHeader("Set-Cookie", [
    `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
    `${NAME_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  ]);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isWorkspaceReady() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: IDE_HOST,
        port: IDE_PORT,
        path: "/healthz",
        method: "GET",
        timeout: 1200,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signZoomJwt(role, token) {
  if (!ZOOM_VIDEO_SDK_KEY || !ZOOM_VIDEO_SDK_SECRET) {
    return null;
  }

  const iat = Math.floor(Date.now() / 1000) - 30;
  const maxSeconds = Math.min(48 * 60 * 60, Math.max(1800, SESSION_DURATION_MINUTES * 60));
  const exp = iat + maxSeconds;
  const userKey = crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    app_key: ZOOM_VIDEO_SDK_KEY,
    role_type: role === "interviewer" ? 1 : 0,
    tpc: ZOOM_SESSION_NAME,
    version: 1,
    iat,
    exp,
    user_key: userKey,
    session_key: SESSION_NAME.slice(0, 36),
    audio_webrtc_mode: 1,
    video_webrtc_mode: 1,
  };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = crypto.createHmac("sha256", ZOOM_VIDEO_SDK_SECRET).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function targetPathForIde(reqUrl) {
  if (reqUrl === "/ide") {
    return "/";
  }
  return reqUrl.replace(/^\/ide(?=\/|$)/, "") || "/";
}

function rewriteProxyHeaders(headers) {
  const rewritten = { ...headers };
  if (rewritten.location && String(rewritten.location).startsWith("/")) {
    rewritten.location = `/ide${rewritten.location}`;
  }
  delete rewritten["content-security-policy"];
  return rewritten;
}

function proxyIdeRequest(req, res) {
  const targetPath = targetPathForIde(req.url);
  const headers = {
    ...req.headers,
    host: `${IDE_HOST}:${IDE_PORT}`,
    "x-forwarded-host": req.headers.host || "",
    "x-forwarded-proto": req.headers["x-forwarded-proto"] || "https",
  };

  const proxyReq = http.request(
    {
      hostname: IDE_HOST,
      port: IDE_PORT,
      method: req.method,
      path: targetPath,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, rewriteProxyHeaders(proxyRes.headers));
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    send(res, 502, "Workspace is not ready yet.", { "Content-Type": "text/plain; charset=utf-8" });
  });
  req.pipe(proxyReq);
}

function proxyIdeUpgrade(req, socket, head) {
  const reqUrl = req.url || "";
  if (!(reqUrl === "/ide" || reqUrl.startsWith("/ide/"))) {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  if (!getSession(req)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const session = getSession(req);
  if (session.role === "candidate" && !roomState.candidateAdmitted) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const targetSocket = net.connect(IDE_PORT, IDE_HOST, () => {
    const targetPath = targetPathForIde(req.url);
    const headers = {
      ...req.headers,
      host: `${IDE_HOST}:${IDE_PORT}`,
      "x-forwarded-host": req.headers.host || "",
      "x-forwarded-proto": req.headers["x-forwarded-proto"] || "https",
    };
    const headerLines = Object.entries(headers)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\r\n");

    targetSocket.write(`${req.method} ${targetPath} HTTP/${req.httpVersion}\r\n${headerLines}\r\n\r\n`);
    if (head?.length) {
      targetSocket.write(head);
    }
    socket.pipe(targetSocket).pipe(socket);
  });

  targetSocket.on("error", () => {
    socket.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
    socket.destroy();
  });
}

function renderLogin(message = "") {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CodeRoom</title>
  <style>${styles()}</style>
</head>
<body class="login-body">
  <main class="login-panel">
    <div class="brand-row">
      <div class="brand-mark">CR</div>
      <div>
        <h1>CodeRoom</h1>
        <p>Temporary interview room</p>
      </div>
    </div>
    ${message ? `<p class="login-error">${escapeHtml(message)}</p>` : ""}
    <form method="post" action="/login" class="login-form">
      <label>
        Room password
        <input name="password" type="password" autocomplete="current-password" autofocus />
      </label>
      <label>
        Join as
        <select name="role">
          <option value="candidate">Candidate</option>
          <option value="interviewer">Interviewer</option>
        </select>
      </label>
      <button type="submit">Enter room</button>
    </form>
  </main>
</body>
</html>`;
}

function renderNamePrompt(session, message = "") {
  const roleLabel = session.role === "interviewer" ? "Interviewer" : "Candidate";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CodeRoom</title>
  <style>${styles()}</style>
</head>
<body class="login-body">
  <main class="login-panel">
    <div class="brand-row">
      <div class="brand-mark">CR</div>
      <div>
        <h1>CodeRoom</h1>
        <p>${escapeHtml(roleLabel)} profile</p>
      </div>
    </div>
    ${message ? `<p class="login-error">${escapeHtml(message)}</p>` : ""}
    <form method="post" action="/profile" class="login-form">
      <label>
        Display name
        <input name="display_name" maxlength="48" autocomplete="name" autofocus />
      </label>
      <button type="submit">Continue</button>
    </form>
  </main>
</body>
</html>`;
}

function renderRoom(session) {
  if (session.role === "candidate" && !roomState.candidateAdmitted) {
    return renderCandidateLobby();
  }
  if (session.role === "candidate") {
    return renderCandidateRoom();
  }
  return renderInterviewerRoom();
}

function renderRoomShell(bodyClass, mainMarkup, scriptMarkup = `<script>${clientScript()}</script>`) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CodeRoom Interview</title>
  <style>${styles()}</style>
</head>
<body class="${bodyClass}">
  <div class="shell">
    <header class="topbar">
      <div class="brand-row compact">
        <div class="brand-mark">CR</div>
        <div>
          <h1>CodeRoom</h1>
          <p id="sessionLine">Loading room...</p>
        </div>
      </div>
      <div class="status-strip">
        <span id="roleBadge" class="pill">role</span>
        <span id="workspaceBadge" class="pill muted">workspace</span>
        <a class="ghost-link" href="/logout">Leave</a>
      </div>
    </header>

    ${mainMarkup}
  </div>
  <div id="zoomOverlay" class="zoom-overlay" hidden>
    <div class="zoom-floating-window" role="dialog" aria-label="Zoom call">
      <div class="zoom-window-bar">
        <strong>Zoom</strong>
        <button id="closeZoomButton" class="secondary icon-button" type="button" title="Hide Zoom" aria-label="Hide Zoom">&#215;</button>
      </div>
      <div id="sessionContainer" class="zoom-container"></div>
    </div>
  </div>
  <div id="zoomInviteBanner" class="zoom-invite-banner" hidden>
    <span id="zoomInviteText">The interviewer invited you to join Zoom.</span>
    <button id="joinZoomFromInviteButton" class="primary" type="button">Join</button>
  </div>
  ${scriptMarkup}
</body>
</html>`;
}

function renderCandidateLobby() {
  const main = `
    <main class="lobby-layout">
      <section class="panel lobby-card">
        <div class="panel-heading">
          <h2>Waiting room</h2>
          <span class="pill muted">candidate</span>
        </div>
        <div class="lobby-copy">
          <strong>Waiting for interviewer approval</strong>
          <span id="candidateGateStatus">Your room link is valid. The workspace will open after approval.</span>
        </div>
      </section>
    </main>`;
  return renderRoomShell("candidate-lobby", main, `<script>${lobbyScript()}</script>`);
}

function renderCandidateRoom() {
  const main = `
    <main class="candidate-grid">
      <section class="panel candidate-workspace-panel">
        <div class="panel-heading">
          <h2>Workspace</h2>
          <button id="reloadWorkspace" class="secondary" type="button">Reload</button>
        </div>
        <div id="workspaceLoading" class="workspace-loading">
          <strong>Workspace starting</strong>
          <span>code-server will open here when it is ready.</span>
        </div>
        <iframe id="workspaceFrame" title="Interview workspace" hidden></iframe>
      </section>
      <div class="resize-handle vertical" data-resize="candidate-dock" title="Resize panels"></div>

      <aside class="candidate-dock">
        <section class="panel video-panel">
          <div class="panel-heading">
            <h2>Call</h2>
            <div class="call-actions">
              <button id="joinZoomButton" class="primary icon-button" type="button" disabled title="Join Zoom" aria-label="Join Zoom">&#9658;</button>
            </div>
          </div>
          <div id="zoomNotice" class="notice">Checking Zoom configuration...</div>
        </section>

        <section class="panel chat-panel">
          <div class="panel-heading">
            <h2>Chat</h2>
            <span id="chatStatus" class="subtle">connecting</span>
          </div>
          <div id="messages" class="messages"></div>
          <form id="chatForm" class="chat-form">
            <input id="chatInput" maxlength="1200" placeholder="Message the room" autocomplete="off" />
            <button type="submit">Send</button>
          </form>
        </section>
      </aside>
    </main>`;
  return renderRoomShell("candidate-room", main);
}

function renderInterviewerRoom() {
  const main = `
    <main class="interviewer-grid">
      <section class="panel lobby-panel">
        <div class="panel-heading">
          <h2>Candidate</h2>
          <button id="admitCandidateButton" class="primary" type="button" disabled>Waiting</button>
        </div>
        <div class="notice" id="candidateStatus">No candidate waiting yet.</div>
      </section>
      <div class="resize-handle vertical interviewer-col-handle" data-resize="interviewer-left" title="Resize panels"></div>

      <section class="panel video-panel">
        <div class="panel-heading">
          <h2>Call</h2>
          <div class="call-actions">
            <button id="inviteZoomButton" class="secondary icon-button" type="button" disabled title="Invite candidate to Zoom" aria-label="Invite candidate to Zoom">&#8599;</button>
            <button id="joinZoomButton" class="primary icon-button" type="button" disabled title="Join Zoom" aria-label="Join Zoom">&#9658;</button>
          </div>
        </div>
        <div id="zoomNotice" class="notice">Checking Zoom configuration...</div>
      </section>
      <div class="resize-handle horizontal interviewer-row-handle" data-resize="interviewer-top" title="Resize call and workspace"></div>

      <section class="panel chat-panel">
        <div class="panel-heading">
          <h2>Chat</h2>
          <span id="chatStatus" class="subtle">connecting</span>
        </div>
        <div id="messages" class="messages"></div>
        <form id="chatForm" class="chat-form">
          <input id="chatInput" maxlength="1200" placeholder="Message the room" autocomplete="off" />
          <button type="submit">Send</button>
        </form>
      </section>

      <section class="panel interviewer-workspace-panel">
        <div class="panel-heading">
          <h2>Workspace</h2>
          <button id="reloadWorkspace" class="secondary" type="button">Reload</button>
        </div>
        <div id="workspaceLoading" class="workspace-loading">
          <strong>Workspace starting</strong>
          <span>code-server will open here when it is ready.</span>
        </div>
        <iframe id="workspaceFrame" title="Interview workspace" hidden></iframe>
      </section>
    </main>
`;
  return renderRoomShell("interviewer-room", main);
}

function styles() {
  return `
:root {
  --bg: #eef1f4;
  --panel: #ffffff;
  --text: #17202a;
  --muted: #617080;
  --line: #d8dee5;
  --accent: #0f766e;
  --accent-strong: #115e59;
  --danger: #b42318;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.login-body {
  display: grid;
  place-items: center;
  padding: 24px;
}
.login-panel {
  width: min(440px, 100%);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(20, 30, 40, 0.12);
}
.brand-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-row.compact h1 { font-size: 18px; }
.brand-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  font-weight: 800;
}
h1, h2, p { margin: 0; }
h1 { font-size: 24px; }
h2 { font-size: 16px; }
p, .subtle { color: var(--muted); }
.login-form {
  display: grid;
  gap: 14px;
  margin-top: 24px;
}
label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}
input, select, button {
  font: inherit;
}
input, select {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 10px;
  background: #fff;
  color: var(--text);
}
button {
  min-height: 38px;
  border: 0;
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
  white-space: nowrap;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.icon-button {
  width: 40px;
  min-width: 40px;
  min-height: 40px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  font-size: 18px;
  line-height: 1;
}
.call-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.primary, .login-form button {
  background: var(--accent);
  color: white;
}
.primary:hover, .login-form button:hover {
  background: var(--accent-strong);
}
.secondary {
  background: #e6eaee;
  color: var(--text);
}
.ghost-link {
  color: var(--muted);
  text-decoration: none;
  font-size: 14px;
}
.login-error {
  margin-top: 18px;
  color: var(--danger);
}
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
}
.topbar {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid var(--line);
}
.status-strip {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  border-radius: 999px;
  padding: 4px 10px;
  background: #d9f3ef;
  color: #0f4f49;
  font-size: 13px;
}
.pill.muted {
  background: #edf0f3;
  color: var(--muted);
}
.room-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(420px, 1fr);
  grid-template-rows: minmax(260px, 42vh) minmax(360px, 1fr);
  gap: 12px;
  padding: 12px;
}
.panel {
  min-height: 0;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr;
}
.panel-heading {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}
.video-panel { grid-column: 1; grid-row: 1; }
.chat-panel { grid-column: 1; grid-row: 2; }
.workspace-panel { grid-column: 2; grid-row: 1 / span 2; }
.lobby-layout {
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 24px;
}
.lobby-card {
  width: min(560px, 100%);
  min-height: 240px;
}
.lobby-copy {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 10px;
  padding: 28px;
  text-align: center;
  color: var(--muted);
}
.lobby-copy strong {
  color: var(--text);
  font-size: 20px;
}
.interviewer-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, var(--interviewer-left-width, 380px)) 8px minmax(420px, 1fr);
  grid-template-rows: minmax(140px, var(--interviewer-top-height, 260px)) 8px minmax(280px, 1fr);
  gap: 8px;
  padding: 12px;
}
.interviewer-grid .lobby-panel {
  grid-column: 1;
  grid-row: 1;
}
.interviewer-grid .video-panel {
  grid-column: 3;
  grid-row: 1;
}
.interviewer-grid .chat-panel {
  grid-column: 1;
  grid-row: 3;
}
.interviewer-workspace-panel {
  grid-column: 3;
  grid-row: 3;
  min-height: 280px;
  position: relative;
}
.candidate-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(360px, 1fr) 8px minmax(280px, var(--candidate-dock-width, 360px));
  gap: 8px;
  padding: 12px;
}
.candidate-workspace-panel {
  grid-column: 1;
  min-height: 0;
  position: relative;
}
.candidate-dock {
  grid-column: 3;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(260px, 42vh) minmax(280px, 1fr);
  gap: 8px;
}
.candidate-dock .video-panel,
.candidate-dock .chat-panel {
  grid-column: auto;
  grid-row: auto;
}
body.zoom-enabled .chat-panel {
  display: none;
}
body.zoom-enabled .candidate-dock {
  grid-template-rows: minmax(160px, auto);
  align-content: start;
}
body.zoom-enabled .interviewer-grid {
  grid-template-rows: minmax(140px, var(--interviewer-top-height, 220px)) 8px minmax(280px, 1fr);
}
body.zoom-enabled .interviewer-workspace-panel {
  grid-column: 1 / span 3;
}
body.zoom-enabled .interviewer-col-handle {
  grid-row: 1;
}
.resize-handle {
  position: relative;
  border-radius: 6px;
  background: #dce2e8;
}
.resize-handle::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  background: var(--accent);
  transition: opacity 120ms ease;
}
.resize-handle:hover::after,
.resize-handle.dragging::after {
  opacity: 0.35;
}
.resize-handle.vertical {
  cursor: col-resize;
}
.resize-handle.horizontal {
  cursor: row-resize;
}
.interviewer-col-handle {
  grid-column: 2;
  grid-row: 1 / span 3;
}
.interviewer-row-handle {
  grid-column: 3;
  grid-row: 2;
}
.notice {
  align-self: start;
  margin: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--muted);
  background: #f8fafb;
  font-size: 14px;
}
.zoom-container {
  min-height: 0;
  width: 100%;
}
.zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.48);
}
.zoom-floating-window {
  width: min(1180px, calc(100vw - 40px));
  height: min(760px, calc(100vh - 40px));
  min-height: 420px;
  display: grid;
  grid-template-rows: 48px 1fr;
  overflow: hidden;
  border: 1px solid #252c35;
  border-radius: 8px;
  background: #1f242b;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.34);
}
.zoom-window-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 8px 6px 14px;
  color: white;
  background: #111827;
}
.zoom-floating-window .zoom-container {
  height: 100%;
  background: #202124;
}
.zoom-invite-banner {
  position: fixed;
  left: 50%;
  bottom: 20px;
  z-index: 60;
  width: min(520px, calc(100vw - 32px));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 16px 44px rgba(20, 30, 40, 0.18);
  transform: translateX(-50%);
}
.messages {
  min-height: 0;
  overflow: auto;
  padding: 12px;
}
.message {
  display: grid;
  gap: 4px;
  padding: 10px 0;
  border-bottom: 1px solid #edf0f3;
}
.message-meta {
  display: flex;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
}
.message-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.chat-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--line);
}
.workspace-panel,
.candidate-workspace-panel,
.interviewer-workspace-panel {
  position: relative;
}
.workspace-loading {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 8px;
  color: var(--muted);
  padding: 24px;
}
.workspace-loading strong {
  color: var(--text);
}
#workspaceFrame {
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}
@media (max-width: 900px) {
  .topbar {
    height: auto;
    align-items: flex-start;
    flex-direction: column;
  }
  .room-grid {
    grid-template-columns: 1fr;
    grid-template-rows: 320px 360px minmax(520px, 70vh);
  }
  .interviewer-grid,
  .candidate-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
  .resize-handle {
    display: none;
  }
  .candidate-dock {
    grid-template-rows: 320px 360px;
    grid-column: 1;
  }
  body.zoom-enabled .candidate-dock {
    grid-template-rows: auto;
  }
  .video-panel, .chat-panel, .workspace-panel {
    grid-column: 1;
    grid-row: auto;
  }
  .interviewer-grid .lobby-panel,
  .interviewer-grid .video-panel,
  .interviewer-grid .chat-panel,
  .interviewer-workspace-panel,
  .candidate-workspace-panel {
    grid-column: 1;
    grid-row: auto;
  }
  .candidate-workspace-panel {
    min-height: 70vh;
  }
  .zoom-floating-window {
    width: calc(100vw - 20px);
    height: calc(100vh - 20px);
    min-height: 0;
  }
}
`;
}

function clientScript() {
  return `
const sessionLine = document.getElementById("sessionLine");
const roleBadge = document.getElementById("roleBadge");
const workspaceBadge = document.getElementById("workspaceBadge");
const workspaceFrame = document.getElementById("workspaceFrame");
const workspaceLoading = document.getElementById("workspaceLoading");
const reloadWorkspace = document.getElementById("reloadWorkspace");
const joinZoomButton = document.getElementById("joinZoomButton");
const inviteZoomButton = document.getElementById("inviteZoomButton");
const zoomNotice = document.getElementById("zoomNotice");
const sessionContainer = document.getElementById("sessionContainer");
const zoomOverlay = document.getElementById("zoomOverlay");
const closeZoomButton = document.getElementById("closeZoomButton");
const zoomInviteBanner = document.getElementById("zoomInviteBanner");
const zoomInviteText = document.getElementById("zoomInviteText");
const joinZoomFromInviteButton = document.getElementById("joinZoomFromInviteButton");
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatStatus = document.getElementById("chatStatus");
const candidateStatus = document.getElementById("candidateStatus");
const admitCandidateButton = document.getElementById("admitCandidateButton");

let sessionState = null;
let workspaceLoaded = false;
let zoomJoined = false;
let zoomLoading = false;
let zoomAssetsPromise = null;

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function renderMessage(message) {
  if (!messagesEl) {
    return;
  }
  const item = document.createElement("div");
  item.className = "message";
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  item.innerHTML = '<div class="message-meta"><strong>' + escapeHtml(message.author) + '</strong><span>' + time + '</span></div><div class="message-body">' + escapeHtml(message.text) + '</div>';
  messagesEl.appendChild(item);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateCandidateControls(state) {
  if (!candidateStatus || !admitCandidateButton) {
    return;
  }

  if (state.room.candidateAdmitted) {
    const names = state.room.candidateNames.length ? state.room.candidateNames.join(", ") : "Candidate";
    candidateStatus.textContent = names + " admitted. The workspace link is active for both sides.";
    admitCandidateButton.textContent = "Admitted";
    admitCandidateButton.disabled = true;
    return;
  }

  if (state.room.candidateWaiting) {
    const seen = state.room.candidateLastSeen ? new Date(state.room.candidateLastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    const names = state.room.candidateNames.length ? state.room.candidateNames.join(", ") : "Candidate";
    candidateStatus.textContent = names + " waiting" + (seen ? " since " + seen : "") + ".";
    admitCandidateButton.textContent = "Admit candidate";
    admitCandidateButton.disabled = false;
    return;
  }

  candidateStatus.textContent = "No candidate waiting yet.";
  admitCandidateButton.textContent = "Waiting";
  admitCandidateButton.disabled = true;
}

function canJoinZoom(state) {
  if (!state?.zoom?.enabled) {
    return false;
  }
  if (state.role === "candidate") {
    return state.room.candidateAdmitted && Boolean(state.room.zoomInviteAt);
  }
  return true;
}

function updateZoomControls(state) {
  const zoomEnabled = Boolean(state?.zoom?.enabled);
  document.body.classList.toggle("zoom-enabled", zoomEnabled);

  if (zoomInviteBanner) {
    const showInvite = zoomEnabled && state?.role === "candidate" && Boolean(state.room.zoomInviteAt) && !zoomJoined;
    zoomInviteBanner.hidden = !showInvite;
    if (showInvite && zoomInviteText) {
      const byline = state.room.zoomInviteBy ? " from " + state.room.zoomInviteBy : "";
      zoomInviteText.textContent = "Zoom invite" + byline + ".";
    }
  }

  if (!joinZoomButton && !zoomNotice && !inviteZoomButton) {
    return;
  }

  if (!zoomEnabled) {
    if (joinZoomButton) {
      joinZoomButton.disabled = true;
    }
    if (inviteZoomButton) {
      inviteZoomButton.disabled = true;
    }
    if (zoomNotice) {
      zoomNotice.hidden = false;
      zoomNotice.textContent = "Zoom is not configured. Add ZOOM_VIDEO_SDK_KEY and ZOOM_VIDEO_SDK_SECRET to enable video.";
    }
    return;
  }

  if (joinZoomButton) {
    joinZoomButton.disabled = zoomLoading || !canJoinZoom(state);
    joinZoomButton.title = zoomJoined ? "Show Zoom" : "Join Zoom";
    joinZoomButton.setAttribute("aria-label", zoomJoined ? "Show Zoom" : "Join Zoom");
  }

  if (inviteZoomButton) {
    const candidateReady = state.room.candidateAdmitted;
    inviteZoomButton.disabled = zoomLoading || !zoomJoined || !candidateReady;
  }

  if (!zoomNotice) {
    return;
  }

  zoomNotice.hidden = false;
  if (state.role === "candidate") {
    if (zoomJoined) {
      zoomNotice.textContent = "Zoom is open in a floating window.";
    } else if (state.room.zoomInviteAt) {
      zoomNotice.textContent = "The interviewer invited you to join Zoom.";
    } else {
      zoomNotice.textContent = "Zoom will be available after the interviewer invites you.";
    }
    return;
  }

  if (zoomJoined && state.room.zoomInviteAt) {
    zoomNotice.textContent = "Zoom is open. Candidate invitation sent.";
  } else if (zoomJoined) {
    zoomNotice.textContent = "Zoom is open. Invite the candidate when ready.";
  } else {
    zoomNotice.textContent = "Join Zoom first, then invite the candidate.";
  }
}

async function loadSession() {
  const response = await fetch("/api/session", { cache: "no-store" });
  if (!response.ok) {
    location.reload();
    return;
  }
  sessionState = await response.json();
  setText(sessionLine, sessionState.sessionName);
  setText(roleBadge, sessionState.name ? sessionState.role + ": " + sessionState.name : sessionState.role);
  updateCandidateControls(sessionState);

  const workspaceAvailable = sessionState.role !== "candidate" || sessionState.room.candidateAdmitted;
  if (workspaceBadge) {
    const label = sessionState.workspace.ready && workspaceAvailable ? "workspace ready" : "workspace starting";
    workspaceBadge.textContent = label;
    workspaceBadge.classList.toggle("muted", !(sessionState.workspace.ready && workspaceAvailable));
  }

  if (workspaceFrame && workspaceLoading && sessionState.workspace.ready && workspaceAvailable && !workspaceLoaded) {
    workspaceLoaded = true;
    workspaceFrame.src = "/ide/";
    workspaceFrame.hidden = false;
    workspaceLoading.hidden = true;
  }

  updateZoomControls(sessionState);
}

async function loadMessages() {
  if (!messagesEl) {
    return;
  }
  const response = await fetch("/api/chat", { cache: "no-store" });
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  messagesEl.textContent = "";
  for (const message of data.messages) {
    renderMessage(message);
  }
}

function connectEvents() {
  if (!messagesEl) {
    return;
  }
  const events = new EventSource("/api/events");
  events.onopen = () => {
    setText(chatStatus, "live");
  };
  events.onerror = () => {
    setText(chatStatus, "reconnecting");
  };
  events.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "message") {
      renderMessage(data.message);
    }
    if (data.type === "room") {
      loadSession();
    }
  };
}

if (chatForm && chatInput) {
  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) {
      return;
    }
    chatInput.value = "";
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  });
}

if (reloadWorkspace && workspaceFrame) {
  reloadWorkspace.addEventListener("click", () => {
    if (workspaceFrame.src) {
      workspaceFrame.src = "/ide/";
    }
  });
}

if (admitCandidateButton) {
  admitCandidateButton.addEventListener("click", async () => {
    admitCandidateButton.disabled = true;
    await fetch("/api/admit-candidate", { method: "POST" });
    await loadSession();
  });
}

function loadStyle(href) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('link[href="' + href + '"]')) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="' + src + '"]')) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function loadZoomToolkit(version) {
  if (!zoomAssetsPromise) {
    zoomAssetsPromise = Promise.all([
      loadStyle("https://source.zoom.us/uitoolkit/" + version + "/videosdk-ui-toolkit.css"),
      window.UIToolkit ? Promise.resolve() : loadScript("https://source.zoom.us/uitoolkit/" + version + "/videosdk-ui-toolkit.min.umd.js"),
    ]);
  }
  return zoomAssetsPromise;
}

async function joinZoom() {
  if (!sessionState) {
    await loadSession();
  }
  if (!canJoinZoom(sessionState)) {
    updateZoomControls(sessionState);
    return;
  }
  if (zoomJoined) {
    if (zoomOverlay) {
      zoomOverlay.hidden = false;
    }
    return;
  }

  zoomLoading = true;
  updateZoomControls(sessionState);
  if (zoomOverlay) {
    zoomOverlay.hidden = false;
  }
  if (zoomNotice) {
    zoomNotice.hidden = false;
    zoomNotice.textContent = "Loading Zoom...";
  }

  try {
    const response = await fetch("/api/zoom-session", { cache: "no-store" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Zoom session is not available");
    }
    const zoom = await response.json();
    const version = zoom.uiToolkitVersion;
    await loadZoomToolkit(version);
    const uitoolkit = window.UIToolkit;
    if (!uitoolkit || !sessionContainer) {
      throw new Error("Zoom UI Toolkit did not load");
    }
    sessionContainer.textContent = "";
    const config = {
      videoSDKJWT: zoom.videoSDKJWT,
      sessionName: zoom.sessionName,
      userName: zoom.userName,
      sessionPasscode: zoom.sessionPasscode,
    };
    uitoolkit.joinSession(sessionContainer, config);
    zoomJoined = true;
    if (typeof uitoolkit.onSessionClosed === "function") {
      uitoolkit.onSessionClosed(() => {
        zoomJoined = false;
        if (zoomOverlay) {
          zoomOverlay.hidden = true;
        }
        if (sessionState) {
          updateZoomControls(sessionState);
        }
      });
    }
  } catch (error) {
    console.error(error);
    if (zoomOverlay) {
      zoomOverlay.hidden = true;
    }
    if (zoomNotice) {
      zoomNotice.hidden = false;
      zoomNotice.textContent = "Could not start Zoom: " + error.message;
    }
  } finally {
    zoomLoading = false;
    if (sessionState) {
      updateZoomControls(sessionState);
    }
  }
}

if (joinZoomButton) {
  joinZoomButton.addEventListener("click", joinZoom);
}

if (joinZoomFromInviteButton) {
  joinZoomFromInviteButton.addEventListener("click", joinZoom);
}

if (closeZoomButton && zoomOverlay) {
  closeZoomButton.addEventListener("click", () => {
    zoomOverlay.hidden = true;
  });
}

if (inviteZoomButton) {
  inviteZoomButton.addEventListener("click", async () => {
    inviteZoomButton.disabled = true;
    try {
      const response = await fetch("/api/invite-zoom", { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Could not send Zoom invite");
      }
      await loadSession();
    } catch (error) {
      console.error(error);
      if (zoomNotice) {
        zoomNotice.hidden = false;
        zoomNotice.textContent = "Could not send Zoom invite: " + error.message;
      }
      updateZoomControls(sessionState);
    }
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function restoreLayoutSize(key, cssVar) {
  const value = localStorage.getItem(key);
  if (value) {
    document.documentElement.style.setProperty(cssVar, value);
  }
}

function initResizers() {
  restoreLayoutSize("coderoom:candidate-dock-width", "--candidate-dock-width");
  restoreLayoutSize("coderoom:interviewer-left-width", "--interviewer-left-width");
  restoreLayoutSize("coderoom:interviewer-top-height", "--interviewer-top-height");

  for (const handle of document.querySelectorAll(".resize-handle")) {
    handle.addEventListener("pointerdown", (event) => {
      const mode = handle.dataset.resize;
      const grid = handle.closest(".candidate-grid, .interviewer-grid");
      if (!grid) {
        return;
      }
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("dragging");

      const onMove = (moveEvent) => {
        const rect = grid.getBoundingClientRect();
        if (mode === "candidate-dock") {
          const width = clamp(rect.right - moveEvent.clientX, 280, Math.max(280, rect.width * 0.6));
          const value = Math.round(width) + "px";
          document.documentElement.style.setProperty("--candidate-dock-width", value);
          localStorage.setItem("coderoom:candidate-dock-width", value);
        }
        if (mode === "interviewer-left") {
          const width = clamp(moveEvent.clientX - rect.left, 280, Math.max(280, rect.width * 0.48));
          const value = Math.round(width) + "px";
          document.documentElement.style.setProperty("--interviewer-left-width", value);
          localStorage.setItem("coderoom:interviewer-left-width", value);
        }
        if (mode === "interviewer-top") {
          const height = clamp(moveEvent.clientY - rect.top, 160, Math.max(160, rect.height - 260));
          const value = Math.round(height) + "px";
          document.documentElement.style.setProperty("--interviewer-top-height", value);
          localStorage.setItem("coderoom:interviewer-top-height", value);
        }
      };

      const onUp = () => {
        handle.classList.remove("dragging");
        handle.releasePointerCapture?.(event.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }
}

initResizers();
loadSession();
loadMessages();
connectEvents();
setInterval(loadSession, 2000);
`;
}

function lobbyScript() {
  return `
const sessionLine = document.getElementById("sessionLine");
const roleBadge = document.getElementById("roleBadge");
const workspaceBadge = document.getElementById("workspaceBadge");
const candidateGateStatus = document.getElementById("candidateGateStatus");

async function loadLobbyState() {
  const response = await fetch("/api/session", { cache: "no-store" });
  if (!response.ok) {
    location.reload();
    return;
  }
  const state = await response.json();
  if (sessionLine) {
    sessionLine.textContent = state.sessionName;
  }
  if (roleBadge) {
    roleBadge.textContent = state.name ? state.role + ": " + state.name : state.role;
  }
  if (workspaceBadge) {
    workspaceBadge.textContent = state.room.candidateAdmitted ? "approved" : "waiting approval";
    workspaceBadge.classList.toggle("muted", !state.room.candidateAdmitted);
  }
  if (state.room.candidateAdmitted) {
    location.reload();
    return;
  }
  if (candidateGateStatus) {
    candidateGateStatus.textContent = "The interviewer has not admitted this candidate yet.";
  }
}

loadLobbyState();
setInterval(loadLobbyState, 2000);
`;
}

async function handleRoomToken(req, res, url) {
  const token = url.searchParams.get("token") || "";
  if (!token) {
    return false;
  }
  const role = getRoleFromToken(token);
  if (!role) {
    send(res, 403, renderLogin("Invalid or expired room link."), { "Content-Type": "text/html; charset=utf-8" });
    return true;
  }
  setRoomCookie(res, token);
  redirect(res, "/room");
  return true;
}

async function handleLogin(req, res) {
  const body = await readBody(req, 16 * 1024);
  const params = new URLSearchParams(body);
  const password = params.get("password") || "";
  const requestedRole = params.get("role") === "interviewer" ? "interviewer" : "candidate";
  if (!ROOM_PASSWORD || !timingSafeEqual(password, ROOM_PASSWORD)) {
    send(res, 200, renderLogin("Password did not match."), { "Content-Type": "text/html; charset=utf-8" });
    return;
  }

  const token = requestedRole === "interviewer" ? INTERVIEWER_TOKEN : CANDIDATE_TOKEN;
  if (!token) {
    send(res, 500, renderLogin("Room token is not configured."), { "Content-Type": "text/html; charset=utf-8" });
    return;
  }
  setRoomCookie(res, token);
  redirect(res, "/room");
}

async function handleProfile(req, res, session) {
  const body = await readBody(req, 16 * 1024);
  const params = new URLSearchParams(body);
  const name = sanitizeDisplayName(params.get("display_name") || "");
  if (!name) {
    send(res, 400, renderNamePrompt(session, "Enter a display name."), { "Content-Type": "text/html; charset=utf-8" });
    return;
  }
  setNameCookie(res, name);
  redirect(res, "/room");
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/healthz") {
    send(res, 200, "ok\n", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  if (url.pathname === "/") {
    redirect(res, "/room");
    return;
  }

  if (url.pathname === "/room") {
    if (await handleRoomToken(req, res, url)) {
      return;
    }
    const session = getSession(req);
    if (!session) {
      send(res, 200, renderLogin(), { "Content-Type": "text/html; charset=utf-8" });
      return;
    }
    if (!session.name) {
      send(res, 200, renderNamePrompt(session), { "Content-Type": "text/html; charset=utf-8" });
      return;
    }
    markSeen(session);
    send(res, 200, renderRoom(session), { "Content-Type": "text/html; charset=utf-8" });
    return;
  }

  if (url.pathname === "/login" && req.method === "POST") {
    await handleLogin(req, res);
    return;
  }

  if (url.pathname === "/profile" && req.method === "POST") {
    const session = getSession(req);
    if (!session) {
      redirect(res, "/room");
      return;
    }
    await handleProfile(req, res, session);
    return;
  }

  if (url.pathname === "/logout") {
    clearRoomCookie(res);
    redirect(res, "/room");
    return;
  }

  const session = getSession(req);
  if (!session) {
    if (url.pathname.startsWith("/api/")) {
      sendJson(res, 401, { error: "unauthorized" });
    } else {
      redirect(res, "/room");
    }
    return;
  }

  if (url.pathname === "/api/session") {
    markSeen(session);
    sendJson(res, 200, {
      role: session.role,
      name: session.name,
      sessionName: SESSION_NAME,
      room: serializeRoomState(),
      workspace: { ready: await isWorkspaceReady() },
      zoom: { enabled: Boolean(ZOOM_VIDEO_SDK_KEY && ZOOM_VIDEO_SDK_SECRET) },
    });
    return;
  }

  if (url.pathname === "/api/admit-candidate" && req.method === "POST") {
    if (session.role !== "interviewer") {
      sendJson(res, 403, { error: "interviewer role required" });
      return;
    }
    roomState.candidateWaiting = true;
    roomState.candidateAdmitted = true;
    roomState.admittedAt = new Date().toISOString();
    const room = serializeRoomState();
    broadcast({ type: "room", room });
    sendJson(res, 200, { room });
    return;
  }

  if (url.pathname === "/api/invite-zoom" && req.method === "POST") {
    if (session.role !== "interviewer") {
      sendJson(res, 403, { error: "interviewer role required" });
      return;
    }
    if (!ZOOM_VIDEO_SDK_KEY || !ZOOM_VIDEO_SDK_SECRET) {
      sendJson(res, 404, { error: "Zoom Video SDK is not configured" });
      return;
    }
    roomState.zoomInviteAt = new Date().toISOString();
    roomState.zoomInviteBy = session.name || "Interviewer";
    const room = serializeRoomState();
    broadcast({ type: "room", room });
    sendJson(res, 200, { room });
    return;
  }

  if (url.pathname === "/api/zoom-session") {
    if (session.role === "candidate" && !roomState.candidateAdmitted) {
      sendJson(res, 403, { error: "candidate is waiting for admission" });
      return;
    }
    if (session.role === "candidate" && !roomState.zoomInviteAt) {
      sendJson(res, 403, { error: "candidate is waiting for Zoom invite" });
      return;
    }
    const videoSDKJWT = signZoomJwt(session.role, session.token);
    if (!videoSDKJWT) {
      sendJson(res, 404, { error: "Zoom Video SDK is not configured" });
      return;
    }
    sendJson(res, 200, {
      videoSDKJWT,
      sessionName: ZOOM_SESSION_NAME,
      sessionPasscode: ZOOM_SESSION_PASSCODE,
      uiToolkitVersion: ZOOM_UI_TOOLKIT_VERSION,
      userName: session.name || (session.role === "interviewer" ? "Interviewer" : "Candidate"),
    });
    return;
  }

  if (url.pathname === "/api/chat" && req.method === "GET") {
    sendJson(res, 200, { messages });
    return;
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    const body = await readBody(req);
    const data = JSON.parse(body || "{}");
    const text = String(data.text || "").trim().slice(0, 1200);
    if (!text) {
      sendJson(res, 400, { error: "message is required" });
      return;
    }
    const message = {
      id: crypto.randomUUID(),
      author: session.name || (session.role === "interviewer" ? "Interviewer" : "Candidate"),
      text,
      createdAt: new Date().toISOString(),
    };
    messages.push(message);
    while (messages.length > MAX_MESSAGES) {
      messages.shift();
    }
    broadcast({ type: "message", message });
    sendJson(res, 201, { message });
    return;
  }

  if (url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    res.write("\n");
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
    return;
  }

  if (url.pathname === "/ide" || url.pathname.startsWith("/ide/")) {
    if (session.role === "candidate" && !roomState.candidateAdmitted) {
      send(res, 403, "Waiting for interviewer approval.\n", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    proxyIdeRequest(req, res);
    return;
  }

  send(res, 404, "Not found\n", { "Content-Type": "text/plain; charset=utf-8" });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "internal server error" });
    } else {
      res.end();
    }
  });
});

server.on("upgrade", proxyIdeUpgrade);

server.listen(APP_PORT, APP_HOST, () => {
  console.log(`Interview app listening on http://${APP_HOST}:${APP_PORT}`);
  console.log(`Proxying /ide/ to code-server at http://${IDE_HOST}:${IDE_PORT}`);
});
