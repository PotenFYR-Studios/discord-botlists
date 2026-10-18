import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { Botlists, expressHandler, fastifyHandler, koaHandler, lambdaHandler, fetchHandler, readClientStats } from '../src/index.js';
import { VoteWebhookServer } from '../src/webhooks/server.js';

const mk = () => {
  const server = new VoteWebhookServer({ secret: { 'botlist.me': 'sek' } });
  const votes: (string | null)[] = [];
  server.on('vote', (v: { voterId: string | null }) => votes.push(v.voterId));
  return { server, votes };
};
const fakeRes = () => {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 0,
    out: '',
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    end(chunk: string) {
      this.out = chunk;
    },
  };
};

describe('framework adapters (no server started)', () => {
  test('express with express.json already parsed + :list param', async () => {
    const { server, votes } = mk();
    const res = fakeRes();
    await expressHandler(server)(
      { method: 'POST', url: '/votes/botlist.me', headers: { authorization: 'sek' }, body: { user: '1', type: 'Upvote' }, params: { list: 'botlist.me' } },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(votes).toEqual(['1']);
  });

  test('express with an untouched stream (no body parser)', async () => {
    const { server, votes } = mk();
    const res = fakeRes();
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify({ user: '2', type: 'Upvote' }))]), {
      method: 'POST',
      url: '/hook?list=botlist.me',
      headers: { authorization: 'sek' },
    });
    await expressHandler(server)(req, res);
    expect(res.statusCode).toBe(200);
    expect(votes).toEqual(['2']);
  });

  test('express.raw Buffer + pinned list verifies a signed delivery byte-for-byte', async () => {
    const server = new VoteWebhookServer({ secret: { 'thediscordlist.com': 's' }, security: { hmac: { 'thediscordlist.com': 's' } } });
    const votes: (string | null)[] = [];
    server.on('vote', (v: { voterId: string | null }) => votes.push(v.voterId));
    const raw = '{"id":"d1","event":"listing.upvoted","created_at":"x","listing":{"id":"9"},"data":{"user":{"id":"55"}}}';
    const t = '1760000000';
    const sig = createHmac('sha256', 's').update(`${t}.${raw}`).digest('hex');
    const res = fakeRes();
    await expressHandler(server, { list: 'thediscordlist.com' })(
      { method: 'POST', url: '/anything', headers: { 'x-tdl-signature': `t=${t},v1=${sig}` }, body: Buffer.from(raw) },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(votes).toEqual(['55']);
  });

  test('wrong secret is 401', async () => {
    const { server } = mk();
    server.on('error', () => {});
    const res = fakeRes();
    await expressHandler(server)({ method: 'POST', url: '/botlist.me', headers: { authorization: 'bad' }, body: { user: '1' } }, res);
    expect(res.statusCode).toBe(401);
  });

  test('fastify handler', async () => {
    const { server, votes } = mk();
    const reply = {
      c: 0,
      code(c: number) {
        this.c = c;
        return this;
      },
      headers() {
        return this;
      },
      send(b: unknown) {
        return b;
      },
    };
    await fastifyHandler(server)(
      { method: 'POST', url: '/votes/botlist.me', headers: { authorization: 'sek' }, body: { user: '3', type: 'Upvote' }, params: { list: 'botlist.me' } },
      reply,
    );
    expect(reply.c).toBe(200);
    expect(votes).toEqual(['3']);
  });

  test('koa handler with koa-bodyparser rawBody', async () => {
    const { server, votes } = mk();
    const ctx = {
      method: 'POST',
      url: '/votes/botlist.me',
      headers: { authorization: 'sek' },
      request: { rawBody: '{"user":"4","type":"Upvote"}', body: { user: '4' } },
      params: { list: 'botlist.me' },
      set: () => {},
      status: 0,
      body: null as unknown,
    };
    await koaHandler(server)(ctx);
    expect(ctx.status).toBe(200);
    expect(votes).toEqual(['4']);
  });

  test('lambda handler: HTTP API v2 with base64 body', async () => {
    const { server, votes } = mk();
    const body = Buffer.from(JSON.stringify({ user: '5', type: 'Upvote' })).toString('base64');
    const out = await lambdaHandler(server)({
      rawPath: '/votes/botlist.me',
      rawQueryString: '',
      requestContext: { http: { method: 'POST' } },
      headers: { Authorization: 'sek' },
      body,
      isBase64Encoded: true,
    });
    expect(out.statusCode).toBe(200);
    expect(votes).toEqual(['5']);
  });

  test('fetch handler (Hono/Next/Workers) with a pinned list', async () => {
    const { server, votes } = mk();
    const res = await fetchHandler(server, { list: 'botlist.me' })(
      new Request('https://edge.test/api/whatever', { method: 'POST', headers: { authorization: 'sek' }, body: JSON.stringify({ user: '6', type: 'Upvote' }) }),
    );
    expect(res.status).toBe(200);
    expect(votes).toEqual(['6']);
    const bad = await fetchHandler(server, { list: 'nope.example' })(new Request('https://edge.test/x', { method: 'POST', body: '{}' }));
    expect(bad.status).toBe(404);
  });
});

