#!/usr/bin/env bun
/** Marks given list ids as deprecated in the generated registry.
 *  Usage: bun scripts/mark-dead.ts list1.xyz list2.com
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/data/lists.generated.ts', import.meta.url).pathname;
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
  const patched = block.replace(
    /(    supports: \{[^\n]*\},\n)/,
    `$1    status: 'shutdown',\n`,
  );
  source = source.slice(0, index) + patched + source.slice(blockEnd);
  changed++;
}
writeFileSync(file, source);
console.log(`marked ${changed}/${dead.length} lists as shutdown`);
