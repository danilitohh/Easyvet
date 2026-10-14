import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Supabase's Vercel Marketplace integration provides POSTGRES_PRISMA_URL.
// Keep DATABASE_URL as the canonical name used by the schema and local setup.
process.env.DATABASE_URL ??= process.env.POSTGRES_PRISMA_URL;

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
