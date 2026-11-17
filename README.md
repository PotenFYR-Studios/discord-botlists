<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:8b5cf6,50:ec4899,100:f97316&height=220&section=header&text=discord-botlists&fontSize=52&fontColor=ffffff&fontAlignY=34&desc=Votes%20%C2%B7%20Stats%20%C2%B7%20Webhooks%20%C2%B7%20Every%20botlist%2C%20one%20SDK&descSize=18&descAlignY=55&animation=twinkling" width="100%" alt="discord-botlists banner"/>

[![npm](https://img.shields.io/npm/v/@potenfyrstudios/discord-botlists.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=1c1e26&color=8b5cf6)](https://www.npmjs.com/package/@potenfyrstudios/discord-botlists)
[![npm downloads](https://img.shields.io/npm/dt/@potenfyrstudios/discord-botlists.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=1c1e26&color=ec4899)](https://www.npmjs.com/package/@potenfyrstudios/discord-botlists)
[![Website](https://img.shields.io/badge/https://docs.potenfyr.in/repo/discord-botlists?style=for-the-badge&logo=googlechrome&logoColor=white&labelColor=1c1e26)](https://docs.potenfyr.in/repo/discord-botlists)
[![Discord](https://img.shields.io/badge/Discord-Join%20us-5865F2?style=for-the-badge&logo=discord&logoColor=white&labelColor=1c1e26)](https://discord.com/invite/zUaN2FPBec)
[![GitHub](https://img.shields.io/badge/GitHub-PotenFYR--Studios-181717?style=for-the-badge&logo=github&logoColor=white&labelColor=1c1e26)](https://github.com/PotenFYR-Studios/discord-botlists)
[![View](https://komarev.com/ghpvc/?username=PotenFYR-Studios-discord-botlists&color=ec4899&style=for-the-badge&label=VIEW&labelColor=1c1e26)](https://github.com/PotenFYR-Studios/discord-botlists)

[![CI](https://img.shields.io/github/actions/workflow/status/PotenFYR-Studios/discord-botlists/ci.yml?branch=master&style=flat-square&logo=githubactions&label=CI&color=2ea043&labelColor=1c1e26)](https://github.com/PotenFYR-Studios/discord-botlists/actions/workflows/ci.yml)
[![status](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/PotenFYR-Studios/discord-botlists/master/.status/shield.json&style=flat-square&labelColor=1c1e26)](#live-status)
[![license](https://img.shields.io/badge/license-Apache--2.0%20%2B%20Commons%20Clause-8b5cf6.svg?style=flat-square&labelColor=1c1e26)](LICENSE)

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&pause=1200&color=8B5CF6&center=true&vCenter=true&width=800&lines=Post+stats+to+every+botlist+with+one+call;Realtime+votes%2C+comments+and+reviews;One+parser+for+every+API+shape;Zero+dependencies+%C2%B7+fully+typed)](https://github.com/PotenFYR-Studios/discord-botlists)

**`@potenfyrstudios/discord-botlists`**: the universal multi-botlist SDK for Discord bots: post stats to 27 verified live lists, get votes in realtime, parse every API into one shape.

[Docs](https://docs.potenfyr.in/repo/discord-botlists) · [Examples](https://docs.potenfyr.in/repo/discord-botlists/examples) · [npm](https://www.npmjs.com/package/@potenfyrstudios/discord-botlists) · [Issues](https://github.com/PotenFYR-Studios/discord-botlists/issues) · [Live status](#live-status)

</div>

---

## Why discord-botlists

Posting your bot's stats to every list and handling every list's webhook format yourself is weeks of glue code. This package does all of it with zero runtime dependencies:

- **Stats posting** to 27 verified live lists, each with its correct wire format, auth header and endpoint, learned from every list's own docs plus the BotBlock directory. Dead lists are pruned automatically by the hourly status sync.
- **Realtime vote, comment and review events** through your own web server (Express, Fastify, Koa, Hono, serverless and more) or, if you prefer, an optional built-in one. Nothing listens on a port unless you ask for it.
- **Universal parser** that normalizes any list's bot data into one `UniversalBot` object so you never juggle `server_count` vs `guildCount` vs `guilds` vs `count` again.
- **Status tracking**: automated hourly probes detect deprecated or shut down lists, with latency and HTTP state, synced into this README and the docs site.
- **Fully typed**: strict TypeScript, generic event emitter, autocomplete for every option.
- **Lightweight**: zero dependencies, works on Node 18+ and Bun.

> The full documentation lives at **[https://docs.potenfyr.in/repo/discord-botlists](https://docs.potenfyr.in/repo/discord-botlists)**: [API reference](https://docs.potenfyr.in/repo/discord-botlists/api-reference), [examples](https://docs.potenfyr.in/repo/discord-botlists/examples) and the [live status board](https://docs.potenfyr.in/repo/discord-botlists/status). This README mirrors the same content.

## Installation

```bash
npm install @potenfyrstudios/discord-botlists
# or
bun add @potenfyrstudios/discord-botlists
# or
pnpm add @potenfyrstudios/discord-botlists
```

Requirements: Node.js 18+ or Bun 1.1+. No peer dependencies.

**Works with every Discord framework, or none at all:**

| Framework | Auto stats collection |
| --- | --- |
| discord.js | pass `client` - reads `guilds.cache.size`, shard info |
| Eris | pass `client` - reads the guilds Map |
| Oceanic | pass `client` - reads the guilds Map |
| Any other client | pass `client` if it exposes `guilds` |
| Anything else / no framework | use `statsProvider` or pass stats explicitly |

```ts
// framework-less usage: stats provided by you
const lists = new Botlists({
  statsProvider: () => ({
    serverCount: shardManager.totalGuilds,
    shardCount: shardManager.shardCount,
  }),
});

// or per call
await lists.postStats({ serverCount: myGuildCount });
```

The webhook server, parser, status checks and every other feature are framework independent - they use plain HTTP and Node builtins.

## Quick start

```ts
import { Client } from 'discord.js';
import { Botlists } from '@potenfyrstudios/discord-botlists';

const client = new Client({ intents: ['Guilds'] });

const lists = new Botlists({
  client,
  tokens: {
    'top.gg': process.env.TOPGG_TOKEN,
    'discordbotlist.com': process.env.DBL_TOKEN,
  },
  webhook: {
    port: 8080,
    path: '/discord-botlists',
    secret: process.env.WEBHOOK_SECRET,
  },
});

client.once('ready', async () => {
  // 1. post stats to every list you gave a token for
  const report = await lists.postStats();
  console.log(`posted to ${report.posted} lists`);

  // 2. (optional) start the built-in vote webhook server.
  // Skip this if you already run a web server: see "Using your own server" below.
  await lists.startWebhooks();
});

// 3. react to votes the moment they happen
lists.on('vote', (vote) => {
  console.log(`${vote.voterId} voted on ${vote.listName} (x${vote.weight})`);
  // give the voter a bonus role here
});

lists.on('review', (review) => {
  console.log(`new review on ${review.listName}: ${review.content}`);
});

client.login(process.env.DISCORD_TOKEN);
```

Point each botlist's webhook URL at `https://your-domain:8080/discord-botlists/<list-id>` and votes arrive as typed events instantly. Per-list wire formats, env variable names and more live examples: [docs](https://docs.potenfyr.in/repo/discord-botlists/docs) · [examples](https://docs.potenfyr.in/repo/discord-botlists/examples).

### top.gg v1 signed webhooks

top.gg no longer sends the shared password in the `Authorization` header. Every **top.gg v1 delivery** carries `x-topgg-signature: t=<unix seconds>,v1=<hex>`, the HMAC-SHA256 of `<t>.<rawBody>` keyed with your `whs_...` webhook secret from the top.gg dashboard. The SDK verifies this automatically - just keep the secret configured for `top.gg` (the same field you already had). The legacy `Authorization` header and other signature schemes keep working for every other list.

The v1 payload is wrapped (`{"vote":{"userId":..,"botId":..,"type":"vote"|"test"}}`); the SDK flattens it so your `vote` handler is unchanged, preserves the original body on `vote.raw`, and routes dashboard test deliveries to the `test` event with `isTest: true`. Feeding bodies through `lists.webhook.ingest()` from your own framework route? Pass the delivery `headers` and `ingest` enforces the signature check for you (returns `null` on failure); omit them and it trusts your framework's auth.

### Announce votes to Discord in realtime (text / embed / embed-v2)

Disabled by default - opt in and every incoming vote is broadcast to your Discord channel webhooks (and optionally external endpoints) through the raw Discord execute-webhook REST API, no Discord library required:

```ts
const lists = new Botlists({
  client,
  announcer: {
    enabled: true,
    format: 'embed-v2', // 'text' ({placeholder} template) | 'embed' | 'embed-v2' (Components V2)
    webhooks: [process.env.VOTE_WEBHOOK_URL!],          // Discord channel webhooks
    external: ['https://api.example.com/hooks/votes'],  // JSON: { source, event, list, vote }
    links: [{ label: 'Vote Again', url: 'https://top.gg/bot/YOUR_BOT/vote', emoji: '🗳️' }],
  },
});
```

Rate-limit safe by default: ≥ 1 s spacing per target (`minIntervalMs`), one polite Retry-After wait on 429, bounded queues (`maxQueueSize`, oldest dropped - a stalled webhook can never grow memory) and unref'd timers that only exist while a delivery is pending. Full control via `customize(vote, payload)`, identity overrides via `username` / `avatarUrl` / `botToken`, and a standalone `VoteAnnouncer` class for custom pipelines.

## Using your own server and Discord library

The built-in webhook server is optional and off by default: the package opens no port unless you call `startWebhooks()` or pass `webhook.autoStart`. Instead you can plug vote webhooks into a server you already run. The Discord client is read by duck-typing, so no Discord library is a dependency. The adapters and client readers below are covered by tests with stand-in objects shaped like each framework or library; they have not been run against every real version.

**Web frameworks.** Every adapter forwards to one core (`webhook.process()`), so secrets, HMAC/JWT checks and dedupe behave identically. Pin the list with `{ list: 'top.gg' }` or let the URL decide (`/votes/top.gg` or `?list=top.gg`).

| You run | Use |
| --- | --- |
| Express, Connect, Polka, Restify, NestJS (express), Next.js pages API | `expressHandler(lists.webhook)` |
| Fastify | `fastifyHandler(lists.webhook)` |
| Koa / @koa/router | `koaHandler(lists.webhook)` |
| AWS Lambda, API Gateway v1/v2, function URLs, Netlify, Vercel | `lambdaHandler(lists.webhook)` |
| Hono, Elysia, Next.js route handlers, SvelteKit, Remix, Bun, Deno, Cloudflare Workers, h3/Nitro | `fetchHandler(lists.webhook)` or `lists.webhook.handleRequest(request)` |
| Anything else | `await lists.webhook.process({ method, url, headers, rawBody })` |

```ts
import express from 'express';
import { Botlists, expressHandler } from '@potenfyrstudios/discord-botlists';

const lists = new Botlists({ client, webhook: { secret: { 'top.gg': process.env.TOPGG_SECRET! } } });
app.post('/votes/:list', express.raw({ type: '*/*' }), expressHandler(lists.webhook));
lists.on('vote', (v) => reward(v.voterId));
```

Signature lists (top.gg v1, DisQ, TheDiscordList, TopBot, DiscordForge v2) sign the exact bytes, so give the adapter the raw body (`express.raw`, `fastify-raw-body`, koa-bodyparser `rawBody`) or leave the stream untouched. Parsed-only bodies are re-serialised, which usually matches but is not guaranteed.

**Discord libraries.** Written for discord.js (v13/v14, sharded or not, including `ShardingManager`), Eris, Oceanic, Fluxer, Discordeno, Seyfert, or your own object.

```ts
const lists = new Botlists({ client });
lists.attach(); // waits for ready, posts once, then every 30 min
```

`attach()` listens for `clientReady`/`botReady`/`ready` (discord.js `ready` is skipped: deprecated since 14.22) and also polls readiness, so a renamed event cannot leave the bot unlisted. Server and shard counts are summed across shards through `client.shard.fetchClientValues('guilds.cache.size')` or a `ShardingManager`; Eris/Oceanic per-shard counts come from `guild.shardID`. Anything else: pass `statsProvider` or `postStats({ serverCount })`.

**Runtimes.** ESM and CommonJS builds with typed subpath exports (`/adapters`, `/webhooks`, `/votes`, `/lists`), no top-level `node:http` import (it loads only if you call `startWebhooks()`), zero runtime dependencies. Tested on Node (import and require) and Bun. The Web `Request`/`Response` handler is built for Workers and Deno, but I have not run it on them.

## Beyond posting stats

Features single-list SDKs (`@top-gg/sdk`, `topgg-autoposter`, `blapi`) do not give you:

**Vote ledger: reward users without polling any API.** Votes from every list land in one per-user record.

```ts
import { Botlists, FileVoteStore } from '@potenfyrstudios/discord-botlists';

const lists = new Botlists({
  client,
  webhook: { secret: process.env.VOTE_SECRET },
  voteLedger: { store: new FileVoteStore('./data/votes.json') }, // or `true` for memory, or your own VoteStore (redis, sqlite...)
});

// /daily command: true only ONCE per vote, retry- and double-click-safe
if (await lists.ledger!.claim(interaction.user.id)) grantReward();
await lists.ledger!.hasVoted(userId);              // voted on ANY list in the last 12h
await lists.ledger!.hasVoted(userId, { listId: 'top.gg', withinMs: 3_600_000 });
await lists.ledger!.streak(userId);                // consecutive UTC days
await lists.ledger!.nextVoteAt(userId, 'top.gg');  // when they can vote again
await lists.ledger!.top(10);                       // leaderboard
```

**Bring your own server: `handleRequest(Request) => Response`.** No http server of ours needed for Hono, Next.js route handlers, Bun, Deno, Cloudflare Workers or Remix. Same secret, HMAC, JWT and dedupe rules as the built-in server.

```ts
app.post('/votes/*', (c) => lists.webhook.handleRequest(c.req.raw)); // Hono
```

**Self-healing posting.** A per-list circuit breaker skips lists that keep failing (network/5xx/404/410) with exponential backoff and re-probes them; auth and rate-limit errors never trip it. `lists.health` shows the state, `lists.resetHealth()` clears it. Slow lists are never reported dead: the status probe retries HEAD and GET and only declares `shutdown` on a hard DNS/connection failure.

**`await lists.doctor()`** checks every configured token against the list (rejected, unverified, unreachable), flags `DBL_*` env typos and a missing bot id, and never posts anything.

**Webhook dedupe.** Lists retry slow deliveries; the same envelope id emits once (`webhook.dedupeTtlMs`).

**Typed events.** `lists.on('vote', (v) => v.voterId)` is fully typed via `BotlistsEventMap`.

## Full API

### class `Botlists`

| Method | Returns | Description |
| --- | --- | --- |
| `postStats(stats?, opts?)` | `Promise<PostReport>` | Post to every list you have a token for. `opts.only` / `opts.skip` filter by list id. |
| `postStatsTo(list, stats?)` | `Promise<PostResult>` | Post to one list. |
| `postViaBotBlock(stats?)` | `Promise<PostReport>` | One request to botblock.org that fans out to all lists. |
| `startWebhooks(port?)` | `Promise<string>` | Optional. Start the built-in webhook server, returns its address. Not needed when you use an adapter. |
| `stopWebhooks()` | `Promise<void>` | Stop the webhook server. |
| `ingestWebhook(list, body, isTest?)` | `void` | Feed a webhook body from your own express/fastify app. |
| `fetchBot(list, botId?)` | `Promise<UniversalBot>` | Fetch and normalize a bot from one list. |
| `fetchVotes(list, botId?)` | `Promise<number \| null>` | Current vote count on one list. |
| `hasVoted(list, userId)` | `Promise<boolean \| null>` | Check if a user voted (lists that expose it). |
| `searchBots(list, query, limit?)` | `Promise<UniversalBot[]>` | Search a list's directory. |
| `refreshStatus(force?)` | `Promise<StatusBoard>` | Probe all lists: state, latency, HTTP. |
| `checkAndReportStatus(force?)` | `Promise<StatusBoard>` | Probe + console table + issue links. |
| `widgetUrl(list, botId?)` | `string \| null` | Widget image URL on a list. |
| `viewBotUrl(list, botId?)` | `string \| null` | Public bot page on a list. |
| `startAutoPost(intervalMs?, stats?)` | `void` | Re-post stats periodically (default 30 min). |
| `stopAutoPost()` | `void` | Stop the auto poster. |

A list can be referenced by id (`'top.gg'`), name (`'Discord Bots'`), hostname (`'discord.bots.gg'`) or shorthand (`'topgg'`, `'voidbots'`, `'radarcord'`).

Also exported: `UniversalParser`, `StatusChecker`, `ConsoleReport`, `BotlistsError`, `EVENTS`, and the subpath exports `@potenfyrstudios/discord-botlists/webhooks` (`VoteWebhookServer`) and `/lists` (the raw registry).

### Realtime events

| Event | Payload | Fired when |
| --- | --- | --- |
| `vote` | `UniversalVote` | A user votes for your bot on any list. |
| `review` | `UniversalComment` | A review is posted. |
| `comment` | `UniversalComment` | A comment is posted. |
| `rating` | `UniversalComment` | A rating is posted. |
| `test` | `UniversalVote` | A list dashboard sends a webhook test. |
| `statsPosted` | `PostReport` | After each `postStats` fan-out. |
| `status` | `StatusBoard` | After each status refresh. |
| `raw` | `ParsedWebhook` | Every parsed webhook, for custom handling. |
| `request` | `{ method, url, status, listId }` | Every HTTP request the server receives. |
| `error` | `Error` | Bad auth, invalid JSON, internal errors. |

```ts
lists.on('vote', (vote) => {
  vote.listId;      // 'top.gg'
  vote.voterId;     // '160105994217586689'
  vote.voterName;   // 'someuser'
  vote.weight;      // 2 on weekend multiplier lists
  vote.weekend;     // true
  vote.isTest;      // false
  vote.query;       // { ref: 'partner' } if the vote link had query params
  vote.raw;         // the untouched original body
});
```

### `UniversalBot`: one shape for every list

Whatever list you call `fetchBot` on, you always get:

```ts
interface UniversalBot {
  listId: string;          // 'top.gg'
  listName: string;        // 'Discord Bot List'
  id: string;              // '432161800760442880'
  name: string;            // 'Rythm'
  avatar: string | null;
  description: string | null;
  owners: string[];        // ['160105994217586689']
  serverCount: number | null;
  shardCount: number | null;
  votes: number | null;         // total votes / points
  monthlyVotes: number | null;
  certified: boolean | null;
  website: string | null;
  github: string | null;
  supportServer: string | null;
  invite: string | null;
  prefix: string | null;
  library: string | null;
  tags: string[];
  ratings: { average: number | null; count: number | null };
  raw: unknown;            // original payload, always kept
  fetchedAt: number;       // unix ms
}
```

### Webhook security

Anyone who discovers your webhook URL could POST fake votes. The server defends against that by default:

- **Secret required**: POSTs without a valid secret are rejected with 401. The server refuses to start if you never configure a secret (override with `security.requireSecret = false` for local tests only).
- **Per-list secrets**: `secret: { 'top.gg': '...', 'botlist.me': '...' }` - each list only passes with its own value.
- **HMAC-SHA256 payload signing**: for lists that sign payloads, pass `security.hmac` keys and the server verifies the signature from `x-signature-256` / `x-hub-signature-256` / `x-signature` headers. A wrong signature is rejected even if the secret matches.
- **Per-IP rate limiting**: default 30 requests/minute, extra requests get 429 + `Retry-After`.
- **Brute-force lockout**: 10 consecutive auth failures bans the IP for 15 minutes (403).
- **List allowlist**: `security.allowedLists` restricts which lists may POST at all.
- **Body limit**: payloads over 512 KB are dropped (413).
- `security.trustProxy = true` if you run behind nginx/Cloudflare so rate limits key off the real client IP.

```ts
const lists = new Botlists({
  webhook: {
    port: 8080,
    secret: {
      'top.gg': 'shared-secret-for-topgg',
      'botlist.me': 'another-secret',
    },
    security: {
      // sign keys per list, checked against x-signature-256 etc.
      hmac: { 'top.gg': 'webhook-signing-key' },
      rateLimit: { max: 30, windowMs: 60_000 },
      banAfterFailures: 10,
      allowedLists: ['top.gg', 'botlist.me', 'discordbotlist.com'],
      trustProxy: true, // behind a reverse proxy
    },
  },
});
```

### Tokens: three ways, pick what fits

```bash
# 1. env vars (recommended). Pattern: DBL_<LISTID-UPPERCASED>
DBL_TOP.GG=eyJ...            # top.gg token
DBL_DISCORDBOTLIST.COM=...   # discordbotlist.com token
DBL_VOIDBOTS.NET=...
```

Env keys are mapped onto list ids automatically (`DBL_TOPGG` / `DBL_TOP.GG` → `top.gg`), so you never have to hand-translate names. Dots, underscores and casing don't matter.

```ts
// 2. constructor map
const lists = new Botlists({ tokens: { 'top.gg': 'eyJ...' } });

// 3. mixed: env is the base, the map overrides per key
```

`list.tokenEnvKey` tells you the env name for every list at runtime. See [.env.example](.env.example) for the full key list.

### Posting stats, including shards

```ts
await lists.postStats({
  serverCount: client.guilds.cache.size,
  shardCount: client.shard?.count,
  shards: await client.shard?.fetchClientValues('guilds.cache.size'),
});

// only some lists
await lists.postStats({ serverCount: 100 }, { only: ['top.gg', 'botlist.me'] });

// one list
await lists.postStatsTo('radarcord', { serverCount: 100 });

// single BotBlock request for all lists (counts as 1 request to botblock)
await lists.postViaBotBlock({ serverCount: 100 });
```

Every list gets its correct body shape automatically: `server_count` for top.gg, `guildCount` for discord.bots.gg, `guilds` for discordbotlist.com, `servers` for disforge, and so on for every supported list.

### Rate limit safety

- Posts are throttled with a 250 ms gap per list; HTTP layer retries 408/429/5xx with backoff, and strict requests honour `Retry-After` (≤ 30 s) once before failing.
- BotBlock mode sends one request total (their own limit is 1 per 120 s, the SDK will not retry it faster).
- Status probes use 8 parallel HEAD requests max (GET fallback for hosts that reject HEAD), browser UA, board cached 5 minutes.
- `fetchBot`/`searchBots` add your token only when required, public endpoints stay unauthenticated.

### Custom / self-hosted lists

```ts
const lists = new Botlists({
  lists: [{
    id: 'my-list.dev',
    name: 'My Self Hosted List',
    website: 'https://my-list.dev',
    apiPost: 'https://api.my-list.dev/bots/:id/stats',
    postField: 'server_count',
    postMethod: 'POST',
    authHeader: 'Authorization',
    apiDocs: null, apiGet: null, viewBot: null, widget: null,
    shardField: null, shardIdField: null, shardsArrayField: null,
    tokenEnvKey: 'DBL_MYLIST',
    webhook: { header: 'Authorization', voterField: 'user_id', eventField: null },
    supports: { post: true, get: false, widget: false, webhook: true },
  }],
});
```

Custom lists work everywhere built-in ones do: posting, webhooks, parsing, status.

## Supported lists (27 verified live)

The generated registry (`src/data/lists.generated.ts`, reproducible from the BotBlock snapshot) carries every audited list. Shutdown and deprecated lists stay in the registry but are marked `status: 'shutdown'` / `'deprecated'`: the SDK skips posting to them, and the status board below reports them red. The September 2026 docs audit pruned 8 domains that serve registrar parking or squatter pages despite answering HTTP 200 (blist.xyz, botlist.co, botsdatabase.com, discord.services, discordbot.world, motiondevelopment.top, space-bot-list.xyz, topcord.xyz) and added topbot.gg and discordforge.org. The October 2026 sync briefly marked 5 lists dead because the old probe treated a timeout as shutdown; they were re-verified (their APIs answer) and restored. Only bots.discordlabs.org (moved, API gone) is deprecated:

botlist.me | bots.ondiscord.xyz | carbonitex.net | cybralist.com | discord.bots.gg | discord.place | discord.rovelstars.com | discordbotlist.com | discordbotlist.xyz | discordextremelist.xyz | disforge.com | disq.ink | omniplex.gg | radarcord.net | discordforge.org | discordlist.gg | discords.com | discover.fluxpoint.dev | dlist.space | justdiscord.org | stellarbotlist.com | thediscordlist.com | top.gg | topbot.gg | vcodes.xyz | voidbots.net | yabl.xyz

Each record carries: endpoint URLs, wire field names, shard field names, auth header, widget and view URLs, webhook format hint and env var key.

Missing a list? [Open a list request](https://github.com/PotenFYR-Studios/discord-botlists/issues/new?template=list_request.yml) with its name, API docs link and a maintainer contact: live lists get added within days.

## Live status

<!-- STATUS:START -->
🟢 26 live | 🟡 1 deprecated | 🔴 0 shutdown | ⚪ 1 unknown

| List | Status |
| --- | --- |
| [Botlist.me](https://botlist.me/) | 🟢 live |
| [Discord Labs](https://bots.discordlabs.org/) | 🟡 deprecated |
| [Bots on Discord](https://bots.ondiscord.xyz/) | 🟢 live |
| [Carbonitex](https://www.carbonitex.net/discord/bots) | 🟢 live |
| [Cybralist](https://cybralist.com/) | 🟢 live |
| [Discord Bots](https://discord.bots.gg/) | 🟢 live |
| [discord.place](https://discord.place/bots) | 🟢 live |
| [Rovel Discord List](https://discord.rovelstars.com) | 🟢 live |
| [Discord Bot List](https://discordbotlist.com/) | 🟢 live |
| [Discord Bot List XYZ](https://discordbotlist.xyz/) | ⚪ unknown |
| [Discord Extreme List](https://discordextremelist.xyz/) | 🟢 live |
| [DiscordForge](https://discordforge.org/) | 🟢 live |
| [dlist.gg](https://discordlist.gg/) | 🟢 live |
| [Bots for Discord](https://discords.com/bots/) | 🟢 live |
| [Fluxpoint Discover](https://discover.fluxpoint.dev/) | 🟢 live |
| [Disforge](https://disforge.com/bots) | 🟢 live |
| [DisQ](https://disq.ink/) | 🟢 live |
| [DList.Space](https://dlist.space/) | 🟢 live |
| [JustDiscord](https://justdiscord.org/) | 🟢 live |
| [Omniplex](https://omniplex.gg/) | 🟢 live |
| [Radarcord](https://radarcord.net/) | 🟢 live |
| [Stellar Bot List](https://stellarbotlist.com/) | 🟢 live |
| [TheDiscordList](https://thediscordlist.com/) | 🟢 live |
| [Discord Bot List](https://top.gg/) | 🟢 live |
| [TopBot](https://topbot.gg/) | 🟢 live |
| [vCodes](https://vcodes.xyz) | 🟢 live |
| [Void Bots](https://voidbots.net/) | 🟢 live |
| [Yet Another Bot List](https://yabl.xyz/) | 🟢 live |
<!-- STATUS:END -->

The table above is regenerated hourly by [scripts/status-sync.ts](scripts/status-sync.ts) (workflow: `status-sync.yml`). A list is marked:

- 🟢 **live**: website answered with HTTP < 500.
- 🟡 **deprecated**: superseded or announced end of life.
- 🔴 **shutdown**: unreachable, or domain is parked/dead.

When a list turns deprecated or shutdown, the workflow keeps a **single tracking issue** open until every reported list is marked dead in the registry (`bun scripts/mark-dead.ts <ids>`), so a human always approves registry changes — no branches, no automated PRs. Marked lists drop out of stats posting and show red above. Pure latency/uptime refreshes land on the default branch directly.

## Testing

```bash
bun install
bun test                    # unit tests, no network
bun scripts/test-live.ts    # live integration, reads .env (optional)
```

Everything also runs in Docker (the pinned `oven/bun:1` image - no local toolchain needed):

```bash
docker compose -f docker-compose.test.yml run --rm tests   # typecheck + full suite
docker compose -f docker-compose.test.yml run --rm build   # tsc build
TOPGG_TOKEN=... TOPGG_WEBHOOK_SECRET=... \
  docker compose -f docker-compose.test.yml run --rm live  # real top.gg round-trip
```

For the live test: `cp .env.example .env`, fill in tokens for the lists you use (all optional), and run `bun scripts/test-live.ts`. It fetches real data, posts real stats (server count 1) and simulates a vote webhook, printing PASS/FAIL per action. Lists without tokens are skipped, nothing hard fails. `scripts/verify-topgg.mjs` is the production-style check: real stats POST + round-trip, a genuinely signed top.gg v1 delivery through the ingest path, and announcer validation - `TOPGG_TOKEN=... TOPGG_WEBHOOK_SECRET=... node scripts/verify-topgg.mjs <serverCount>`.

## Registry maintenance

```bash
# refresh the BotBlock snapshot and regenerate the registry
curl -s https://botblock.org/api/lists > scripts/snapshot/botblock-lists.json
python3 scripts/snapshot/build_lists.py
bun test   # verify nothing broke
```

## Contributing

PRs welcome; see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands and conventions. In short:

1. Add or fix list data in `scripts/snapshot/build_lists.py` (manual overrides), not the generated file.
2. Run `bun test` and `bun run lint`.
3. Keep the zero-dependency promise: no new runtime deps.

Found a vulnerability? Please report privately: see [SECURITY.md](SECURITY.md).

## Docs & links

- [Documentation site](https://docs.potenfyr.in/repo/discord-botlists) (this repo's `docs/`, deployed via GitHub Pages)
- [API reference](https://docs.potenfyr.in/repo/discord-botlists/api-reference) · [Examples](https://docs.potenfyr.in/repo/discord-botlists/examples) · [Status board](https://docs.potenfyr.in/repo/discord-botlists/status)
- [npm package](https://www.npmjs.com/package/@potenfyrstudios/discord-botlists)
- [PotenFYR Studios](https://github.com/PotenFYR-Studios) | [Website](https://potenfyr.in) | [Discord](https://discord.com/invite/zUaN2FPBec)

## License

Licensed under the **Apache License 2.0 with the Commons Clause**: free to fork, modify, use, and build around; not to be sold as a product. See [LICENSE](LICENSE); the LICENSE file is authoritative. Botlist names and trademarks belong to their respective owners; see [NOTICE.md](NOTICE.md).

---

Built by **[PotenFYR Studios](https://github.com/PotenFYR-Studios)** · [potenfyr.in](https://potenfyr.in) · Part of the PotenFYR Studios open-source ecosystem.

---

## ⭐ Star History

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=potenfyr-studios/.github,potenfyr-studios/.web,potenfyr-studios/AuthCore,potenfyr-studios/CustomDamageNumbers,potenfyr-studios/Database-Eggs,potenfyr-studios/EchoingDeaths,potenfyr-studios/FYRwall,potenfyr-studios/HBS-Tool,potenfyr-studios/LinkFYR,potenfyr-studios/Minecraft-Eggs,potenfyr-studios/OrbyNode,potenfyr-studios/PteroOps-MCP,potenfyr-studios/Prog-Language-Eggs,potenfyr-studios/Shell-Eggs,potenfyr-studios/VigilFYR,potenfyr-studios/discord-botlists,potenfyr-studios/ojaj,potenfyr-studios/potenfyr-nest,potenfyr-studios/statfyr&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=potenfyr-studios/.github,potenfyr-studios/.web,potenfyr-studios/AuthCore,potenfyr-studios/CustomDamageNumbers,potenfyr-studios/Database-Eggs,potenfyr-studios/EchoingDeaths,potenfyr-studios/FYRwall,potenfyr-studios/HBS-Tool,potenfyr-studios/LinkFYR,potenfyr-studios/Minecraft-Eggs,potenfyr-studios/OrbyNode,potenfyr-studios/PteroOps-MCP,potenfyr-studios/Prog-Language-Eggs,potenfyr-studios/Shell-Eggs,potenfyr-studios/VigilFYR,potenfyr-studios/discord-botlists,potenfyr-studios/ojaj,potenfyr-studios/potenfyr-nest,potenfyr-studios/statfyr&type=Date" />
  <img alt="Star history chart for all PotenFYR Studios public repositories" src="https://api.star-history.com/svg?repos=potenfyr-studios/.github,potenfyr-studios/.web,potenfyr-studios/AuthCore,potenfyr-studios/CustomDamageNumbers,potenfyr-studios/Database-Eggs,potenfyr-studios/EchoingDeaths,potenfyr-studios/FYRwall,potenfyr-studios/HBS-Tool,potenfyr-studios/LinkFYR,potenfyr-studios/Minecraft-Eggs,potenfyr-studios/OrbyNode,potenfyr-studios/PteroOps-MCP,potenfyr-studios/Prog-Language-Eggs,potenfyr-studios/Shell-Eggs,potenfyr-studios/VigilFYR,potenfyr-studios/discord-botlists,potenfyr-studios/ojaj,potenfyr-studios/potenfyr-nest,potenfyr-studios/statfyr&type=Date" width="80%" />
</picture>

Every public PotenFYR Studios repository on one live chart, served by [star-history.com](https://star-history.com).

## Contributing

Contributions make the open-source community such an amazing place to learn, inspire and create. Any contributions you make are **greatly appreciated** - see [CONTRIBUTING.md](CONTRIBUTING.md) and the [good first issues](https://github.com/PotenFYR-Studios/discord-botlists/labels/good%20first%20issue). Security concerns: please use [SECURITY.md](SECURITY.md) (private vulnerability reporting), not public issues.

<a href="https://github.com/PotenFYR-Studios/discord-botlists/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=PotenFYR-Studios/discord-botlists" alt="discord-botlists contributors" />
</a>
<a href="https://github.com/PotenFYR-Studios/discord-botlists/stargazers">
  <img src="https://img.shields.io/github/stars/PotenFYR-Studios/discord-botlists?style=social&label=Stars" alt="Live star count" />
</a>
<a href="https://github.com/PotenFYR-Studios/discord-botlists/network/members">
  <img src="https://img.shields.io/github/forks/PotenFYR-Studios/discord-botlists?style=social&label=Forks" alt="Live fork count" />
</a>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/PotenFYR-Studios/FYRwall/output/github-snake-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/PotenFYR-Studios/FYRwall/output/github-snake.svg" />
  <img alt="Contribution snake animation" src="https://raw.githubusercontent.com/PotenFYR-Studios/FYRwall/output/github-snake.svg" width="100%" />
</picture>

---

<!-- markdownlint-disable -->


<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:f97316,50:ec4899,100:8b5cf6&height=120&section=footer&text=Made%20with%20%E2%9D%A4%EF%B8%8F%20by%20PotenFYR%20Studios&fontSize=22&fontColor=ffffff&animation=twinkling" width="100%" alt="footer"/>

</div>
<!-- markdownlint-enable -->
