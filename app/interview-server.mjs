import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URLSearchParams } from "node:url";

const APP_HOST = process.env.INTERVIEW_APP_HOST || "0.0.0.0";
const APP_PORT = Number(process.env.INTERVIEW_APP_PORT || "8080");
const IDE_HOST = process.env.IDE_INTERNAL_HOST || "127.0.0.1";
const IDE_PORT = Number(process.env.IDE_INTERNAL_PORT || "8081");
const ROOM_PASSWORD = process.env.ROOM_PASSWORD || "";
const DEV_AUTH_ENABLED = process.env.NODE_ENV !== "production";
const INTERVIEWER_TOKEN = process.env.INTERVIEWER_TOKEN || (DEV_AUTH_ENABLED ? "dev-interviewer-token" : "");
const CANDIDATE_TOKEN = process.env.CANDIDATE_TOKEN || (DEV_AUTH_ENABLED ? "dev-candidate-token" : "");
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

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(APP_DIR, "dist");
const MANIFEST_PATH = path.join(DIST_DIR, ".vite", "manifest.json");
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
let clientManifest = null;

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

function sanitizeDisplayName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function getRoleFromToken(token) {
  if (INTERVIEWER_TOKEN && timingSafeEqual(token, INTERVIEWER_TOKEN)) {
    return "interviewer";
  }
  if (CANDIDATE_TOKEN && timingSafeEqual(token, CANDIDATE_TOKEN)) {
    return "candidate";
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

function setNameCookie(res, name) {
  res.setHeader(
    "Set-Cookie",
    `${NAME_COOKIE_NAME}=${encodeURIComponent(name)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.max(
      1800,
      SESSION_DURATION_MINUTES * 60,
    )}`,
  );
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

function sendBuffer(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Length": body.length,
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

function readClientManifest() {
  if (clientManifest) {
    return clientManifest;
  }
  try {
    clientManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    clientManifest = {};
  }
  return clientManifest;
}

function clientEntry() {
  return readClientManifest()["src/main.jsx"] || { file: "assets/main.js", css: ["assets/main.css"] };
}

function assetHref(file) {
  return `/${String(file).replace(/^\/+/, "")}`;
}

function renderAssetTags({ includeScript = true } = {}) {
  const entry = clientEntry();
  const styles = (entry.css || [])
    .map((file) => `<link rel="stylesheet" href="${assetHref(file)}" />`)
    .join("\n  ");
  const script = includeScript ? `\n  <script type="module" src="${assetHref(entry.file)}"></script>` : "";
  return `${styles}${script}`;
}

async function serveStaticAsset(res, pathname) {
  if (!pathname.startsWith("/assets/")) {
    return false;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    send(res, 400, "Bad request\n", { "Content-Type": "text/plain; charset=utf-8" });
    return true;
  }

  const distRoot = path.resolve(DIST_DIR);
  const assetPath = path.resolve(DIST_DIR, decodedPath.slice(1));
  if (!assetPath.startsWith(`${distRoot}${path.sep}`)) {
    send(res, 403, "Forbidden\n", { "Content-Type": "text/plain; charset=utf-8" });
    return true;
  }

  try {
    const body = await fs.promises.readFile(assetPath);
    sendBuffer(res, 200, body, {
      "Content-Type": MIME_TYPES[path.extname(assetPath)] || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  } catch {
    send(res, 404, "Not found\n", { "Content-Type": "text/plain; charset=utf-8" });
  }
  return true;
}

function isWorkspaceReady() {
  return new Promise((resolve) => {
    const probe = http.request(
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
    probe.on("timeout", () => {
      probe.destroy();
      resolve(false);
    });
    probe.on("error", () => resolve(false));
    probe.end();
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
  const url = new URL(reqUrl, "http://coderoom.local");
  if (url.pathname === "/ide") {
    return `/${url.search}`;
  }
  return `${url.pathname.replace(/^\/ide(?=\/|$)/, "") || "/"}${url.search}`;
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
      path: targetPathForIde(req.url),
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
  const url = new URL(reqUrl, "http://coderoom.local");
  if (!(url.pathname === "/ide" || url.pathname.startsWith("/ide/"))) {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const session = getSession(req);
  if (!session) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  if (session.role === "candidate" && !roomState.candidateAdmitted) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const targetSocket = net.connect(IDE_PORT, IDE_HOST, () => {
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

    targetSocket.write(`${req.method} ${targetPathForIde(req.url)} HTTP/${req.httpVersion}\r\n${headerLines}\r\n\r\n`);
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
  ${renderAssetTags({ includeScript: false })}
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
  ${renderAssetTags({ includeScript: false })}
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

function renderRoom() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CodeRoom Interview</title>
  ${renderAssetTags()}
</head>
<body>
  <div id="coderoom-root"></div>
</body>
</html>`;
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

  if (await serveStaticAsset(res, url.pathname)) {
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
    send(res, 200, renderRoom(), { "Content-Type": "text/html; charset=utf-8" });
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
