FROM ghcr.io/coder/code-server:latest

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        git \
        jq \
        nodejs \
        npm \
        default-jdk \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g \
        @openai/codex \
        @anthropic-ai/claude-code \
        @google/gemini-cli \
    && npm cache clean --force

USER coder
WORKDIR /home/coder/project

COPY --chown=coder:coder workspace/ /home/coder/project/

EXPOSE 8080

CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "password", "/home/coder/project"]
