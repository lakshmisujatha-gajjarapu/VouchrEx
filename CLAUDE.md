# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vouchrex** — a P2P voucher/coupon resale marketplace for India. Yarn monorepo with a NestJS API, an Expo React Native consumer app, a Next.js admin console, and a worker placeholder. Designed as a modular monolith (Phase 1) intended to evolve toward microservices.

## Common Commands

All commands can be run from the repo root.

### Development

```bash
make infra-up       # Start PostgreSQL, Redis, MinIO via Docker
make api-dev        # NestJS with hot reload (port 3010)
make mobile-dev     # Expo dev server
make admin-dev      # Next.js admin console (port 3011)
make migrate        # Prisma interactive migration (dev)
make migrate-deploy # Apply checked-in migrations (prod-style)
make push           # Push Prisma schema without creating a migration
make seed           # Load starter brand catalog
make studio         # Prisma Studio at localhost:5555
```

### CI / Quality

```bash
make check          # lint + typecheck + test (full pre-commit suite)
make lint           # ESLint across all workspaces
make typecheck      # tsc --noEmit across all workspaces
make test           # Node.js built-in test runner (API only)
```

### Workspace-specific

Workspace names are `vouchrex-api`, `vouchrex-mobile`, `vouchrex-admin`, `vouchrex-worker`.

```bash
# API
yarn workspace vouchrex-api build         # Compile TS + Prisma generate
yarn workspace vouchrex-api test          # Run *.test.ts files via tsx
yarn workspace vouchrex-api typecheck

# Mobile
yarn workspace vouchrex-mobile start      # Expo (pick platform interactively)
yarn workspace vouchrex-mobile typecheck
yarn workspace vouchrex-mobile build      # expo export --platform web

# Admin
yarn workspace vouchrex-admin dev         # Next.js dev (port 3011)
yarn workspace vouchrex-admin build
yarn workspace vouchrex-admin typecheck
yarn workspace vouchrex-admin lint

# Prisma
yarn workspace vouchrex-api prisma:migrate:dev
yarn workspace vouchrex-api prisma:migrate:deploy
yarn workspace vouchrex-api prisma:seed
```

## Architecture

### Workspace layout

```
apps/
  api/      NestJS backend — port 3010
  mobile/   Expo Router React Native app
  admin/    Next.js admin console — port 3011
  worker/   Placeholder for Phase 2+ async jobs
HLD/        High-level design docs across phases
docs/       Standards, plans, runbooks
```

### API (`apps/api`)

Modular NestJS monolith. Each domain is an independent module under `src/modules/`:

| Module | Responsibility |
|---|---|
| `auth` | OTP request/verify, session token issuance (`x-session-token`) |
| `listings` | Voucher listings CRUD, search/filter, CodeVault encryption |
| `orders` | Order lifecycle: INITIATED → CONFIRMED/DISPUTED, escrow timer, dispute resolution, reconciliation |
| `payments` | Razorpay integration, payment signature verification |
| `payouts` | Seller payout accounts and payout retry flow |
| `brands` | Brand catalog, metadata, seeding |
| `notifications` | In-app/SMS/push event records |
| `realtime` | Socket.IO gateway for live order/listing/notification events |
| `push` | Expo push token registry + push dispatcher |
| `webhooks` | Inbound webhook handlers (e.g. payment provider) |
| `users` | User CRUD (internal/admin in Phase 1) |
| `admin` | Manual ops — requires `x-admin-token` header |
| `health` | Liveness/readiness endpoints |
| `prisma` | DB connection singleton |

Swagger UI lives at `GET /docs`. JSON schema at `GET /docs/json`.

**Authentication headers**:
- User requests: `x-session-token`
- Admin endpoints: `x-admin-token`

**Key flows**:
1. OTP auth → session token → all subsequent requests
2. Listing created → code encrypted (AES-256-GCM) in CodeVault
3. Order created → Razorpay checkout prepared → payment verified → escrow active → reveal returns watermarked SVG → auto-confirm timer or dispute
4. Server-side state changes fan out via `realtime` gateway and `push` dispatcher

### Mobile (`apps/mobile`)

Expo Router file-based routing under `src/app/`:

- `index.tsx` / `sign-in.tsx` — OTP sign-in
- `(tabs)/` — Bottom tabs: `shop`, `listings`, `sell`, `orders`, `inbox`
- `listings/[id].tsx` — Listing detail + buy action; `listings/edit/[id].tsx` — edit
- `orders/[id].tsx` — Order detail, reveal, confirm, dispute
- `profile.tsx` / `edit-profile.tsx` / `terms.tsx`

