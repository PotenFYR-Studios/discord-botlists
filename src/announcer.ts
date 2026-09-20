import { EventEmitter } from 'node:events';
import type { UniversalVote, VoteAnnouncerOptions } from './types.js';

export type { VoteAnnouncerOptions } from './types.js';

/** Discord message formats the announcer can render a vote into. */
export type VoteAnnouncerFormat = 'text' | 'embed' | 'embed-v2';

/** One outgoing delivery result (per target url). */
export interface AnnouncerDelivery {
  target: string;
  kind: 'discord' | 'external';
  ok: boolean;
  status: number;
  error?: string;
}

/** Top level shape posted to `external` endpoints. */
export interface ExternalVotePayload {
  source: 'discord-botlists';
  event: 'vote';
  list: { id: string; name: string };
  vote: UniversalVote;
}

/** Discord execute-webhook JSON (the subset the announcer emits). */
export interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds?: Record<string, unknown>[];
  components?: Record<string, unknown>[];
  flags?: number;
  allowed_mentions?: { parse: string[] };
}

const DISCORD_WEBHOOK_RE = /^https:\/\/(?:canary\.|ptb\.)?(?:discord\.com|discordapp\.com)\/api(?:\/v\d+)?\/webhooks\//;
const DEFAULT_TEXT_TEMPLATE = '🗳️ **{voter}** just voted for **{bot}** on **{list}**!';
const DEFAULT_COLOR = 0x5865f2;
const IS_COMPONENTS_V2 = 32768;
/** default spacing between two sends to the SAME target. Discord webhook
 *  buckets allow bursts, but a quiet 1/sec pace never trips anything. */
const DEFAULT_MIN_INTERVAL_MS = 1_000;
/** per-target queue bound: drop the oldest vote when full (never grows). */
const DEFAULT_MAX_QUEUE = 500;
/** Retry-After values above this are not waited out (429 → drop, not queue). */
const MAX_RETRY_AFTER_MS = 30_000;

/**
 * VoteAnnouncer: realtime vote broadcasting to Discord channel webhooks and
 * generic external HTTP endpoints. Pure fetch + Discord REST - no Discord
 * library required and nothing is sent until you opt in.
 *
 *   const lists = new Botlists({
 *     client,
 *     announcer: { enabled: true, format: 'embed-v2', webhooks: [process.env.VOTE_WEBHOOK_URL] },
 *   });
 *
 * or standalone (always active):
 *
 *   const announcer = new VoteAnnouncer({ format: 'text', webhooks: [...] });
 *   lists.on('vote', (vote) => announcer.announce(vote));
 *
 * Rate-limit safety (defaults - all user-controllable):
 *  - sends to the same target are spaced >= minIntervalMs apart (1s default),
 *  - a 429 with a small Retry-After is waited out once, larger ones drop,
 *  - the per-target queue is bounded (500) and drops the OLDEST vote when
 *    full, so a webhook outage can never grow memory,
 *  - the scheduler timer is unref'd and only alive while a delivery is
 *    pending - zero idle resource usage.
 *
 * Formats: 'text' ({placeholder} template), 'embed' (rich embed),
 * 'embed-v2' (Components V2: section, separator, link buttons).
 *
 * Events: 'delivered' (AnnouncerDelivery), 'dropped' (AnnouncerDelivery),
 * 'error' (Error).
 */
export class VoteAnnouncer extends EventEmitter {
  public readonly format: VoteAnnouncerFormat;
  public readonly webhooks: string[];
  public readonly external: string[];
  public readonly options: Required<Omit<VoteAnnouncerOptions, 'webhooks' | 'external' | 'format' | 'customize' | 'links' | 'botToken' | 'username' | 'avatarUrl'>> &
    Pick<VoteAnnouncerOptions, 'customize' | 'links' | 'username' | 'avatarUrl'>;

  /** bot identity resolved once via GET /users/@me (pure REST, opt-in). */
  private identity: { username?: string; avatar_url?: string } | null = null;
  private identityPromise: Promise<void> | null = null;
  private botToken?: string;

  /** per-target outbound queues + pacing state. */
  private readonly queues = new Map<string, { items: { vote: UniversalVote; kind: 'discord' | 'external' }[]; nextAt: number; timer: NodeJS.Timeout | null }>();

  public constructor(options: VoteAnnouncerOptions = {}) {
    super();
    this.format = options.format ?? 'embed';
    // invalid targets are dropped silently at construction (EventEmitter
    // cannot emit 'error' before any listener exists). Reads: .webhooks /
    // .external after construction to see what survived.
    this.webhooks = (options.webhooks ?? []).filter((url) => isDiscordWebhookUrl(url));
    this.external = (options.external ?? []).filter((url) => isAllowedExternalUrl(url));
    this.options = {
      enabled: options.enabled ?? false,
      announceTestVotes: options.announceTestVotes ?? false,
      username: options.username,
      avatarUrl: options.avatarUrl,
      color: options.color ?? DEFAULT_COLOR,
      template: options.template ?? DEFAULT_TEXT_TEMPLATE,
      timeoutMs: options.timeoutMs ?? 8_000,
      minIntervalMs: options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
      maxQueueSize: options.maxQueueSize ?? DEFAULT_MAX_QUEUE,
      customize: options.customize,
      links: options.links,
    };
    this.botToken = options.botToken;
  }

