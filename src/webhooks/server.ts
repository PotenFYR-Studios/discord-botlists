import { EventEmitter } from 'node:events';
import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { BotlistRecord, ParsedWebhook, WebhookOptions, WebhookSecurityOptions } from '../types.js';
import { UniversalParser, unwrapVoteEnvelope } from '../core/parser.js';
import { resolveList } from '../core/http.js';
import { isJwtLike, verifyJwtHs256 } from '../core/jwt.js';

interface RateBucket {
  count: number;
  resetAt: number;
}

interface IpState {
  rate: RateBucket;
  authFailures: number;
  bannedUntil: number;
}

const DEFAULT_SECURITY: Required<Omit<WebhookSecurityOptions, 'hmac' | 'allowedLists'>> = {
  requireSecret: true,
  rateLimit: { max: 30, windowMs: 60_000 },
  banAfterFailures: 10,
  banDurationMs: 15 * 60_000,
  trustProxy: false,
};

/** headers botlists commonly use for the webhook secret. */
const SECRET_HEADERS = ['authorization', 'x-webhook-authentication', 'x-webhook-secret'] as const;

/** headers botlists commonly use for HMAC signatures. */
const SIGNATURE_HEADERS = [
  'x-signature-256',
  'x-hub-signature-256',
  'x-signature',
  'x-signature-sha256',
  // discordforge.org webhooks v2: "X-Forge-Signature: sha256=<hex hmac of raw body>"
  'x-forge-signature',
] as const;

/**
 * VoteWebhookServer: dependency free http server that receives vote, comment
 * and review webhooks from every supported list and re-emits them as typed
 * realtime events on a single EventEmitter. Zero delay, no polling.
 *
 * Security model (all on by default):
 *  - POSTs without a valid secret are rejected (401). Set
 *    security.requireSecret = false only for local testing.
 *  - Optional per-list HMAC-SHA256 payload verification via security.hmac.
 *  - Per-IP rate limiting (default 30 req/min) with 429 + Retry-After.
 *  - Per-IP auth failure tracking: 10 bad secrets in a row bans the ip for
 *    15 minutes (403 while banned).
 *  - Optional botlist allowlist so unknown sources never emit events.
 *
 * Events:
 *  vote | comment | review | rating | test | raw | request | error
 */
export class VoteWebhookServer extends EventEmitter {
  private readonly port: number;
  private readonly path: string;
  private readonly host: string;
  private readonly redirectUrl: string;
  private readonly debug: boolean;
  private readonly parser = new UniversalParser();
  private readonly secrets: Record<string, string>;
  private readonly security: WebhookSecurityOptions;
  private readonly requireSecret: boolean;
  private readonly hmacKeys: Record<string, string>;
  private readonly ipState = new Map<string, IpState>();
  private server: Server | null = null;
  private started = false;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  public constructor(options: WebhookOptions = {}) {
    super();
    this.port = options.port ?? 8080;
    this.path = normalizePath(options.path ?? '/discord-botlists');
    this.host = options.host ?? 'localhost';
    this.redirectUrl = options.redirectUrl ?? 'https://github.com/PotenFYR-Studios/discord-botlists';
    this.debug = options.debug ?? false;
    this.secrets = typeof options.secret === 'string' ? { '*': options.secret } : (options.secret ?? {});
    this.security = options.security ?? {};
    this.requireSecret = this.security.requireSecret ?? DEFAULT_SECURITY.requireSecret;
    this.hmacKeys = this.security.hmac ?? {};
    if (options.autoStart) void this.start();
  }

