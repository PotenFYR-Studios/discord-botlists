# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
