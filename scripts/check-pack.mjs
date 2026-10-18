#!/usr/bin/env node
/**
 * Packaging guard (runs in prepublishOnly): the published tarball must hold
 * ONLY what a consumer installing through npm/pnpm/yarn/bun needs - compiled
 * dist, README, LICENSE, NOTICE and package.json. No sources, tests, docs,
 * workflows, Docker files, env files, source maps or lockfiles.
 */
import { execFileSync } from 'node:child_process';

const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8', shell: process.platform === 'win32' });
const files = JSON.parse(out)[0].files.map((f) => f.path);
const allowed = [/^dist\/.+\.(?:js|d\.ts)$/, /^dist\/cjs\/package\.json$/,/^(?:README\.md|LICENSE|NOTICE\.md|package\.json)$/];
const banned = [/\.test\.(?:js|d\.ts)$/, /\.map$/, /docker/i, /^\.github\//, /^\.env/, /^src\//, /^test\//, /^scripts\//, /^docs\//];
const bad = files.filter((f) => !allowed.some((re) => re.test(f)) || banned.some((re) => re.test(f)));
if (bad.length) {
  console.error(`unexpected files in the npm tarball:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
console.log(`pack ok: ${files.length} files, nothing but dist + metadata`);
