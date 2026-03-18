import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

import { defineConfig } from 'prisma/config';

loadEnv({ path: resolve(__dirname, '.env') });
loadEnv({ path: resolve(__dirname, '../../.env'), override: false });

const datasource = process.env.DATABASE_URL
  ? {
      datasource: {
        url: process.env.DATABASE_URL
      }
    }
  : {};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  ...datasource
});
