# ── Stage 1: build Expo web export ───────────────────────────────────────────
FROM node:24-alpine AS builder

# Baked into the JS bundle at build time — pass via --build-arg in CI
ARG EXPO_PUBLIC_API_BASE_URL
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL

WORKDIR /app
RUN corepack enable

# Manifests first — cached unless deps change
COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json ./
COPY .yarn/releases .yarn/releases
COPY apps/api/package.json    apps/api/package.json
COPY apps/admin/package.json  apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN yarn install --immutable

COPY apps/mobile ./apps/mobile

RUN yarn workspace vouchrex-mobile build

# ── Stage 2: serve static output via nginx ────────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html
COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
