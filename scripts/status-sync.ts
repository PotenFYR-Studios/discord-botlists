#!/usr/bin/env bun
/**
 * Status sync: probes every botlist, writes the status board to
 * .status/status.json + STATUS.md, patches README.md and the docs site,
 * and outputs GitHub Actions step outputs.
 *
 * Notify policy: the workflow tracks dead lists in ONE GitHub issue. A list
 * is only reported while it is NOT yet marked in the generated registry
 * (src/data/lists.generated.ts); once every reported list is marked, the
 * issue auto-closes. Latency/uptime refreshes commit to the default branch
 * directly via the workflow (or are ignored when run locally).
 *
 * Outputs (written to $GITHUB_OUTPUT when present):
 *   pr_needed=true|false            (true = unmarked dead lists exist)
 *   dead_lists=<comma separated ids> (dead AND not yet marked)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Botlists } from '../src/index.js';
import { StatusChecker } from '../src/status/checker.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = `${ROOT}.status`;
const README = `${ROOT}README.md`;
const WEBSITE_DATA = `${ROOT}docs/src/data/status.json`;
const SITE_URL = process.env.SITE_URL ?? 'https://botlists.docs.potenfyr.in/';

const begin = new Date();
const client = new Botlists();
console.log(`probing ${client.lists.length} lists...`);
const board = await client.refreshStatus(true);

const dead = board.entries.filter((e) => e.state === 'shutdown' || e.state === 'deprecated');
const marked = new Set(readMarkedIds());
const unmarked = dead.map((d) => d.listId).filter((id) => !marked.has(id));
console.log(`live=${board.summary.live} deprecated=${board.summary.deprecated} shutdown=${board.summary.shutdown} unknown=${board.summary.unknown}`);
console.log(`dead=${dead.length} alreadyMarked=${dead.length - unmarked.length} needsReview=${unmarked.length}`);

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(`${ROOT}docs/src/data`, { recursive: true });

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
writeGitHubOutputs(unmarked);

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

/** ids already marked dead in the generated registry (human reviewed). */
function readMarkedIds(): string[] {
  let source: string;
  try {
    source = readFileSync(`${ROOT}src/data/lists.generated.ts`, 'utf8');
  } catch {
    return [];
  }
  const ids: string[] = [];
  const re = /id: ("(?:[^"\\]|\\.)*")/g;
  for (let match = re.exec(source); match; match = re.exec(source)) {
    const blockEnd = source.indexOf('  },', match.index);
    const block = source.slice(match.index, blockEnd === -1 ? undefined : blockEnd);
    if (/status: '(?:shutdown|deprecated)'/.test(block)) ids.push(JSON.parse(match[1]) as string);
  }
  return ids;
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
