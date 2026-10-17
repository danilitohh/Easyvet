import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const base = process.env.FORMAT_BASE_REF ?? 'HEAD^';
const head = process.env.FORMAT_HEAD_REF ?? 'HEAD';
const formatExtensions = /\.(cjs|css|js|json|md|mjs|ts|tsx|yaml|yml)$/i;

const changedFiles = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=ACMR', base, head],
  {
    encoding: 'utf8',
  },
)
  .split('\n')
  .map((file) => file.trim())
  .filter(
    (file) =>
      file && formatExtensions.test(file) && !file.startsWith('graphify-out/') && existsSync(file),
  );

if (changedFiles.length === 0) {
  console.log(`Format check: no supported changed files in ${base}..${head}`);
  process.exit(0);
}

console.log(`Format check: ${changedFiles.length} changed file(s) in ${base}..${head}`);
execFileSync('npx', ['--no-install', 'prettier', '--check', ...changedFiles], {
  stdio: 'inherit',
});