describe('client readers', () => {
  test('discord.js (guilds.cache.size) used to read 0', async () => {
    expect((await readClientStats({ guilds: { cache: { size: 321 } } })).serverCount).toBe(321);
  });

  test('discord.js child shard sums every shard via fetchClientValues', async () => {
    const stats = await readClientStats({ guilds: { cache: { size: 10 } }, shard: { count: 3, ids: [0], fetchClientValues: async () => [10, 20, 30] } });
    expect(stats).toMatchObject({ serverCount: 60, shardCount: 3, shards: [10, 20, 30], shardId: 0 });
  });

  test('discord.js ShardingManager (parent process)', async () => {
    const stats = await readClientStats({ totalShards: 2, fetchClientValues: async () => [5, 7] });
    expect(stats).toMatchObject({ serverCount: 12, shardCount: 2, shards: [5, 7] });
  });

  test('Eris / Oceanic: guilds.size and per-shard counts from guild.shardID', async () => {
    const guilds = new Map([
      ['a', { shardID: 0 }],
      ['b', { shardID: 1 }],
      ['c', { shardID: 1 }],
    ]);
    const stats = await readClientStats({ guilds, shards: new Map([[0, {}], [1, {}]]) });
    expect(stats).toMatchObject({ serverCount: 3, shardCount: 2, shards: [1, 2] });
  });

  test('Seyfert async cache count and Discordeno cache', async () => {
    expect((await readClientStats({ cache: { guilds: { count: async () => 99 } } })).serverCount).toBe(99);
    expect((await readClientStats({ cache: { guilds: new Map([['a', 1], ['b', 2]]) } })).serverCount).toBe(2);
  });

  test('plain numbers and hostile objects never throw', async () => {
    expect((await readClientStats({ guildCount: 12 })).serverCount).toBe(12);
    expect(
      await readClientStats({
        get guilds(): never {
          throw new Error('boom');
        },
      }),
    ).toEqual({});
    expect(await readClientStats(null)).toEqual({});
  });

  test('Botlists posts the real count for a discord.js-shaped client', async () => {
    const realFetch = globalThis.fetch;
    let sent: unknown = null;
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response('{}');
    }) as typeof fetch;
    try {
      const lists = new Botlists({ botId: '1', client: { guilds: { cache: { size: 77 } } }, tokens: { 'botlist.me': 't' }, webhook: { autoStart: false } });
      await lists.postStatsTo('botlist.me');
    } finally {
      globalThis.fetch = realFetch;
    }
    expect((sent as { server_count: number }).server_count).toBe(77);
  });
});

describe('attach()', () => {
  test('starts as soon as the client emits ready (Eris/Oceanic style)', async () => {
    const client = Object.assign(new EventEmitter(), { guilds: new Map<string, number>() });
    const lists = new Botlists({ botId: '1', client, webhook: { autoStart: false }, tokens: {} });
    let posted = 0;
    lists.on('statsPosted', () => posted++);
    const stop = lists.attach(client, { intervalMs: 3_600_000 });
    expect(posted).toBe(0);
    client.emit('ready');
    await new Promise((r) => setTimeout(r, 20));
    expect(posted).toBe(1);
    stop();
  });

  test('polling covers a renamed event: guilds appear, posting starts', async () => {
    const client = { guilds: new Map<string, number>([['a', 1]]) };
    const lists = new Botlists({ botId: '1', client, webhook: { autoStart: false }, tokens: {} });
    let posted = 0;
    lists.on('statsPosted', () => posted++);
    const stop = lists.attach(client, { intervalMs: 3_600_000 });
    await new Promise((r) => setTimeout(r, 2400));
    expect(posted).toBe(1);
    stop();
  });
});
