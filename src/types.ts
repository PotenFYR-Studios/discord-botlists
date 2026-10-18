import type { VoteAnnouncer } from './announcer.js';

/** How a list expects statistics to be named on the wire. */
export type StatShape = 'server_count' | 'guildCount' | 'guilds' | 'count' | 'servers' | 'serverCount' | 'custom';

import type { VoteLedger, VoteLedgerOptions } from './votes/ledger.js';

/** Lifecycle state of a botlist, refreshed by the status sync. */
export type ListStatus = 'live' | 'deprecated' | 'shutdown' | 'unknown';

/** Realtime event names emitted by the package. */
export type BotlistEvent =
  | 'vote'
  | 'comment'
  | 'review'
  | 'rating'
  | 'test'
  | 'statsPosted'
  | 'status'
  | 'error'
  | 'request'
  | 'raw';

/** Minimal surface the SDK needs from a discord.js / Eris client. */
export interface BotClientLike {
  /** any other property: the client is read by duck-typing, so every library fits. */
  [key: string]: unknown;
  user?: { id: string } | null;
  guilds?: { size?: number } | Map<unknown, unknown> | unknown[] | null;
  shard?: { count?: number; ids?: number[] } | null;
  ws?: { shards?: Map<number, unknown> | unknown[] } | null;
  options?: { shardCount?: number } | null;
}

/** Statistics you can publish to a botlist. */
export interface StatsPayload {
  serverCount: number;
  shardId?: number;
  shardCount?: number;
  shards?: number[];
  users?: number;
  voiceConnections?: number;
}

/** Result of a single stats post to a single list. */
export interface PostResult {
  listId: string;
  listName: string;
  ok: boolean;
  status: number | null;
  error?: string;
  retryAfter?: number;
  durationMs: number;
}