  /** start listening. resolves once the socket is live. */
  public async start(): Promise<void> {
    if (this.started) return;
    if (this.requireSecret && !Object.keys(this.secrets).length) {
      throw new Error(
        '[discord-botlists] refusing to start the webhook server without a secret. ' +
          'Pass webhook.secret (string or per-list record) or set security.requireSecret = false for local testing.',
      );
    }
    const server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.port, () => resolve());
    });
    this.server = server;
    this.started = true;
    // periodic sweep so forgotten ip states do not leak memory.
    this.sweepTimer = setInterval(() => this.sweep(), 5 * 60_000);
    this.sweepTimer.unref?.();
    if (this.debug) console.log(`[discord-botlists] webhook server listening on ${this.host}:${this.port}${this.path}`);
  }

  public stop(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
    if (!this.server) return Promise.resolve();
    const server = this.server;
    this.server = null;
    this.started = false;
    return new Promise((resolve) => server.close(() => resolve()));
  }

  public get isRunning(): boolean {
    return this.started;
  }

  public get address(): string {
    return `http://${this.host}:${this.port}${this.path}`;
  }

  /**
   * feed an express/fastify handler into the parser without a socket.
   *
   * Transport auth: when you PASS `headers`, ingest() verifies the delivery
   * itself (Authorization secret, top.gg v1 signature or a configured HMAC
   * key - same rules as the http server) and returns null on failure. When
   * you pass NO headers, the call trusts your framework's auth and only
   * parses. Rate limiting and ip bans stay your framework's job either way.
   */
  public ingest(
    listQuery: string,
    body: unknown,
    options: { headers?: Record<string, string | string[] | undefined>; isTest?: boolean } = {},
  ): ParsedWebhook | null {
    const list = resolveList(listQuery);
    if (!list) return null;
    if (this.requireSecret && !Object.keys(this.secrets).length) {
      throw new Error('[discord-botlists] ingest() called without a configured secret');
    }
    // discordlist.gg delivers the whole body as an HS256 JWT string: verify it
    // with the configured secret (the signature IS the auth) and parse the
    // claims instead. An invalid token is a rejected delivery, not a vote.
    let jwtVerified = false;
    if (isJwtLike(body)) {
      const secret = this.secrets[list.id] ?? this.secrets['*'];
      const claims = secret ? verifyJwtHs256(body, secret) : null;
      if (!claims) {
        this.emit('error', new Error(`invalid jwt for ${list.id} (ingest)`));
        return null;
      }
      body = claims;
      jwtVerified = true;
    }
    const raw = body === undefined || body === null ? '' : JSON.stringify(body);
    const callerSentHeaders = options.headers !== undefined;
    if (callerSentHeaders || jwtVerified || (list && this.hmacKeys[list.id])) {
      const auth = this.authorize(list, options.headers ?? {}, raw, body, jwtVerified);
      if (!auth.ok) {
        this.emit('error', new Error(`${auth.reason} for ${list.id} (ingest)`));
        return null;
      }
    }
    return this.parseAndEmit(list, body, options.isTest === true);
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = (req.url ?? '/').split('?')[0] ?? '/';
    const method = (req.method ?? 'GET').toUpperCase();
    const ip = clientIp(req, this.security.trustProxy === true);

    if (!url.startsWith(this.path)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'not found' }));
      return;
    }

    if (method === 'GET') {
      this.emit('request', { method, url, status: 302, listId: null });
      res.writeHead(302, { location: this.redirectUrl });
      res.end();
      return;
    }

    if (method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
      return;
    }

    // banned ip short-circuits before any body reading.
    const state = this.stateFor(ip);
    if (state.bannedUntil > Date.now()) {
      const retry = Math.ceil((state.bannedUntil - Date.now()) / 1000);
      res.writeHead(403, { 'content-type': 'application/json', 'retry-after': String(retry) });
      res.end(JSON.stringify({ ok: false, error: 'temporarily banned' }));
      this.emit('request', { method, url, status: 403, listId: null });
      return;
    }

    // per ip rate limit.
    const rl = this.security.rateLimit ?? DEFAULT_SECURITY.rateLimit;
    if (state.rate.resetAt <= Date.now()) {
      state.rate = { count: 0, resetAt: Date.now() + rl.windowMs };
    }
    state.rate.count++;
    if (state.rate.count > rl.max) {
      const retry = Math.ceil((state.rate.resetAt - Date.now()) / 1000);
      res.writeHead(429, { 'content-type': 'application/json', 'retry-after': String(retry) });
      res.end(JSON.stringify({ ok: false, error: 'rate limited' }));
      this.emit('request', { method, url, status: 429, listId: null });
      return;
    }

    const list = this.identifyList(req);
    let raw = '';
    try {
      raw = await readBody(req);
    } catch {
      res.writeHead(413, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'payload too large' }));
      this.emit('request', { method, url, status: 413, listId: null });
      return;
    }
    let body: unknown = null;
    let jwtVerified = false;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      // discordlist.gg delivers the ENTIRE body as an HS256 JWT signed with
      // the webhook secret (claims: {user_id, bot_id, is_test}). A valid
      // signature doubles as the transport auth - no headers to compare.
      const secret = list ? this.secrets[list.id] ?? this.secrets['*'] : this.secrets['*'];
      const claims = isJwtLike(raw) && secret ? verifyJwtHs256(raw, secret) : null;
      if (claims) {
        body = claims;
        jwtVerified = true;
      } else {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
        this.emit('error', new Error(`invalid json from ${ip} (${list?.id ?? 'unknown list'})`));
        return;
      }
    }

    const auth = this.authorize(list, req.headers, raw, body, jwtVerified);
    if (!auth.ok) {
      state.authFailures++;
      if (state.authFailures >= (this.security.banAfterFailures ?? DEFAULT_SECURITY.banAfterFailures)) {
        state.bannedUntil = Date.now() + (this.security.banDurationMs ?? DEFAULT_SECURITY.banDurationMs);
        state.authFailures = 0;
      }
      this.emit('error', new Error(`${auth.reason} from ${ip} (${list?.id ?? 'unknown list'})`));
      this.emit('request', { method, url, status: auth.status, listId: list?.id ?? null });
      res.writeHead(auth.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: auth.reason }));
      return;
    }
    state.authFailures = 0;

    const isTest = detectTest(list, body);
    const parsed = this.parseAndEmit(list ?? UNKNOWN_LIST, body, isTest);

    this.emit('request', { method, url, status: 200, listId: list?.id ?? null });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));

    if (this.debug && parsed) {
      console.log(`[discord-botlists] ${parsed.event} from ${parsed.listId}`);
    }
  }

  /** map the request onto a list via the webhook path suffix or query param. */
  private identifyList(req: IncomingMessage): BotlistRecord | null {
    const full = req.url ?? '';
    // 1. /<base>/<list> style paths: try every remaining segment, last first.
    const rest = full.slice(this.path.length).split('?')[0] ?? '';
    const segments = rest.split('/').filter(Boolean).reverse();
    for (const segment of segments) {
      const list = safeResolve(decodeURIComponent(segment));
      if (list) return list;
    }
    // 2. ?list= or ?source= query parameter.
    const url = new URL(full, `http://${req.headers.host ?? 'localhost'}`);
    const param = url.searchParams.get('list') ?? url.searchParams.get('source');
    if (param) {
      const list = safeResolve(param);
      if (list) return list;
    }
    return null;
  }

  private authorize(
    list: BotlistRecord | null,
    rawHeaders: IncomingMessage['headers'] | Record<string, string | string[] | undefined>,
    rawBody: string,
    body: unknown,
    jwtVerified = false,
  ): { ok: true } | { ok: false; reason: string; status: number } {
    // optional allowlist: only named lists may post.
    const allow = this.security.allowedLists;
    if (allow && list && !allow.includes(list.id)) {
      return { ok: false, reason: 'list not allowed', status: 403 };
    }

    // a verified JWT body (discordlist.gg) IS the auth: the signature was
    // checked with the secret at parse time.
    if (jwtVerified) return { ok: true };

    const secret = list ? this.secrets[list.id] ?? this.secrets['*'] : this.secrets['*'];
    const hmacKey = list ? this.hmacKeys[list.id] : undefined;

    // hmac verification takes precedence when a key exists for this list.
    if (hmacKey) {
      const headers = normalizeHeaders(rawHeaders);
      if (this.verifyHmac(list?.id ?? '', rawBody, headers)) return { ok: true };
      return { ok: false, reason: 'invalid signature', status: 401 };
    }

    // no secret configured for anything: requireSecret decides.
    if (!secret) {
      return this.requireSecret
        ? { ok: false, reason: 'no secret configured', status: 503 }
        : { ok: true };
    }

    const headers = normalizeHeaders(rawHeaders);
    // some lists sign instead of sharing a secret; accept common signatures too.
    if (list && this.verifySignatureHex(list.id, rawBody, headers, secret)) return { ok: true };

    for (const name of SECRET_HEADERS) {
      const value = headers[name];
      if (typeof value === 'string' && safeEqual(value, secret)) return { ok: true };
      // "Authorization: Bearer <secret>" and "Basic" forms.
      if (typeof value === 'string') {
        const bare = value.replace(/^(?:Bearer|Basic)\s+/i, '').trim();
        if (bare && safeEqual(bare, secret)) return { ok: true };
      }
    }
    // some lists put the secret in the body instead of a header.
    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      if (typeof record['secret'] === 'string' && safeEqual(record['secret'], secret)) return { ok: true };
    }
    return { ok: false, reason: 'unauthorized', status: 401 };
  }

  /** hmac-sha256(raw body) matched against any common signature header. */
  private verifyHmac(listId: string, rawBody: string, headers: Record<string, string>): boolean {
    const key = this.hmacKeys[listId];
    if (!key) return false;
    return this.verifySignatureHex(listId, rawBody, headers, key);
  }

  private verifySignatureHex(listId: string, rawBody: string, headers: Record<string, string>, key: string): boolean {
    // Timestamped scheme: "t=<unix seconds>,v1=<hex hmac-sha256 of '<t>.<raw
    // body>'>". top.gg's x-topgg-signature and DisQ's x-disq-signature
    // (docs.disq.ink/webhooks/overview) both use it. It does not match the
    // plain raw-body schemes below, so it is checked first.
    for (const name of ['x-topgg-signature', 'x-disq-signature']) {
      const sig = headers[name];
      if (typeof sig !== 'string' || !sig) continue;
      const t = /(?:^|,)\s*t=([^,]+)/.exec(sig)?.[1]?.trim();
      const v1 = /(?:^|,)\s*v1=([^,]+)/.exec(sig)?.[1]?.trim();
      if (t && v1) {
        const expected = createHmac('sha256', key).update(`${t}.${rawBody}`).digest('hex');
        if (safeEqualHex(v1, expected)) return true;
      }
    }
    // topbot.gg variant: the signature header carries ONLY the hex hmac; the
    // timestamp arrives in a separate x-topbot-timestamp header (hmac over
    // "<timestamp>.<raw body>"). Only tried when the timestamp header exists,
    // so plain-hex signature headers are unaffected.
    const topbotSig = headers['x-topbot-signature'];
    const topbotTs = headers['x-topbot-timestamp'];
    if (typeof topbotSig === 'string' && typeof topbotTs === 'string' && topbotSig && topbotTs && !topbotSig.includes('=')) {
      const expectedTs = createHmac('sha256', key).update(`${topbotTs}.${rawBody}`).digest('hex');
      if (safeEqualHex(topbotSig.trim(), expectedTs)) return true;
    }
    const expected = createHmac('sha256', key).update(rawBody).digest('hex');
    for (const name of SIGNATURE_HEADERS) {
      const value = headers[name];
      if (typeof value !== 'string' || !value) continue;
      const bare = value.replace(/^sha256=/i, '').trim();
      if (safeEqualHex(bare, expected)) return true;
    }
    return false;
  }

  private parseAndEmit(list: BotlistRecord | null, body: unknown, isTest?: boolean): ParsedWebhook | null {
    if (!list) return null;
    // top.gg v1 wraps the payload ({ vote: { userId, botId, type, ... } });
    // flatten it so detection and parsing stay list-agnostic. The original
    // body is preserved on the parsed payload's `raw`.
    const flat = unwrapVoteEnvelope(body) ?? body;
    const test = isTest === true ? true : detectTest(list, flat);
    const event = detectEvent(list, flat, test);
    if (!event) return null;
    const payload =
      event === 'vote' || event === 'test'
        ? this.parser.parseVoteWebhook(list, flat, test)
        : this.parser.parseCommentWebhook(list, flat, event === 'comment' ? 'comment' : event === 'rating' ? 'rating' : 'review');
    if (payload && flat !== body) payload.raw = body;
    const parsed: ParsedWebhook = { listId: list.id, event, payload };
    this.emit('raw', parsed);
    this.emit(event, payload);
    return parsed;
  }

  private stateFor(ip: string): IpState {
    let state = this.ipState.get(ip);
    if (!state) {
      state = { rate: { count: 0, resetAt: Date.now() + (this.security.rateLimit ?? DEFAULT_SECURITY.rateLimit).windowMs }, authFailures: 0, bannedUntil: 0 };
      this.ipState.set(ip, state);
    }
    return state;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [ip, state] of this.ipState) {
      if (state.bannedUntil < now && state.rate.resetAt < now && state.authFailures === 0) {
        this.ipState.delete(ip);
      }
    }
  }
}

