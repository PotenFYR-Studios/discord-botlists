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
    const obj = flattenNested(asObject(body) ?? {});
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
    const obj = flattenNested(asObject(body) ?? {});
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

/**
 * Nested-object flattener for lists that deliver entities as objects instead
 * of id strings. DisQ (docs.disq.ink/webhooks/overview) posts
 * `{"type":"vote","bot":{"id","name"},"user":{"id","username"},"review":{...}}`
 * - without this pass the priority pick lists see only an object under `user`
 * and the voter id parses as null. top.gg v1's `platform_id`-first rule is
 * handled in unwrapVoteEnvelope before this runs; here `platform_id` still
 * wins when present so both shapes flatten the same way.
 */
function flattenNested(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  const user = asObject(out['user']);
  if (user) {
    out['user'] = user['platform_id'] ?? user['id'] ?? user['userId'] ?? user['user_id'] ?? null;
    if (out['username'] === undefined) out['username'] = user['username'] ?? user['name'] ?? user['displayName'] ?? null;
    if (out['avatar'] === undefined) out['avatar'] = user['avatar'] ?? user['avatar_url'] ?? null;
  }
  const bot = asObject(out['bot']);
  if (bot) out['bot'] = bot['platform_id'] ?? bot['id'] ?? bot['botId'] ?? bot['bot_id'] ?? null;
  const review = asObject(out['review']);
  if (review) {
    if (out['rating'] === undefined) out['rating'] = review['rating'] ?? review['stars'] ?? null;
    if (out['content'] === undefined) out['content'] = review['content'] ?? review['comment'] ?? review['text'] ?? null;
  }
  return out;
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
 * The REAL v1 envelope (docs.top.gg/webhooks/events) is
 * `{"type":"vote.create"|"webhook.test","data":{...}}` where the voter's
 * DISCORD id is `data.user.platform_id` (`data.user.id` is top.gg's internal
 * id and NOT a snowflake), the bot is `data.project.platform_id`, and `weight`
 * is 2 during the weekend multiplier. Legacy v0 delivered the flat
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

  // REAL top.gg v1: {"type":"vote.create"|"webhook.test","data":{...}}.
  // discordforge.org webhooks v2 use the same envelope shape with sibling
  // fields ({"id","type":"vote.created","created_at","bot_id","data":{...}}),
  // so envelope keys are merged too (data wins on collision).
  const type = typeof obj['type'] === 'string' ? obj['type'] : null;
  const data = asObject(obj['data']);
  if (type && data && (type.startsWith('vote.') || type.startsWith('webhook.'))) {
    const flat: Record<string, unknown> = { ...obj };
    delete flat['data'];
    for (const [key, value] of Object.entries(data)) flat[key] = value;
    const user = asObject(data['user']);
    if (user) {
      // platform_id is the Discord snowflake; fall back to the top.gg id only
      // when a list variant omits it (it will fail snowflake checks upstream).
      flat['user'] = user['platform_id'] ?? user['id'] ?? null;
      flat['username'] = user['name'] ?? null;
      flat['avatar'] = user['avatar_url'] ?? null;
    }
    const project = asObject(data['project']);
    if (project) flat['bot'] = project['platform_id'] ?? project['id'] ?? null;
    // top.gg has no explicit weekend flag - weight 2 IS the weekend multiplier.
    if (data['weight'] === 2) flat['isWeekend'] = true;
    // keep the envelope type so detectTest/detectEvent classify the event
    // ("vote.create" -> vote, "webhook.test" -> test via includes()).
    flat['type'] = type;
    return flat;
  }

  // enveloped variants some lists deliver: {"vote":{...}} / {"vote_created":{...}}.
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
