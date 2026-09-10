import type {
  BotlistRecord,
  FetchOptions,
  PostResult,
  StatsPayload,
  UniversalBot,
} from '../types.js';
import { BOTLISTS } from '../data/lists.generated.js';

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 1500;

/** Errors that are worth one more try, anything else fails fast. */
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export class BotlistsError extends Error {
  public readonly listId: string | null;
  public readonly status: number | null;
  public readonly retryAfter: number | null;

  public constructor(
    message: string,
    options: { listId?: string | null; status?: number | null; retryAfter?: number | null } = {},
  ) {
    super(message);
    this.name = 'BotlistsError';
    this.listId = options.listId ?? null;
    this.status = options.status ?? null;
    this.retryAfter = options.retryAfter ?? null;
  }
}

export class Http {
  public readonly timeout: number;
  public readonly retries: number;
  public readonly retryDelay: number;
  public readonly headers: Record<string, string>;

  public constructor(options: FetchOptions = {}) {
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.retries = options.retries ?? DEFAULT_RETRIES;
    this.retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;
    this.headers = { 'content-type': 'application/json', 'user-agent': 'discord-botlists/2.0 (+https://github.com/PotenFYR-Studios/discord-botlists)', ...options.headers };
  }

  public async request(
    url: string,
    init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
  ): Promise<{ ok: boolean; status: number | null; text: string; json: unknown; retryAfter: number | null }> {
    let lastStatus: number | null = 0;
    let lastBody = '';
    let retryAfter: number | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        const response = await fetch(url, {
          method: init.method ?? 'GET',
          headers: { ...this.headers, ...init.headers },
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const text = await response.text();
        let json: unknown = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        return { ok: response.ok, status: response.status, text, json, retryAfter: parseRetryAfter(response.headers, text) };
      } catch (error) {
        clearTimeout(timer);
        lastStatus = 0;
        lastBody = error instanceof Error ? error.message : String(error);
      }
      if (attempt < this.retries) await sleep(this.retryDelay * (attempt + 1));
    }
    return { ok: false, status: lastStatus, text: lastBody, json: null, retryAfter };
  }

  /** request that throws on non-2xx after retries, with retry-after honoured. */
  public async requestStrict(
    url: string,
    init: { method?: string; headers?: Record<string, string>; body?: unknown; listId?: string } = {},
  ): Promise<{ status: number; json: unknown; text: string }> {
    let result = await this.request(url, init);
    if (result.ok && result.status !== null) return { status: result.status, json: result.json, text: result.text };

    // honour Retry-After once before giving up.
    if (result.status === 429 && result.retryAfter && result.retryAfter <= 30) {
      await sleep(result.retryAfter * 1000);
      result = await this.request(url, init);
      if (result.ok && result.status !== null) return { status: result.status, json: result.json, text: result.text };
    }

    const id: string | undefined = init.listId;
    if (result.status === null || result.status === 0) {
      throw new BotlistsError(`network error talking to ${url}: ${result.text}`, { listId: id, status: 0 });
    }
    throw new BotlistsError(`request to ${url} failed with ${result.status}: ${truncate(result.text)}`, {
      listId: id,
      status: result.status,
      retryAfter: result.retryAfter,
    });
  }

  public shouldRetry(status: number): boolean {
    return RETRYABLE.has(status);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(headers: Headers, body: string): number | null {
  const headerValue = headers.get('retry-after');
  if (headerValue) {
    const asNumber = Number(headerValue);
    if (!Number.isNaN(asNumber)) return asNumber;
  }
  try {
    const parsed = JSON.parse(body) as { retry_after?: number; retryAfter?: number };
    if (typeof parsed?.retry_after === 'number') return parsed.retry_after;
    if (typeof parsed?.retryAfter === 'number') return parsed.retryAfter;
  } catch {
    // body was not json, nothing to parse.
  }
  return null;
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/** resolve a list record by id, name fragment or hostname. */
const ALIASES: Record<string, string> = {
  topgg: 'top.gg',
  'top.gg': 'top.gg',
  dbl: 'discordbotlist.com',
  discords: 'discords.com',
  voidbots: 'voidbots.net',
  vcodes: 'vcodes.xyz',
  botlistme: 'botlist.me',
  radarcord: 'radarcord.net',
  disforge: 'disforge.com',
  blist: 'blist.xyz',
  dlist: 'dlist.space',
  dbgg: 'discord.bots.gg',
  yabl: 'yabl.xyz',
  disq: 'disq.ink',
  omniplex: 'omniplex.gg',
  cybralist: 'cybralist.com',
};

export function resolveList(query: string, extra: BotlistRecord[] = []): BotlistRecord | null {
  const needle = query.toLowerCase().trim();
  const all = [...BOTLISTS, ...extra] as BotlistRecord[];
  const alias = ALIASES[needle];
  const exact = alias
    ? all.find((l) => l.id === alias)
    : all.find((l) => l.id === needle || l.name.toLowerCase() === needle);
  if (exact) return exact;
  const stripped = needle.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const host = all.find((l) => l.id === stripped || l.id.replace(/\./g, '') === stripped.replace(/\./g, ''));
  if (host) return host;
  const fuzzy = all.filter(
    (l) =>
      l.id.includes(needle) ||
      l.id.replace(/\./g, '').includes(needle.replace(/\./g, '')) ||
      l.name.toLowerCase().includes(needle) ||
      (l.website ?? '').includes(needle),
  );
  if (fuzzy.length === 1) return fuzzy[0];
  if (fuzzy.length > 1) {
    throw new BotlistsError(`ambiguous list "${query}", matches: ${fuzzy.map((l) => l.id).join(', ')}`);
  }
  return null;
}

/** convert universal stats into the exact wire body one list expects. */
export function buildPostBody(record: BotlistRecord, stats: StatsPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  // top.gg v0 style array of per shard counts.
  if (record.shardsArrayField) body[record.shardsArrayField] = stats.shards ?? [];

  const count = stats.serverCount;
  if (record.postField) body[record.postField] = count;

  // lists that never documented a field still need a count, pick a sane key.
  if (!record.postField) body.guessCount = count;

  if (record.shardField && stats.shardCount !== undefined) body[record.shardField] = stats.shardCount;
  if (record.shardIdField && stats.shardId !== undefined) body[record.shardIdField] = stats.shardId;
  if (stats.users !== undefined) {
    const usersKey = record.id === 'discordbotlist.com' ? 'users' : 'users';
    body[usersKey] = stats.users;
  }
  if (stats.voiceConnections !== undefined) body.voice_connections = stats.voiceConnections;
  return body;
}

/** fill :id placeholders in a template url. */
export function applyId(template: string, id: string): string {
  return template.replaceAll(':id', encodeURIComponent(id));
}

export type { PostResult, UniversalBot };
