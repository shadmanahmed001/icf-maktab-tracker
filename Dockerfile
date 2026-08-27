# Multi-stage build for the ICF Maktab Tracker.
#
# The database engine is WebAssembly SQLite (sql.js), so there is no native
# module to compile and no build toolchain in the runtime image.

# ── Stage 1: build the client ────────────────────────────────────────────────
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/maktab.db

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

# The database is a single file; this volume is the only thing to back up.
# The directory must belong to the unprivileged user that runs the process, or
# the first write fails with EACCES — the image creates it as root otherwise,
# and Docker carries that ownership onto a fresh named volume.
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME /app/data

# Run unprivileged.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
