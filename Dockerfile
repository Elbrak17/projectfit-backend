# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────
# Stage 1 — build: typecheck + compile TypeScript → dist/
# ─────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first so this layer is cached across code changes.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the sources, then typecheck + compile + run the test suite.
COPY tsconfig.json ./
COPY src ./src
RUN npm run typecheck && npm test

# ─────────────────────────────────────────────────────────
# Stage 2 — runtime: production deps only, no toolchain
# ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

# Run as the unprivileged built-in user.
RUN addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

WORKDIR /app

# Production dependencies only.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled output from the build stage.
COPY --from=build /app/dist ./dist

USER app
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "dist/server.js"]
