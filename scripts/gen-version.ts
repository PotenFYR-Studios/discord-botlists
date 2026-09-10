#!/usr/bin/env bun
/**
 * Syncs the website docs version with the package version.
 * Run before every website build (wired into the "build" script).
 * Also refreshes .status/status.json -> src/data copy when present.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = pkg.version as string;

const out = `// AUTO-GENERATED from package.json version. Do not edit: run
// \`bun scripts/gen-version.ts\` (wired into website build) to regenerate.
export const CURRENT_VERSION = '${version}';
`;
writeFileSync(new URL('../website/src/docs/version.generated.ts', import.meta.url), out);
console.log(`docs version -> ${version}`);

// copy status board for the status page when it exists
const status = new URL('../.status/status.json', import.meta.url).pathname;
const dest = new URL('../website/src/data/status.json', import.meta.url).pathname;
if (existsSync(status)) {
  mkdirSync(new URL('../website/src/data/', import.meta.url), { recursive: true });
  copyFileSync(status, dest);
  console.log('status.json synced');
}