function normalizeHeaders(headers: IncomingMessage['headers'] | Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return out;
}

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
    if (Array.isArray(forwarded) && forwarded.length) return forwarded[0].trim();
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string') return real;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

const UNKNOWN_LIST: BotlistRecord = {
  id: 'unknown',
  name: 'Unknown list',
  website: null,
  apiDocs: null,
  apiPost: null,
  postField: null,
  postMethod: 'POST',
  shardField: null,
  shardIdField: null,
  shardsArrayField: null,
  apiGet: null,
  viewBot: null,
  widget: null,
  authHeader: 'Authorization',
  tokenEnvKey: 'DBL_UNKNOWN',
  webhook: { header: 'Authorization', voterField: null, eventField: null },
  supports: { post: false, get: false, widget: false, webhook: true },
};

function safeResolve(query: string): BotlistRecord | null {
  try {
    return resolveList(query);
  } catch {
    return null;
  }
}

function normalizePath(path: string): string {
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  return trimmed.endsWith('/') && trimmed !== '/' ? trimmed.slice(0, -1) : trimmed;
}

function readBody(req: IncomingMessage, limit = 512 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function safeEqualHex(a: string, b: string): boolean {
  return a.length === b.length && safeEqual(a.toLowerCase(), b.toLowerCase());
}

/** top.gg v1 style test events and generic test payloads. */
function detectTest(list: BotlistRecord | null, body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const record = body as Record<string, unknown>;
  const type = record[list?.webhook?.eventField ?? 'type'];
  // case-insensitive: botlist.me sends "Test", v0 lists send "test".
  if (typeof type === 'string' && type.toLowerCase().includes('test')) return true;
  // dlist.space sends test:true, discordforge legacy isTest, discordlist.gg
  // JWT claims is_test.
  return record['test'] === true || record['isTest'] === true || record['is_test'] === true;
}

function detectEvent(list: BotlistRecord, body: unknown, isTest: boolean): ParsedWebhook['event'] | null {
  if (isTest) return 'test';
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    const eventField = list.webhook?.eventField;
    const rawType = eventField ? record[eventField] : record['type'];
    // case-insensitive: botlist.me sends "Upvote" for real votes.
    const type = typeof rawType === 'string' ? rawType.toLowerCase() : null;
    if (type) {
      if (type.includes('review')) return 'review';
      if (type.includes('comment')) return 'comment';
      if (type.includes('rating')) return 'rating';
      if (type.includes('vote')) return 'vote';
    }
    // body shape heuristics for lists without an event field.
    if ('rating' in record || 'stars' in record) return 'rating';
    if ('review' in record || 'content' in record || 'comment' in record) return 'review';
  }
  return 'vote';
}
