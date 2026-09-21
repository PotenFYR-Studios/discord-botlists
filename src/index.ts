import { EventEmitter } from 'node:events';
import type {
  BotClientLike,
  BotlistEvent,
  BotlistsOptions,
  BotlistRecord,
  PostReport,
  PostResult,
  StatsPayload,
  StatsProvider,
  StatusBoard,
  UniversalBot,
} from './types.js';
import { BOTLISTS } from './data/lists.generated.js';
import { BotlistsError, Http, applyId, buildPostBody, resolveList, sleep } from './core/http.js';
import { UniversalParser } from './core/parser.js';
import { StatusChecker } from './status/checker.js';
import { ConsoleReport } from './status/report.js';
import { VoteWebhookServer } from './webhooks/server.js';
import { VoteAnnouncer } from './announcer.js';
import type { UniversalVote } from './types.js';

export { BotlistsError, ConsoleReport };
export { UniversalParser, unwrapVoteEnvelope } from './core/parser.js';
export { isJwtLike, verifyJwtHs256 } from './core/jwt.js';
export { StatusChecker } from './status/checker.js';
export { VoteAnnouncer, isDiscordWebhookUrl } from './announcer.js';
export type { VoteAnnouncerFormat, AnnouncerDelivery, ExternalVotePayload, DiscordWebhookPayload } from './announcer.js';

/** Retry-After waits above this are not honoured (drop instead of hanging). */
const MAX_RETRY_WAIT_MS = 30_000;

/**
 * Botlists: the main entry point.
 *
 * const lists = new Botlists({ client });
 * await lists.postStats({ serverCount: 120 });
 *
 * Emits every realtime event the webhook server emits, plus:
 *  statsPosted -> PostReport after each fan-out post
 *  status      -> StatusBoard after each status refresh
 */
export class Botlists extends EventEmitter {
  public readonly botId: string | null;
  public readonly client: BotClientLike | null;
  public readonly webhook: VoteWebhookServer;

  private readonly tokens: Record<string, string>;
  private readonly authHeaders: Record<string, string>;
  private readonly extraLists: BotlistRecord[];
  private readonly http: Http;
  private readonly parser = new UniversalParser();
  private readonly statusChecker = new StatusChecker();
  private readonly fetchOptions: BotlistsOptions['fetchOptions'];
  private readonly disableStatusCheck: boolean;
  private readonly startupStatusCheck: boolean;
  private readonly statsProvider: StatsProvider | null;
  private statusBoard: StatusBoard | null = null;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private lastPostAt = 0;
  private announcer: VoteAnnouncer | null = null;
  /** gap between two list posts inside one postStats fan-out (rate limit safety). */
  private readonly postSpacingMs: number;

  public constructor(options: BotlistsOptions = {}) {
    super();
    this.client = options.client ?? null;
    this.botId = options.botId ?? this.client?.user?.id ?? null;
    this.tokens = { ...readTokenEnv(), ...(options.tokens ?? {}) };
    this.authHeaders = options.authHeaders ?? {};
    this.extraLists = options.lists ?? [];
    this.fetchOptions = options.fetchOptions;
    this.disableStatusCheck = options.disableStatusCheck ?? false;
    this.startupStatusCheck = options.startupStatusCheck ?? false;
    this.statsProvider = options.statsProvider ?? null;
    this.http = new Http(options.fetchOptions);
    this.postSpacingMs = Math.max(100, options.postSpacingMs ?? 1000);

    this.webhook = new VoteWebhookServer(options.webhook ?? {});
    // bubble every webhook event up to the main emitter.
    for (const event of ['vote', 'comment', 'review', 'rating', 'test', 'raw', 'request', 'error'] as const) {
      this.webhook.on(event, (...args: unknown[]) => this.emit(event, ...args));
    }

    // vote announcer (opt-in): disabled unless options.announcer.enabled is
    // true; a pre-built VoteAnnouncer instance is always wired. Re-announced
    // events: 'vote' always, 'test' only when announceTestVotes is set.
    const announcerOpt = options.announcer;
    if (announcerOpt instanceof VoteAnnouncer) {
      this.announcer = announcerOpt;
    } else if (announcerOpt?.enabled) {
      this.announcer = new VoteAnnouncer(announcerOpt);
    }
    if (this.announcer) {
      this.on('vote', (vote: UniversalVote) => this.announcer!.announce(vote));
      if (this.announcer.options.announceTestVotes) {
        this.on('test', (vote: UniversalVote) => this.announcer!.announce(vote));
      }
    }
  }

