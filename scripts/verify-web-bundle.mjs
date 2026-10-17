import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const bundleRoot = join(process.cwd(), 'dist');
const serverOnlyMarkers = [
  'DATABASE_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'PLATFORM_ADMIN_BOOTSTRAP_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'STORAGE_S3_ACCESS_KEY',
  'STORAGE_S3_SECRET_KEY',
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else files.push(path);
  }

  return files;
}

const violations = [];

for (const file of await filesUnder(bundleRoot)) {
  const contents = await readFile(file, 'utf8');
  for (const marker of serverOnlyMarkers) {
    if (contents.includes(marker)) violations.push(`${relative(process.cwd(), file)}: ${marker}`);
  }
}

if (violations.length > 0) {
  console.error('Server-only environment markers found in the browser bundle:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Web bundle secret boundary verified (${serverOnlyMarkers.length} markers checked).`);
