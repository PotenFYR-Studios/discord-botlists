import type { BotlistRecord, UniversalBot } from '../types.js';
import { BotlistsError } from './http.js';

/**
 * UniversalParser: turns any botlist API response into UniversalBot.
 * Field names differ on every list, the parser reads them in priority order
 * so callers always get the same shape no matter which list answered.
 */
export class UniversalParser {
  public parseBot(list: BotlistRecord, payload: unknown): UniversalBot {
    const obj = asObject(payload);
    const bot = pickObject(obj, ['bot', 'data', 'response']);
    const source: Record<string, unknown> | null = bot ?? obj;
    const base = {
      listId: list.id,
      listName: list.name,
      id: firstString(source, ['id', '_id', 'bot_id', 'botid', 'discord_id', 'clientID', 'client_id']) ?? '',
      name: firstString(source, ['username', 'name', 'botname', 'bot_name', 'displayName']) ?? 'Unknown',
      avatar: firstString(source, ['avatar', 'avatar_url', 'avatarURL', 'logo', 'icon', 'image', 'pfp']),
      discriminator: firstString(source, ['discriminator', 'discrim', 'tag']) ?? null,
      description: firstString(source, ['description', 'short_description', 'shortDescription', 'summary', 'bio']),
      owners: firstArray(source, ['owners', 'owner', 'owner_ids', 'owners_ids']) ?? [],
      serverCount: firstNumber(source, ['server_count', 'servers', 'serverCount', 'guildCount', 'guild_count', 'guilds', 'count', 'stats.server_count', 'stats.guilds']) ,
      shardCount: firstNumber(source, ['shard_count', 'shardCount', 'shards_count']),
      votes: firstNumber(source, ['votes', 'points', 'vote_count', 'votecount', 'upvotes', 'monthly_votes', 'monthlyVotes', 'votal', 'vts']) ,
      monthlyVotes: firstNumber(source, ['monthly_votes', 'monthlyPoints', 'monthly_points', 'monthlyVotes', 'votes_month', 'vpm']),
      certified: firstBool(source, ['certified', 'isCertified', 'verified', 'is_verified', 'certify']),
      website: firstString(source, ['website', 'website_url', 'site', 'url_site']),
      github: firstString(source, ['github', 'github_url', 'git', 'repo']),
      supportServer: firstString(source, ['support', 'support_server', 'supportInvite', 'discord', 'support_guild', 'server']),
      invite: firstString(source, ['invite', 'invite_url', 'botInvite', 'bot_invite', 'add_url', 'oauth_url']),
      prefix: firstString(source, ['prefix', 'cmd_prefix', 'custom_prefix']),
      library: firstString(source, ['library', 'libraryName', 'lib', 'language', 'lang']),
      tags: firstArray(source, ['tags', 'categories', 'category']) ?? [],
      ratings: {
        average: firstNumber(source, ['rating', 'average_rating', 'avg_rating', 'score', 'stars', 'rating_average']),
        count: firstNumber(source, ['rating_count', 'reviews_count', 'review_count', 'num_reviews', 'ratingCount']),
      },
      raw: payload,
      fetchedAt: Date.now(),
    };
    return base;
  }

  /** parse an array of bots (list-wide search endpoints). */
  public parseBots(list: BotlistRecord, payload: unknown): UniversalBot[] {
    if (Array.isArray(payload)) return payload.map((entry) => this.parseBot(list, entry));
    const obj = asObject(payload);
    if (!obj) return [];
    for (const key of ['bots', 'results', 'data', 'items', 'list', 'response']) {
      const value = obj[key];
      if (Array.isArray(value)) return value.map((entry) => this.parseBot(list, entry));
    }
    // single bot response, wrap it.
    return [this.parseBot(list, payload)];
  }

  /** best effort votes extraction, used when you only need the vote count. */
  public parseVotes(list: BotlistRecord, payload: unknown): number | null {
    const bot = this.parseBot(list, payload);
    return bot.votes;
  }

  /** parse any webhook body into a normalized vote. */
  public parseVoteWebhook(list: BotlistRecord, body: unknown, isTest = false) {
    const obj = asObject(body) ?? {};
    const vote = {
      listId: list.id,
      listName: list.name,
      voterId: pickString(obj, ['user', 'user_id', 'userID', 'userId', 'voter_id', 'voter', 'id']) ,
      voterName: pickString(obj, ['username', 'name', 'user_name', 'voter_name']) ,
      voterAvatar: pickString(obj, ['avatar', 'avatar_url', 'userAvatar', 'user_avatar']) ,
      botId: pickString(obj, ['bot', 'bot_id', 'botID', 'botId', 'project_id']) ,
      isTest,
      weight: pickNumber(obj, ['weight', 'vote_weight']) ?? 1,
      query: extractQuery(obj),
      weekend: Boolean(pickBool(obj, ['isWeekend', 'weekend', 'is_weekend'])),
      raw: body,
      receivedAt: Date.now(),
    };
    return vote;
  }