  /** the wired announcer, when one is enabled. */
  public get voteAnnouncer(): VoteAnnouncer | null {
    return this.announcer;
  }

  /** all known lists, including any custom ones you passed in. */
  public get lists(): readonly BotlistRecord[] {
    return [...BOTLISTS, ...this.extraLists] as const;
  }

  /** count of lists that accept stats posts. */
  public get postableCount(): number {
    return this.lists.filter((l) => l.supports.post && l.apiPost).length;
  }

  /**
   * start the realtime webhook server.
   * Returns the address it listens on.
   */
  public async startWebhooks(port?: number): Promise<string> {
    if (port !== undefined && port !== this.webhook['port']) {
      // allow a per-call override for convenience.
      (this.webhook as unknown as { port: number }).port = port;
    }
    await this.webhook.start();
    return this.webhook.address;
  }

  public async stopWebhooks(): Promise<void> {
    await this.webhook.stop();
  }

  /** feed a webhook body from your own http framework. */
  public ingestWebhook(listQuery: string, body: unknown, isTest = false): void {
    this.webhook.ingest(listQuery, body, { isTest });
  }

  /**
   * post stats to every list you have a token for, or to explicit ids.
   * Rate limit safe: sequential per list, retries on 429 honour Retry-After,
   * BotBlock batch mode sends one request instead of N.
   */
  public async postStats(
    stats?: Partial<StatsPayload>,
    options: { only?: string[]; skip?: string[]; viaBotBlock?: boolean } = {},
  ): Promise<PostReport> {
    const started = Date.now();
    if (this.startupStatusCheck && !this.statusBoard) {
      await this.checkAndReportStatus(true);
    }
    const resolved = await this.resolveStats(stats);
    const results: PostResult[] = [];

    const targets = this.pickTargets(options.only, options.skip);
    for (const list of targets) {
      const token = this.tokens[list.id];
      if (!token) {
        results.push(noToken(list));
        continue;
      }
      results.push(await this.postOne(list, resolved, token));
      // polite gap between list posts (postSpacingMs, default 1000ms) keeps
      // the fan-out far away from every per-list rate limit. A list that
      // answered 429 with a big Retry-After adds a cooldown before the NEXT
      // list so a hot list never turns into a hammering loop.
      const last = results[results.length - 1];
      let spacing = this.postSpacingMs;
      if (last && !last.ok && last.retryAfter && last.retryAfter * 1000 <= MAX_RETRY_WAIT_MS) {
        spacing = Math.max(spacing, last.retryAfter * 1000 + 250);
      }
      await sleep(spacing);
    }
    const report: PostReport = {
      results,
      posted: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok && !r.error?.includes('no token')).length,
      skipped: results.filter((r) => r.error?.includes('no token')).length,
      durationMs: Date.now() - started,
    };
    this.lastPostAt = Date.now();
    this.emit('statsPosted', report);
    return report;
  }

  /** post stats to one list by id, name or hostname. */
  public async postStatsTo(listQuery: string, stats?: Partial<StatsPayload>): Promise<PostResult> {
    const list = this.requireList(listQuery);
    const token = this.tokens[list.id];
    if (!token) return noToken(list);
    const resolved = await this.resolveStats(stats);
    return this.postOne(list, resolved, token);
  }

  /** one request to botblock.org that forwards the count to every list. */
  public async postViaBotBlock(stats?: Partial<StatsPayload>): Promise<PostReport> {
    const started = Date.now();
    const resolved = await this.resolveStats(stats);
    const body: Record<string, unknown> = {
      server_count: resolved.serverCount,
      bot_id: this.botId ?? '',
    };
    if (resolved.shards) body.shards = resolved.shards;
    if (resolved.shardCount !== undefined) body.shard_count = resolved.shardCount;
    if (resolved.shardId !== undefined) body.shard_id = resolved.shardId;
    for (const list of this.lists) {
      const token = this.tokens[list.id];
      if (token) body[list.id] = token;
    }
    const results: PostResult[] = [];
    const response = await this.http.request('https://botblock.org/api/count', { method: 'POST', body });
    const json = (response.json ?? {}) as Record<string, { status?: number }>;
    const all = new Map<string, BotlistRecord>(this.lists.map((l) => [l.id, l]));
    for (const [id, info] of Object.entries(json)) {
      const list = all.get(id);
      if (!list) continue;
      const status = Array.isArray(info) ? (info[0] as number) : (info?.status ?? 0);
      results.push({
        listId: id,
        listName: list.name,
        ok: status >= 200 && status < 300,
        status,
        durationMs: Date.now() - started,
      });
    }
    const report: PostReport = {
      results,
      posted: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      skipped: 0,
      durationMs: Date.now() - started,
    };
    this.emit('statsPosted', report);
    return report;
  }

  /** fetch and normalize one bot from one list. */
  public async fetchBot(listQuery: string, botId?: string): Promise<UniversalBot> {
    const list = this.requireList(listQuery);
    if (!list.apiGet) throw new BotlistsError(`${list.name} has no public bot endpoint`, { listId: list.id });
    const id = botId ?? this.botId;
    if (!id) throw new BotlistsError('no bot id given and none detected from client', { listId: list.id });
    const url = applyId(list.apiGet, id);
    const token = this.tokenFor(list);
    const headers = token ? { [this.authHeaderFor(list)]: token } : undefined;
    const response = await this.http.requestStrict(url, { headers, listId: list.id });
    return this.parser.parseBot(list, response.json ?? response.text);
  }

  /** search a list's bot directory when it exposes one. */
  public async searchBots(listQuery: string, query: string, limit = 10): Promise<UniversalBot[]> {
    const list = this.requireList(listQuery);
    const id = this.botId ?? '';
    const bases = [
      list.apiGet ? applyId(list.apiGet, id).replace(/\/bots\/.*$/, '') : null,
      list.website,
    ].filter(Boolean) as string[];
    for (const base of bases) {
      const url = `${base}/search?query=${encodeURIComponent(query)}&limit=${limit}`;
      const response = await this.http.request(url);
      if (response.ok && response.json) {
        return this.parser.parseBots(list, response.json).slice(0, limit);
      }
    }
    return [];
  }

  /** current votes for your bot on one list. */
  public async fetchVotes(listQuery: string, botId?: string): Promise<number | null> {
    const bot = await this.fetchBot(listQuery, botId);
    return bot.votes;
  }

  /** has a specific user voted on a list (top.gg and others that expose it). */
  public async hasVoted(listQuery: string, userId: string): Promise<boolean | null> {
    const list = this.requireList(listQuery);
    const token = this.tokens[list.id];
    if (!token || !list.apiGet) return null;
    const id = this.botId ?? '';
    const base = applyId(list.apiGet, id);
    const url = `${base.replace(/\/$/, '')}/vote/${encodeURIComponent(userId)}`;
    const response = await this.http.request(url, { headers: { [this.authHeaderFor(list)]: token } });
    if (!response.ok) return null;
    const json = (response.json ?? {}) as Record<string, unknown>;
    const voted = json['voted'] ?? json['hasVoted'] ?? json['voted'];
    if (typeof voted === 'boolean') return voted;
    if (typeof json === 'number' || typeof json === 'boolean') return Boolean(json);
    return null;
  }

  /** widget image url for a bot on a list. */
  public widgetUrl(listQuery: string, botId?: string): string | null {
    const list = this.requireList(listQuery);
    const id = botId ?? this.botId;
    if (!list.widget || !id) return null;
    return applyId(list.widget, id);
  }

  /** public page url for a bot on a list. */
  public viewBotUrl(listQuery: string, botId?: string): string | null {
    const list = this.requireList(listQuery);
    const id = botId ?? this.botId;
    if (!list.viewBot || !id) return null;
    return applyId(list.viewBot, id);
  }

  /**
   * probe every list, print the console status table, and log github issue
   * urls for dead lists. returns the board. safe to call any time.
   */
  public async checkAndReportStatus(force = true): Promise<StatusBoard> {
    const board = await this.refreshStatus(force);
    console.log(ConsoleReport.table(board));
    const dead = board.entries.filter((e) => e.state === 'shutdown' || e.state === 'deprecated');
    if (dead.length) {
      console.log(`\n[discord-botlists] ${dead.length} list(s) look dead. Tokens for them are ignored.`);
      console.log('[discord-botlists] report or suggest alternatives:');
      for (const url of ConsoleReport.issueUrls(dead).slice(0, 5)) console.log(`  ${url}`);
      if (dead.length > 5) console.log(`  ...and ${dead.length - 5} more`);
    }
    return board;
  }

  /** run the status probe for every list and remember the board. */
  public async refreshStatus(force = false): Promise<StatusBoard> {
    const board = await this.statusChecker.checkAll(this.lists, force);
    this.statusBoard = board;
    this.emit('status', board);
    return board;
  }

  public get status(): StatusBoard | null {
    return this.statusBoard;
  }

  /** start periodic stats posting. interval in ms, default 30 minutes. */
  public startAutoPost(intervalMs = 30 * 60_000, stats?: Partial<StatsPayload>): void {
    this.stopAutoPost();
    // small jitter (+-5%) so a fleet of bots restarted at the same moment
    // never lands on the list APIs in lockstep. Default cadence is 30 min.
    const jittered = Math.round(Math.max(60_000, intervalMs) * (0.95 + Math.random() * 0.1));
    this.autoTimer = setInterval(() => {
      void this.postStats(stats).catch((error: unknown) => this.emit('error', error));
    }, jittered);
    this.autoTimer.unref?.();
  }

  public stopAutoPost(): void {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = null;
  }

  /**
   * merge order: explicit args > statsProvider (any framework / none) >
   * auto collection from a discord.js, Eris or Oceanic client.
   */
  private async resolveStats(stats?: Partial<StatsPayload>): Promise<StatsPayload> {
    const provided = this.statsProvider ? await this.statsProvider() : null;
    const payload: StatsPayload = {
      serverCount: stats?.serverCount ?? provided?.serverCount ?? collectServerCount(this.client),
      shardId: stats?.shardId ?? provided?.shardId,
      shardCount: stats?.shardCount ?? provided?.shardCount ?? collectShardCount(this.client),
      shards: stats?.shards ?? provided?.shards ?? collectShards(this.client),
      users: stats?.users ?? provided?.users,
      voiceConnections: stats?.voiceConnections ?? provided?.voiceConnections,
    };
    return payload;
  }

  private pickTargets(only?: string[], skip?: string[]): BotlistRecord[] {
    return this.lists.filter((list) => {
      if (!list.supports.post || !list.apiPost) return false;
      if (only?.length) return only.some((q) => matches(list, q));
      if (skip?.length && skip.some((q) => matches(list, q))) return false;
      return true;
    });
  }

  private async postOne(list: BotlistRecord, stats: StatsPayload, token: string): Promise<PostResult> {
    const started = Date.now();
    const url = applyId(list.apiPost as string, this.botId ?? '');
    const body = buildPostBody(list, stats);
    const init = {
      method: list.postMethod || 'POST',
      body,
      headers: { [this.authHeaderFor(list)]: token },
    };
    try {
      let response = await this.http.request(url, init);
      // botlist rate limits: honour Retry-After with ONE polite retry instead
      // of the transport-layer fast retries - we never hammer a 429ing list.
      if (response.status === 429 && response.retryAfter && response.retryAfter * 1000 <= MAX_RETRY_WAIT_MS) {
        await sleep(response.retryAfter * 1000 + 250);
        response = await this.http.request(url, init);
      }
      const retryAfter = response.retryAfter ?? undefined;
      return {
        listId: list.id,
        listName: list.name,
        ok: response.ok,
        status: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.text.slice(0, 120)}`,
        retryAfter,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      return {
        listId: list.id,
        listName: list.name,
        ok: false,
        status: null,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - started,
      };
    }
  }

  private requireList(query: string): BotlistRecord {
    const list = resolveList(query, this.extraLists);
    if (!list) throw new BotlistsError(`unknown list "${query}"`);
    return list;
  }

  private authHeaderFor(list: BotlistRecord): string {
    return this.authHeaders[list.id] ?? list.authHeader;
  }

  private tokenFor(list: BotlistRecord): string {
    return this.tokens[list.id] ?? '';
  }
}

/** event names, exported for on() typing helpers. */
export const EVENTS: readonly BotlistEvent[] = [
  'vote',
  'comment',
  'review',
  'rating',
  'test',
  'statsPosted',
  'status',
  'error',
  'request',
  'raw',
];

function matches(list: BotlistRecord, query: string): boolean {
  const q = query.toLowerCase();
  return list.id === q || list.id.includes(q) || list.name.toLowerCase().includes(q);
}

function noToken(list: BotlistRecord): PostResult {
  return {
    listId: list.id,
    listName: list.name,
    ok: false,
    status: null,
    error: `no token for ${list.id} (set ${list.tokenEnvKey} or pass tokens["${list.id}"])`,
    durationMs: 0,
  };
}

/** DBL_* env keys mapped onto their list ids (built once from the registry).
 *  Both the canonical tokenEnvKey (DBL_TOPGG) and a normalized form of the
 *  list id (top.gg -> DBL_TOPGG) resolve, so DBL_TOP.GG works too. */
const ENV_KEYS_TO_LISTS: Map<string, string> = new Map(
  BOTLISTS.flatMap((list) => {
    const norm = (s: string) => `DBL_${s.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
    const keys: (readonly [string, string])[] = [];
    if (list.tokenEnvKey) keys.push([list.tokenEnvKey, list.id] as const);
    keys.push([norm(list.id), list.id] as const);
    return keys;
  }),
);

