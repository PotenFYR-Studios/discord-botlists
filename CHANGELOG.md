# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Framework adapters** `expressHandler`, `nodeHandler`, `fastifyHandler`, `koaHandler`, `lambdaHandler`, `fetchHandler` (also `@potenfyrstudios/discord-botlists/adapters`) and the core `webhook.process()`: use your existing server, no built-in server needed. `handleRequest` accepts `{ list }`.
- **`client.attach()`**: waits for any Discord library to be ready (events + readiness polling), posts, then auto-posts.
- **`VoteLedger`** (`voteLedger` option, `client.ledger`, `MemoryVoteStore`/`FileVoteStore`/bring-your-own `VoteStore`): per-user vote memory across all lists with `hasVoted`, `claim` (reward exactly once per vote), `streak`, `nextVoteAt`, `top`.
- **`webhook.handleRequest(Request): Promise<Response>`** for Hono, Next.js, Bun, Deno, Cloudflare Workers.
- **`client.doctor()`** token/env/bot-id diagnostics (read-only).
- **Typed events** via `BotlistsEventMap`.
- **Per-list circuit breaker** (`circuitBreaker` option, `client.health`, `client.resetHealth()`): a list failing 5x in a row (network/5xx/404/410) is skipped with exponential backoff (15 min to 6 h) and re-probed; 400/401/403/429 never trip it. The live status board also gates `postStats` for hosts that no longer resolve.
- **Webhook delivery dedupe** (`webhook.dedupeTtlMs`, default 10 min): re-deliveries of the same envelope id (TheDiscordList, DiscordForge v2) emit once.
- **thediscordlist.com** - new list (stats POST `{"server_count","shard_count"}` with `Authorization: Bearer`, signed `X-TDL-Signature: t=<unix>,v1=<hmac of "<t>.<raw body>">` webhooks; `listing.upvoted` parses as a vote, other events such as `listing.bumped` and `bot.stats_reported` are ignored).
- `authScheme` on registry records: lists that need `Authorization: Bearer <token>` (thediscordlist.com, discordforge.org, topbot.gg) get the prefix added automatically; a token that already carries it is left alone.
- `scripts/discover-lists.ts` (`npm run discover`) finds BotBlock lists missing from the registry and validates their site and stats API before they are suggested. Runs hourly in the status workflow.
- `npm run check:pack` (part of `prepublishOnly`) fails the publish if the tarball holds anything but compiled `dist` JS/typings and package metadata.

### Fixed
- **discord.js bots posted a server count of 0**: `client.guilds` is a manager with `.cache`, which the reader never looked at. Counts are now read from discord.js (`guilds.cache.size`), Eris, Oceanic, Fluxer, Discordeno, Seyfert and plain objects.
- **Sharded bots reported one shard's count** and sent shard *ids* where lists expect per-shard guild counts. Totals now come from `client.shard.fetchClientValues` / `ShardingManager`, and `shards` holds real per-shard counts (or is omitted).
- **`require()` failed on Node 18/20** (the `require` export pointed at the ESM build). The package now ships ESM + CommonJS with typed subpath exports.
- **Five lists wrongly marked shutdown are restored** (discordextremelist.xyz, disforge.com, disq.ink, omniplex.gg, radarcord.net): the old probe treated a timeout as dead; their APIs answer.
- **discordforge.org** stats moved to `POST /api/v1/bots/stats` (Bearer); the legacy route returns 410 since 2026-10-14.
- **discords.com** stats posted to a redirecting host, which fetch turns into a GET. Now `POST /bots/api/bot/:id/setservers`.
- **vcodes.xyz** calls `www.vcodes.xyz` directly; the apex redirect stripped the Authorization header.
- **discordlabs.org** is marked deprecated (moved; the bot API is gone).
- **Status detection** treated a timeout as `shutdown`, so slow lists were reported dead. Probes now retry HEAD and GET with a doubled budget, and only a hard DNS/connection failure on every attempt means `shutdown`; slow or bot-walled lists stay `live`/`unknown`.
- Namespaced non-vote webhook events (e.g. `bot.stats_reported`) are no longer mistaken for votes.

