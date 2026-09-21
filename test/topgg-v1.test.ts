import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { VoteWebhookServer } from '../src/webhooks/server.js';
import { Botlists } from '../src/index.js';
import { buildPostBody, resolveList } from '../src/core/http.js';

/**
 * top.gg v1 webhook suite.
 *
 * top.gg migrated webhooks from the legacy shared password (Authorization
 * header) to signed v1 deliveries: every request carries
 *   x-topgg-signature: t=<unix seconds>,v1=<hex hmac-sha256 of "<t>.<body>">
 * and the payload is wrapped: {"vote":{"userId":..,"botId":..,"type":"vote"}}.
 * The legacy flat v0 shape must keep working alongside it.
 */

const WHS = 'whs_test_secret_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/** Sign a raw body exactly the way top.gg v1 does. */
function signV1(raw: string, t = Math.floor(Date.now() / 1000), secret = WHS): string {
  const v1 = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

const V1_VOTE = { vote: { id: '3029384756102938475', botId: '1470079725106888817', userId: '264811613708746752', type: 'vote', createdAt: '2026-09-20T10:00:00.000Z' } };
const V1_TEST = { vote: { id: '3029384756102938476', botId: '1470079725106888817', userId: '264811613708746752', type: 'test', createdAt: '2026-09-20T10:00:00.000Z' } };

/**
 * REAL top.gg v1 payloads (docs.top.gg/webhooks/events). The envelope is
 * {"type":"vote.create"|"webhook.test","data":{...}} - NOT the {vote:{...}}
 * shape the original fixtures assumed. The voter's DISCORD id is
 * data.user.platform_id; data.user.id is top.gg's internal id and NOT a
 * snowflake. weight is 2 during the weekend multiplier.
 */
const RV1_VOTE = {
  type: 'vote.create',
  data: {
    id: '808499215864008704',
    weight: 1,
    created_at: '2026-02-09T00:47:14.2510149+00:00',
    expires_at: '2026-02-09T12:47:14.2510149+00:00',
    project: { id: '803190510032756736', type: 'bot', platform: 'discord', platform_id: '160105994217586689' },
    query: { ref: 'jericho' },
    user: { id: '999888777666555444', platform_id: '264811613708746752', name: 'votername', avatar_url: 'https://cdn.discordapp.com/avatars/264811613708746752/abc.png' },
  },
};
const RV1_VOTE_WEEKEND = {
  type: 'vote.create',
  data: {
    id: '808499215864008705',
    weight: 2,
    created_at: '2026-02-09T00:47:14.2510149+00:00',
    expires_at: '2026-02-09T12:47:14.2510149+00:00',
    project: { id: '803190510032756736', type: 'bot', platform: 'discord', platform_id: '160105994217586689' },
    query: {},
    user: { id: '999888777666555444', platform_id: '264811613708746752', name: 'votername', avatar_url: 'https://cdn.discordapp.com/avatars/264811613708746752/abc.png' },
  },
};
const RV1_TEST = {
  type: 'webhook.test',
  data: {
    user: { id: '999888777666555444', platform_id: '264811613708746752', name: 'votername', avatar_url: 'https://cdn.discordapp.com/avatars/264811613708746752/abc.png' },
    project: { id: '803190510032756736', type: 'bot', platform: 'discord', platform_id: '160105994217586689' },
  },
};

/** start a server on a free port, run assertions, stop. */
async function withServer(
  opts: ConstructorParameters<typeof VoteWebhookServer>[0],
  fn: (port: number, server: VoteWebhookServer) => Promise<void>,
) {
  const server = new VoteWebhookServer(opts);
  await server.start();
  const addr = server['server']?.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    await fn(port, server);
  } finally {
    await server.stop();
  }
}

const postRaw = (port: number, path: string, raw: string, headers: Record<string, string> = {}) =>
  fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: raw,
  });

