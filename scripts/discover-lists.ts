#!/usr/bin/env bun
/**
 * Botlist discovery: pulls BotBlock's directory, finds lists the registry
 * does not carry yet and validates them against reality before anyone adds
 * them. A candidate is "viable" only when the site answers AND the stats
 * endpoint behaves like a real API (JSON/401/403/400/405 for an unauthenticated
 * call) - 404s, HTML error pages, parked domains and dead DNS are rejected.
 * Probes are patient (slow is not dead): 30s budget, one retry.
 *
 * Writes .status-out/candidates.json; never edits the registry. Add a viable
 * list with scripts/snapshot/build_lists.py (NEW_LISTS) after reading its docs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOTLISTS } from '../src/data/lists.generated.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${ROOT}.status-out`;
const UA = 'Mozilla/5.0 (compatible; discord-botlists-discovery/1.0)';
const SAMPLE_ID = '557628352828014614';

interface BotBlockList {
  id: string;
  name: string;
  url: string | null;
  defunct: number;
  api_docs: string | null;
  api_post: string | null;
  api_field: string | null;
}

const known = new Set(BOTLISTS.map((l) => l.id));
// ids deliberately dropped after their APIs were verified dead (see build_lists.py).
const rejected = new Set(
  (() => {
    try {
      return (JSON.parse(readFileSync(`${ROOT}scripts/snapshot/rejected-lists.json`, 'utf8')) as { id: string }[]).map((r) => r.id);
    } catch {
      return [] as string[];
    }
  })(),
);

const response = await fetch('https://botblock.org/api/lists', { headers: { 'user-agent': UA } });
if (!response.ok) {
  console.error(`botblock answered ${response.status}, skipping discovery`);
  process.exit(0);
}
const directory = (await response.json()) as Record<string, BotBlockList>;
const pending = Object.values(directory).filter((l) => !l.defunct && !known.has(l.id) && !rejected.has(l.id));
console.log(`botblock lists=${Object.keys(directory).length} unknown to registry=${pending.length}`);

async function patient(url: string, init: RequestInit = {}): Promise<{ status: number; type: string; body: string } | { dns: boolean } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, { ...init, redirect: 'manual', signal: controller.signal, headers: { 'user-agent': UA, ...(init.headers ?? {}) } });
      return { status: res.status, type: res.headers.get('content-type') ?? '', body: (await res.text()).slice(0, 200) };
    } catch (error) {
      const code = (error as { cause?: { code?: string } }).cause?.code;
      if (code === 'ENOTFOUND') return { dns: true };
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

const results = [];
for (const list of pending) {
  const site = list.url ? await patient(list.url) : null;
  let verdict = 'rejected';
  let reason = '';
  if (!site) reason = 'site unreachable';
  else if ('dns' in site) reason = 'dns dead';
  else if (!list.api_post) reason = 'no stats API documented';
  else {
    const api = await patient(list.api_post.replace(':id', SAMPLE_ID), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'invalid' },
      body: JSON.stringify({ [list.api_field ?? 'server_count']: 1 }),
    });
    if (!api) reason = 'api unreachable';
    else if ('dns' in api) reason = 'api dns dead';
    else if ([301, 302, 307, 308].includes(api.status)) reason = `api redirects (${api.status}); resolve the real host first`;
    else if (api.status === 404 || api.type.includes('text/html')) reason = `api not found (${api.status} ${api.type.split(';')[0]})`;
    else {
      verdict = 'viable';
      reason = `api answers ${api.status} ${api.type.split(';')[0]}`;
    }
  }
  console.log(`${verdict.padEnd(8)} ${list.id} - ${reason}`);
  results.push({ id: list.id, name: list.name, website: list.url, apiDocs: list.api_docs, apiPost: list.api_post, verdict, reason });
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/candidates.json`, JSON.stringify({ generatedAt: Date.now(), candidates: results }, null, 2));
console.log(`viable=${results.filter((r) => r.verdict === 'viable').length}`);
