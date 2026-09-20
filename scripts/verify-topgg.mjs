#!/usr/bin/env node
/**
 * Live top.gg verification for @potenfyrstudios/discord-botlists.
 *
 * Runs the BUILT SDK against the REAL top.gg API and a REAL signed v1
 * webhook delivery - the same path production vote events take.
 *
 *   TOPGG_TOKEN=<bot api token> TOPGG_WEBHOOK_SECRET=<whs_...> \
 *     node scripts/verify-topgg.mjs [serverCount]
 *
 * Exits 0 only when every check passes.
 */
import { createHmac } from 'node:crypto';
import { Botlists, VoteAnnouncer, isDiscordWebhookUrl } from '../dist/index.js';

const token = process.env.TOPGG_TOKEN || '';
const secret = process.env.TOPGG_WEBHOOK_SECRET || '';
const botId = process.env.TOPGG_BOT_ID || '1470079725106888817';
const serverCount = Number(process.argv[2] || 0);

let failures = 0;
const check = (name, ok, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ` - ${info}` : ''}`);
  if (!ok) failures++;
};

if (!token) {
  console.error('TOPGG_TOKEN is required');
  process.exit(1);
}

// 1. env token mapping: DBL_TOPGG style keys resolve under the list id.
process.env.DBL_TOPGG = token;
const lists = new Botlists({});
check('DBL_TOPGG env key maps to the "top.gg" list id', Boolean(lists.tokens?.['top.gg']));

// 2. real stats POST with the real token.
if (serverCount > 0) {
  const report = await lists.postStatsTo('top.gg', { serverCount });
  const r = report;
  check('stats POST to top.gg', r.ok === true, `HTTP ${r.status}`);
} else {
  console.log('SKIP  stats POST (pass serverCount as argv[2] to exercise it)');
}

// 3. read the count back from the real /stats endpoint.
const res = await fetch(`https://top.gg/api/bots/${botId}/stats`, { headers: { Authorization: token } });
const stats = res.ok ? await res.json() : null;
check('stats GET round-trip', res.ok && stats && typeof stats.server_count === 'number', `server_count=${stats?.server_count}`);

// 4. v1 webhook signature + payload envelope through the SDK ingest path.
if (secret) {
  const ingester = new Botlists({ webhook: { secret: { 'top.gg': secret }, security: { requireSecret: true } } });
  const votes = [];
  const tests = [];
  ingester.on('vote', (v) => votes.push(v));
  ingester.on('test', (v) => tests.push(v));

  const body = JSON.stringify({ vote: { id: '0000000000000000000', botId, userId: '264811613708746752', type: 'vote', createdAt: new Date().toISOString() } });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const parsed = ingester.webhook.ingest('top.gg', JSON.parse(body), { headers: { 'x-topgg-signature': `t=${t},v1=${v1}` } });
  check('v1 signed vote ingested', Boolean(parsed) && votes.length === 1 && votes[0].voterId === '264811613708746752');

  const bad = ingester.webhook.ingest('top.gg', JSON.parse(body), { headers: { 'x-topgg-signature': `t=${t},v1=${'0'.repeat(64)}` } });
  check('v1 bad signature rejected', bad === null);

  const testBody = { vote: { id: '0000000000000000001', botId, userId: '264811613708746752', type: 'test', createdAt: new Date().toISOString() } };
  const tt = Math.floor(Date.now() / 1000);
  const tv1 = createHmac('sha256', secret).update(`${tt}.${JSON.stringify(testBody)}`).digest('hex');
  ingester.webhook.ingest('top.gg', testBody, { headers: { 'x-topgg-signature': `t=${tt},v1=${tv1}` } });
  check('v1 test delivery routed to the test event', tests.length === 1 && tests[0].isTest === true);
} else {
  console.log('SKIP  v1 webhook checks (set TOPGG_WEBHOOK_SECRET)');
}

// 5. announcer URL validation sanity.
check('announcer discord webhook url validation', isDiscordWebhookUrl('https://discord.com/api/webhooks/1/x') && !isDiscordWebhookUrl('https://example.com/x'));
new VoteAnnouncer({}).stop();

console.log(failures === 0 ? '\nALL LIVE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