Shared infrastructure:
- `src/lib/api.ts` — HTTP client (base URL from `EXPO_PUBLIC_API_BASE_URL` or platform default)
- `src/lib/storage.ts` — SecureStore wrapper for session token
- `src/lib/routes/*` — typed API route helpers per domain
- `src/hooks/use-auth.tsx` — AuthContext (session, current user, logout)
- `src/hooks/use-*-socket.*` — realtime subscriptions (orders, listings, notifications, push registrar)
- `src/theme/theme-context.tsx` + `tokens.ts` — light/dark theme via `useTheme()` (Unistyles was removed)

### Admin (`apps/admin`)

Next.js App Router console for ops. Pages under `app/<domain>/page.tsx` render a server-side wrapper and a client `*-view.tsx` component. Authenticated calls go through Next.js route handlers under `app/api/*` which proxy to the NestJS API with the admin token. `components/realtime-bridge.tsx` wires the admin UI into the API's realtime gateway.

### Database (Prisma + PostgreSQL 16)

Schema at `apps/api/prisma/schema.prisma`. Key models: `User`, `Brand`, `VoucherListing`, `CodeVault`, `Order`, `Payment`, `Dispute`, `OtpChallenge`, `UserSession`, `Notification`, `AuditLog`, plus payout/push/team-member models added in later phases.

Local DB runs on port **5434** (not 5432) to avoid conflicts.

### Infrastructure

| Service | Local port |
|---|---|
| PostgreSQL 16 | 5434 |
| Redis 7 | 6380 |
| MinIO (S3) | 9000 / 9001 |
| NestJS API | 3010 |
| Next.js admin | 3011 |

Docker Compose manages backing services. `make reset-infra` destroys volumes (destructive).

### Environment

Copy `.env.example` → `.env` at repo root. Required non-defaulted variables:
- `CODE_ENCRYPTION_KEY` — AES-256 key for voucher code vault
- `ADMIN_API_TOKEN` — for admin endpoints
- `OTP_PROVIDER=DEV` uses fixed OTP `123456` locally

## Linting & TypeScript

- ESLint flat config (`eslint.config.mjs`) — strict TypeScript rules including `no-floating-promises` and `consistent-type-imports`
- `apps/api/test/**` is excluded from ESLint (test mocks rely on `any` typings)
- NestJS `*.module.ts` files have `no-extraneous-class` disabled
- Base `tsconfig.base.json` at root; each app extends it

## Testing

API tests use Node.js built-in test runner via `tsx` (`node --import tsx --test`). Test files are `apps/api/test/**/*.test.ts` and import directly from `src/`. Tests are excluded from the main `tsc --noEmit` (mocks use `any`); their TS imports are resolved at runtime by tsx. There are no mobile or admin tests in Phase 1.

## File Naming Conventions

Across `apps/mobile` and `apps/admin`:

- **Filenames are kebab-case** — `stat-card.tsx`, `theme-context.tsx`, `disputes-view.tsx`.
- **Exported React components stay PascalCase** — `stat-card.tsx` exports `StatCard`.
- **Hooks files** are `use-*.ts(x)` and export the `useThing` identifier.
- API files follow NestJS convention: `<name>.<role>.ts` (e.g. `orders.service.ts`, `realtime.gateway.ts`).

## Mobile Coding Standards

Full standards are in `docs/mobile-coding-standards.md`. Key rules enforced on every file:

- **No hardcoded colors** — always `theme.colors.*`. Add missing colors to `tokens.ts` first.
- **No hardcoded spacing** — always `theme.spacing[N]`.
- **No hardcoded border radius** — always `theme.radius.*`.
- **No hardcoded font families** — always `theme.fontFamily.*`.
- **No hardcoded gradients** — always `theme.gradients.*`.
- **No dark-mode branching on colors** — `colorScheme === 'dark' ? ... : ...` is banned for style values; theme tokens already handle it. Only exception: BlurView `tint` prop.
- **No module-level design constants** — color/gradient constants belong in `tokens.ts`, not at the top of screen files.
- **No floating promises** — use `void` or `await`.
- **All component props are `readonly`**.
- **Shared status/label helpers** go in `src/lib/status.ts`, not inlined per-screen.

## Phase 1 Scope

Implemented: OTP auth, listings + CodeVault, order lifecycle with escrow, Razorpay checkout (web flow), disputes, realtime gateway, push dispatcher, admin console, payouts, refund/payout retry.

Not yet implemented (schema/stubs may exist): full KYC, fraud scoring, Razorpay native SDK in mobile, full webhook delivery pipeline, dedicated worker for async jobs.
