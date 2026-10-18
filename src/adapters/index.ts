/**
 * Framework adapters: plug vote webhooks into the server you ALREADY run.
 * Nothing here starts a server or imports a framework - every adapter is
 * duck-typed and forwards to `webhook.process()`, so they work with whatever
 * version you have installed and add zero dependencies.
 *
 *   express / connect / polka / restify / NestJS (express) / Next.js pages API
 *     app.post('/votes/:list', express.raw({ type: '*\/*' }), expressHandler(lists.webhook))
 *   fastify         fastify.post('/votes/:list', fastifyHandler(lists.webhook))
 *   koa             router.post('/votes/:list', koaHandler(lists.webhook))
 *   AWS Lambda / API Gateway / Vercel / Netlify functions
 *     export const handler = lambdaHandler(lists.webhook)
 *   Hono, Elysia, Next.js route handlers, SvelteKit, Remix, Bun, Deno,
 *   Cloudflare Workers, h3/Nitro:  fetchHandler(lists.webhook)  (Request -> Response)
 *
 * Signature-based lists (top.gg v1, DisQ, TheDiscordList, TopBot, DiscordForge
 * v2) sign the EXACT bytes. Give the adapter the raw body (`express.raw`,
 * `fastify-raw-body`, koa-bodyparser's `rawBody`) or a stream it can read;
 * with only a parsed body it re-serialises JSON, which matches for most
 * senders but is not guaranteed byte-identical.
 */
import type { VoteWebhookServer } from '../webhooks/server.js';
import type { WebhookInput, WebhookOutput } from '../types.js';

export interface AdapterOptions {
  /** botlist id/name/host to pin, e.g. 'top.gg'. Default: read from the url (`/votes/top.gg` or `?list=top.gg`). */
  list?: string;
}

type Headers = Record<string, string | string[] | undefined>;
type Any = any; // framework objects are duck-typed on purpose

const asBytes = (v: unknown): Uint8Array | string | undefined => {
  if (typeof v === 'string') return v;
  if (v instanceof Uint8Array) return v; // Buffer is a Uint8Array
  return undefined;
};

async function readStream(stream: Any): Promise<string | undefined> {
  if (!stream || typeof stream[Symbol.asyncIterator] !== 'function' || stream.readableEnded) return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of stream as AsyncIterable<Uint8Array | string>) {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
    size += bytes.length;
    if (size > 1_000_000) throw new Error('payload too large');
    chunks.push(bytes);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  return new TextDecoder().decode(all);
}

/** body + rawBody from a node-style request, whatever middleware ran before. */
async function nodeBody(req: Any): Promise<Pick<WebhookInput, 'body' | 'rawBody'>> {
  const raw = asBytes(req.rawBody);
  const b = req.body;
  if (raw !== undefined) return { rawBody: raw, body: typeof b === 'object' && !(b instanceof Uint8Array) ? b : undefined };
  if (b instanceof Uint8Array || typeof b === 'string') return { rawBody: b }; // express.raw / express.text
  if (b && typeof b === 'object' && Object.keys(b).length) return { body: b }; // express.json / fastify
  return { rawBody: await readStream(req.raw ?? req) }; // untouched stream
}

function send(res: Any, out: WebhookOutput): void {
  if (typeof res.setHeader === 'function') for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  res.statusCode = out.status;
  res.end(out.body === null ? '' : JSON.stringify(out.body));
}

/** express, connect, polka, restify, NestJS (express platform), Next.js pages API routes. */
export function expressHandler(webhook: VoteWebhookServer, options: AdapterOptions = {}) {
  return async (req: Any, res: Any, next?: (error?: unknown) => void): Promise<void> => {
    try {
      const out = await webhook.process({
        method: req.method,
        url: req.originalUrl ?? req.url,
        host: req.headers?.host,
        headers: req.headers as Headers,
        ...(await nodeBody(req)),
        list: options.list ?? (typeof req.params?.list === 'string' ? req.params.list : undefined),
      });
      send(res, out);
    } catch (error) {
      if (next) next(error);
      else {
        res.statusCode = 500;
        res.end('{"ok":false}');
      }
    }
  };
}

/** Node `http.createServer((req, res) => ...)` or any bare node request listener. */
export const nodeHandler = expressHandler;

/** fastify route handler: `fastify.post('/votes/:list', fastifyHandler(webhook))`. */
export function fastifyHandler(webhook: VoteWebhookServer, options: AdapterOptions = {}) {
  return async (request: Any, reply: Any): Promise<unknown> => {
    const out = await webhook.process({
      method: request.method,
      url: request.url,
      host: request.headers?.host,
      headers: request.headers as Headers,
      ...(await nodeBody(request)),
      list: options.list ?? (typeof request.params?.list === 'string' ? request.params.list : undefined),
    });
    reply.code(out.status).headers(out.headers);
    return reply.send(out.body ?? '');
  };
}

/** koa middleware/handler (works with koa-router and @koa/router). */
export function koaHandler(webhook: VoteWebhookServer, options: AdapterOptions = {}) {
  return async (ctx: Any): Promise<void> => {
    const raw = asBytes(ctx.request?.rawBody);
    const parsed = ctx.request?.body;
    const out = await webhook.process({
      method: ctx.method,
      url: ctx.originalUrl ?? ctx.url,
      host: ctx.host,
      headers: ctx.headers as Headers,
      ...(raw !== undefined
        ? { rawBody: raw }
        : parsed && typeof parsed === 'object' && Object.keys(parsed).length
          ? { body: parsed }
          : { rawBody: await readStream(ctx.req) }),
      list: options.list ?? (typeof ctx.params?.list === 'string' ? ctx.params.list : undefined),
    });
    ctx.status = out.status;
    for (const [k, v] of Object.entries(out.headers)) ctx.set(k, v);
    ctx.body = out.body === null ? '' : out.body;
  };
}

/** AWS Lambda behind API Gateway (REST v1 or HTTP v2), Lambda function URLs, Netlify, Vercel serverless. */
export function lambdaHandler(webhook: VoteWebhookServer, options: AdapterOptions = {}) {
  return async (event: Any): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
    const method = event.httpMethod ?? event.requestContext?.http?.method ?? 'POST';
    const path = event.rawPath ?? event.path ?? '/';
    const query = event.rawQueryString ?? (event.queryStringParameters ? new URLSearchParams(event.queryStringParameters).toString() : '');
    const headers: Headers = {};
    for (const [k, v] of Object.entries((event.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v;
    let rawBody: string | undefined = event.body ?? undefined;
    if (rawBody && event.isBase64Encoded) rawBody = new TextDecoder().decode(Uint8Array.from(atob(rawBody), (c) => c.charCodeAt(0)));
    const out = await webhook.process({
      method,
      url: query ? `${path}?${query}` : path,
      host: headers['host'] as string | undefined,
      headers,
      rawBody,
      list: options.list ?? event.pathParameters?.list,
    });
    return { statusCode: out.status, headers: out.headers, body: out.body === null ? '' : JSON.stringify(out.body) };
  };
}

/** Request -> Response for Hono, Elysia, Next.js route handlers, SvelteKit, Remix, Bun, Deno, Workers. */
export function fetchHandler(webhook: VoteWebhookServer, options: AdapterOptions = {}) {
  return (request: Request): Promise<Response> => webhook.handleRequest(request, options);
}
