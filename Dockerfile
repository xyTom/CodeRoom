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

COPY app/package*.json /opt/coderoom/app/
WORKDIR /opt/coderoom/app
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY app/ /opt/coderoom/app/
RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force

COPY scripts/start-interview-ide.sh /usr/local/bin/start-interview-ide
RUN chmod +x /usr/local/bin/start-interview-ide

USER coder
WORKDIR /home/coder/project

COPY --chown=coder:coder workspace/ /home/coder/project/

EXPOSE 8080

ENTRYPOINT []
CMD ["start-interview-ide"]
