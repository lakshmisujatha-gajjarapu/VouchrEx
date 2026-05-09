// Prisma config used by both dev and production (the Docker container).
// Loads .env from the api workspace and the repo root if present (best-effort);
// in containers where the files don't exist, dotenv silently no-ops and we
// rely on DATABASE_URL being set externally.
"use strict";
const { resolve } = require('node:path');

try {
  const { config: loadEnv } = require('dotenv');
  loadEnv({ path: resolve(__dirname, '.env') });
  loadEnv({ path: resolve(__dirname, '../../.env'), override: false });
} catch {
  // dotenv not installed (production image) — env vars come from the runtime
}

const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {})
});
