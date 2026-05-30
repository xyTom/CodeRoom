# Collaboration Options

This project currently exposes code-server directly through a Cloudflare Quick
Tunnel. That is enough for a shared IDE, but it does not provide a built-in
interview call, candidate camera, or screen-share workflow.

## Recommended MVP Direction

The best product shape is not "open code-server first." The first screen should
be the interview room:

- Chat and call controls are visible immediately.
- The workspace panel starts in a loading state.
- The workflow starts or attaches a code-server runner in the background.
- When the runner is healthy, the app shows "workspace ready" and opens the IDE
  in a side panel.
- The interviewer and candidate share the same room URL, with different roles.
- The candidate starts in a waiting room and cannot access workspace or video
  session credentials until the interviewer admits them.
- After admission, the candidate layout is workspace-first.
- The interviewer layout keeps admission, call/screen-share, chat, and workspace
  inspection visible at the same time.
- Every browser enters a display name. Multiple interviewers can use the same
  interviewer link but still show different names in chat and Zoom.
- Workspace/call/chat regions are resizable with lightweight browser-side split
  handles; no frontend framework is required for the POC.

In this design, code-server is an implementation detail. Users should not need
to know its password, tunnel URL, or startup logs.

## Simplest Single-Runner Architecture

Keep everything inside one GitHub Actions run:

- GitHub Actions builds one image.
- The container starts code-server on an internal port, such as
  `127.0.0.1:8081`.
- The same container starts a small interview app on `0.0.0.0:8080`.
- The interview app renders chat/video/workspace layout.
- The interview app reverse proxies `/ide/` to the internal code-server.
- Cloudflare Quick Tunnel exposes only the interview app on port `8080`.

This avoids a separate Vercel, VPS, or cloud deployment. All runtime state is
temporary and disappears when the GitHub Actions job ends.

The current POC uses a dependency-free Node HTTP app instead of Next.js. That
keeps the Docker build small and avoids an extra frontend build step. It can be
replaced by Next.js later if the UI grows.

Recommended GitHub Actions flow:

1. The interviewer manually starts the workflow, optionally setting a room
   password and session duration.
2. The workflow generates `interviewerToken` and `candidateToken`.
3. The workflow starts the interview container.
4. The workflow starts the Cloudflare tunnel.
5. The workflow prints two links in the run summary:
   - Interviewer link: can see controls and artifacts.
   - Candidate link: starts in a waiting room.
6. The interviewer opens the control room.
7. The candidate opens the waiting room.
8. The interviewer admits the candidate.
9. The candidate workspace opens as the primary surface. The interviewer sees
   the call/screen-share area as the primary observation surface.

This is the lowest-complexity path that still feels like an interview product.

## Code-Server Authentication

For the eventual product, code-server should not show its own password prompt.
There are two realistic ways to do that:

### Preferred: proxy-protected `--auth none`

- Run code-server with `--auth none`.
- Bind code-server to `127.0.0.1`, not `0.0.0.0`.
- Expose only the interview app through Cloudflare Tunnel.
- Route `/ide/` through the interview app's authenticated reverse proxy.
- Validate a room token or room password before proxying `/ide/`.

This gives the best UX: users authenticate once to the interview room, then the
IDE just opens.

Do not switch to `--auth none` if code-server itself is still the service being
exposed by Cloudflare Quick Tunnel.

### Simpler transition: hidden generated password

- Keep code-server password auth.
- The workflow generates the password.
- The interview app stores it in memory for the current Actions run.
- The app opens the IDE through a proxy that handles the password.

This is safer during migration, but it is more fragile and still leaves you
fighting code-server's login behavior.

Do not pass the code-server password in a URL query parameter. code-server's
documented auth model is the login form/cookie flow or external auth through a
reverse proxy. A URL password also leaks into browser history, logs, screenshots,
and referrers.

For a no-login MVP, generate room tokens and put them in the initial invite URL:

- `/room?token=<candidate-token>`
- `/room?token=<interviewer-token>`

On first load, the interview app should validate the token, set an HTTP-only
cookie, then remove the token from the address bar with `history.replaceState`.
That gives "click link and enter the room" UX without exposing code-server
directly.

## Same-Origin Portal Option

The cleanest browser behavior comes from a same-origin portal:

- Run code-server on an internal port, such as `127.0.0.1:8081`.
- Run the interview portal on the public port, such as `8080`.
- Render the room UI at `/`.
- Reverse proxy `/ide/` to code-server.
- Embed `/ide/` in the side panel.

This avoids most iframe and browser permission problems. The public page can
show:

- IDE iframe.
- Candidate/interviewer video tiles.
- Mic/camera/screen-share controls.
- Optional session timer and connection status.

