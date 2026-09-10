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

const V2: DocVersion = {
  version: '2.0.0',
  label: 'v2.0.0 (latest)',
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
            'Version 2.0.0 is a complete rewrite. The old express based class from 1.x is gone; see the migration section if you are coming from v1.',
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
            ['client', 'BotClientLike', 'null', 'discord.js or Eris client for auto stats'],
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
            'Posts: 250 ms gap between lists, retries on 429 and 5xx honouring Retry-After exactly once before failing.',
            'BotBlock mode: one request total, never retried inside their 120 s window.',
            'Status probes: max 8 concurrent HEAD requests, browser user agent, board cached for 5 minutes.',
            'Fetches: token header only on endpoints that need it, public reads stay unauthenticated.',
            'Webhooks: push based, so there is zero polling traffic against any list API.',
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

export const DOC_VERSIONS: DocVersion[] = [V2];
export const LATEST_VERSION = V2.version;