  /** parse comment, review and rating webhooks. */
  public parseCommentWebhook(list: BotlistRecord, body: unknown, kind: 'comment' | 'review' | 'rating' = 'review') {
    const obj = asObject(body) ?? {};
    return {
      listId: list.id,
      listName: list.name,
      kind,
      botId: pickString(obj, ['bot', 'bot_id', 'botID', 'botId']) ,
      userId: pickString(obj, ['user', 'user_id', 'userID', 'userId', 'author', 'author_id', 'id']) ,
      userName: pickString(obj, ['username', 'name', 'author_name', 'user_name']) ,
      rating: pickNumber(obj, ['rating', 'stars', 'score', 'rate']) ,
      content: pickString(obj, ['content', 'comment', 'review', 'text', 'message', 'body']) ,
      raw: body,
      receivedAt: Date.now(),
    };
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickObject(obj: Record<string, unknown> | null, keys: string[]): Record<string, unknown> | null {
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

/** dotted paths like stats.server_count are resolved here. */
function dig(obj: Record<string, unknown> | null, path: string): unknown {
  if (!obj) return undefined;
  let current: unknown = obj;
  for (const part of path.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function firstString(obj: Record<string, unknown> | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = dig(obj, key);
    if (typeof value === 'string' && value) return value;
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  return firstString(obj, keys);
}

function firstNumber(obj: Record<string, unknown> | null, keys: string[]): number | null {
  for (const key of keys) {
    const value = dig(obj, key);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  return firstNumber(obj, keys);
}

function firstBool(obj: Record<string, unknown> | null, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = dig(obj, key);
    if (typeof value === 'boolean') return value;
    if (value === 1) return true;
    if (value === 0) return false;
    if (typeof value === 'string') {
      if (['true', 'yes', '1'].includes(value.toLowerCase())) return true;
      if (['false', 'no', '0'].includes(value.toLowerCase())) return false;
    }
  }
  return null;
}

function pickBool(obj: Record<string, unknown>, keys: string[]): boolean | null {
  return firstBool(obj, keys);
}

function firstArray(obj: Record<string, unknown> | null, keys: string[]): string[] | null {
  for (const key of keys) {
    const value = dig(obj, key);
    if (Array.isArray(value)) {
      return value.map((entry) => {
        if (typeof entry === 'string') return entry;
        if (typeof entry === 'object' && entry !== null) {
          const record = entry as Record<string, unknown>;
          const id = record.id ?? record.user_id ?? record.username ?? record.name;
          if (id !== undefined) return String(id);
        }
        return String(entry);
      });
    }
    // owners is sometimes a single id instead of an array.
    if (typeof value === 'string' && value) return [value];
  }
  return null;
}

function extractQuery(obj: Record<string, unknown>): Record<string, string> {
  const query = obj['query'];
  if (typeof query === 'object' && query !== null && !Array.isArray(query)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(query as Record<string, unknown>)) out[k] = String(v);
    return out;
  }
  return {};
}

/**
 * top.gg v1 webhook envelope flattener.
 *
 * top.gg's v1 webhooks deliver `{"vote":{"id":..,"botId":..,"userId":..,
 * "type":"vote"|"test","createdAt":..}}` while v0 delivered the flat
 * `{user, bot, type}` shape. Returns the body flattened into the universal
 * shape (user/bot/type at the top level) so detection and parsing stay
 * list-agnostic, or null when the body is not enveloped. Callers should keep
 * the ORIGINAL body around for `raw` on the parsed payload.
 */
export function unwrapVoteEnvelope(body: unknown): Record<string, unknown> | null {
  const obj = asObject(body);
  if (!obj) return null;
  // already flat (v0 shape) - nothing to unwrap.
  if (typeof obj['user'] === 'string' || typeof obj['user_id'] === 'string') return null;
  const inner = pickObject(obj, ['vote', 'vote_created']);
  if (!inner) return null;
  const flat: Record<string, unknown> = { ...obj };
  delete flat['vote'];
  delete flat['vote_created'];
  for (const [key, value] of Object.entries(inner)) flat[key] = value;
  if (flat['user'] === undefined) {
    flat['user'] = inner['userId'] ?? inner['user_id'] ?? inner['user'] ?? null;
  }
  if (flat['bot'] === undefined) {
    flat['bot'] = inner['botId'] ?? inner['bot_id'] ?? inner['bot'] ?? null;
  }
  return flat;
}

export { BotlistsError };