  /** resolve the bot's username/avatar over the Discord REST API (once). */
  private resolveIdentity(): Promise<void> {
    if (!this.botToken) return Promise.resolve();
    if (this.identityPromise) return this.identityPromise;
    this.identityPromise = fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${this.botToken}` },
    })
      .then(
        (res): Promise<{ id?: string; username?: string; avatar?: string } | null> =>
          res.ok ? (res.json() as Promise<{ id?: string; username?: string; avatar?: string }>) : Promise.resolve(null),
      )
      .then((user) => {
        if (user?.username) {
          this.identity = {
            username: user.username,
            avatar_url: user.id && user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
          };
        }
      })
      .catch(() => undefined);
    return this.identityPromise;
  }

  /**
   * Render one vote into the configured format. Exported for users who want
   * the payload without sending it (logging pipelines, custom transports).
   */
  public render(vote: UniversalVote): DiscordWebhookPayload {
    const voter = vote.voterName || vote.voterId || 'A supporter';
    const list = vote.listName || vote.listId;
    const bot = vote.botId ? `<@${vote.botId}>` : 'the bot';
    const base: DiscordWebhookPayload = {
      username: this.options.username || this.identity?.username || undefined,
      avatar_url: this.options.avatarUrl || this.identity?.avatar_url || undefined,
      allowed_mentions: { parse: [] },
    };
    let payload: DiscordWebhookPayload;
    if (this.format === 'text') {
      payload = { ...base, content: fillTemplate(this.options.template, vote, voter, list, bot) };
    } else if (this.format === 'embed') {
      payload = {
        ...base,
        embeds: [
          {
            title: `🗳️ New vote on ${list}${vote.isTest ? ' (test)' : ''}`,
            description: fillTemplate(this.options.template, vote, voter, list, bot),
            color: this.options.color,
            timestamp: new Date(vote.receivedAt).toISOString(),
            footer: { text: `discord-botlists · ${vote.listId}${vote.weekend ? ' · weekend x2' : ''}` },
            thumbnail: vote.voterAvatar ? { url: vote.voterAvatar } : undefined,
          },
        ],
      };
    } else {
      payload = buildComponentsV2(vote, voter, list, this.options);
    }
    // full-control hook: mutate or replace the payload.
    if (this.options.customize) {
      payload = (this.options.customize(vote, payload as unknown as Record<string, unknown>) as DiscordWebhookPayload | null | void) ?? payload;
    }
    return payload;
  }

  /**
   * Queue one vote for delivery to every configured target. Never throws and
   * never blocks: pacing, 429 backoff and queue bounds are handled by the
   * scheduler. Returns the current queue depths (diagnostics only).
   */
  public announce(vote: UniversalVote): { queued: number } {
    if (vote.isTest && !this.options.announceTestVotes) return { queued: 0 };
    void this.resolveIdentity();
    let queued = 0;
    for (const url of this.webhooks) queued += this.enqueue(url, vote, 'discord');
    for (const url of this.external) queued += this.enqueue(url, vote, 'external');
    return { queued };
  }

  /** clear every queue + timers (graceful shutdown). */
  public stop(): void {
    for (const state of this.queues.values()) {
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      state.items = [];
    }
    this.queues.clear();
  }

  /** enqueue one vote for one target and wake the scheduler. */
  private enqueue(url: string, vote: UniversalVote, kind: 'discord' | 'external'): number {
    let state = this.queues.get(url);
    if (!state) {
      state = { items: [], nextAt: 0, timer: null };
      this.queues.set(url, state);
    }
    if (state.items.length >= this.options.maxQueueSize) {
      // bounded memory: drop the OLDEST pending vote when a target is stalled.
      state.items.shift();
      this.emit('error', new Error(`[discord-botlists] announcer: queue full for ${redact(url)} - dropped the oldest pending vote`));
    }
    state.items.push({ vote, kind });
    this.schedule(url, 0);
    return state.items.length;
  }

  /** ensure a scheduler pass is pending for this target (unref'd timer). */
  private schedule(url: string, delayMs: number): void {
    const state = this.queues.get(url);
    if (!state || state.timer) return;
    state.timer = setTimeout(() => {
      state.timer = null;
      void this.flush(url).catch(() => undefined);
    }, delayMs);
    state.timer.unref?.();
  }

  /** send while the queue has items and the pacing window allows. */
  private async flush(url: string): Promise<void> {
    const state = this.queues.get(url);
    if (!state) return;
    while (state.items.length > 0) {
      const now = Date.now();
      if (now < state.nextAt) {
        this.schedule(url, state.nextAt - now);
        return;
      }
      const item = state.items.shift()!;
      const result = await this.deliver(url, item);
      if (result.ok || result.status === 0) {
        // success, or a transport error that already consumed its timeout.
        state.nextAt = Date.now() + this.options.minIntervalMs;
        this.emit(result.ok ? 'delivered' : 'error', result.ok ? result : new Error(`[discord-botlists] announcer: ${result.error} for ${redact(url)}`));
      } else if (result.retryAfterMs && result.retryAfterMs <= MAX_RETRY_AFTER_MS) {
        // rate limited with a small window: wait it out once, keep the vote.
        state.items.unshift(item);
        state.nextAt = Date.now() + result.retryAfterMs + 250;
        this.schedule(url, result.retryAfterMs + 250);
        return;
      } else {
        state.nextAt = Date.now() + this.options.minIntervalMs;
        this.emit('dropped', result);
      }
    }
    // queue drained: drop the state so idle targets hold zero resources.
    if (state.items.length === 0 && !state.timer) this.queues.delete(url);
  }

  /** one HTTP delivery. retries are NOT automatic - the scheduler paces. */
  private async deliver(url: string, item: { vote: UniversalVote; kind: 'discord' | 'external' }): Promise<AnnouncerDelivery & { retryAfterMs?: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const body =
        item.kind === 'discord'
          ? JSON.stringify(this.render(item.vote))
          : JSON.stringify({
              source: 'discord-botlists',
              event: 'vote',
              list: { id: item.vote.listId, name: item.vote.listName },
              vote: item.vote,
            } satisfies ExternalVotePayload);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'discord-botlists-announcer' },
        body,
        signal: controller.signal,
      });
      const retryAfterMs = res.status === 429 ? parseRetryAfter(res.headers.get('retry-after')) : undefined;
      return {
        target: redact(url),
        kind: item.kind,
        ok: res.ok,
        status: res.status,
        error: res.ok ? undefined : `HTTP ${res.status}`,
        retryAfterMs,
      };
    } catch (error) {
      return {
        target: redact(url),
        kind: item.kind,
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** true when the url looks like a Discord channel webhook. */
export function isDiscordWebhookUrl(url: string): boolean {
  return DISCORD_WEBHOOK_RE.test(url);
}

/** external endpoints must be https - loopback http is allowed for dev. */
export function isAllowedExternalUrl(url: string): boolean {
  if (/^https:\/\//.test(url)) return true;
  return /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/.test(url);
}

/** Components V2 render: section + separator + link buttons, flag 32768. */
function buildComponentsV2(
  vote: UniversalVote,
  voter: string,
  list: string,
  options: VoteAnnouncerOptions & { color: number; template: string },
): DiscordWebhookPayload {
  const components: Record<string, unknown>[] = [
    {
      type: 17, // section
      components: [
        {
          type: 10, // text display
          content: fillTemplate(options.template, vote, voter, list, vote.botId ? `<@${vote.botId}>` : 'the bot'),
        },
      ],
      ...(vote.voterAvatar ? { accessory: { type: 11, media: { url: vote.voterAvatar } } } : {}),
    },
    { type: 14 }, // separator
    {
      type: 10,
      content: `-# ${vote.listName || vote.listId}${vote.weekend ? ' · weekend x2' : ''}${vote.isTest ? ' · test vote' : ''} · <t:${Math.floor(vote.receivedAt / 1000)}:R>`,
    },
  ];
  const links = (options.links ?? []).filter((l) => l.label && /^https?:\/\//.test(l.url)).slice(0, 5);
  if (links.length > 0) {
    components.push({
      type: 1, // action row
      components: links.map((l) => ({
        type: 2, // button
        style: 5, // link
        label: l.label.slice(0, 80),
        url: l.url,
        ...(l.emoji ? { emoji: { name: l.emoji } } : {}),
      })),
    });
  }
  return {
    username: options.username || undefined,
    avatar_url: options.avatarUrl || undefined,
    flags: IS_COMPONENTS_V2,
    components,
    allowed_mentions: { parse: [] },
  };
}

/** {placeholder} substitution for text templates. */
function fillTemplate(template: string, vote: UniversalVote, voter: string, list: string, bot: string): string {
  return template
    .replaceAll('{voter}', voter)
    .replaceAll('{voterId}', vote.voterId ?? 'unknown')
    .replaceAll('{list}', list)
    .replaceAll('{listId}', vote.listId)
    .replaceAll('{bot}', bot)
    .replaceAll('{botId}', vote.botId ?? 'unknown')
    .replaceAll('{weight}', String(vote.weight))
    .replaceAll('{weekend}', vote.weekend ? 'weekend' : '');
}

/** never log full webhook urls (they contain secrets). */
function redact(url: string): string {
  return url.replace(/\/([A-Za-z0-9_-]{20,})\/?[A-Za-z0-9_-]*$/, '/***');
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const n = Number(header);
  return Number.isFinite(n) && n > 0 ? n * 1000 : undefined;
}
