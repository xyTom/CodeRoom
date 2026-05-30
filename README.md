# CodeRoom

This repository starts a temporary browser interview room from GitHub Actions.

It is a minimal proof of concept for a HackerRank-style interview session:

- GitHub Actions builds the Docker image.
- The Docker container runs a small interview web app and an internal
  `code-server` workspace in the runner.
- Cloudflare Quick Tunnel exposes the interview room as a temporary HTTPS URL.
- When the workflow ends, the edited workspace and logs are uploaded as an artifact.

## Start an interview

1. Push this repository to GitHub.
2. Open the repository on GitHub.
3. Go to **Actions**.
4. Run **Interview Room** manually.
5. Set `duration_minutes`, optionally set a room `password`, then start the workflow.
6. Open the workflow run summary and copy the generated interviewer and
   candidate URLs.

The candidate opens the candidate URL in a browser. The interviewer opens the
interviewer URL. Each participant enters a display name before joining the room.

The interviewer and candidate see different room layouts:

- Candidate URL opens a waiting room first. After the interviewer admits the
  candidate, the workspace becomes the primary full-page surface.
- Interviewer URL opens a control room with candidate admission, call controls,
  chat, and a smaller workspace inspection panel.
- Main panels can be resized in the browser by dragging the split handles.

The room includes chat, an optional Zoom Video SDK call, and the shared
workspace. The workspace is served by code-server behind the interview app, so
users do not need to type a separate code-server password.

## Customize the interview

Put the starter files, prompt, and tests in `workspace/`.

The current image includes:

- Python 3
- Node.js and npm
- Java default JDK
- git, curl, jq
- basic C/C++ build tools
- AI coding CLIs:
  - Codex CLI: `codex`
  - Claude Code: `claude`
  - Gemini CLI: `gemini`

AI coding CLIs are installed in the image, but authentication is not baked into
the container. Sign in or provide provider API keys inside each interview
session as needed.

To provide AI credentials automatically, add repository secrets and enable
`enable_ai_credentials` when starting the workflow. Supported secrets and
variables:

- `CODEX_ACCESS_TOKEN`: preferred for Codex CLI when using ChatGPT Business or
  Enterprise access tokens.
- `CODEX_AUTH_JSON`: advanced Codex CLI fallback. Store the full contents of a
  pre-existing `~/.codex/auth.json` file.
- `OPENAI_API_KEY`: fallback for Codex CLI API-key auth.
- `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`: Claude Code credentials.
- `GEMINI_API_KEY` or `GOOGLE_API_KEY`: Gemini CLI credentials.
- `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_GENAI_USE_VERTEXAI`:
  optional repository variables for Gemini Vertex AI mode.

Only enable shared AI credentials for trusted interview sessions. Anyone with
terminal access inside the IDE can read environment variables passed to the
container.

Add more packages in `Dockerfile` if a role needs a different runtime.

## Zoom Video SDK

Zoom is optional. Without Zoom credentials, the interview room still starts and
the workspace still works.

To enable Zoom Video SDK for the POC, add these repository secrets:

- `ZOOM_VIDEO_SDK_KEY`
- `ZOOM_VIDEO_SDK_SECRET`

Optional repository variable:

- `ZOOM_UI_TOOLKIT_VERSION`: defaults to `2.2.0-2`.

The app generates Video SDK JWTs server-side inside the GitHub Actions runner.
The Zoom secret is never sent to the browser. The display name entered in the
room is passed to Zoom as the participant `userName`.

## Architecture Notes

For the single-runner design, provider comparison, and later collaboration
options, see `docs/collaboration-options.md`.

## Important limits

- A GitHub-hosted runner job can run for at most 6 hours.
- This workflow caps `duration_minutes` at 330 minutes to leave time for cleanup.
- Cloudflare Quick Tunnel URLs are temporary and change every run.
- This is not a production-grade interview platform. It is a cheap PoC.

For a real product, keep the browser editor and collaboration layer in your own app, and use containers only as isolated execution sandboxes.
