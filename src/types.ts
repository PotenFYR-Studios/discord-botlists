/** How a list expects statistics to be named on the wire. */
export type StatShape = 'server_count' | 'guildCount' | 'guilds' | 'count' | 'servers' | 'serverCount' | 'custom';

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

export interface BotlistsOptions {
  /** bot id: defaults to client.user.id when a client is given. */
  botId?: string;
  /** discord.js or Eris client, enables auto stats collection. */
  client?: BotClientLike;
  /** tokens per list id, merged over env vars. */
  tokens?: Record<string, string>;
  /** fallback bot token header names per list id. */
  authHeaders?: Record<string, string>;
  /** extra or overriding list definitions. */
  lists?: BotlistRecord[];
  /** webhook server options. */
  webhook?: WebhookOptions;
  /** global fetch options applied to every request. */
  fetchOptions?: FetchOptions;
  /** disable automated status checks before each request when true. */
  disableStatusCheck?: boolean;
  /**
   * when true, the first postStats call probes every list, prints a status
   * table to the console and warns about deprecated or shutdown lists.
   */
  startupStatusCheck?: boolean;
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
  /** start the server immediately on construction. */
  autoStart?: boolean;
  /** log requests to console, default false. */
  debug?: boolean;
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
  /** env var name this list's token is read from. */
  tokenEnvKey: string;
  webhook: { header: string; voterField: string | null; eventField: string | null } | null;
  supports: { post: boolean; get: boolean; widget: boolean; webhook: boolean };
  /** runtime state, only set by the status checker. */
  status?: ListStatus;
  latencyMs?: number | null;
}
