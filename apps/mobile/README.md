# Vouchrex Mobile

This app is the `vouchrex-mobile` workspace inside the root Yarn monorepo.

## Workspace workflow

1. Run `nvm use` from the repo root.
2. Run `corepack enable`.
3. Install dependencies once from the repo root with `yarn install`.
4. Start the app from the repo root with `yarn workspace vouchrex-mobile start` or `make mobile-dev`.

## Useful commands

- `yarn workspace vouchrex-mobile start`
- `yarn workspace vouchrex-mobile typecheck`
- `yarn workspace vouchrex-mobile lint`
- `yarn workspace vouchrex-mobile build`

Do not run `npm install` inside `apps/mobile`; dependency management lives at the monorepo root.
