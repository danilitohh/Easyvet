import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Centralize Prisma schema, migration, and development seed configuration.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.mjs',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
