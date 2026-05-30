# CodeRoom

This repository starts a temporary browser coding environment from GitHub Actions.

It is a minimal proof of concept for a HackerRank-style interview session:

- GitHub Actions builds the Docker image.
- The Docker container runs `code-server` in the runner.
- Cloudflare Quick Tunnel exposes the IDE as a temporary HTTPS URL.
- When the workflow ends, the edited workspace and logs are uploaded as an artifact.

## Start an interview

1. Push this repository to GitHub.
2. Open the repository on GitHub.
3. Go to **Actions**.
4. Run **Interview IDE** manually.
5. Set `duration_minutes`, optionally set `password`, then start the workflow.
6. Open the workflow run summary and copy the generated URL and password.

The candidate opens the URL in a browser and codes inside the `workspace` directory.

The interviewer can open the same URL and password to inspect the same remote IDE session. This is shared access to one browser IDE workspace, not a full collaborative editor with presence, cursor sharing, or conflict handling.

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

Add more packages in `Dockerfile` if a role needs a different runtime.

## Important limits

- A GitHub-hosted runner job can run for at most 6 hours.
- This workflow caps `duration_minutes` at 330 minutes to leave time for cleanup.
- Cloudflare Quick Tunnel URLs are temporary and change every run.
- This is not a production-grade interview platform. It is a cheap PoC.

For a real product, keep the browser editor and collaboration layer in your own app, and use containers only as isolated execution sandboxes.