### Changed
- The built-in webhook server is documented as optional and off by default (no port is opened unless you opt in).
- `node:http` is imported lazily, so the package loads on edge runtimes; `BotClientLike` accepts any object.
- The hourly status sync is silent: master only changes when a list changes state (no timestamps/latency in committed files, `[skip ci]`); the full live board is force-pushed to the single-commit `status-data` branch.

## [1.0.3] - 2026-09-21

Every webhook-enabled list's payload was audited against its official docs; the fixes below are pinned by tests using the documented payloads.

### Fixed
- **Real top.gg v1 vote webhooks parsed with an empty `voterId`** - top.gg v1 actually delivers `{"type":"vote.create"|"webhook.test","data":{...}}` (docs.top.gg/webhooks/events), not the `{"vote":{...}}` envelope 1.0.2 assumed. Real votes emitted `voterId: null`, so downstream consumers (Jericho included) silently dropped every genuine vote: no rewards, no announcements. The envelope now flattens correctly: `voterId` is `data.user.platform_id` (the DISCORD snowflake; `data.user.id` is top.gg's internal id), `voterName`/`voterAvatar` from `data.user`, `botId` from `data.project.platform_id`, `query` from `data.query`, and `weight: 2` (weekend multiplier) sets `weekend: true`. Dashboard tests (`type: "webhook.test"`) route to the `test` event.
- **DisQ votes parsed with an empty `voterId`** - docs.disq.ink delivers the voter as a nested object (`user.id`). Nested `user`/`bot`/`review` objects are now flattened before field extraction, for vote and comment/review webhooks alike.
- **Case-sensitive event detection** - botlist.me sends `type: "Upvote"`/`"Test"`; test/vote detection is now case-insensitive.

### Added
- **topbot.gg** - new list (stats POST `{"serverCount","shardCount"}`, vote webhooks `{event, flagged, user}` signed via `x-topbot-signature` + `x-topbot-timestamp`, hmac over `"<timestamp>.<raw body>"`). Its API key is Bearer-style: set the token value to `Bearer <api key>`.
- **discordforge.org** - new list (stats POST `{"server_count","shard_count"}`; webhooks v2 envelope `{id, type:"vote.created", created_at, bot_id, data:{voter_id,...}}` signed with `X-Forge-Signature: sha256=<hex hmac of raw body>`; legacy `{id, username, isTest}` shape supported alongside).
- **discordlist.gg JWT webhook bodies** - dlist.gg signs the entire request body as an HS256 JWT keyed with your Webhook Authorization secret (claims `{user_id, bot_id, is_test}`). The HTTP server and `ingest()` verify the token and parse the claims; a valid signature doubles as the transport auth. `isJwtLike`/`verifyJwtHs256` are exported from the package root.
- DisQ `X-DisQ-Signature` (the same `t=,v1=` hmac family as top.gg v1) is now verified.
- Test-delivery flags `isTest` (discordforge legacy) and `is_test` (discordlist.gg claims) alongside the existing `test: true` (dlist.space).

### Changed
- **8 dead lists pruned** - their domains now serve registrar parking or squatter pages while still answering HTTP 200 (why the status sync never flagged them): blist.xyz, botlist.co, botsdatabase.com, discord.services, discordbot.world, motiondevelopment.top, space-bot-list.xyz, topcord.xyz. The registry is 27 verified-live lists.
- Webhook support claims trued up against the docs audit: discordextremelist.xyz (no vote webhook exists) and bots.ondiscord.xyz (none publicly documented) no longer advertise webhook support; `voterField` metadata corrected for botlist.me, discords.com, radarcord.net, voidbots.net, vcodes.xyz, disq.ink and discordlist.gg.

## [1.0.2] - 2026-09-20

### Added
- **VoteAnnouncer** - realtime vote broadcasting to Discord channel webhooks and external https endpoints, built directly on the Discord execute-webhook REST API (plain fetch, no Discord library required).
  - Three render formats: `text` (`{placeholder}` templates), classic `embed`, and `embed-v2` (Components V2: section + avatar accessory, separator, link buttons, `IS_COMPONENTS_V2` flag).
  - Disabled by default when passed via `Botlists({ announcer })` - nothing is sent until `enabled: true`; standalone `VoteAnnouncer` instances are always active.
  - External endpoints receive a JSON envelope: `{ source, event, list, vote }`.
  - Identity control: `username` / `avatarUrl` overrides, or opt-in `botToken` that resolves the bot's identity once via `GET /users/@me` (read-only REST use).
  - Full-control `customize(vote, payload)` hook, `links` buttons, `announceTestVotes` opt-in.
  - Rate-limit safe by default: ≥ 1 s spacing per target (`minIntervalMs`), one polite wait on 429 honoring Retry-After (≤ 30 s), bounded per-target queues (`maxQueueSize`, oldest dropped first), unref'd timers that only exist while a delivery is pending - zero idle resource usage and no memory growth during webhook outages. `stop()` clears everything for graceful shutdown.
- **top.gg v1 webhook support** - top.gg migrated deliveries from the shared-password `Authorization` header to signed v1 requests (`x-topgg-signature: t=<unix seconds>,v1=<hex hmac-sha256 of "<t>.<rawBody>">`). The SDK now verifies the v1 scheme automatically for the configured `top.gg` secret, alongside the legacy header and all other lists' signature headers.
- **top.gg v1 payload envelope** - `{"vote":{"userId","botId","type","createdAt"}}` bodies are flattened transparently: `vote` events keep their shape (`voterId`, `botId`), the original body is preserved on `vote.raw`, and dashboard test deliveries (`type: "test"`) route to the `test` event with `isTest: true`.
- `ingest()` transport auth: when callers pass delivery `headers`, `ingest()` now enforces the same auth rules as the HTTP server (v1 signature, Authorization secret or HMAC key) and returns `null` on failure. Without headers it keeps trusting the caller's framework auth (unchanged behavior).
- `unwrapVoteEnvelope` exported from the package root.
- Docker test harness: `Dockerfile` + `docker-compose.test.yml` (`tests`, `build`, `live` services) on a pinned `oven/bun:1` image.
- `scripts/verify-topgg.mjs` - production-style live check: real stats POST + round-trip against the top.gg API and a genuinely signed v1 delivery through the ingest path.
- New test suites: `test/topgg-v1.test.ts` (signatures, envelope, ingest auth, stats wire body) and `test/announcer.test.ts` (rendering, real-HTTP delivery, 429 handling, queue bounds, wiring defaults).

### Fixed
- **`DBL_*` env tokens were never found** - `readTokenEnv()` stored keys verbatim (`DBL_TOPGG`), but every token lookup is keyed by list id (`top.gg`), so env-configured tokens silently matched nothing. Keys are now mapped onto their list ids via each list's `tokenEnvKey`, with normalized aliases (`DBL_TOP.GG` works too).
- **Stats posts zeroed the top.gg server count** - `buildPostBody()` always included the `shards` array, and top.gg derives `server_count` from a present `shards` array: posting `shards: []` silently published `server_count: 0`. Non-sharded bots now omit the field entirely; real shard data still goes out as before.
- Stats fan-out politeness: the inter-list gap is now 1 s (was 250 ms) and configurable via `postSpacingMs`; a 429 with a small Retry-After waits it out before the next list; the auto-post timer gained ±5% jitter so fleets never hit list APIs in lockstep.

### Notes
- top.gg retired the legacy `GET /api/bots/:id` bot-info endpoints in production (they return HTML 404s today). `fetchBot` / `hasVoted` / `searchBots` surface that as normal request failures for top.gg; stats POST/GET (`/api/bots/:id/stats`) remain live.
