#!/usr/bin/env bun
/** Marks given list ids as deprecated in the generated registry.
 *  Usage: bun scripts/mark-dead.ts list1.xyz list2.com
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../src/data/lists.generated.ts', import.meta.url));
const dead = process.argv.slice(2);
if (!dead.length) {
  console.error('no list ids given');
  process.exit(1);
}

let source = readFileSync(file, 'utf8');
let changed = 0;
for (const id of dead) {
  // find the record block for this id and inject status inside its supports line
  const marker = `    id: ${JSON.stringify(id)},`;
  const index = source.indexOf(marker);
  if (index === -1) {
    console.warn(`not found: ${id}`);
    continue;
  }
  const blockEnd = source.indexOf('  },', index);
  const block = source.slice(index, blockEnd);
  if (block.includes('status:')) continue;
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const patched = block.replace(
    /(    supports: \{[^\n]*\},\r?\n)/,
    `$1    status: 'shutdown',${eol}`,
  );
  if (patched === block) {
    console.warn(`no supports line matched for ${id}, skipping`);
    continue;
  }
  source = source.slice(0, index) + patched + source.slice(blockEnd);
  changed++;
}
writeFileSync(file, source);
console.log(`marked ${changed}/${dead.length} lists as shutdown`);