Browsers can request camera, microphone, and screen-sharing permission from the
user. A web page cannot silently record a user's screen.

## Provider Comparison

Pricing changes often. The notes below reflect public docs checked in May 2026.
Re-check provider pricing pages before committing to a provider.

### Zoom Video SDK

Use this if call quality and meeting behavior matter most.

Pros:

- Strong fit for interview calls because Zoom is specialized in meetings.
- Web Video SDK supports custom video experiences.
- UI Toolkit can get a working call UI running quickly.
- Good operational tooling, QoS, recording, and mature meeting primitives.
- Current public Zoom page says the Build Platform starts with 20 free credits
  per month and measures Video SDK use as meeting session minutes.

Cons:

- Requires a Zoom Video SDK account.
- Requires server-side JWT generation.
- Zoom Video SDK sessions are separate from ordinary Zoom Meetings.
- More vendor-specific frontend and auth code.

Docs:

- https://www.zoom.com/en/video-sdk/
- https://developers.zoom.us/docs/video-sdk/
- https://developers.zoom.us/docs/video-sdk/web/ui-toolkit/

### Zoom Meeting SDK

Use this if you want to embed a real Zoom Meeting or Webinar experience.

Pros:

- Closest to standard Zoom meetings.
- Useful if interviewers already schedule meetings in Zoom.
- Meeting SDK web has client and component views.

Cons:

- Less flexible than Video SDK for a custom product UI.
- Iframe embedding is not the primary integration path; Zoom recommends using
  the Meeting SDK directly on the page where it runs.
- More of an embedded Zoom experience than a native interview app.

Docs:

- https://developers.zoom.us/docs/meeting-sdk/
- https://developers.zoom.us/blog/meeting-sdk-iframe/

### Cloudflare RealtimeKit

Use this if product flexibility and Cloudflare-native deployment matter most.

Pros:

- Programmable WebRTC video and voice.
- Prebuilt UI kits plus lower-level SDKs for custom UI.
- Fits well with Cloudflare Workers, Pages, Tunnel, and a future edge-hosted
  interview portal.
- More natural if the app already depends on Cloudflare for tunneling.
- RealtimeKit is currently in beta and documented as available at no cost during
  the beta period.
- Published GA pricing is lower than most video SDKs: audio/video participants
  at `$0.002/min`, audio-only at `$0.0005/min`, and recording/RTMP/HLS export at
  `$0.010/min`.

Cons:

- Newer product surface than Zoom's meeting stack.
- You still need backend API integration to create meetings and participants.
- More responsibility for product details like roles, lobby, recording UX, and
  interview-specific controls.

Docs:

- https://developers.cloudflare.com/realtime/realtimekit/
- https://developers.cloudflare.com/realtime/realtimekit/pricing/
- https://docs.realtime.cloudflare.com/

### LiveKit Cloud or Self-Hosted LiveKit

Use this if open source, self-hosting, or future AI participant features matter.

Pros:

- Open-source SFU with a hosted cloud option.
- Strong SDK coverage and custom UI control.
- Good long-term fit for programmable voice/video/data and AI agents.
- Can self-host later if cost or control becomes important.
- Cloud Build plan is currently `$0/mo`.
- Published Build plan includes `5,000` WebRTC minutes, `100` concurrent
  connections, and `50GB` downstream data transfer.
- Self-hosting remains available if cloud pricing or control becomes a concern.

Cons:

- More infrastructure and product ownership than Zoom.
- The default meeting polish is on you unless you start from a template.

Docs:

- https://livekit.com/pricing
- https://docs.livekit.io/intro/about
- https://docs.livekit.io/intro/basics/connect/

### Daily

Use this if the goal is the fastest embedded-call MVP.

Pros:

- Daily Prebuilt is quick to embed.
- Custom SDK path exists when the product needs more control.
- Good fit for a fast prototype with fewer meeting-specific decisions.

Cons:

- Another external platform to operate and pay for.
- Less aligned with the existing Cloudflare tunnel stack.

Docs:

- https://docs.daily.co/get-started
- https://docs.daily.co/guides/products/client-sdk

## Practical Recommendation

For this repository, the best next step is:

1. Add the interview portal and same-origin `/ide/` reverse proxy.
2. Start with Zoom Video SDK UI Toolkit if the first priority is stable meeting
   quality and a familiar call experience.
3. Start with Cloudflare RealtimeKit if the first priority is deep UI
   customization and keeping the stack Cloudflare-native.
4. Consider LiveKit if the product should remain portable or self-hostable.

Do not start with raw WebRTC. The hard parts are NAT traversal, reconnects,
bandwidth adaptation, device handling, screenshare edge cases, recording, and
quality monitoring. A provider SDK is the right abstraction for this product.
