import { CURRENT_VERSION } from './version.generated';
export interface DocSection {
  slug: string;
  title: string;
  blurb: string;
  category: 'Getting Started' | 'Core Concepts' | 'Guides' | 'API Reference';
  /** markdown-ish body blocks, rendered by the docs page */
  blocks: DocBlock[];
}

export type DocBlock =
  | { type: 'text'; content: string }
  | { type: 'code'; title?: string; lang: 'ts' | 'bash' | 'json'; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'note'; tone: 'info' | 'warn' | 'tip'; content: string }
  | { type: 'list'; items: string[] }
  | { type: 'h3'; content: string };

export interface DocVersion {
  version: string;
  label: string;
  deprecated?: boolean;
  sections: DocSection[];
}

const CURRENT: DocVersion = {
  version: CURRENT_VERSION,
  label: `v${CURRENT_VERSION} (latest)`,
  sections: [
    {
      slug: 'introduction',
      title: 'Introduction',
      blurb: 'What discord-botlists is and why it exists.',
      category: 'Getting Started',
      blocks: [
        {
          type: 'text',
          content:
            'discord-botlists is a zero dependency SDK that connects your Discord bot to every botlist at once. It posts your server and shard counts in each list exact wire format, receives votes, comments, reviews and ratings in realtime through one webhook server, parses any list API response into a single normalized shape, and tracks the health of every list it supports.',
        },
        {
          type: 'list',
          items: [
            'Post stats to 30+ verified live lists with one call, each mapped to its exact endpoint, auth header and field names.',
            'Realtime typed events for votes, comments, reviews and ratings. No polling, no delay.',
            'Universal parser: fetchBot returns the same UniversalBot shape on every list.',
            'Status tracking: hourly probes detect deprecated and shutdown lists, prune them from the registry automatically, and show latency on the status page.',
            'Fully typed with strict TypeScript. Zero runtime dependencies. Node 18+ and Bun.',
          ],
        },
        {
          type: 'note',
          tone: 'info',
          content:
            `v${CURRENT_VERSION} is a complete rewrite. The old express based class from 1.x is gone; see the migration section if you are coming from v1.`,
        },
      ],
    },
    {
      slug: 'installation',
      title: 'Installation',
      blurb: 'Install the package and requirements.',
      category: 'Getting Started',
      blocks: [
        {
          type: 'code',
          lang: 'bash',
          title: 'pick your package manager',
          content: `npm install @potenfyrstudios/discord-botlists
bun add @potenfyrstudios/discord-botlists
pnpm add @potenfyrstudios/discord-botlists`,
        },
        {
          type: 'table',
          headers: ['Requirement', 'Minimum', 'Notes'],
          rows: [
            ['Node.js', '18.0.0', 'uses global fetch and node:http'],
            ['Bun', '1.1.0', 'fully supported, recommended for tests'],
            ['TypeScript', '5.0', 'optional, types ship in the package'],
            ['discord.js / Eris', 'optional', 'pass your client to auto collect stats'],
          ],
        },
        {
          type: 'note',
          tone: 'tip',
          content:
            'The package never installs express, axios or dotenv. Everything runs on the Node standard library.',
        },
      ],
    },
    {
      slug: 'frameworks',
      title: 'Framework support',
      blurb: 'discord.js, Eris, Oceanic, anything else, or no framework at all.',
      category: 'Getting Started',
      blocks: [
        {
          type: 'text',
          content:
            'The SDK has no framework lock-in. Pass any client object that exposes a guilds collection and it reads server and shard counts automatically. Or skip the client entirely and hand over the numbers yourself.',
        },
        {
          type: 'table',
          headers: ['Framework', 'How to use', 'Auto collection'],
          rows: [
            ['discord.js', "new Botlists({ client })", 'guilds.cache.size, shard data'],
            ['Eris', "new Botlists({ client })", 'guilds Map size'],
            ['Oceanic', "new Botlists({ client })", 'guilds Map size'],
            ['Other frameworks', "new Botlists({ statsProvider })", 'you provide it'],
            ['No framework', "new Botlists({ statsProvider }) or explicit stats", 'you provide it'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'statsProvider: full control, any framework or none',
          content: `const lists = new Botlists({
  statsProvider: async () => ({
    serverCount: shardManager.totalGuilds,
    shardCount: shardManager.shardCount,
    shards: shardManager.perShardCounts,
  }),
});

// or per call, no constructor changes
await lists.postStats({ serverCount: myGuildCount });`,
        },
        {
          type: 'note',
          tone: 'tip',
          content:
            'Everything except auto stats collection (webhooks, parser, status checks, posting) never touches your client object - it is plain HTTP and Node builtins.',
        },
      ],
    },
    {
      slug: 'setup',
      title: 'Setup and tokens',
      blurb: 'Constructing Botlists and providing tokens.',
      category: 'Getting Started',
      blocks: [
        {
          type: 'code',
          lang: 'ts',
          title: 'the usual setup',
          content: `import { Client } from 'discord.js';
import { Botlists } from '@potenfyrstudios/discord-botlists';

const client = new Client({ intents: ['Guilds'] });

const lists = new Botlists({
  client,                       // optional: discord.js or Eris client
  tokens: {
    'top.gg': process.env.TOPGG_TOKEN,
    'discordbotlist.com': process.env.DBL_TOKEN,
  },
  webhook: {
    port: 8080,                 // default 8080
    path: '/discord-botlists',  // default
    secret: process.env.WEBHOOK_SECRET,
  },
  startupStatusCheck: true,     // print the status table on first postStats
});`,
        },
        { type: 'h3', content: 'Token resolution order' },
        {
          type: 'list',
          items: [
            'Environment variables: DBL_<LIST-ID-UPPERCASED>, for example DBL_TOP.GG.',
            'The tokens map in the constructor overrides env per list id.',
            'Lists without a token are skipped by postStats and reported as skipped, never as failures.',
          ],
        },
        {
          type: 'table',
          headers: ['Option', 'Type', 'Default', 'Description'],
          rows: [
            ['botId', 'string', 'client.user.id', 'Your bot application id'],
            ['client', 'BotClientLike', 'null', 'discord.js, Eris or Oceanic client for auto stats'],
            ['statsProvider', 'StatsProvider', 'null', 'Provide stats yourself: any framework or none'],
            ['tokens', 'Record<string,string>', 'env DBL_*', 'Per list tokens, overrides env'],
            ['authHeaders', 'Record<string,string>', 'per list default', 'Override the auth header name per list'],
            ['lists', 'BotlistRecord[]', '[]', 'Add custom or self-hosted lists'],
            ['webhook', 'WebhookOptions', '{}', 'Webhook server config'],
            ['fetchOptions', 'FetchOptions', 'timeout 10s, 2 retries', 'Applied to every request'],
            ['disableStatusCheck', 'boolean', 'false', 'Skip pre-request status lookups'],
            ['startupStatusCheck', 'boolean', 'false', 'Probe and print the status table on first post'],
          ],
        },
      ],
    },
    {
      slug: 'posting-stats',
      title: 'Posting stats',
      blurb: 'postStats, postStatsTo, postViaBotBlock and auto posting.',
      category: 'Core Concepts',
      blocks: [
        {
          type: 'code',
          lang: 'ts',
          content: `// every list you have a token for
const report = await lists.postStats({ serverCount: 120 });
report.posted;  // 4
report.failed;  // 0
report.skipped; // lists without tokens

// shard aware posting
await lists.postStats({
  serverCount: client.guilds.cache.size,
  shardCount: client.shard?.count,
  shards: await client.shard?.fetchClientValues('guilds.cache.size') as number[],
});

// only some lists, or skip some
await lists.postStats({ serverCount: 120 }, { only: ['top.gg', 'botlist.me'] });
await lists.postStats({ serverCount: 120 }, { skip: ['bots.ondiscord.xyz'] });

// one specific list
await lists.postStatsTo('radarcord', { serverCount: 120 });

// one request, botblock fans out to every list for you
await lists.postViaBotBlock({ serverCount: 120 });`,
        },
        { type: 'h3', content: 'Wire format mapping' },
        {
          type: 'text',
          content:
            'Every list names the server count differently. The registry stores the exact field per list and builds the correct body automatically:',
        },
        {
          type: 'table',
          headers: ['List', 'Body field', 'Auth header'],
          rows: [
            ['top.gg', 'server_count', 'Authorization'],
            ['discord.bots.gg', 'guildCount', 'Authorization'],
            ['discordbotlist.com', 'guilds', 'Authorization'],
            ['botlist.me', 'server_count', 'authorization'],
            ['disforge.com', 'servers', 'Authorization'],
            ['discordlist.gg', 'count', 'Authorization'],
            ['discord.rovelstars.com', 'count', 'authorization'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'auto posting on an interval',
          content: `lists.startAutoPost(30 * 60 * 1000); // every 30 minutes, minimum 60s
lists.stopAutoPost();`,
        },
        {
          type: 'note',
          tone: 'warn',
          content:
            'BotBlock allows one successful request per 120 seconds. postViaBotBlock never retries inside that window; the SDK reports the 429 with retryAfter instead.',
        },
      ],
    },
    {
      slug: 'realtime-events',
      title: 'Realtime events',
      blurb: 'Votes, comments, reviews and ratings with zero delay.',
      category: 'Core Concepts',
      blocks: [
        {
          type: 'text',
          content:
            'startWebhooks launches a dependency free http server. Point each list dashboard at your address with the list id appended and payloads arrive as typed events instantly.',
        },
        {
          type: 'code',
          lang: 'ts',
          content: `await lists.startWebhooks();
console.log(lists.webhook.address); // http://localhost:8080/discord-botlists

// give each dashboard:
//   https://yourdomain.dev/discord-botlists/top.gg
//   https://yourdomain.dev/discord-botlists/botlist.me

lists.on('vote', (vote) => {
  vote.listId;     // 'top.gg'
  vote.voterId;    // '160105994217586689'
  vote.voterName;  // 'someuser'
  vote.weight;     // 2 on weekend multiplier lists
  vote.weekend;    // true
  vote.isTest;     // dashboard test button
  vote.query;      // { ref: 'partner' }
  vote.raw;        // untouched original body
});

lists.on('review', (review) => {
  review.rating;   // 1 to 5 when sent
  review.content;  // review text
});

lists.on('comment', onComment);
lists.on('rating', onRating);
lists.on('test', (vote) => console.log('test from', vote.listId));
lists.on('statsPosted', (report) => console.log(report.posted, 'lists updated'));
lists.on('error', (error) => console.error(error.message));`,
        },
        {
          type: 'table',
          headers: ['Event', 'Payload', 'Fired when'],
          rows: [
            ['vote', 'UniversalVote', 'A user votes on any list'],
            ['comment', 'UniversalComment', 'A comment arrives'],
            ['review', 'UniversalComment', 'A review arrives'],
            ['rating', 'UniversalComment', 'A rating arrives'],
            ['test', 'UniversalVote', 'A list dashboard sends a test'],
            ['statsPosted', 'PostReport', 'After each postStats fan-out'],
            ['status', 'StatusBoard', 'After each status refresh'],
            ['raw', 'ParsedWebhook', 'Every parsed webhook'],
            ['request', 'RequestLog', 'Every http request received'],
            ['error', 'Error', 'Bad auth, invalid json, internal errors'],
          ],
        },
        { type: 'h3', content: 'Using your own http framework' },
        {
          type: 'code',
          lang: 'ts',
          content: `// express, fastify, whatever you already run
app.post('/webhooks/:list', (req, res) => {
  lists.ingestWebhook(req.params.list, req.body);
  res.sendStatus(200);
});`,
        },
        {
          type: 'note',
          tone: 'tip',
          content:
            'Webhook payloads are normalized per list using the registry webhook hints: the header each list signs with, the voter id field and whether the list uses an event type field like top.gg v1.',
        },
      ],
    },
    {
      slug: 'vote-announcer',
      title: 'Vote announcements',
      blurb: 'Realtime vote posts to Discord webhooks - text, embed or Components V2.',
      category: 'Guides',
      blocks: [
        {
          type: 'text',
          content:
            'The VoteAnnouncer broadcasts every incoming vote to Discord channel webhooks (and any external https endpoint) in realtime. It is DISABLED by default - nothing leaves your process until you pass `enabled: true`. It is built directly on the Discord execute-webhook REST endpoint with plain fetch: no discord.js, no Eris, works inside any framework or none.',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'wire it up',
          content: `const lists = new Botlists({
  client,
  announcer: {
    enabled: true,               // required - off by default
    format: 'embed-v2',          // 'text' | 'embed' | 'embed-v2'
    webhooks: [process.env.VOTE_WEBHOOK_URL!],   // Discord channel webhooks
    external: ['https://api.example.com/hooks/votes'], // JSON { source, event, list, vote }
    username: 'Vote Alerts',     // optional webhook identity overrides
    color: 0x5865f2,
    links: [{ label: 'Vote Again', url: 'https://top.gg/bot/YOUR_BOT/vote', emoji: '🗳️' }],
    announceTestVotes: false,    // dashboard test deliveries: ignore by default
  },
});`,
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'three render formats',
          content: `// 'text' - plain message content from a {placeholder} template
{ format: 'text', template: '🗳️ {voter} voted on {list}!' }

// 'embed' - classic rich embed (title, description, color, timestamp, thumbnail)
{ format: 'embed' }

// 'embed-v2' - Components V2: section + avatar accessory, separator,
// link buttons; the IS_COMPONENTS_V2 flag is set for you
{ format: 'embed-v2' }`,
        },
        {
          type: 'table',
          headers: ['Option', 'Default', 'What it does'],
          rows: [
            ['enabled', 'false', 'master switch for wiring inside Botlists (standalone instances are always active)'],
            ['format', "'embed'", 'render style: text / embed / embed-v2'],
            ['webhooks', '[]', 'Discord channel webhook urls (discord.com, discordapp.com, canary, ptb)'],
            ['external', '[]', 'any https endpoint - receives { source, event, list, vote } JSON'],
            ['username / avatarUrl', 'webhook default', 'override the posting identity'],
            ['botToken', 'undefined', 'read-only: resolves username/avatar via GET /users/@me so posts use the bot’s identity'],
            ['template', 'see below', '{placeholder} text: {voter} {voterId} {list} {listId} {bot} {botId} {weight} {weekend}'],
            ['links', '[]', 'link buttons appended to embed-v2 (max 5)'],
            ['customize', 'undefined', '(vote, payload) => payload - full control, mutate or replace before sending'],
            ['announceTestVotes', 'false', 'also announce dashboard test deliveries'],
            ['minIntervalMs', '1000', 'spacing between two sends to the SAME target (rate-limit safety)'],
            ['maxQueueSize', '500', 'per-target queue bound; the oldest vote is dropped when full'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'standalone use',
          content: `import { Botlists, VoteAnnouncer } from '@potenfyrstudios/discord-botlists';

const announcer = new VoteAnnouncer({ format: 'embed-v2', webhooks: [url] });
announcer.on('delivered', (d) => console.log('sent to', d.target, d.status));
const lists = new Botlists({ client });
lists.on('vote', (vote) => announcer.announce(vote));`,
        },
        {
          type: 'note',
          tone: 'tip',
          content:
            'Rate-limit safety is on by default: sends to the same target are spaced ≥ 1 s apart, a 429 with a small Retry-After is waited out exactly once, queues are bounded so a webhook outage can never grow memory, and scheduler timers are unref\'d - zero idle resource usage.',
        },
      ],
    },
    {
      slug: 'webhook-security',
      title: 'Webhook security',
      blurb: 'How the server rejects fake votes, floods and brute force.',
      category: 'Core Concepts',
      blocks: [
        {
          type: 'text',
          content:
            'Anyone who discovers your webhook URL could POST fake votes. The server defends against that with secure defaults: secrets are required, per-IP rate limiting and brute-force lockout are always on, and HMAC payload signing is supported per list.',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'security options',
          content: `const lists = new Botlists({
  webhook: {
    port: 8080,
    secret: {
      'top.gg': 'shared-secret-for-topgg',
      'botlist.me': 'another-secret',
    },
    security: {
      // HMAC-SHA256 signing keys per list. when present, requests from that
      // list must carry a valid signature in x-signature-256 /
      // x-hub-signature-256 / x-signature.
      hmac: { 'top.gg': 'webhook-signing-key' },

      // per ip rate limit (default 30/min). extra requests get 429.
      rateLimit: { max: 30, windowMs: 60_000 },

      // ban an ip after N consecutive auth failures (default 10),
      // for M ms (default 15 minutes). banned ips get 403.
      banAfterFailures: 10,
      banDurationMs: 15 * 60_000,

      // only these lists may POST at all. others get 403.
      allowedLists: ['top.gg', 'botlist.me', 'discordbotlist.com'],

      // set true behind nginx/cloudflare so rate limits use the real ip.
      trustProxy: true,

      // only for local testing: accept unsigned posts.
      requireSecret: false,
    },
  },
});`,
        },
        {
          type: 'table',
          headers: ['Threat', 'Defense', 'Response'],
          rows: [
            ['Fake votes (no secret)', 'Secret required on every POST', '401'],
            ['Replayed/forged payloads', 'top.gg v1 signature or HMAC-SHA256 check', '401'],
            ['Captured delivery replayed later', 'v1 timestamp window (10 min)', '401'],
            ['Secret brute force', 'Failure counter per ip', '403 ban after 10'],
            ['Request floods', 'Per ip token bucket', '429 + Retry-After'],
            ['Giant payloads', '512 KB body limit', '413'],
            ['Unlisted sources', 'allowedLists check', '403'],
          ],
        },
        {
          type: 'h3',
          content: 'top.gg v1 signed deliveries',
        },
        {
          type: 'text',
          content:
            'top.gg migrated its webhooks: instead of the shared password in the Authorization header, every v1 delivery carries `x-topgg-signature: t=<unix seconds>,v1=<hex>` where v1 is HMAC-SHA256 of `<t>.<rawBody>` keyed with your whs_-prefixed webhook secret. The SDK verifies this scheme automatically whenever the `top.gg` secret is configured - keep using the same secret, nothing else changes. The legacy Authorization header (and the other lists’ signature headers) keep working alongside it.',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'verify a v1 delivery inside your own framework route',
          content: `// With headers passed, ingest() enforces transport auth itself and returns
// null on a bad signature. Without headers it trusts your framework's auth
// and only parses.
const parsed = lists.webhook.ingest('top.gg', req.body, {
  headers: { 'x-topgg-signature': req.headers['x-topgg-signature'] },
});
if (!parsed) return res.status(401).end();`,
        },
        {
          type: 'text',
          content:
            'The v1 payload is wrapped ({"vote":{"userId":..,"botId":..,"type":"vote"|"test"}}). The SDK flattens it transparently: your `vote` event still receives voterId, botId and a `raw` field holding the original enveloped body. Dashboard test deliveries (type "test") arrive on the `test` event with isTest: true.',
        },
        {
          type: 'note',
          tone: 'warn',
          content:
            'The server throws at start() when requireSecret is true (the default) and no secret was configured. This is intentional: an open webhook endpoint will receive fake votes within hours of going public.',
        },
      ],
    },
    {
      slug: 'fetching-data',
      title: 'Fetching data',
      blurb: 'fetchBot, fetchVotes, hasVoted, searchBots, widgets.',
      category: 'Core Concepts',
      blocks: [
        {
          type: 'code',
          lang: 'ts',
          content: `const bot = await lists.fetchBot('discord.bots.gg', '557628352828014614');
bot.name;        // 'Ticket Tool'
bot.prefix;      // '$ (Customizable)'
bot.library;     // 'discord.js'

const votes = await lists.fetchVotes('top.gg');       // number | null
const voted = await lists.hasVoted('top.gg', userId); // boolean | null
const found = await lists.searchBots('botlist.me', 'music', 5);

lists.widgetUrl('top.gg');  // widget image url
lists.viewBotUrl('top.gg'); // listing page url`,
        },
        {
          type: 'note',
          tone: 'warn',
          content:
            'top.gg and voidbots require a token even for reads. Lists without a public bot endpoint throw a BotlistsError with listId attached; catch it and fall back.',
        },
      ],
    },
    {
      slug: 'universal-parser',
      title: 'Universal parser',
      blurb: 'One shape for every list response.',
      category: 'Core Concepts',
      blocks: [
        {
          type: 'text',
          content:
            'Lists name the same concept ten different ways: server_count, guildCount, guilds, servers, count. The parser reads each field in priority order, including nested paths like stats.server_count, and returns UniversalBot:',
        },
        {
          type: 'code',
          lang: 'ts',
          content: `import { UniversalParser } from '@potenfyrstudios/discord-botlists';

const parser = new UniversalParser();
const bot = parser.parseBot(listRecord, rawApiResponse);

interface UniversalBot {
  listId: string;      listName: string;
  id: string;          name: string;
  avatar: string | null;
  owners: string[];
  serverCount: number | null;
  votes: number | null;         monthlyVotes: number | null;
  certified: boolean | null;
  ratings: { average: number | null; count: number | null };
  tags: string[];
  raw: unknown;        fetchedAt: number;
  // ...description, invite, prefix, library, github, supportServer
}`,
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'arrays and votes only',
          content: `const many = parser.parseBots(list, rawArray);
const justVotes = parser.parseVotes(list, rawResponse);`,
        },
      ],
    },
    {
      slug: 'status-checking',
      title: 'Status checking',
      blurb: 'Latency, uptime state, dead list detection.',
      category: 'Guides',
      blocks: [
        {
          type: 'code',
          lang: 'ts',
          content: `const board = await lists.refreshStatus();
board.summary; // { live: 33, deprecated: 0, shutdown: 0, unknown: 0 }

board.entries[0];
// { listId, listName, website, state, httpStatus, latencyMs, lastChecked }

// probe, print the unicode console table, get github issue links for dead lists
await lists.checkAndReportStatus();`,
        },
        {
          type: 'table',
          headers: ['State', 'Meaning', 'What happens'],
          rows: [
            ['live', 'Website answered HTTP < 500', 'Stays in the registry'],
            ['deprecated', 'Superseded or announced end of life', 'PR opens to remove it'],
            ['shutdown', 'Unreachable or parked domain', 'PR opens to remove it'],
            ['unknown', '5xx answers, list is struggling', 'Kept, watched closely'],
          ],
        },
        {
          type: 'note',
          tone: 'info',
          content:
            'The hourly GitHub workflow updates the README table and website on main directly. Only deprecated or shutdown detections open a pull request, so registry changes always get a human review.',
        },
      ],
    },
    {
      slug: 'custom-lists',
      title: 'Custom lists',
      blurb: 'Self-hosted or missing lists.',
      category: 'Guides',
      blocks: [
        {
          type: 'code',
          lang: 'ts',
          content: `const lists = new Botlists({
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
          type: 'text',
          content:
            'Custom lists work everywhere built-in ones do: posting, webhooks, parsing, status probing and the env token pattern. Request built-in support for any live list through the list-request issue template.',
        },
      ],
    },
    {
      slug: 'rate-limits',
      title: 'Rate limit safety',
      blurb: 'How the SDK stays polite to every API.',
      category: 'Guides',
      blocks: [
        {
          type: 'list',
          items: [
            'Stats posts: 1 s gap between lists by default (postSpacingMs), one polite retry on 429 honouring Retry-After when it is ≤ 30 s, and ±5% jitter on the auto-post timer so fleets never hit lists in lockstep.',
            'top.gg shards quirk: an EMPTY shards array zeroes your published server_count on top.gg - the SDK omits the field entirely unless the bot actually reports shard data.',
            'Vote announcer: sends to the same Discord webhook are spaced ≥ 1 s apart (minIntervalMs), a 429 with a small Retry-After is waited out once, and per-target queues are bounded (maxQueueSize 500, oldest dropped) so a stalled webhook can never grow memory. Timers are unref\'d and only alive while a delivery is pending.',
            'BotBlock mode: one request total, never retried inside their 120 s window.',
            'Status probes: max 8 concurrent HEAD requests, browser user agent, board cached for 5 minutes.',
            'Fetches: token header only on endpoints that need it, public reads stay unauthenticated.',
            'Webhooks (inbound): push based, so there is zero polling traffic against any list API.',
          ],
        },
      ],
    },
    {
      slug: 'api-reference',
      title: 'API Reference',
      blurb: 'Every class, method and type.',
      category: 'API Reference',
      blocks: [
        { type: 'h3', content: 'class Botlists extends EventEmitter' },
        {
          type: 'table',
          headers: ['Method', 'Returns', 'Description'],
          rows: [
            ['postStats(stats?, opts?)', 'Promise<PostReport>', 'Post to every tokened list, filter with only or skip'],
            ['postStatsTo(list, stats?)', 'Promise<PostResult>', 'Post to one list'],
            ['postViaBotBlock(stats?)', 'Promise<PostReport>', 'Single BotBlock fan-out'],
            ['startWebhooks(port?)', 'Promise<string>', 'Start the realtime server, returns address'],
            ['stopWebhooks()', 'Promise<void>', 'Stop the server'],
            ['ingestWebhook(list, body, isTest?)', 'void', 'Feed a webhook from your own framework'],
            ['fetchBot(list, botId?)', 'Promise<UniversalBot>', 'Normalized bot data from one list'],
            ['fetchVotes(list, botId?)', 'Promise<number | null>', 'Vote count on one list'],
            ['hasVoted(list, userId)', 'Promise<boolean | null>', 'User vote check where supported'],
            ['searchBots(list, query, limit?)', 'Promise<UniversalBot[]>', 'Search a list directory'],
            ['refreshStatus(force?)', 'Promise<StatusBoard>', 'Probe every list'],
            ['checkAndReportStatus(force?)', 'Promise<StatusBoard>', 'Probe, print table, issue links'],
            ['widgetUrl(list, botId?)', 'string | null', 'Widget image url'],
            ['viewBotUrl(list, botId?)', 'string | null', 'Listing page url'],
            ['startAutoPost(intervalMs?, stats?)', 'void', 'Periodic posting, default 30 min'],
            ['stopAutoPost()', 'void', 'Stop periodic posting'],
          ],
        },
        { type: 'h3', content: 'class VoteWebhookServer extends EventEmitter' },
        {
          type: 'table',
          headers: ['Member', 'Description'],
          rows: [
            ['start() / stop()', 'Control the http server'],
            ['ingest(listQuery, body, opts)', 'Parse and emit without a socket'],
            ['address', 'http://host:port/path'],
            ['isRunning', 'Server state'],
          ],
        },
        { type: 'h3', content: 'class UniversalParser' },
        {
          type: 'table',
          headers: ['Method', 'Returns'],
          rows: [
            ['parseBot(list, payload)', 'UniversalBot'],
            ['parseBots(list, payload)', 'UniversalBot[]'],
            ['parseVotes(list, payload)', 'number | null'],
            ['parseVoteWebhook(list, body, isTest?)', 'UniversalVote'],
            ['parseCommentWebhook(list, body, kind?)', 'UniversalComment'],
          ],
        },
        { type: 'h3', content: 'class ConsoleReport (static)' },
        {
          type: 'table',
          headers: ['Method', 'Returns'],
          rows: [
            ['table(board)', 'Unicode status table string'],
            ['issueUrls(dead, repo?)', 'Prefilled GitHub issue urls per dead list'],
          ],
        },
        { type: 'h3', content: 'class StatusChecker (static)' },
        { type: 'table', headers: ['Method', 'Returns'], rows: [['toMarkdown(board)', 'Markdown table for READMEs']] },
        { type: 'h3', content: 'Errors' },
        {
          type: 'text',
          content:
            'BotlistsError carries listId, status and retryAfter so you can react per list. resolveList throws on ambiguous matches and returns null on unknown ids.',
        },
      ],
    },
    {
      slug: 'migration-v1',
      title: 'Migrating from v1',
      blurb: 'Old class to new SDK in five minutes.',
      category: 'Guides',
      blocks: [
        {
          type: 'table',
          headers: ['discord-botlists 1.x', '2.0.0'],
          rows: [
            ['new BotLists(webhook, data, port, ip, redirect)', 'new Botlists({ webhook: { port, path, secret } })'],
            ['botlists.start()', 'await lists.startWebhooks()'],
            ["on('vote', (name, token) => ...)", "on('vote', (vote) => vote.voterId)"],
            ['express dependency', 'Zero dependencies, node:http'],
            ['axios dependency', 'Native fetch with retry-after handling'],
            ['manual botlists.json editing', 'Generated registry, auto pruned by status sync'],
          ],
        },
        {
          type: 'note',
          tone: 'info',
          content:
            'Event payloads changed from positional arguments to a single normalized object. Everything you read from vote.raw is still the untouched original body, so old integrations keep working during migration.',
        },
      ],
    },
  ],
};

/**
 * Versioned docs, discord.js style: CURRENT is always the shipped version's
 * content. Older versions are frozen in ./versions/ and merged in below so
 * every released version stays readable forever.
 */
import { ARCHIVED_VERSIONS } from './versions/index.js';

export const CURRENT_DOC: DocVersion = CURRENT;

export const DOC_VERSIONS: DocVersion[] = [CURRENT_DOC, ...ARCHIVED_VERSIONS.filter((v) => v.version !== CURRENT_VERSION)];
export const LATEST_VERSION = CURRENT_VERSION;
