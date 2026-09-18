<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:8b5cf6,50:ec4899,100:f97316&height=220&section=header&text=discord-botlists&fontSize=52&fontColor=ffffff&fontAlignY=34&desc=Votes%20%C2%B7%20Stats%20%C2%B7%20Webhooks%20%C2%B7%20Every%20botlist%2C%20one%20SDK&descSize=18&descAlignY=55&animation=twinkling" width="100%" alt="discord-botlists banner"/>

[![npm](https://img.shields.io/npm/v/@potenfyrstudios/discord-botlists.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=1c1e26&color=8b5cf6)](https://www.npmjs.com/package/@potenfyrstudios/discord-botlists)
[![npm downloads](https://img.shields.io/npm/dt/@potenfyrstudios/discord-botlists.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=1c1e26&color=ec4899)](https://www.npmjs.com/package/@potenfyrstudios/discord-botlists)
[![Website](https://img.shields.io/badge/docs-botlists.docs.potenfyr.in-8b5cf6?style=for-the-badge&logo=googlechrome&logoColor=white&labelColor=1c1e26)](https://botlists.docs.potenfyr.in)
[![Discord](https://img.shields.io/badge/Discord-Join%20us-5865F2?style=for-the-badge&logo=discord&logoColor=white&labelColor=1c1e26)](https://discord.com/invite/zUaN2FPBec)
[![GitHub](https://img.shields.io/badge/GitHub-PotenFYR--Studios-181717?style=for-the-badge&logo=github&logoColor=white&labelColor=1c1e26)](https://github.com/PotenFYR-Studios/discord-botlists)
[![View](https://komarev.com/ghpvc/?username=PotenFYR-Studios-discord-botlists&color=ec4899&style=for-the-badge&label=VIEW&labelColor=1c1e26)](https://github.com/PotenFYR-Studios/discord-botlists)

[![CI](https://img.shields.io/github/actions/workflow/status/PotenFYR-Studios/discord-botlists/ci.yml?branch=master&style=flat-square&logo=githubactions&label=CI&color=2ea043&labelColor=1c1e26)](https://github.com/PotenFYR-Studios/discord-botlists/actions/workflows/ci.yml)
[![status](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/PotenFYR-Studios/discord-botlists/master/.status/shield.json&style=flat-square&labelColor=1c1e26)](#live-status)
[![license](https://img.shields.io/badge/license-Apache--2.0%20%2B%20Commons%20Clause-8b5cf6.svg?style=flat-square&labelColor=1c1e26)](LICENSE)

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&pause=1200&color=8B5CF6&center=true&vCenter=true&width=800&lines=Post+stats+to+every+botlist+with+one+call;Realtime+votes%2C+comments+and+reviews;One+parser+for+every+API+shape;Zero+dependencies+%C2%B7+fully+typed)](https://github.com/PotenFYR-Studios/discord-botlists)

**`@potenfyrstudios/discord-botlists`**: the universal multi-botlist SDK for Discord bots: post stats to 33 verified live lists, get votes in realtime, parse every API into one shape.

[Docs](https://botlists.docs.potenfyr.in) · [Examples](https://botlists.docs.potenfyr.in/examples) · [npm](https://www.npmjs.com/package/@potenfyrstudios/discord-botlists) · [Issues](https://github.com/PotenFYR-Studios/discord-botlists/issues) · [Live status](#live-status)

</div>

---

## Why discord-botlists

Posting your bot's stats to every list and handling every list's webhook format yourself is weeks of glue code. This package does all of it with zero runtime dependencies:

- **Stats posting** to 33 verified live lists, each with its correct wire format, auth header and endpoint, learned from every list's own docs plus the BotBlock directory. Dead lists are pruned automatically by the hourly status sync.
- **Realtime vote, comment and review events** through a built-in webhook server. No polling, no delay, no express dependency.
- **Universal parser** that normalizes any list's bot data into one `UniversalBot` object so you never juggle `server_count` vs `guildCount` vs `guilds` vs `count` again.
- **Status tracking**: automated hourly probes detect deprecated or shut down lists, with latency and HTTP state, synced into this README and the docs site.
- **Fully typed**: strict TypeScript, generic event emitter, autocomplete for every option.
- **Lightweight**: zero dependencies, works on Node 18+ and Bun.

> The full documentation lives at **[botlists.docs.potenfyr.in](https://botlists.docs.potenfyr.in)**: [API reference](https://botlists.docs.potenfyr.in/docs/1.0.1/api-reference), [examples](https://botlists.docs.potenfyr.in/examples) and the [live status board](https://botlists.docs.potenfyr.in/status). This README mirrors the same content.

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

  // 2. start realtime vote webhooks
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

Point each botlist's webhook URL at `https://your-domain:8080/discord-botlists/<list-id>` and votes arrive as typed events instantly. Per-list wire formats, env variable names and more live examples: [docs](https://botlists.docs.potenfyr.in/docs) · [examples](https://botlists.docs.potenfyr.in/examples).

## Full API

### class `Botlists`

| Method | Returns | Description |
| --- | --- | --- |
| `postStats(stats?, opts?)` | `Promise<PostReport>` | Post to every list you have a token for. `opts.only` / `opts.skip` filter by list id. |
| `postStatsTo(list, stats?)` | `Promise<PostResult>` | Post to one list. |
| `postViaBotBlock(stats?)` | `Promise<PostReport>` | One request to botblock.org that fans out to all lists. |
| `startWebhooks(port?)` | `Promise<string>` | Start the realtime webhook server, returns its address. |
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

Every list gets its correct body shape automatically: `server_count` for top.gg, `guildCount` for discord.bots.gg, `guilds` for discordbotlist.com, `servers` for disforge, and so on for all 33.

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

## Supported lists (33 verified live)

The generated registry (`src/data/lists.generated.ts`, reproducible from the BotBlock snapshot) only contains lists that answered during the latest status audit. Shutdown and deprecated lists are removed automatically:

top.gg | discordbotlist.com | discord.bots.gg | botlist.me | discords.com | voidbots.net | vcodes.xyz | radarcord.net | discordextremelist.xyz | bots.ondiscord.xyz | discordlist.gg | disforge.com | disq.ink | dlist.space | cybralist.com | discord.rovelstars.com | yabl.xyz | justdiscord.org | omniplex.gg | discover.fluxpoint.dev | blist.xyz | motiondevelopment.top | topcord.xyz | discordbot.world | bots.discordlabs.org | botsdatabase.com | discordbotlist.xyz | space-bot-list.xyz | botlist.co | discord.services | stellarbotlist.com | carbonitex.net | discord.place

Each record carries: endpoint URLs, wire field names, shard field names, auth header, widget and view URLs, webhook format hint and env var key.

Missing a list? [Open a list request](https://github.com/PotenFYR-Studios/discord-botlists/issues/new?template=list_request.yml) with its name, API docs link and a maintainer contact: live lists get added within days.

## Live status

<!-- STATUS:START -->
Last sync: **2026-09-18** | 🟢 33 live | 🟡 0 deprecated | 🔴 0 shutdown | ⚪ 0 unknown

| List | Status | Latency | HTTP | Last checked (UTC) |
| --- | --- | --- | --- | --- |
| [Blist](https://blist.xyz/) | 🟢 live | 174 ms | 200 | 2026-09-18 07:20 |
| [Botlist.Co](https://botlist.co/platforms/discord) | 🟢 live | 601 ms | 200 | 2026-09-18 07:20 |
| [Botlist.me](https://botlist.me/) | 🟢 live | 462 ms | 200 | 2026-09-18 07:20 |
| [Discord Labs](https://bots.discordlabs.org/) | 🟢 live | 678 ms | 200 | 2026-09-18 07:20 |
| [Bots on Discord](https://bots.ondiscord.xyz/) | 🟢 live | 463 ms | 200 | 2026-09-18 07:20 |
| [Bots Database](https://botsdatabase.com/) | 🟢 live | 276 ms | 200 | 2026-09-18 07:20 |
| [Carbonitex](https://www.carbonitex.net/discord/bots) | 🟢 live | 495 ms | 200 | 2026-09-18 07:20 |
| [Cybralist](https://cybralist.com/) | 🟢 live | 579 ms | 200 | 2026-09-18 07:20 |
| [Discord Bots](https://discord.bots.gg/) | 🟢 live | 418 ms | 200 | 2026-09-18 07:20 |
| [discord.place](https://discord.place/bots) | 🟢 live | 395 ms | 200 | 2026-09-18 07:20 |
| [Rovel Discord List](https://discord.rovelstars.com) | 🟢 live | 1145 ms | 200 | 2026-09-18 07:20 |
| [Discord Services](https://discord.services/) | 🟢 live | 186 ms | 200 | 2026-09-18 07:20 |
| [Discord Bot World](https://discordbot.world/) | 🟢 live | 1591 ms | 200 | 2026-09-18 07:20 |
| [Discord Bot List](https://discordbotlist.com/) | 🟢 live | 618 ms | 200 | 2026-09-18 07:20 |
| [Discord Bot List XYZ](https://discordbotlist.xyz/) | 🟢 live | 1221 ms | 200 | 2026-09-18 07:20 |
| [Discord Extreme List](https://discordextremelist.xyz/) | 🟢 live | 459 ms | 200 | 2026-09-18 07:20 |
| [dlist.gg](https://discordlist.gg/) | 🟢 live | 229 ms | 200 | 2026-09-18 07:20 |
| [Bots for Discord](https://discords.com/bots/) | 🟢 live | 201 ms | 200 | 2026-09-18 07:20 |
| [Fluxpoint Discover](https://discover.fluxpoint.dev/) | 🟢 live | 612 ms | 200 | 2026-09-18 07:20 |
| [Disforge](https://disforge.com/bots) | 🟢 live | 1069 ms | 200 | 2026-09-18 07:20 |
| [DisQ](https://disq.ink/) | 🟢 live | 1867 ms | 200 | 2026-09-18 07:20 |
| [DList.Space](https://dlist.space/) | 🟢 live | 133 ms | 200 | 2026-09-18 07:20 |
| [JustDiscord](https://justdiscord.org/) | 🟢 live | 1802 ms | 200 | 2026-09-18 07:20 |
| [MotionDevelopment](https://www.motiondevelopment.top/) | 🟢 live | 316 ms | 200 | 2026-09-18 07:20 |
| [Omniplex](https://omniplex.gg/) | 🟢 live | 1019 ms | 200 | 2026-09-18 07:20 |
| [Radarcord](https://radarcord.net/) | 🟢 live | 1126 ms | 200 | 2026-09-18 07:20 |
| [Space Bot List](https://space-bot-list.xyz/) | 🟢 live | 186 ms | 200 | 2026-09-18 07:20 |
| [Stellar Bot List](https://stellarbotlist.com/) | 🟢 live | 618 ms | 200 | 2026-09-18 07:20 |
| [Discord Bot List](https://top.gg/) | 🟢 live | 83 ms | 403 | 2026-09-18 07:20 |
| [TopCord](https://topcord.xyz/) | 🟢 live | 192 ms | 200 | 2026-09-18 07:20 |
| [vCodes](https://vcodes.xyz) | 🟢 live | 702 ms | 200 | 2026-09-18 07:20 |
| [Void Bots](https://voidbots.net/) | 🟢 live | 259 ms | 200 | 2026-09-18 07:20 |
| [Yet Another Bot List](https://yabl.xyz/) | 🟢 live | 165 ms | 200 | 2026-09-18 07:20 |
<!-- STATUS:END -->

The table above is regenerated hourly by [scripts/status-sync.ts](scripts/status-sync.ts) (workflow: `status-sync.yml`). A list is marked:

- 🟢 **live**: website answered with HTTP < 500.
- 🟡 **deprecated**: superseded or announced end of life.
- 🔴 **shutdown**: unreachable, or domain is parked/dead.

When a list turns deprecated or shutdown, the workflow **opens a pull request** that removes it from the post registry, so a human always approves registry changes. Pure latency/uptime refreshes land on main directly.

## Testing

```bash
bun install
bun test                    # unit tests, no network
bun scripts/test-live.ts    # live integration, reads .env (optional)
```

For the live test: `cp .env.example .env`, fill in tokens for the lists you use (all optional), and run `bun scripts/test-live.ts`. It fetches real data, posts real stats (server count 1) and simulates a vote webhook, printing PASS/FAIL per action. Lists without tokens are skipped, nothing hard fails.

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

- [Documentation site](https://botlists.docs.potenfyr.in) (this repo's `docs/`, deployed via GitHub Pages)
- [API reference](https://botlists.docs.potenfyr.in/docs/1.0.1/api-reference) · [Examples](https://botlists.docs.potenfyr.in/examples) · [Status board](https://botlists.docs.potenfyr.in/status)
- [npm package](https://www.npmjs.com/package/@potenfyrstudios/discord-botlists)
- [PotenFYR Studios](https://github.com/PotenFYR-Studios) | [Website](https://potenfyr.in) | [Discord](https://discord.com/invite/zUaN2FPBec)

## License

Licensed under the **Apache License 2.0 with the Commons Clause**: free to fork, modify, use, and build around; not to be sold as a product. See [LICENSE](LICENSE); the LICENSE file is authoritative. Botlist names and trademarks belong to their respective owners; see [NOTICE.md](NOTICE.md).

---

Built by **[PotenFYR Studios](https://github.com/PotenFYR-Studios)** · [potenfyr.in](https://potenfyr.in) · Part of the PotenFYR Studios open-source ecosystem.

---

## ⭐ Star History

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=potenfyr-studios/authcore,potenfyr-studios/statfyr,potenfyr-studios/discord-botlists,potenfyr-studios/shell-eggs,potenfyr-studios/prog-language-eggs,potenfyr-studios/minecraft-eggs,potenfyr-studios/database-eggs,potenfyr-studios/apicordon,potenfyr-studios/ojaj,potenfyr-studios/fyrwall,potenfyr-studios/echoingdeaths&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=potenfyr-studios/authcore,potenfyr-studios/statfyr,potenfyr-studios/discord-botlists,potenfyr-studios/shell-eggs,potenfyr-studios/prog-language-eggs,potenfyr-studios/minecraft-eggs,potenfyr-studios/database-eggs,potenfyr-studios/apicordon,potenfyr-studios/ojaj,potenfyr-studios/fyrwall,potenfyr-studios/echoingdeaths&type=Date" />
  <img alt="Star history chart for all PotenFYR Studios public repositories" src="https://api.star-history.com/svg?repos=potenfyr-studios/authcore,potenfyr-studios/statfyr,potenfyr-studios/discord-botlists,potenfyr-studios/shell-eggs,potenfyr-studios/prog-language-eggs,potenfyr-studios/minecraft-eggs,potenfyr-studios/database-eggs,potenfyr-studios/apicordon,potenfyr-studios/ojaj,potenfyr-studios/fyrwall,potenfyr-studios/echoingdeaths&type=Date" width="80%" />
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