/** Result of a fan-out post across many lists. */
export interface PostReport {
  results: PostResult[];
  posted: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

/** Normalized information about a bot on one list. */
export interface UniversalBot {
  listId: string;
  listName: string;
  id: string;
  name: string;
  avatar: string | null;
  discriminator: string | null;
  description: string | null;
  owners: string[];
  serverCount: number | null;
  shardCount: number | null;
  votes: number | null;
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
  raw: unknown;
  fetchedAt: number;
}

/** Normalized vote webhook payload. Every list is mapped onto this shape. */
export interface UniversalVote {
  listId: string;
  listName: string;
  voterId: string | null;
  voterName: string | null;
  voterAvatar: string | null;
  botId: string | null;
  isTest: boolean;
  weight: number;
  query: Record<string, string>;
  weekend: boolean;
  raw: unknown;
  receivedAt: number;
}

/** Normalized comment or review payload. */
export interface UniversalComment {
  listId: string;
  listName: string;
  kind: 'comment' | 'review' | 'rating';
  botId: string | null;
  userId: string | null;
  userName: string | null;
  rating: number | null;
  content: string | null;
  raw: unknown;
  receivedAt: number;
}

/** A parsed webhook request before it becomes an event. */
export interface ParsedWebhook {
  listId: string;
  event: BotlistEvent;
  payload: UniversalVote | UniversalComment;
}

/** One checked endpoint on the status page. */
export interface StatusEntry {
  listId: string;
  listName: string;
  website: string;
  state: ListStatus;
  /** HTTP status of the last probe, null when the site never answered. */
  httpStatus: number | null;
  latencyMs: number | null;
  uptime30d: number | null;
  lastChecked: number;
  deprecated: boolean;
  notice: string | null;
}

/** Serialized status board used by the README and website sync. */
export interface StatusBoard {
  generatedAt: number;
  entries: StatusEntry[];
  summary: { live: number; deprecated: number; shutdown: number; unknown: number };
}

/** stats provider for full control over any framework or none. */
export type StatsProvider = () => StatsPayload | Promise<StatsPayload>;

export interface BotlistsOptions {
  /** bot id: defaults to client.user.id when a client is given. */
  botId?: string;
  /** discord.js, Eris, Oceanic or any client with a guilds collection. Optional. */
  client?: BotClientLike;
  /**
   * full control: provide stats yourself, works with every framework or none.
   * overrides client auto collection.
   */
  statsProvider?: StatsProvider;
  /** tokens per list id, merged over env vars. */
  tokens?: Record<string, string>;
  /** fallback bot token header names per list id. */
  authHeaders?: Record<string, string>;
  /** extra or overriding list definitions. */
  lists?: BotlistRecord[];
  /** webhook server options. */
  webhook?: WebhookOptions;
  /**
   * realtime vote announcements to Discord channel webhooks / external
   * endpoints. DISABLED by default - pass { enabled: true, ... } to turn on,
   * or hand in a pre-built VoteAnnouncer instance for full control.
   */
  announcer?: VoteAnnouncerOptions | VoteAnnouncer;
  /**
   * gap between two list posts inside one postStats fan-out, default 1000ms.
   * rate-limit safety: a list that answers 429 with a small Retry-After
   * additionally waits it out before the next list is posted.
   */
  postSpacingMs?: number;
  /** global fetch options applied to every request. */
  fetchOptions?: FetchOptions;
  /** disable automated status checks before each request when true. */
  disableStatusCheck?: boolean;
  /**
   * when true, the first postStats call probes every list, prints a status
   * table to the console and warns about deprecated or shutdown lists.
   */
  startupStatusCheck?: boolean;
  /**
   * per-list circuit breaker for postStats fan-outs. After `threshold`
   * consecutive systemic failures (network error, 5xx, 404/410) a list is
   * skipped for `baseMs`, doubling on each further failure up to `maxMs`,
   * and probed again afterwards. Auth/rate/validation errors (400, 401, 403,
   * 429) never trip it - those are your config, not a dead list.
   * default { threshold: 5, baseMs: 15 min, maxMs: 6 h }; false disables it.
   */
  /**
   * remember every webhook vote (who, which list, when) so rewards never need
   * a list API call: true = in-memory ledger, an options object to choose a
   * store (FileVoteStore or your own), or a ready VoteLedger. Exposed as
   * `client.ledger`. off by default.
   */
  voteLedger?: boolean | VoteLedger | VoteLedgerOptions;
  circuitBreaker?: false | { threshold?: number; baseMs?: number; maxMs?: number };
}

/** Runtime health of one list as seen by this client's own posts. */
export interface ListHealth {
  listId: string;
  state: 'healthy' | 'degraded' | 'open';
  consecutiveFailures: number;
  /** epoch ms until which the list is skipped; 0 when not open. */
  openUntil: number;
  lastError: string | null;
}

export interface WebhookSecurityOptions {
  /**
   * refuse POSTs when no secret matches. when false, unsigned requests are
   * accepted (dangerous, only for local testing). default true.
   */
  requireSecret?: boolean;
  /**
   * HMAC-SHA256 signing keys per list id. when present, a request from that
   * list must carry a valid signature in one of the common signature headers
   * (x-signature-256, x-hub-signature-256, x-signature) or a matching
   * authorization scheme (sha256=<hex>). plain secret matching still works
   * for lists that do not sign payloads.
   */
  hmac?: Record<string, string>;
  /** per ip rate limit. default 30 requests per minute. */
  rateLimit?: { max: number; windowMs: number };
  /** block an ip after this many consecutive auth failures. default 10. */
  banAfterFailures?: number;
  /** how long a banned ip stays banned in ms. default 15 minutes. */
  banDurationMs?: number;
  /** trust x-forwarded-for for client ip resolution (behind nginx etc). default false. */
  trustProxy?: boolean;
  /**
   * allowlist of botlist ids allowed to POST. default: every list with a
   * webhook hint plus 'unknown'. requests from other lists are rejected.
   */
  allowedLists?: string[];
}

export interface WebhookOptions {
  /** port for the built-in http server, default 8080. */
  port?: number;
  /** webhook path, default /discord-botlists. */
  path?: string;
  /** hostname shown in logs, default localhost. */
  host?: string;
  /** expected Authorization secret, checked when set. */
  secret?: string | Record<string, string>;
  /** security hardening options. secure defaults. */
  security?: WebhookSecurityOptions;
  /** redirect target for GET on the webhook path. */
  redirectUrl?: string;
  /**
   * start the built-in http server immediately on construction. default false:
   * the package opens no port unless you opt in (here or via startWebhooks()),
   * so you can feed votes through your own server with the adapters instead.
   */
  autoStart?: boolean;
  /** log requests to console, default false. */
  debug?: boolean;
  /**
   * ignore re-deliveries of the same webhook event (lists retry on a slow
   * 2xx). Keyed on the delivery id that envelope-style lists (TheDiscordList,
   * DiscordForge v2) put in the body. Window in ms, default 10 minutes; 0
   * disables it.
   */
  dedupeTtlMs?: number;
}

/** How votes are rendered before being broadcast. */
export type VoteAnnouncerFormatOption = 'text' | 'embed' | 'embed-v2';

/**
 * VoteAnnouncer options: realtime vote broadcasting to Discord channel
 * webhooks (text / classic embed / Components V2) and generic external
 * https endpoints. Disabled unless `enabled: true` when passed to Botlists.
 * Pure Discord REST + fetch - no Discord library required.
 */
export interface VoteAnnouncerOptions {
  /**
   * master switch for announcer wiring INSIDE Botlists. The announcer is
   * disabled by default; standalone VoteAnnouncer instances ignore this.
   */
  enabled?: boolean;
  /** render style, default 'embed'. */
  format?: VoteAnnouncerFormatOption;
  /** Discord channel webhook urls (discord.com / discordapp.com). */
  webhooks?: string[];
  /** any https endpoint - receives { source, event, list, vote } JSON. */
  external?: string[];
  /** override the webhook username (defaults to the webhook's own identity). */
  username?: string;
  /** override the webhook avatar url. */
  avatarUrl?: string;
  /**
   * bot token (optional): resolves username/avatar via GET /users/@me so
   * announcements default to the bot's real identity. Read-only use.
   */
  botToken?: string;
  /** accent color for embed / embed-v2, default 0x5865f2 blurple. */
  color?: number;
  /**
   * {placeholder} template for format 'text' (and embed descriptions).
   * placeholders: {voter} {voterId} {list} {listId} {bot} {botId} {weight} {weekend}
   */
  template?: string;
  /** link buttons appended to embed-v2 messages (label + url, max 5 used). */
  links?: { label: string; url: string; emoji?: string }[];
  /**
   * full control: mutate or replace any outgoing Discord payload before it
   * is sent (per vote). Return null to fall through to the rendered payload.
   */
  customize?: (vote: UniversalVote, payload: Record<string, unknown>) => Record<string, unknown> | null | void;
  /** also announce dashboard test deliveries, default false. */
  announceTestVotes?: boolean;
  /** per-delivery timeout, default 8000ms. */
  timeoutMs?: number;
  /**
   * minimum spacing between two sends to the SAME target, default 1000ms.
   * the default pace never trips Discord webhook rate limits.
   */
  minIntervalMs?: number;
  /**
   * per-target queue bound, default 500. when a target stalls, the OLDEST
   * pending vote is dropped so memory can never grow unbounded.
   */
  maxQueueSize?: number;
}

export interface FetchOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

/** Everything the runtime knows about one botlist. */
export interface BotlistRecord {
  /** BotBlock style id, usually the hostname. */
  id: string;
  name: string;
  website: string | null;
  apiDocs: string | null;
  apiPost: string | null;
  /** body field the list expects for the server count. */
  postField: string | null;
  postMethod: string;
  shardField: string | null;
  shardIdField: string | null;
  shardsArrayField: string | null;
  apiGet: string | null;
  viewBot: string | null;
  widget: string | null;
  authHeader: string;
  /** prefix put before the token in the auth header, e.g. "Bearer". null = bare token. */
  authScheme?: string | null;
  /** env var name this list's token is read from. */
  tokenEnvKey: string;
  webhook: { header: string; voterField: string | null; eventField: string | null } | null;
  supports: { post: boolean; get: boolean; widget: boolean; webhook: boolean };
  /** runtime state, only set by the status checker. */
  status?: ListStatus;
  latencyMs?: number | null;
}

/** Per-list verdict from Botlists#doctor(). */
export interface DoctorEntry {
  listId: string;
  listName: string;
  tokenEnvKey: string;
  tokenConfigured: boolean;
  /** ok = token accepted, bad-token = 401/403, unverified = no read endpoint to test with. */
  auth: 'ok' | 'bad-token' | 'unverified' | 'no-token' | 'unreachable' | 'dead';
  httpStatus: number | null;
  notes: string[];
}

export interface DoctorReport {
  botId: string | null;
  entries: DoctorEntry[];
  /** DBL_* env vars that match no list (usually a typo). */
  unrecognizedEnv: string[];
  /** human readable problems, empty when everything checks out. */
  problems: string[];
}

/** Typed payloads of every event Botlists emits. */
export interface BotlistsEventMap {
  vote: [UniversalVote];
  test: [UniversalVote];
  comment: [UniversalComment];
  review: [UniversalComment];
  rating: [UniversalComment];
  statsPosted: [PostReport];
  status: [StatusBoard];
  error: [unknown];
  request: [{ method: string; url: string; status: number; listId: string | null }];
  raw: [ParsedWebhook];
}

/** What an adapter hands to VoteWebhookServer#process. */
export interface WebhookInput {
  method?: string;
  /** request path (+ query); used to find the list unless `list` is set. */
  url?: string;
  host?: string;
  headers?: Record<string, string | string[] | undefined>;
  /** parsed body as your framework gives it (express.json, fastify...). */
  body?: unknown;
  /** exact request bytes; strongly preferred, signatures are checked against them. */
  rawBody?: string | Uint8Array;
  /** force the botlist (id, name or host) instead of reading it from the url. */
  list?: string;
}

export interface WebhookOutput {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}
