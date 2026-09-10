<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:8b5cf6,50:ec4899,100:f97316&height=200&section=header&text=discord-botlists&fontSize=48&fontColor=ffffff&fontAlignY=36&desc=One%20SDK%20%C2%B7%20Every%20botlist%20%C2%B7%20Zero%20dependencies&descSize=18&descAlignY=58&animation=twinkling" width="100%" alt="discord-botlists banner"/>

[![npm version](https://img.shields.io/npm/v/discord-botlists.svg?style=for-the-badge&logo=npm&labelColor=1c1e26)](https://www.npmjs.com/package/discord-botlists)
[![npm downloads](https://img.shields.io/npm/dt/discord-botlists.svg?style=for-the-badge&logo=npm&labelColor=1c1e26)](https://www.npmjs.com/package/discord-botlists)
[![CI](https://img.shields.io/github/actions/workflow/status/PotenFYR-Studios/discord-botlists/ci.yml?style=for-the-badge&logo=githubactions&label=CI&labelColor=1c1e26)](https://github.com/PotenFYR-Studios/discord-botlists/actions/workflows/ci.yml)
[![status](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/PotenFYR-Studios/discord-botlists/main/.status/shield.json&style=for-the-badge&labelColor=1c1e26)](#live-status)
[![license](https://img.shields.io/badge/license-MIT-8b5cf6.svg?style=for-the-badge&labelColor=1c1e26)](LICENSE)
[![Discord](https://img.shields.io/discord/795434308005134406?style=for-the-badge&logo=discord&logoColor=white&labelColor=1c1e26)](https://discord.com/invite/zUaN2FPBec)

**Post stats to 30+ verified live botlists. Realtime votes. One parse shape for every list.**

[Documentation Website](https://potenfyr-studios.github.io/discord-botlists/) | [npm](https://www.npmjs.com/package/discord-botlists) | [Status Board](#live-status)

</div>

---

## Why discord-botlists

Posting your bot's stats to every list and handling every list's webhook format yourself is weeks of glue code. This package does all of it with zero runtime dependencies:

- **Stats posting** to 30+ verified live lists, each with its correct wire format, auth header and endpoint, learned from every list's own docs plus the BotBlock directory. Dead lists are pruned automatically by the hourly status sync.
- **Realtime vote, comment and review events** through a built-in webhook server. No polling, no delay, no express dependency.
- **Universal parser** that normalizes any list's bot data into one `UniversalBot` object so you never juggle `server_count` vs `guildCount` vs `guilds` vs `count` again.
- **Status tracking**: automated hourly probes detect deprecated or shut down lists, with latency and HTTP state, synced into this README and the website.
- **Fully typed**: strict TypeScript, generic event emitter, autocomplete for every option.
- **Lightweight**: zero dependencies, ~15 KB min+gzip, works on Node 18+ and Bun.

> Documentation is duplicated on the [website](https://potenfyr-studios.github.io/discord-botlists/) with live examples. This README is the same content, maintained in sync.

## Installation

```bash
npm install discord-botlists
# or
bun add discord-botlists
# or
pnpm add discord-botlists
```

Requirements: Node.js 18+ or Bun 1.1+. No peer dependencies. discord.js and Eris are optional; pass your `client` and the SDK reads server and shard counts from it.

## Quick start

```ts
import { Client } from 'discord.js';
import { Botlists } from 'discord-botlists';

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

client.on('ready', async () => {
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

Point each botlist's webhook URL at `https://your-domain:8080/discord-botlists/<list-id>` and votes arrive as typed events instantly. The full API of every supported list, per list env variable names and more live examples are in the [docs website](https://potenfyr-studios.github.io/discord-botlists/).

## Full API

### class `Botlists`

| Method | Returns | Description |
| --- | --- | --- |
| `postStats(stats?, opts?)` | `Promise<PostReport>` | Post to every list you have a token for. `opts.only` / `opts.skip` filter by list id. |
| `postStatsTo(list, stats?)` | `Promise<PostResult>` | Post to one list. |
| `postViaBotBlock(stats?)` | `Promise<PostReport>` | One request to botblock.org that fans out to all lists. |
| `startWebhooks(port?)` | `Promise<string>` | Start the realtime webhook server, returns its address. |
| `stopWebhooks()` | `Promise<void>` | Stop the webhook server. |
| `ingestWebhook(list, body)` | `void` | Feed a webhook body from your own express/fastify app. |
| `fetchBot(list, botId?)` | `Promise<UniversalBot>` | Fetch and normalize a bot from one list. |
| `fetchVotes(list, botId?)` | `Promise<number \| null>` | Current vote count on one list. |
| `hasVoted(list, userId)` | `Promise<boolean \| null>` | Check if a user voted (lists that expose it). |
| `searchBots(list, query, limit?)` | `Promise<UniversalBot[]>` | Search a list's directory. |
| `refreshStatus(force?)` | `Promise<StatusBoard>` | Probe all lists: state, latency, HTTP. |
| `widgetUrl(list, botId?)` | `string \| null` | Widget image URL on a list. |
| `viewBotUrl(list, botId?)` | `string \| null` | Public bot page on a list. |
| `startAutoPost(intervalMs?, stats?)` | `void` | Re-post stats periodically (default 30 min). |
| `stopAutoPost()` | `void` | Stop the auto poster. |

A list can be referenced by id (`'top.gg'`), name (`'Discord Bots'`), hostname (`'discord.bots.gg'`) or shorthand (`'topgg'`, `'voidbots'`, `'radarcord'`).

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

`list.tokenEnvKey` tells you the env name for every list at runtime.

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

Every list gets its correct body shape automatically: `server_count` for top.gg, `guildCount` for discord.bots.gg, `guilds` for discordbotlist.com, `servers` for disforge, and so on for all 50+.

### Rate limit safety

- Posts are throttled with a 250 ms gap per list and retried on 429/5xx honouring `Retry-After`.
- BotBlock mode sends one request total (their own limit is 1 per 120 s, the SDK will not retry it faster).
- Status probes use 8 parallel HEAD requests max, browser UA, per run.
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

top.gg | discordbotlist.com | discord.bots.gg | botlist.me | discords.com | voidbots.net | vcodes.xyz | radarcord.net | discordextremelist.xyz | bots.ondiscord.xyz | discordlist.gg | disforge.com | disq.ink | dlist.space | cybralist.com | discord.rovelstars.com | yabl.xyz | justdiscord.org | omniplex.gg | discover.fluxpoint.dev | blist.xyz | motiondevelopment.top | topcord.xyz | discordbot.world | bots.discordlabs.org | botsdatabase.com | discordbotlist.xyz | space-bot-list.xyz | botlist.co | discord.services | stellarbotlist.com

Each record carries: endpoint URLs, wire field names, shard field names, auth header, widget and view URLs, webhook format hint and env var key.

Missing a list? [Open an issue](https://github.com/PotenFYR-Studios/discord-botlists/issues/new?template=list-request.md) with its name, API docs link and a maintainer contact: live lists get added within days.

## Live status

<!-- STATUS:START -->
Last sync: **2026-09-10** | 🟢 43 live | 🟡 0 deprecated | 🔴 40 shutdown | ⚪ 0 unknown

| List | Status | Latency | HTTP | Last checked (UTC) |
| --- | --- | --- | --- | --- |
| [Arcane Bot Center](https://arcane-center.xyz/) | 🟢 live | 187 ms | 200 | 2026-09-10 08:06 |
| [AroBotList](https://arobotlist.xyz) | 🟢 live | 185 ms | 200 | 2026-09-10 08:06 |
| [AutomaCord](https://automacord.xyz/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [BladeList](https://bladelist.gg/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Blist](https://blist.xyz/) | 🟢 live | 184 ms | 200 | 2026-09-10 08:06 |
| [Boat List](https://boatlist.ml/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Boat List](https://boatlist.xyz/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [BoatSpace](https://boatspace.xyz/) | 🟢 live | 184 ms | 200 | 2026-09-10 08:06 |
| [Botlist.Co](https://botlist.co/platforms/discord) | 🟢 live | 2183 ms | 200 | 2026-09-10 08:06 |
| [Botlist.me](https://botlist.me/) | 🟢 live | 801 ms | 200 | 2026-09-10 08:06 |
| [Astro Bot List](https://botlists.com/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Botrix](https://botrix.cc/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Labs](https://bots.discordlabs.org/) | 🟢 live | 998 ms | 200 | 2026-09-10 08:06 |
| [Discord List App](https://bots.discordlist.app/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [DisTop](https://bots.distop.xyz/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Idle Bot List](https://bots.idledev.org/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Bots on Discord](https://bots.ondiscord.xyz/) | 🟢 live | 1503 ms | 200 | 2026-09-10 08:06 |
| [Bots Database](https://botsdatabase.com/) | 🟢 live | 178 ms | 200 | 2026-09-10 08:06 |
| [Bots Para Discord](https://botsparadiscord.com) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Carbonitex](https://www.carbonitex.net/discord/bots) | 🟢 live | 1068 ms | 200 | 2026-09-10 08:06 |
| [Cloud Botlist](https://cloud-botlist.xyz/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Cloud List](https://www.cloudlist.xyz/) | 🟢 live | 179 ms | 200 | 2026-09-10 08:06 |
| [Cybralist](https://cybralist.com/) | 🟢 live | 472 ms | 200 | 2026-09-10 08:06 |
| [Dank Bot List](https://dankbotlist.com/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [DBLista](https://dblista.pl/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Bot List](https://discord-botlist.eu/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Boats](https://discord.boats/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Bots](https://discord.bots.gg/) | 🟢 live | 570 ms | 200 | 2026-09-10 08:06 |
| [discord.place](https://discord.place/bots) | 🟢 live | 437 ms | 403 | 2026-09-10 08:06 |
| [Rovel Discord List](https://discord.rovelstars.com) | 🟢 live | 1606 ms | 200 | 2026-09-10 08:06 |
| [Discord Services](https://discord.services/) | 🟢 live | 782 ms | 403 | 2026-09-10 08:06 |
| [Discord Apps Marketplace](https://discordapps.dev/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Boats Club](https://discordboats.club/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Bot World](https://discordbot.world/) | 🟢 live | 597 ms | 200 | 2026-09-10 08:06 |
| [Discord Bot Directory](https://discordbotdirectory.net/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Bot Index](https://discordbotindex.com/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Bot Labs](https://discordbotlabs.com/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Bot List](https://discordbotlist.com/) | 🟢 live | 600 ms | 200 | 2026-09-10 08:06 |
| [Discord Bot List XYZ](https://discordbotlist.xyz/) | 🟢 live | 782 ms | 200 | 2026-09-10 08:06 |
| [Discord Bots App](https://discordbots.app/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Bots](https://discordbots.co) | 🟢 live | 307 ms | 200 | 2026-09-10 08:06 |
| [Discord Fork](https://discordbots.co.uk/) | 🟢 live | 847 ms | 403 | 2026-09-10 08:06 |
| [discordbots.fun](https://discordbots.fun/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Bots Group](https://discordbots.group/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Bots Club](https://discordbotsclub.org/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Extreme List](https://discordextremelist.xyz/) | 🟢 live | 1199 ms | 200 | 2026-09-10 08:06 |
| [dlist.gg](https://discordlist.gg/) | 🟢 live | 492 ms | 200 | 2026-09-10 08:06 |
| [discordlist.space](https://discordlist.space/) | 🟢 live | 748 ms | 200 | 2026-09-10 08:06 |
| [Discord Listology](https://discordlistology.com/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Music Bots](https://www.discordmusicbots.com/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Bots for Discord](https://discords.com/bots/) | 🟢 live | 400 ms | 200 | 2026-09-10 08:06 |
| [Discord's Best Bots](https://discordsbestbots.xyz/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discordz](https://discordz.gg/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Fluxpoint Discover](https://discover.fluxpoint.dev/) | 🟢 live | 1054 ms | 200 | 2026-09-10 08:06 |
| [Disforge](https://disforge.com/bots) | 🟢 live | 2205 ms | 200 | 2026-09-10 08:06 |
| [DisQ](https://disq.ink/) | 🟢 live | 1358 ms | 200 | 2026-09-10 08:06 |
| [Divine Discord Bots](https://divinediscordbots.com/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [DList.Space](https://dlist.space/) | 🟢 live | 360 ms | 200 | 2026-09-10 08:06 |
| [Fates List](https://fateslist.xyz/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Glenn Bot List](https://glennbotlist.xyz) | 🟢 live | 794 ms | 200 | 2026-09-10 08:06 |
| [Guardian Bot List](https://guardianbots.xyz/) | 🟢 live | 179 ms | 200 | 2026-09-10 08:06 |
| [Hydrogen Bots](https://hydrogenbots.club/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Fork for Internet Explorer 6](http://ie.discordbots.co.uk/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [JustDiscord](https://justdiscord.org/) | 🟢 live | 1013 ms | 200 | 2026-09-10 08:06 |
| [LBots](https://lbots.org/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Listcord](https://listcord.com/) | 🟢 live | 943 ms | 200 | 2026-09-10 08:06 |
| [Listcord](https://listcord.gg/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [ListMyBots](https://listmybots.com/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [MotionDevelopment](https://www.motiondevelopment.top/) | 🟢 live | 1705 ms | 200 | 2026-09-10 08:06 |
| [Nooder Bot List](https://nooder.co) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Omniplex](https://omniplex.gg/) | 🟢 live | 1536 ms | 200 | 2026-09-10 08:06 |
| [Paradise Bots](https://paradisebots.net/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Radarcord](https://radarcord.net/) | 🟢 live | 1786 ms | 200 | 2026-09-10 08:06 |
| [Space Bot List](https://space-bot-list.xyz/) | 🟢 live | 185 ms | 200 | 2026-09-10 08:06 |
| [Stellar Bot List](https://stellarbotlist.com/) | 🟢 live | 1120 ms | 200 | 2026-09-10 08:06 |
| [There is a bot for that](https://thereisabotforthat.com/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Discord Bot List](https://top.gg/) | 🟢 live | 603 ms | 200 | 2026-09-10 08:06 |
| [TopCord](https://topcord.xyz/) | 🟢 live | 184 ms | 200 | 2026-09-10 08:06 |
| [vCodes](https://vcodes.xyz) | 🟢 live | 906 ms | 200 | 2026-09-10 08:06 |
| [VitalList](https://vitallist.xyz/) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Void Bots](https://voidbots.net/) | 🟢 live | 702 ms | 200 | 2026-09-10 08:06 |
| [Wonder Bot List](https://wonderbotlist.com) | 🔴 shutdown | n/a | n/a | 2026-09-10 08:06 |
| [Yet Another Bot List](https://yabl.xyz/) | 🟢 live | 393 ms | 200 | 2026-09-10 08:06 |
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
bun run test:live           # live integration, reads .env
```

For the live test: `cp .env.example .env`, fill in tokens for the lists you use (all optional), and run `bun run test:live`. It fetches real data, posts real stats (server count 1) and simulates a vote webhook, printing PASS/FAIL per action. Lists without tokens are skipped, nothing hard fails.

## Registry maintenance

```bash
# refresh the BotBlock snapshot and regenerate the registry
curl -s https://botblock.org/api/lists > scripts/snapshot/botblock-lists.json
python3 scripts/snapshot/build_lists.py
bun test   # verify nothing broke
```

## Contributing

PRs welcome. Please:

1. Add or fix list data in `scripts/snapshot/build_lists.py` (manual overrides), not the generated file.
2. Run `bun test` and `bun run lint`.
3. Keep the zero-dependency promise: no new runtime deps.

## Links

- [Documentation website](https://potenfyr-studios.github.io/discord-botlists/) (Vite + React + TS, deployed via GitHub Pages)
- [npm package](https://www.npmjs.com/package/discord-botlists)
- [PotenFYR Studios](https://github.com/PotenFYR-Studios) | [Website](https://potenfyr.in) | [Discord](https://discord.com/invite/zUaN2FPBec)

## License

[MIT](LICENSE) | Botlist names and trademarks belong to their respective owners. See [NOTICE.md](NOTICE.md).