function readTokenEnv(): Record<string, string> {
  const tokens: Record<string, string> = {};
  // dotenv is intentionally not bundled: read process.env directly so
  // Bun, Node 20+ --env-file and every cloud runtime work out of the box.
  // DBL_* keys are ALSO mapped onto their list ids (DBL_TOPGG -> "top.gg"):
  // the token lookups in postStats() are keyed by list id, so an unmapped
  // raw key would never be found. The raw key stays as a legacy passthrough
  // for custom lists.
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('DBL_') || !value) continue;
    tokens[key] = value;
    const mapped =
      ENV_KEYS_TO_LISTS.get(key) ??
      ENV_KEYS_TO_LISTS.get(key.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    if (mapped) tokens[mapped] = value;
  }
  return tokens;
}

function collectServerCount(client: BotClientLike | null): number {
  if (!client) return 0;
  if (client.guilds && typeof client.guilds === 'object') {
    if ('size' in client.guilds && typeof client.guilds.size === 'number') return client.guilds.size;
    if (client.guilds instanceof Map) return client.guilds.size;
    if (Array.isArray(client.guilds)) return client.guilds.length;
  }
  return 0;
}

function collectShardCount(client: BotClientLike | null): number | undefined {
  if (!client) return undefined;
  return client.shard?.count ?? client.options?.shardCount ?? client.ws?.shards?.['size' as keyof typeof client.ws.shards] as number | undefined ?? undefined;
}

function collectShards(client: BotClientLike | null): number[] | undefined {
  if (!client?.shard?.ids?.length) return undefined;
  return client.shard.ids;
}
