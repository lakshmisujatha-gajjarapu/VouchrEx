# ── Stage 1: install deps + build ────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app
RUN corepack enable

# Workspace manifests first — cached unless deps change
COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json ./
COPY .yarn/releases .yarn/releases
COPY apps/api/package.json    apps/api/package.json
COPY apps/admin/package.json  apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN yarn install --immutable

# Copy admin source and build (Next.js standalone output)
COPY apps/admin ./apps/admin
RUN yarn workspace vouchrex-admin build

# ── Stage 2: lean runtime image ──────────────────────────────────────────────
FROM node:24-alpine AS runtime

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3011
ENV HOSTNAME=0.0.0.0

# Next.js standalone output: server.js + minimal node_modules
COPY --from=builder --chown=app:app /app/apps/admin/.next/standalone        ./
COPY --from=builder --chown=app:app /app/apps/admin/.next/static            ./apps/admin/.next/static
COPY --from=builder --chown=app:app /app/apps/admin/public                  ./apps/admin/public

EXPOSE 3011

USER app

CMD ["node", "apps/admin/server.js"]
