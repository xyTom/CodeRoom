#!/usr/bin/env bash
set -euo pipefail

login_codex() {
  if ! command -v codex >/dev/null 2>&1; then
    return 0
  fi

  mkdir -p "$HOME/.codex"
  if [ ! -f "$HOME/.codex/config.toml" ]; then
    printf '%s\n' 'cli_auth_credentials_store = "file"' > "$HOME/.codex/config.toml"
  fi

  if [ -n "${CODEX_ACCESS_TOKEN:-}" ]; then
    if printf '%s' "$CODEX_ACCESS_TOKEN" | timeout 30s codex login --with-access-token >/tmp/codex-login.log 2>&1; then
      echo "Codex CLI authenticated with CODEX_ACCESS_TOKEN."
    else
      echo "Codex CLI access-token login failed; check CODEX_ACCESS_TOKEN or run codex login manually." >&2
    fi
    return 0
  fi

  if [ -n "${CODEX_AUTH_JSON:-}" ]; then
    printf '%s' "$CODEX_AUTH_JSON" > "$HOME/.codex/auth.json"
    chmod 600 "$HOME/.codex/auth.json"
    echo "Codex CLI auth.json installed from CODEX_AUTH_JSON."
    return 0
  fi

  if [ -n "${OPENAI_API_KEY:-}" ]; then
    if printf '%s' "$OPENAI_API_KEY" | timeout 30s codex login --with-api-key >/tmp/codex-login.log 2>&1; then
      echo "Codex CLI authenticated with OPENAI_API_KEY."
    else
      echo "Codex CLI will still receive OPENAI_API_KEY from the environment; run codex login manually if needed." >&2
    fi
  fi
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 16
  else
    node -e 'console.log(require("crypto").randomBytes(16).toString("hex"))'
  fi
}

export NODE_ENV="${NODE_ENV:-production}"
export INTERVIEW_APP_HOST="${INTERVIEW_APP_HOST:-0.0.0.0}"
export INTERVIEW_APP_PORT="${INTERVIEW_APP_PORT:-8080}"
export IDE_INTERNAL_HOST="${IDE_INTERNAL_HOST:-127.0.0.1}"
export IDE_INTERNAL_PORT="${IDE_INTERNAL_PORT:-8081}"
export ROOM_PASSWORD="${ROOM_PASSWORD:-$(random_hex)}"
export INTERVIEWER_TOKEN="${INTERVIEWER_TOKEN:-$(random_hex)}"
export CANDIDATE_TOKEN="${CANDIDATE_TOKEN:-$(random_hex)}"
export INTERVIEW_SESSION_NAME="${INTERVIEW_SESSION_NAME:-coderoom-$(date +%s)}"
export VSCODE_PROXY_URI="${VSCODE_PROXY_URI:-./proxy/{{port}}}"

login_codex

code-server \
  --bind-addr "${IDE_INTERNAL_HOST}:${IDE_INTERNAL_PORT}" \
  --auth "none" \
  "/home/coder/project" &
code_server_pid="$!"

node /opt/coderoom/app/interview-server.mjs &
app_pid="$!"

cleanup() {
  kill "$code_server_pid" "$app_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

wait -n "$code_server_pid" "$app_pid"
exit_code="$?"
cleanup
exit "$exit_code"
