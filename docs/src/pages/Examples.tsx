import { Link } from 'react-router-dom';
import Code from '../components/Code';

/**
 * Every snippet here mirrors the real SDK surface exported from src/
 * (Botlists, VoteWebhookServer, UniversalParser, EVENTS): no invented APIs.
 */

const EXAMPLES: { title: string; blurb: string; lang: string; file: string; code: string }[] = [
  {
    title: 'Reward voters instantly',
    blurb: 'Give a role the second someone votes on any list. vote.voterId is normalized across all 33 registries.',
    lang: 'ts',
    file: 'reward-voters.ts',
    code: `import { Botlists } from '@potenfyrstudios/discord-botlists';

// inside your discord.js client setup
const lists = new Botlists({
  client,
  webhook: { port: 8080, secret: process.env.WEBHOOK_SECRET },
});

await lists.startWebhooks();

lists.on('vote', async (vote) => {
  if (vote.isTest) return;            // dashboard test button
  const member = await guild.members.fetch(vote.voterId!).catch(() => null);
  if (member) await member.roles.add('VOTER_ROLE_ID');
  if (vote.weekend) {
    // weekend multiplier: vote.weight tells you how many entries to grant
    await member?.roles.add('DOUBLE_VOTER_ROLE_ID');
  }
});`,
  },
  {
    title: 'Post stats without discord.js',
    blurb: 'statsProvider gives full control: any framework, custom sharding, or a plain cron job with no client at all.',
    lang: 'ts',
    file: 'framework-less.ts',
    code: `import { Botlists } from '@potenfyrstudios/discord-botlists';

const lists = new Botlists({
  botId: '432161800760442880',
  tokens: {
    'top.gg': process.env.TOPGG_TOKEN,
    'botlist.me': process.env.BOTLISTME_TOKEN,
  },
  statsProvider: async () => ({
    serverCount: await shardManager.fetchTotalGuilds(),
    shardCount: shardManager.count,
    shards: await shardManager.fetchPerShardGuilds(),
  }),
});

// every 30 minutes, minimum 60s, timer is unref'd
lists.startAutoPost(30 * 60 * 1000);

lists.on('statsPosted', (report) => {
  console.log(\`posted to \${report.posted}, failed \${report.failed}, skipped \${report.skipped}\`);
});`,
  },
  {
    title: 'Webhooks inside Express or Fastify',
    blurb: 'Already run an HTTP server? Skip the built-in one and feed bodies straight into ingestWebhook.',
    lang: 'ts',
    file: 'express-ingest.ts',
    code: `import express from 'express';
import { Botlists } from '@potenfyrstudios/discord-botlists';

const lists = new Botlists({
  botId: process.env.BOT_ID,
  webhook: { secret: process.env.WEBHOOK_SECRET }, // never started, used for parsing
});

const app = express();
app.use(express.json());

app.post('/webhooks/:list', (req, res) => {
  // the last segment identifies the list: /webhooks/top.gg
  lists.ingestWebhook(req.params.list, req.body);
  res.sendStatus(200);
});

app.listen(3000);`,
  },
  {
    title: 'Per-list posting with filters',
    blurb: 'Post to every tokened list, or slice it with only/skip. Each PostResult carries the HTTP status and Retry-After.',
    lang: 'ts',
    file: 'post-report.ts',
    code: `const report = await lists.postStats(
  { serverCount: client.guilds.cache.size },
  { skip: ['bots.ondiscord.xyz'] },   // or { only: ['top.gg', 'botlist.me'] }
);

for (const result of report.results) {
  if (!result.ok && !result.error?.startsWith('no token')) {
    console.error(\`\${result.listName}: \${result.error}\`);
    if (result.retryAfter) console.log(\`  retry after \${result.retryAfter}s\`);
  }
}

// one list by id, name, hostname or shorthand ('radarcord', 'voidbots', ...)
await lists.postStatsTo('radarcord', { serverCount: 120 });

// one request to botblock.org fans out to every list (their limit: 1 per 120s)
await lists.postViaBotBlock({ serverCount: 120 });`,
  },
  {
    title: 'Read normalized data from any list',
    blurb: 'fetchBot returns UniversalBot everywhere. Votes, ratings, invite, prefix: same shape on every list, raw payload kept.',
    lang: 'ts',
    file: 'read-data.ts',
    code: `const bot = await lists.fetchBot('discord.bots.gg', '557628352828014614');
bot.name;         // 'Ticket Tool'
bot.serverCount;  // number | null
bot.votes;        // number | null
bot.ratings;      // { average, count }
bot.raw;          // the untouched API response

const votes = await lists.fetchVotes('top.gg');        // number | null
const voted = await lists.hasVoted('top.gg', userId);  // boolean | null
const found = await lists.searchBots('botlist.me', 'music', 5);

lists.widgetUrl('top.gg');   // widget image url
lists.viewBotUrl('top.gg');  // listing page url`,
  },
  {
    title: 'Health cron for the registry',
    blurb: 'Probe every list, print the unicode status table, and get prefilled GitHub issue URLs for dead lists.',
    lang: 'ts',
    file: 'status-cron.ts',
    code: `const board = await lists.checkAndReportStatus();
board.summary;   // { live: 33, deprecated: 0, shutdown: 0, unknown: 0 }
board.entries;   // [{ listId, state, httpStatus, latencyMs, ... }]

lists.on('status', (b) => {
  if (b.summary.shutdown > 0) {
    // dead lists are skipped automatically by postStats
    notifyChannel(\`\${b.summary.shutdown} list(s) unreachable\`);
  }
});`,
  },
  {
    title: 'Self-hosted or missing list',
    blurb: 'One BotlistRecord and a custom list works everywhere built-in ones do: posting, webhooks, parsing, probing.',
    lang: 'ts',
    file: 'custom-list.ts',
    code: `const lists = new Botlists({
  tokens: { 'my-list.dev': process.env.MYLIST_TOKEN },
  lists: [{
    id: 'my-list.dev',
    name: 'My List',
    website: 'https://my-list.dev',
    apiPost: 'https://api.my-list.dev/bots/:id/stats',
    postField: 'server_count',
    postMethod: 'POST',
    authHeader: 'Authorization',
    tokenEnvKey: 'DBL_MYLIST',
    webhook: { header: 'Authorization', voterField: 'user_id', eventField: null },
    supports: { post: true, get: false, widget: false, webhook: true },
    apiDocs: null, apiGet: null, viewBot: null, widget: null,
    shardField: null, shardIdField: null, shardsArrayField: null,
  }],
});`,
  },
  {
    title: 'Typed event wiring',
    blurb: 'One EventEmitter carries every realtime signal. EVENTS is exported if you want exhaustiveness checks.',
    lang: 'ts',
    file: 'events.ts',
    code: `import { EVENTS } from '@potenfyrstudios/discord-botlists';

lists.on('comment', (c) => console.log(c.userName, 'commented:', c.content));
lists.on('review', (r) => console.log(\`review \${r.rating}/5 on \${r.listName}\`));
lists.on('rating', (r) => track(r.listId, r.rating));
lists.on('test', (v) => console.log('test vote from', v.listId));
lists.on('raw', (p) => console.log(p.listId, p.event));
lists.on('error', (err) => console.error(err.message));

// 'vote' | 'comment' | 'review' | 'rating' | 'test' | 'statsPosted'
// 'status' | 'error' | 'request' | 'raw'
console.log(EVENTS);`,
  },
];

export default function Examples() {
  return (
    <main className="mx-auto max-w-[1080px] px-6 pb-20 pt-9">
      <p className="mono-label mb-3">copy · paste · ship</p>
      <h1 className="text-[clamp(1.9em,3.6vw,2.6em)] font-extrabold leading-tight tracking-[-0.02em]">
        <span className="grad-text">Examples</span>
      </h1>
      <p className="mt-3 max-w-[720px] text-[1.04em] leading-[1.75] text-muted">
        Real recipes against the real API surface. Every option shown here exists in the shipped
        types: check the{' '}
        <Link to="/docs" className="text-link hover:text-linkh underline-offset-3 hover:underline">
          full reference
        </Link>{' '}
        for the rest.
      </p>

      <div className="mt-10 grid gap-3.5 lg:grid-cols-2">
        {EXAMPLES.map((ex) => (
          <div key={ex.file} className="glass-card !gap-3">
            <h2 className="text-[0.98em] font-bold text-white">{ex.title}</h2>
            <p className="text-[0.83em] leading-[1.55] text-muted">{ex.blurb}</p>
            <Code content={ex.code} lang={ex.lang} title={ex.file} className="mt-1" />
          </div>
        ))}
      </div>
    </main>
  );
}