describe('top.gg v1 signatures', () => {
  test('signed v1 delivery is accepted on the http server', async () => {
    let voterId: string | null = null;
    await withServer({ port: 0, path: '/hook', secret: { 'top.gg': WHS } }, async (port, server) => {
      server.on('vote', (v: { voterId: string | null }) => (voterId = v.voterId));
      const raw = JSON.stringify(V1_VOTE);
      const res = await postRaw(port, '/hook/top.gg', raw, { 'x-topgg-signature': signV1(raw) });
      expect(res.status).toBe(200);
    });
    expect(voterId).toBe('264811613708746752');
  });

  test('tampered v1 body is rejected', async () => {
    await withServer({ port: 0, path: '/hook', secret: { 'top.gg': WHS } }, async (port, server) => {
      server.on('error', () => undefined); // rejections are expected here
      const raw = JSON.stringify(V1_VOTE);
      const sig = signV1(raw);
      const tampered = raw.replace('264811613708746752', '111111111111111111');
      const res = await postRaw(port, '/hook/top.gg', tampered, { 'x-topgg-signature': sig });
      expect(res.status).toBe(401);
    });
  });

  test('v1 signature with the wrong secret is rejected', async () => {
    await withServer({ port: 0, path: '/hook', secret: { 'top.gg': WHS } }, async (port, server) => {
      server.on('error', () => undefined); // rejections are expected here
      const raw = JSON.stringify(V1_VOTE);
      const res = await postRaw(port, '/hook/top.gg', raw, { 'x-topgg-signature': signV1(raw, Math.floor(Date.now() / 1000), 'whs_wrong') });
      expect(res.status).toBe(401);
    });
  });

  test('legacy v0 authorization header still works next to v1', async () => {
    let count = 0;
    await withServer({ port: 0, path: '/hook', secret: { 'top.gg': WHS } }, async (port) => {
      const res = await postRaw(port, '/hook/top.gg', JSON.stringify({ user: '42', type: 'vote' }), { authorization: WHS });
      expect(res.status).toBe(200);
      count = 1;
    });
    expect(count).toBe(1);
  });
});

