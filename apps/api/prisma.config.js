// Production prisma config — used inside the Docker container (no TS compilation needed).
// Development uses prisma.config.ts which loads .env via dotenv.
"use strict";
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {})
});
