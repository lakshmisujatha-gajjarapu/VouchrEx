# Handoff

## Current status

- Phase 1 backend is implemented in `apps/api`.
- Phase 1 React Native app foundation is implemented in `apps/mobile` using Expo Router.
- Core domain flows implemented: OTP auth + sessions, local brand index with optional bootstrap catalog, listings, browse/search, Razorpay-ready checkout, escrow activation, watermarked reveal, disputes, notifications, auto-confirm.
- Mobile screens implemented: OTP auth, Bazaar browse/search, listing detail, Sell flow, dedicated Listings tab with create/edit/delete, Orders, Inbox, and order detail actions.
- OTP now uses a fixed `123456` code in local dev and has an Exotel production path behind env config.
- Order reads are now scoped to the signed-in buyer/seller, and manual dispute resolution uses `x-admin-token`.
- Public user CRUD is no longer mounted in the API app.
- Trust score/tier fields are no longer exposed in Phase 1 API/mobile flows.
- Root `.env` is now loaded by both Nest and Prisma for direct local dev commands.
- Prisma migration baseline is checked in under `apps/api/prisma/migrations/202603160001_init`.
- Root `Makefile` now wraps the common local dev flows.
- Root tooling is now normalized around Yarn 4 workspaces; `npm` lockfiles are disabled and Docker builds install from the repo root.
- Listing creation now accepts free-text `brandName`; the API reuses or creates local brand rows, and both the Sell flow and the dedicated Listings tab layer Brandfetch suggestions on top while Listings handles seller CRUD.
- Auto-confirm timer still runs in the API scheduler for now.
- Swagger/OpenAPI docs are exposed from the API at `/docs` with JSON at `/docs/json`.
- `apps/worker` is a placeholder for future async jobs.

## Next steps

- Fill MSG91 API credentials and switch `OTP_PROVIDER=MSG91_WIDGET` for production WhatsApp OTP.
- Set `CODE_ENCRYPTION_KEY` and `ADMIN_API_TOKEN` explicitly in every non-local environment.
- Set `OTP_PROVIDER=MSG91_WIDGET` and `PAYMENT_PROVIDER=RAZORPAY` for every production-like environment.
- Integrate native Razorpay checkout in the Expo app or add a safe server-side mobile checkout alternative.
- Decide whether to add Razorpay webhooks or keep client-signature verification only for Phase 1.
- Move timer and notification workloads into the worker.
- Add broader end-to-end API tests once the local DB stack is running.

## Validation

- `yarn typecheck` passed.
- `yarn lint` passed.
- `yarn test` passed.
- `yarn check` passed.

## Environment

- Uses Node 22.21.1 via `.nvmrc`.
- Uses Yarn 4.12.0 workspaces with `node-modules` linking.
- Expects PostgreSQL, Redis, and MinIO from `docker-compose.yml`.
- Root `.env` now carries the local Razorpay, auth, and repo-owned infra settings used by Docker Compose.
- `apps/mobile/.env.example` documents the Expo API base URL override for device testing.
- Local direct development targets this project's own Postgres on `localhost:5434` and Redis on `localhost:6380`.