describe('top.gg v1 REAL payload envelope (docs.top.gg/webhooks/events)', () => {
  test('ingest() parses {"type":"vote.create","data":{...}} - voter is user.platform_id', () => {
    const server = new VoteWebhookServer({ secret: { 'top.gg': WHS } });
    let got: { voterId?: string | null; botId?: string | null; voterName?: string | null; voterAvatar?: string | null; weekend?: boolean; weight?: number; isTest?: boolean; query?: Record<string, string> } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('top.gg', RV1_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('264811613708746752'); // platform_id, NOT user.id
    expect(got?.voterName).toBe('votername');
    expect(got?.voterAvatar).toBe('https://cdn.discordapp.com/avatars/264811613708746752/abc.png');
    expect(got?.botId).toBe('160105994217586689'); // project.platform_id
    expect(got?.isTest).toBe(false);
    expect(got?.weekend).toBe(false);
    expect(got?.weight).toBe(1);
    expect(got?.query).toEqual({ ref: 'jericho' });
  });

  test('weight 2 marks the vote as weekend multiplier', () => {
    const server = new VoteWebhookServer({ secret: { 'top.gg': WHS } });
    let got: { weekend?: boolean; weight?: number } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    server.ingest('top.gg', RV1_VOTE_WEEKEND);
    expect(got?.weekend).toBe(true);
    expect(got?.weight).toBe(2);
  });

  test('{"type":"webhook.test"} emits the test event with the voter parsed', () => {
    const server = new VoteWebhookServer({ secret: { 'top.gg': WHS } });
    let got: { voterId?: string | null; isTest?: boolean } | null = null;
    server.on('test', (v: typeof got) => (got = v));
    const parsed = server.ingest('top.gg', RV1_TEST);
    expect(parsed?.event).toBe('test');
    expect(got?.voterId).toBe('264811613708746752');
    expect(got?.isTest).toBe(true);
  });

  test('signed real-shape delivery over http is accepted and parsed', async () => {
    let voterId: string | null = null;
    await withServer({ port: 0, path: '/hook', secret: { 'top.gg': WHS } }, async (port, server) => {
      server.on('vote', (v: { voterId: string | null }) => (voterId = v.voterId));
      const raw = JSON.stringify(RV1_VOTE);
      const res = await postRaw(port, '/hook/top.gg', raw, { 'x-topgg-signature': signV1(raw) });
      expect(res.status).toBe(200);
    });
    expect(voterId).toBe('264811613708746752');
  });
});

describe('top.gg v1 payload envelope', () => {
  test('ingest() flattens the v1 vote envelope and preserves raw', () => {
    const server = new VoteWebhookServer({ secret: { 'top.gg': WHS } });
    let got: { voterId?: string | null; botId?: string | null; raw?: unknown; isTest?: boolean } | null = null;
    server.on('vote', (v: { voterId?: string | null; botId?: string | null; raw?: unknown; isTest?: boolean }) => (got = v));
    const parsed = server.ingest('top.gg', V1_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('264811613708746752');
    expect(got?.botId).toBe('1470079725106888817');
    expect(got?.isTest).toBe(false);
    // raw must stay the ORIGINAL enveloped body, not the flattened one.
    expect((got?.raw as { vote?: unknown })?.vote).toBeDefined();
  });

  test('ingest() marks v1 dashboard test deliveries as tests', () => {
    const server = new VoteWebhookServer({ secret: { 'top.gg': WHS } });
    let got: { voterId?: string | null; isTest?: boolean } | null = null;
    server.on('test', (v: { voterId?: string | null; isTest?: boolean }) => (got = v));
    const parsed = server.ingest('top.gg', V1_TEST);
    expect(parsed?.event).toBe('test');
    expect(got?.voterId).toBe('264811613708746752');
    expect(got?.isTest).toBe(true);
  });

  test('flat v0 payloads are untouched', () => {
    const server = new VoteWebhookServer({ secret: { 'top.gg': WHS } });
    let got: { voterId?: string | null } | null = null;
    server.on('vote', (v: { voterId?: string | null }) => (got = v));
    server.ingest('top.gg', { user: '999', bot: '1', type: 'vote' });
    expect(got?.voterId).toBe('999');
  });
});

describe('DBL_* env token mapping', () => {
  test('DBL_TOPGG resolves under the "top.gg" list id', () => {
    const prev = process.env['DBL_TOPGG'];
    process.env['DBL_TOPGG'] = 'eyJtest.token.value';
    try {
      const client = new Botlists({});
      expect((client as unknown as { tokens: Record<string, string> }).tokens['top.gg']).toBe('eyJtest.token.value');
    } finally {
      if (prev === undefined) delete process.env['DBL_TOPGG'];
      else process.env['DBL_TOPGG'] = prev;
    }
  });
});

describe('stats wire body (rate-limit + correctness regressions)', () => {
  test('non-sharded bots omit the shards array (top.gg zeroes count on [])', () => {
    const topgg = resolveList('top.gg')!;
    const body = buildPostBody(topgg, { serverCount: 36 });
    expect('shards' in body).toBe(false);
    expect(body.server_count).toBe(36);
  });

  test('real shard data is still sent', () => {
    const topgg = resolveList('top.gg')!;
    const body = buildPostBody(topgg, { serverCount: 36, shards: [20, 16] });
    expect(body.shards).toEqual([20, 16]);
    expect(body.server_count).toBe(36);
  });
});

describe('ingest() transport auth', () => {
  test('headers + bad signature are rejected', () => {
    const server = new VoteWebhookServer({ secret: { 'top.gg': WHS } });
    server.on('error', () => undefined); // rejection is expected
    const votes: unknown[] = [];
    server.on('vote', (v: unknown) => votes.push(v));
    const parsed = server.ingest('top.gg', V1_VOTE, { headers: { 'x-topgg-signature': 't=1,v1=deadbeef' } });
    expect(parsed).toBeNull();
    expect(votes.length).toBe(0);
  });

  test('headers + valid v1 signature are accepted', () => {
    const server = new VoteWebhookServer({ secret: { 'top.gg': WHS } });
    let got: { voterId?: string | null } | null = null;
    server.on('vote', (v: { voterId?: string | null }) => (got = v));
    const raw = JSON.stringify(V1_VOTE);
    server.ingest('top.gg', V1_VOTE, { headers: { 'x-topgg-signature': signV1(raw) } });
    expect(got?.voterId).toBe('264811613708746752');
  });

  test('no headers = trusted caller (framework auth), still parses', () => {
    const server = new VoteWebhookServer({ secret: { 'top.gg': WHS } });
    const parsed = server.ingest('top.gg', { user: '777', type: 'vote' });
    expect(parsed?.event).toBe('vote');
  });
});
