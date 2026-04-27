# Vouchrex

Phase 1 backend and mobile app foundation for the Vouchrex voucher resale marketplace.

## Current scope

- NestJS API in `apps/api`
- Expo Router React Native app in `apps/mobile`
- PostgreSQL schema with Prisma
- Phase 1 flows for OTP auth, session login, brands, listings, browse/search, orders, escrow timers, disputes, and notification records
- Placeholder worker in `apps/worker`
- Local infrastructure via `docker-compose.yml`

## Stack

- Node.js 22.21.1 via `.nvmrc`
- Yarn 4 workspaces
- NestJS
- Expo / React Native
- Prisma
- Swagger / OpenAPI
- PostgreSQL
- Redis
- MinIO
- Razorpay orders + signature verification

## Run

1. Copy `.env.example` to `.env`.
2. Run `nvm use` to load Node 22.21.1 from `.nvmrc`.
3. Run `corepack enable`.
4. Install dependencies with `yarn install` or `make install`.
5. Start infrastructure with `make infra-up`.
6. The initial Prisma migration baseline lives in `apps/api/prisma/migrations/202603160001_init`.
7. Apply it with `make migrate` or `make migrate-deploy`.
8. Optionally seed starter brands with `make seed` if you want an initial catalog, but it is no longer required.
9. Start the API directly with `make api-dev` or run the full stack with `make up`.
10. Start the mobile app with `make mobile-dev` or `yarn mobile:start`.
11. Open Swagger UI at `http://localhost:3010/docs` or fetch the OpenAPI JSON from `http://localhost:3010/docs/json`.

## Mobile app

- The Expo app lives in `apps/mobile`.
- Copy `apps/mobile/.env.example` to `apps/mobile/.env` if you want to override the API base URL for a physical device.
- Set `EXPO_PUBLIC_BRANDFETCH_CLIENT_ID` in `apps/mobile/.env` if you want live Brandfetch autocomplete in the Sell and Listings flows.
- Without that override, the app falls back to `http://localhost:3010` on iOS/web and `http://10.0.2.2:3010` on Android emulator.
- Implemented Phase 1 screens: OTP sign-in, Bazaar browse/search, listing detail, Sell creation flow, dedicated Listings tab with seller CRUD, Orders, Inbox, and order actions for prepare checkout, reveal, confirm, and dispute.
- Current mobile caveat: Razorpay order preparation is wired, but the native Razorpay checkout SDK is not yet integrated in the Expo app. The app surfaces the prepared Razorpay order and fully supports the mock payment path for local flow testing.

## Make Targets

- `make help` lists the available shortcuts.
- `make clean` removes workspace build artifacts and the local Expo cache.
- `make check` runs lint, typecheck, and tests.
- `make reset-infra` is destructive and removes this project's compose volumes.

## API highlights

- `POST /auth/otp/request` creates a login OTP challenge.
- `POST /auth/otp/verify` returns the `x-session-token` used for seller/buyer actions.
- `GET /brands` now supports optional `q` and `limit` for local brand suggestions.
- `GET /listings` supports search, category, discount, max-price, and sort filters.
- `GET /listings/mine` returns the signed-in seller's inventory for listing management.
- `POST /listings` accepts free-text `brandName` and reuses or creates a local brand record automatically.
- `PATCH /listings/:id` updates a seller-owned listing before an order exists.
- `DELETE /listings/:id` removes a seller-owned listing before an order exists.
- `GET /orders` and `GET /orders/:id` are now scoped to the signed-in buyer or seller.
- `POST /orders` creates a pending escrow order and prepares checkout.
- `POST /orders/:id/payments/verify` verifies Razorpay signatures and activates escrow.
- `POST /orders/:id/reveal` returns a watermarked SVG data URL instead of a raw code string.
- `POST /orders/disputes/:id/resolve` and the optional `POST /brands/seed` bootstrap endpoint require `x-admin-token`.
- `GET /notifications` exposes push-ready/in-app notification records for the signed-in user.

## Notes

- This implementation follows Phase 1 from the HLD, not the full KYC and advanced fraud platform.
- Trust scores/tiers remain in the schema for future phases but are not surfaced in Phase 1 user flows.
- Voucher codes are encrypted before storage and deduplicated by SHA-256 hash.
- Local brand search comes from the app database; Brandfetch is only an optional live suggestion source and does not block listing creation.
- `CODE_ENCRYPTION_KEY` is required; the API no longer falls back to a shared default secret.
- Local development uses a fixed OTP of `123456` through `OTP_PROVIDER=DEV`.
- Local direct development uses this project's own Postgres on `localhost:5434` and Redis on `localhost:6380`.
- Production should switch to `OTP_PROVIDER=MSG91_WIDGET` with appropriate MSG91 API credentials.
- Production rejects `OTP_PROVIDER=DEV` and `PAYMENT_PROVIDER=MOCK`.
- `PAYMENT_PROVIDER` must be explicit in production; local dev still defaults to `MOCK`.
- `ADMIN_API_TOKEN` is the minimal manual control for Phase 1 dispute resolution and catalog bootstrap.
- This repo is a Yarn monorepo; use `yarn install` at the root and avoid `npm install` inside subdirectories.
- The repo now includes a small service-level test suite runnable with `yarn test`.
- The root `Makefile` is the preferred way to run common local-dev flows.
