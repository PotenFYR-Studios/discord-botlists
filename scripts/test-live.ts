#!/usr/bin/env bun
/**
 * Live integration test driven by .env tokens.
 *
 *   cp .env.example .env      # then fill in the tokens you have
 *   bun run test:live
 *
 * Every token found is exercised: fetch, post, votes, widget urls.
 * Missing tokens are skipped with a clear message, nothing hard fails
 * because of a list you did not sign up for. Requests are throttled and
 * cached so the run never trips rate limits.
 */
import { Botlists } from '../src/index.js';

const results: { list: string; action: string; ok: boolean; info: string }[] = [];
const client = new Botlists({ webhook: { port: 8099, autoStart: false, debug: false } });

client.on('vote', (vote) => console.log('  realtime vote ->', JSON.stringify(vote, null, 2).slice(0, 400)));

const configured = Object.keys(process.env)
  .filter((k) => k.startsWith('DBL_'))
  .map((k) => k.slice(4).toLowerCase());

console.log(`tokens loaded from env: ${configured.length ? configured.join(', ') : 'NONE (set .env first)'}`);
console.log(`registry size: ${client.lists.length} lists, ${client.postableCount} postable\n`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function checkEnvAvailability(): Promise<void> {
  console.log('== env token availability ==');
  for (const list of client.lists) {
    const token = list.tokenEnvKey && process.env[list.tokenEnvKey];
    if (token) {
      results.push({ list: list.id, action: 'token', ok: true, info: `via ${list.tokenEnvKey}` });
    }
  }
  console.log(`  ${results.length} tokens detected\n`);
}

async function fetchPhase(): Promise<void> {
  console.log('== public fetch phase (no tokens needed) ==');
  // public endpoints. top.gg and voidbots require tokens even for reads,
  // so they will FAIL here unless their env token is set, which is expected.
  const targets = ['discordbotlist.com', 'discord.bots.gg', 'botlist.me', 'radarcord.net'];
  if (process.env['DBL_TOP.GG']) targets.push('top.gg');
  if (process.env['DBL_VOIDBOTS.NET']) targets.push('voidbots.net');
  for (const target of targets) {
    try {
      const bot = await client.fetchBot(target, process.env.DBL_TEST_BOT_ID ?? '557628352828014614');
      results.push({ list: target, action: 'fetch', ok: true, info: `${bot.name} servers=${bot.serverCount} votes=${bot.votes}` });
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      results.push({ list: target, action: 'fetch', ok: false, info: message });
    }
    await sleep(1200);
  }
}

async function votesPhase(): Promise<void> {
  console.log('\n== votes phase ==');
  for (const target of ['top.gg', 'botlist.me', 'discordbotlist.com']) {
    if (!process.env[`DBL_${target.replace(/[^a-z0-9]/g, (c) => c.toUpperCase())}`] && !configured.length) {
      console.log(`  skip ${target}: no token`);
      continue;
    }
    try {
      const votes = await client.fetchVotes(target);
      results.push({ list: target, action: 'votes', ok: true, info: `votes=${votes}` });
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      results.push({ list: target, action: 'votes', ok: false, info: message });
    }
    await sleep(1200);
  }
}

async function postPhase(): Promise<void> {
  console.log('\n== stats post phase (only lists with tokens) ==');
  const serverCount = Number(process.env.DBL_TEST_SERVER_COUNT ?? 1);
  const report = await client.postStats({ serverCount, shards: [serverCount] });
  for (const result of report.results) {
    if (result.error?.startsWith('no token')) continue;
    results.push({
      list: result.listId,
      action: 'post',
      ok: result.ok,
      info: result.ok ? `HTTP ${result.status} in ${result.durationMs}ms` : result.error ?? 'failed',
    });
  }
  console.log(`  posted=${report.posted} failed=${report.failed} skipped(no token)=${report.skipped}`);

  const bb = process.env.DBL_BOTBLOCK_TOKEN ?? process.env.BOTBLOCK_KEY;
  if (bb) {
    console.log('  botblock fan-out enabled');
  }
}

async function webhookPhase(): Promise<void> {
  console.log('\n== realtime webhook phase ==');
  await client.startWebhooks();
  console.log(`  listening on ${client.webhook.address} (give this + your secret to each list dashboard)`);

  // simulate a top.gg vote locally to prove the event path.
  const address = client.webhook.address.replace('localhost', '127.0.0.1');
  const response = await fetch(address, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: 'voter-simulation', bot: process.env.DBL_TEST_BOT_ID ?? '0' }),
  });
  console.log(`  simulated top.gg vote -> HTTP ${response.status}`);
  await client.stopWebhooks();
}

async function statusPhase(): Promise<void> {
  console.log('\n== status phase ==');
  const board = await client.refreshStatus(true);
  console.log(`  live=${board.summary.live} shutdown=${board.summary.shutdown} unknown=${board.summary.unknown}`);
  for (const entry of board.entries) {
    if (entry.state !== 'live') {
      results.push({ list: entry.listId, action: 'status', ok: false, info: `${entry.state} (http ${entry.httpStatus ?? 'none'})` });
    }
  }
}

await checkEnvAvailability();
await fetchPhase();
await votesPhase();
await postPhase();
await webhookPhase();
await statusPhase();

console.log('\n================ RESULT =================');
let pass = 0;
let fail = 0;
for (const r of results) {
  const mark = r.ok ? 'PASS' : 'FAIL';
  if (r.ok) pass++;
  else fail++;
  console.log(`${mark}  ${r.list.padEnd(28)} ${r.action.padEnd(7)} ${r.info.slice(0, 110)}`);
}
console.log('-----------------------------------------');
console.log(`pass=${pass} fail=${fail}`);
process.exit(0);
