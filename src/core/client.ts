import type { StatsPayload } from '../types.js';

/**
 * Library-agnostic reader for "how many servers does this bot have".
 *
 * No library is imported: everything is duck-typed so one code path serves
 * discord.js (v13/v14, plus ShardingManager and child-shard clients), Eris,
 * Oceanic, Fluxer, Discordeno (cache plugin), Seyfert (async cache), custom
 * wrappers and plain objects such as `{ guildCount: 123 }`. Every probe is
 * wrapped: a library change can degrade to "unknown", never throw.
 *
 * Sources checked while building this (primary docs): discord.js guide
 * (sharding: `client.shard.fetchClientValues('guilds.cache.size')`) and the
 * discord.js ClientEvents reference (`ready` deprecated, `clientReady` is the
 * replacement from 14.22).
 */
type Obj = Record<string, unknown>;

const obj = (v: unknown): Obj | null => (typeof v === 'object' && v !== null ? (v as Obj) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

async function attempt<T>(fn: () => T | Promise<T>): Promise<T | null> {
  try {
    return (await fn()) ?? null;
  } catch {
    return null;
  }
}

/** size of a Map / Collection / array / manager-with-cache. */
async function sizeOf(value: unknown): Promise<number | null> {
  const o = obj(value);
  if (Array.isArray(value)) return value.length;
  if (!o) return null;
  // discord.js GuildManager / Fluxer: .cache is the Collection
  const cache = obj(o['cache']);
  if (cache) {
    const s = num(cache['size']);
    if (s !== null) return s;
  }
  // Eris / Oceanic / Map / Collection / Discordeno cache
  const direct = num(o['size']);
  if (direct !== null) return direct;
  // Seyfert style: cache.guilds.count() (sync or async)
  if (typeof o['count'] === 'function') return num(await (o['count'] as () => unknown).call(o));
  return null;
}

/** guild count held by this very process/client. */
export async function readLocalGuildCount(client: unknown): Promise<number | null> {
  const c = obj(client);
  if (!c) return null;
  for (const probe of [
    () => sizeOf(c['guilds']),
    () => sizeOf(obj(c['cache'])?.['guilds']),
    () => sizeOf(obj(c['bot'])?.['guilds']),
    () => num(c['guildCount']),
    () => num(c['serverCount']),
    () => (typeof c['guildCount'] === 'function' ? num((c['guildCount'] as () => unknown)()) : null),
  ]) {
    const value = await attempt(probe);
    if (value !== null) return value;
  }
  return null;
}

/** per-shard guild counts for libraries that expose shard ids on guilds (Eris, Oceanic). */
async function perShardFromGuilds(client: Obj): Promise<number[] | null> {
  const guilds = client['guilds'];
  const shards = obj(client['shards']);
  const shardTotal = shards ? num(shards['size']) : null;
  if (!shardTotal || shardTotal < 2 || !guilds || typeof (guilds as Obj)['values'] !== 'function') return null;
  const counts = new Array<number>(shardTotal).fill(0);
  for (const guild of (guilds as { values(): Iterable<unknown> }).values()) {
    const g = obj(guild);
    const id = num(g?.['shardID']) ?? num(g?.['shardId']) ?? num(obj(g?.['shard'])?.['id']);
    if (id === null || id >= shardTotal) return null;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/**
 * Best-effort StatsPayload from any client or sharding manager.
 * `serverCount` is the TOTAL across shards whenever the library lets us ask
 * the other shards; `shards` holds per-shard guild counts only when they are
 * actually known (an empty/guessed array would zero the count on top.gg).
 */
export async function readClientStats(client: unknown): Promise<Partial<StatsPayload>> {
  const c = obj(client);
  if (!c) return {};
  const out: Partial<StatsPayload> = {};

  // discord.js: a ShardingManager (parent process) or a ShardClientUtil (child)
  const shardUtil = obj(c['shard']);
  const fetcher = typeof c['fetchClientValues'] === 'function' ? c : shardUtil && typeof shardUtil['fetchClientValues'] === 'function' ? shardUtil : null;
  if (fetcher) {
    const results = await attempt(() => (fetcher['fetchClientValues'] as (p: string) => Promise<unknown>).call(fetcher, 'guilds.cache.size'));
    if (Array.isArray(results) && results.every((r) => typeof r === 'number')) {
      const counts = results as number[];
      out.serverCount = counts.reduce((a, b) => a + b, 0);
      out.shardCount = counts.length;
      if (counts.length > 1) out.shards = counts;
    }
  }

  if (out.serverCount === undefined) {
    const local = await readLocalGuildCount(client);
    if (local !== null) out.serverCount = local;
  }

  if (out.shardCount === undefined) {
    const ws = obj(c['ws']);
    const options = obj(c['options']);
    const gateway = obj(c['gateway']);
    const shards = obj(c['shards']);
    const candidates = [
      num(shardUtil?.['count']),
      num(c['totalShards']),
      num(options?.['shardCount']),
      num(options?.['maxShards']),
      num(shards?.['size']),
      num(obj(ws?.['shards'])?.['size']),
      Array.isArray(ws?.['shards']) ? (ws!['shards'] as unknown[]).length : null,
      typeof gateway?.['lastShardId'] === 'number' ? (gateway['lastShardId'] as number) + 1 : null,
      num(gateway?.['totalShards']),
    ];
    const found = candidates.find((n) => n !== null && n > 0);
    if (found !== undefined && found !== null) out.shardCount = found;
  }

  if (out.shards === undefined && !fetcher) {
    const perShard = await attempt(() => perShardFromGuilds(c));
    if (perShard) out.shards = perShard;
  }

  // the shard this process runs (one id), for lists that take a shard id
  const ids = shardUtil?.['ids'];
  if (Array.isArray(ids) && ids.length === 1 && typeof ids[0] === 'number') out.shardId = ids[0];

  const users = await attempt(() => sizeOf(c['users']));
  if (users !== null && users > 0 && !fetcher) out.users = users;

  return out;
}

/** event names that mean "gateway ready", per library. discord.js `ready` is skipped on purpose (deprecated warning since 14.22). */
export const READY_EVENTS = ['clientReady', 'botReady', 'shardReady'] as const;

/** is the client past the gateway handshake? */
export function looksReady(client: unknown): boolean {
  const c = obj(client);
  if (!c) return false;
  if (typeof c['isReady'] === 'function') {
    try {
      return Boolean((c['isReady'] as () => boolean).call(c));
    } catch {
      return false;
    }
  }
  if (typeof c['ready'] === 'boolean') return c['ready'];
  if (typeof c['readyAt'] !== 'undefined' && c['readyAt'] !== null) return true;
  return false;
}
