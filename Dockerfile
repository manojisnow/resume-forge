# Debian Chromium supports both amd64 and arm64 (including Apple Silicon).
FROM node:24-trixie-slim AS frontend
WORKDIR /build
COPY client/package*.json ./client/
RUN npm ci --prefix client
COPY client/ ./client/
COPY shared/ ./shared/
RUN npm run build --prefix client

FROM node:24-trixie-slim AS runtime
ENV NODE_ENV=production PUPPETEER_SKIP_DOWNLOAD=true
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-dejavu-core ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package*.json ./server/
RUN npm ci --omit=dev --prefix server && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY server/index.js server/ai.cjs server/pdf.cjs server/read-pdf.cjs ./server/
COPY shared/ ./shared/
COPY --from=frontend /build/client/dist ./client/dist/
COPY LICENSE ./LICENSE
ENV HOST=0.0.0.0 PORT=8080 SERVE_CLIENT=true \
    AI_PROVIDER=ollama OLLAMA_BASE_URL=http://host.docker.internal:11434/v1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080 \
    HOME=/tmp
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
