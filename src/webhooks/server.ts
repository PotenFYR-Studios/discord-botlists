import { EventEmitter } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { BotlistRecord, ParsedWebhook, WebhookOptions } from '../types.js';
import { UniversalParser } from '../core/parser.js';
import { resolveList } from '../core/http.js';

/**
 * VoteWebhookServer: dependency free http server that receives vote, comment
 * and review webhooks from every supported list and re-emits them as typed
 * realtime events on a single EventEmitter. Zero delay, no polling.
 *
 * Events:
 *  vote      -> UniversalVote, fired for every real vote
 *  comment   -> UniversalComment
 *  review    -> UniversalComment
 *  rating    -> UniversalComment
 *  test      -> UniversalVote, fired for webhook test requests
 *  raw       -> ParsedWebhook, fired for every parsed request
 *  request   -> { method, url, status, listId }, fired for every request
 *  error     -> Error, fired for bad auth or unparsable bodies
 */
export class VoteWebhookServer extends EventEmitter {
  private readonly port: number;
  private readonly path: string;
  private readonly host: string;
  private readonly redirectUrl: string;
  private readonly debug: boolean;
  private readonly parser = new UniversalParser();
  private readonly secrets: Record<string, string>;
  private server: Server | null = null;
  private started = false;

  public constructor(options: WebhookOptions = {}) {
    super();
    this.port = options.port ?? 8080;
    this.path = normalizePath(options.path ?? '/discord-botlists');
    this.host = options.host ?? 'localhost';
    this.redirectUrl = options.redirectUrl ?? 'https://github.com/PotenFYR-Studios/discord-botlists';
    this.debug = options.debug ?? false;
    this.secrets = typeof options.secret === 'string' ? { '*': options.secret } : (options.secret ?? {});
    if (options.autoStart) void this.start();
  }

  /** start listening. resolves once the socket is live. */
  public async start(): Promise<void> {
    if (this.started) return;
    const server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.port, () => resolve());
    });
    this.server = server;
    this.started = true;
    if (this.debug) console.log(`[discord-botlists] webhook server listening on ${this.host}:${this.port}${this.path}`);
  }

  public stop(): Promise<void> {
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

  /** feed an express/fastify handler into the parser without a socket. */
  public ingest(
    listQuery: string,
    body: unknown,
    options: { headers?: Record<string, string | string[] | undefined>; isTest?: boolean } = {},
  ): ParsedWebhook | null {
    const list = resolveList(listQuery);
    if (!list) return null;
    return this.parseAndEmit(list, body, options.isTest === true);
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = (req.url ?? '/').split('?')[0] ?? '/';
    const method = (req.method ?? 'GET').toUpperCase();

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

    const list = this.identifyList(req);
    const raw = await readBody(req);
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      this.emit('error', new Error(`invalid json from ${list?.id ?? 'unknown list'}`));
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
      return;
    }

    if (!this.authorize(list, req, body)) {
      this.emit('error', new Error(`unauthorized webhook from ${list?.id ?? 'unknown list'}`));
      this.emit('request', { method, url, status: 401, listId: list?.id ?? null });
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      return;
    }

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
    // 3. still unknown: caller gets a generic record so events keep flowing.
    return null;
  }

  private authorize(list: BotlistRecord | null, req: IncomingMessage, body: unknown): boolean {
    const secret = list ? this.secrets[list.id] ?? this.secrets['*'] : this.secrets['*'];
    if (!secret) return true;
    const header = req.headers.authorization ?? req.headers['x-webhook-authentication'] ?? req.headers.authorization;
    if (typeof header === 'string' && safeEqual(header, secret)) return true;
    // some lists put the secret in the body instead of a header.
    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      if (typeof record['secret'] === 'string' && safeEqual(record['secret'], secret)) return true;
    }
    return false;
  }

  private parseAndEmit(list: BotlistRecord | null, body: unknown, isTest?: boolean): ParsedWebhook | null {
    if (!list) return null;
    const test = isTest === true ? true : detectTest(list, body);
    const event = detectEvent(list, body, test);
    if (!event) return null;
    const payload =
      event === 'vote' || event === 'test'
        ? this.parser.parseVoteWebhook(list, body, test)
        : this.parser.parseCommentWebhook(list, body, event === 'comment' ? 'comment' : event === 'rating' ? 'rating' : 'review');
    const parsed: ParsedWebhook = { listId: list.id, event, payload };
    this.emit('raw', parsed);
    this.emit(event, payload);
    return parsed;
  }
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

/** top.gg v1 style test events and generic test payloads. */
function detectTest(list: BotlistRecord | null, body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const record = body as Record<string, unknown>;
  const type = record[list?.webhook?.eventField ?? 'type'];
  if (typeof type === 'string' && type.includes('test')) return true;
  return record['test'] === true;
}

function detectEvent(list: BotlistRecord, body: unknown, isTest: boolean): ParsedWebhook['event'] | null {
  if (isTest) return 'test';
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    const eventField = list.webhook?.eventField;
    const type = eventField ? record[eventField] : record['type'];
    if (typeof type === 'string') {
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
