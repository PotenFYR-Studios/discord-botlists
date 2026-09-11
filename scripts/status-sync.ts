#!/usr/bin/env bun
/**
 * Status sync: probes every botlist, writes the status board to
 * .status/status.json + STATUS.md, patches README.md and the website,
 * and outputs GitHub Actions step outputs.
 *
 * PR policy: a pull request is opened ONLY when a list is detected as
 * deprecated or shutdown. Latency/uptime refreshes commit to main directly
 * via the workflow (or are ignored when run locally).
 *
 * Outputs (written to $GITHUB_OUTPUT when present):
 *   pr_needed=true|false
 *   dead_lists=<comma separated ids>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Botlists } from '../src/index.js';
import { StatusChecker } from '../src/status/checker.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = `${ROOT}.status`;
const README = `${ROOT}README.md`;
const WEBSITE_DATA = `${ROOT}website/src/data/status.json`;
const SITE_URL = process.env.SITE_URL ?? 'https://botlists.docs.potenfyr.in/';

const begin = new Date();
const client = new Botlists();
console.log(`probing ${client.lists.length} lists...`);
const board = await client.refreshStatus(true);

const dead = board.entries.filter((e) => e.state === 'shutdown' || e.state === 'deprecated');
console.log(`live=${board.summary.live} deprecated=${board.summary.deprecated} shutdown=${board.summary.shutdown} unknown=${board.summary.unknown}`);

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(`${ROOT}website/src/data`, { recursive: true });

const payload = {
  generatedAt: board.generatedAt,
  siteUrl: SITE_URL,
  summary: board.summary,
  entries: board.entries,
};
writeFileSync(`${OUT_DIR}/status.json`, JSON.stringify(payload, null, 2));
writeFileSync(`${OUT_DIR}/STATUS.md`, renderStatusMd(board));
writeFileSync(WEBSITE_DATA, JSON.stringify(payload, null, 2));

patchReadme(board);
writeGitHubOutputs(dead.map((d) => d.listId));

console.log(`done in ${((Date.now() - begin.getTime()) / 1000).toFixed(1)}s`);

function renderStatusMd(b: typeof board): string {
  const head = [
    '# Botlist status board',
    '',
    `Generated ${new Date(b.generatedAt).toISOString()} by scripts/status-sync.ts.`,
    '',
    `- Live: **${b.summary.live}**`,
    `- Deprecated: **${b.summary.deprecated}**`,
    `- Shutdown: **${b.summary.shutdown}**`,
    `- Unknown: **${b.summary.unknown}**`,
    '',
    StatusChecker.toMarkdown(b),
    '',
  ];
  return head.join('\n');
}

function patchReadme(b: typeof board): void {
  let md: string;
  try {
    md = readFileSync(README, 'utf8');
  } catch {
    console.warn('README.md not found, skipping patch');
    return;
  }
  const table = StatusChecker.toMarkdown(b);
  const stamp = new Date(b.generatedAt).toISOString().slice(0, 10);
  const section = `<!-- STATUS:START -->\nLast sync: **${stamp}** | 🟢 ${b.summary.live} live | 🟡 ${b.summary.deprecated} deprecated | 🔴 ${b.summary.shutdown} shutdown | ⚪ ${b.summary.unknown} unknown\n\n${table}\n<!-- STATUS:END -->`;
  if (md.includes('<!-- STATUS:START -->')) {
    md = md.replace(/<!-- STATUS:START -->[\s\S]*?<!-- STATUS:END -->/, section);
  } else {
    md += `\n## Live status\n\n${section}\n`;
  }
  writeFileSync(README, md);
}

function writeGitHubOutputs(ids: string[]): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  const line = `pr_needed=${ids.length > 0}\ndead_lists=${ids.join(',')}\n`;
  if (outputFile) {
    try {
      writeFileSync(outputFile, line, { flag: 'a' });
    } catch (error) {
      console.warn('could not write GITHUB_OUTPUT', error);
    }
  }
  console.log(line.trim());
}
