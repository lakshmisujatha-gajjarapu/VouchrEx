# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vouchrex** — a P2P voucher/coupon resale marketplace for India. Yarn monorepo with a NestJS API, Expo React Native mobile app, and a worker placeholder. Designed as a modular monolith (Phase 1) intended to evolve toward microservices.

## Common Commands

All commands can be run from the repo root.

### Development

```bash
make infra-up       # Start PostgreSQL, Redis, MinIO via Docker
make api-dev        # NestJS with hot reload (port 3010)
make mobile-dev     # Expo dev server
make migrate        # Prisma interactive migration (dev)
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

```bash
# API
yarn workspace @cb/api build         # Compile TS + Prisma generate
yarn workspace @cb/api test          # Run *.test.cjs files
yarn workspace @cb/api typecheck

# Mobile
yarn workspace @cb/mobile start      # Expo (pick platform interactively)
yarn workspace @cb/mobile typecheck
yarn workspace @cb/mobile build      # expo export --platform web

# Prisma
yarn workspace @cb/api prisma:migrate:dev
yarn workspace @cb/api prisma:migrate:deploy
yarn workspace @cb/api prisma:seed
```

## Architecture

### Workspace layout

```
apps/
  api/      NestJS backend — port 3010
  mobile/   Expo Router React Native app
  worker/   Placeholder for Phase 2+ async jobs
HLD/        24-doc high-level design for all phases
```

### API (`apps/api`)

Modular NestJS monolith. Each domain is an independent module under `src/modules/`:

| Module | Responsibility |
|---|---|
| `auth` | OTP request/verify, session token issuance (`x-session-token`) |
| `listings` | Voucher listings CRUD, search/filter, CodeVault encryption |
| `orders` | Order lifecycle: INITIATED → CONFIRMED/DISPUTED, escrow timer |
| `payments` | Razorpay integration, payment signature verification |
| `brands` | Brand catalog, metadata, seeding |
| `notifications` | Records in-app/SMS/push events (delivery is placeholder) |
| `users` | User CRUD (internal only in Phase 1) |
| `admin` | Manual ops — requires `x-admin-token` header |
| `prisma` | DB connection singleton |

Swagger UI lives at `GET /docs`. JSON schema at `GET /docs/json`.

**Authentication headers**:
- User requests: `x-session-token`
- Admin endpoints: `x-admin-token`

**Key flows**:
1. OTP auth → session token → all subsequent requests
2. Listing created → code encrypted (AES-256-GCM) in CodeVault
3. Order created → Razorpay checkout prepared → payment verified → escrow active → reveal returns watermarked SVG → auto-confirm timer or dispute

### Mobile (`apps/mobile`)

Expo Router file-based routing under `src/app/`:

- `index.tsx` / `sign-in.tsx` — OTP sign-in
- `(tabs)/` — Bottom tabs: Bazaar, Sell, Orders, Inbox
- `listings/[id].tsx` — Listing detail + buy action
- `orders/[id].tsx` — Order detail, reveal, confirm, dispute

Shared infrastructure:
- `src/lib/api.ts` — HTTP client (base URL from `EXPO_PUBLIC_API_URL` or platform default)
- `src/lib/storage.ts` — SecureStore wrapper for session token
- `src/hooks/use-auth.tsx` — AuthContext (session, current user, logout)
- `src/theme/` — Unistyles config with light/dark tokens

### Database (Prisma + PostgreSQL 16)

Schema at `apps/api/prisma/schema.prisma`. Key models: `User`, `Brand`, `VoucherListing`, `CodeVault`, `Order`, `Payment`, `Dispute`, `OtpChallenge`, `UserSession`, `Notification`, `AuditLog`.

Local DB runs on port **5434** (not 5432) to avoid conflicts.

### Infrastructure

| Service | Local port |
|---|---|
| PostgreSQL 16 | 5434 |
| Redis 7 | 6380 |
| MinIO (S3) | 9000 / 9001 |
| NestJS API | 3010 |

Docker Compose manages all services. `make reset-infra` destroys volumes (destructive).

### Environment

Copy `.env.example` → `.env` at repo root. Required non-defaulted variables:
- `CODE_ENCRYPTION_KEY` — AES-256 key for voucher code vault
- `ADMIN_API_TOKEN` — for admin endpoints
- `OTP_PROVIDER=DEV` uses fixed OTP `123456` locally

## Linting & TypeScript

- ESLint flat config (`eslint.config.mjs`) — strict TypeScript rules including `no-floating-promises` and `consistent-type-imports`
- `.cjs` test files are excluded from ESLint
- NestJS `*.module.ts` files have `no-extraneous-class` disabled
- Base `tsconfig.base.json` at root; each app extends it

## Testing

API tests use Node.js built-in test runner. Test files are `apps/api/test/**/*.test.cjs`. There are no mobile tests in Phase 1.

## Phase 1 Scope

Not yet implemented (schema/stubs exist): full KYC, fraud scoring, Razorpay native SDK in mobile, webhook delivery, worker async jobs.
