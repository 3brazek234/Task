# syntax=docker/dockerfile:1

# ── Stage 1: base – shared runtime layer ──────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
# dumb-init runs as PID 1 and forwards signals so graceful shutdown works
RUN apk add --no-cache dumb-init

# ── Stage 2: ci – full dev deps, lint (docker build --target ci .) ───────────
# Not built by `docker-compose up`: BuildKit only builds stages the target needs.
FROM base AS ci
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run lint

# ── Stage 3: production – runtime deps only, non-root ─────────────────────────
FROM base AS production
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Only what the app needs at runtime
COPY --chown=node:node knexfile.js ./
COPY --chown=node:node src ./src

# Built-in unprivileged user from the official image
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
# Migrations + idempotent seed, then exec so node receives signals directly
CMD ["sh", "-c", "node_modules/.bin/knex migrate:latest && node_modules/.bin/knex seed:run && exec node src/server.js"]
