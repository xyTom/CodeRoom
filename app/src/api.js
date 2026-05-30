async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

export async function getSession() {
  return readJson(await fetch("/api/session", { cache: "no-store" }));
}

export async function getMessages() {
  return readJson(await fetch("/api/chat", { cache: "no-store" }));
}

export async function sendMessage(text) {
  return readJson(
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  );
}

export async function admitCandidate() {
  return readJson(await fetch("/api/admit-candidate", { method: "POST" }));
}

export async function inviteZoom() {
  return readJson(await fetch("/api/invite-zoom", { method: "POST" }));
}

export async function getZoomSession() {
  return readJson(await fetch("/api/zoom-session", { cache: "no-store" }));
}

export function subscribeRoomEvents({ onMessage, onRoom, onOpen, onError }) {
  const events = new EventSource("/api/events");
  events.onopen = onOpen;
  events.onerror = onError;
  events.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "message") {
      onMessage?.(data.message);
    }
    if (data.type === "room") {
      onRoom?.(data.room);
    }
  };
  return () => events.close();
}
