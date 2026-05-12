# ── Stage 1: install deps + compile ──────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app
RUN corepack enable

# Copy manifests first — cached unless deps change
COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json ./
COPY .yarn/releases .yarn/releases
COPY apps/api/package.json    apps/api/package.json
COPY apps/admin/package.json  apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN yarn install --immutable

# Copy source and build (prisma generate + tsc)
COPY apps/api ./apps/api
RUN yarn workspace vouchrex-api build

# ── Stage 2: lean runtime image ───────────────────────────────────────────────
FROM node:24-alpine AS runtime

# Non-root user — never run as root in production
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Yarn runtime (needed for module resolution with node-modules linker)
RUN corepack enable

# node_modules from builder — includes @prisma/client with the correct
# Alpine query-engine binary generated during `prisma generate`
COPY --from=builder /app/node_modules         ./node_modules

# Compiled API output only — no TypeScript source
COPY --from=builder /app/apps/api/dist        ./apps/api/dist

# Precompiled prisma config for the container (prisma.config.ts is dev-only with dotenv)
COPY apps/api/prisma.config.js                          ./apps/api/prisma.config.js

# Prisma schema — needed if you run `prisma migrate deploy` inside this image
COPY apps/api/prisma                          ./apps/api/prisma

# Workspace manifests — needed for @prisma/client module resolution path
COPY --from=builder /app/package.json         ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 3010

USER app
WORKDIR /app/apps/api

CMD ["sh", "-c", "node /app/node_modules/.bin/prisma migrate deploy && node dist/main.js"]
