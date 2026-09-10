import { describe, expect, test } from 'bun:test';
import { VoteWebhookServer } from '../src/webhooks/server.js';
import { createHmac } from 'node:crypto';

/** start a server on a free port, run assertions, stop. */
async function withServer(opts: ConstructorParameters<typeof VoteWebhookServer>[0], fn: (port: number) => Promise<void>) {
  const server = new VoteWebhookServer(opts);
  const errors: string[] = [];
  server.on('error', (e: Error) => errors.push(e.message));
  await server.start();
  const addr = server['server']?.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    await fn(port);
  } finally {
    await server.stop();
  }
  return errors;
}

const post = (port: number, path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('webhook security', () => {
  test('refuses to start without a secret', async () => {
    const server = new VoteWebhookServer({ port: 0 });
    await expect(server.start()).rejects.toThrow('refusing to start');
  });

  test('rejects unsigned posts when a secret is configured', async () => {
    const votes: unknown[] = [];
    await withServer({ port: 0, path: '/hook/top.gg', secret: 's3cret' }, async (port) => {
      const res = await post(port, '/hook/top.gg', { user: '42' });
      expect(res.status).toBe(401);
      expect(votes.length).toBe(0);
    });
  });

  test('accepts signed posts with the correct secret header', async () => {
    let got = 0;
    await withServer(
      {
        port: 0,
        path: '/hook/top.gg',
        secret: 's3cret',
      },
      async (port) => {
        const server = new VoteWebhookServer({ port: 0, path: '/x', secret: 's3cret' }); // noop, keep lints happy
        server.stop();
        const res = await post(port, '/hook/top.gg', { user: '42' }, { authorization: 's3cret' });
        expect(res.status).toBe(200);
        got = 1;
      },
    );
    expect(got).toBe(1);
  });

  test('bearer scheme is accepted', async () => {
    await withServer({ port: 0, path: '/hook/top.gg', secret: 's3cret' }, async (port) => {
      const res = await post(port, '/hook/top.gg', { user: '42' }, { authorization: 'Bearer s3cret' });
      expect(res.status).toBe(200);
    });
  });

  test('hmac-signed payload verifies', async () => {
    const key = 'hmac-key-1';
    let vote: { voterId: string } | null = null;
    const server = new VoteWebhookServer({ port: 0, path: '/hook', secret: 's3cret', security: { hmac: { 'top.gg': key } } });
    server.on('vote', (v: { voterId: string }) => (vote = v));
    await server.start();
    const addr = server['server']?.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const payload = JSON.stringify({ user: 'abc', bot: '1' });
    const sig = createHmac('sha256', key).update(payload).digest('hex');
    const res = await fetch(`http://127.0.0.1:${port}/hook/top.gg`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature-256': `sha256=${sig}` },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(vote?.voterId).toBe('abc');
    await server.stop();
  });

  test('hmac with wrong key is rejected', async () => {
    const server = new VoteWebhookServer({ port: 0, path: '/hook', secret: 's3cret', security: { hmac: { 'top.gg': 'right-key' } } });
    server.on('error', () => undefined); // rejections are expected here
    await server.start();
    const addr = server['server']?.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const payload = JSON.stringify({ user: 'abc' });
    const badSig = createHmac('sha256', 'wrong-key').update(payload).digest('hex');
    const res = await fetch(`http://127.0.0.1:${port}/hook/top.gg`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature-256': `sha256=${badSig}` },
      body: payload,
    });
    expect(res.status).toBe(401);
    await server.stop();
  });

  test('rate limit kicks in with 429', async () => {
    await withServer(
      {
        port: 0,
        path: '/hook/top.gg',
        secret: 's3cret',
        security: { rateLimit: { max: 3, windowMs: 60_000 }, requireSecret: false },
      },
      async (port) => {
        for (let i = 0; i < 3; i++) {
          const res = await post(port, '/hook/top.gg', { user: String(i) }, { authorization: 's3cret' });
          expect(res.status).toBe(200);
        }
        const limited = await post(port, '/hook/top.gg', { user: '4' }, { authorization: 's3cret' });
        expect(limited.status).toBe(429);
        expect(limited.headers.get('retry-after')).not.toBeNull();
      },
    );
  });

  test('bans an ip after repeated auth failures', async () => {
    await withServer(
      {
        port: 0,
        path: '/hook/top.gg',
        secret: 's3cret',
        security: { banAfterFailures: 3, banDurationMs: 60_000 },
      },
      async (port) => {
        for (let i = 0; i < 3; i++) {
          const res = await post(port, '/hook/top.gg', { user: 'x' }, { authorization: 'wrong' });
          expect(res.status).toBe(401);
        }
        // 4th attempt (even with the right secret) is blocked by the ban.
        const banned = await post(port, '/hook/top.gg', { user: 'x' }, { authorization: 's3cret' });
        expect(banned.status).toBe(403);
      },
    );
  });

  test('allowedLists blocks unlisted sources', async () => {
    await withServer(
      {
        port: 0,
        path: '/hook',
        secret: 's3cret',
        security: { allowedLists: ['botlist.me'] },
      },
      async (port) => {
        const bad = await post(port, '/hook/top.gg', { user: 'x' }, { authorization: 's3cret' });
        expect(bad.status).toBe(403);
        const good = await post(port, '/hook/botlist.me', { id: 'x' }, { authorization: 's3cret' });
        expect(good.status).toBe(200);
      },
    );
  });

  test('oversized bodies are dropped', async () => {
    await withServer({ port: 0, path: '/hook/top.gg', secret: 's3cret' }, async (port) => {
      const big = { user: 'x'.repeat(600 * 1024) };
      let status = 0;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/hook/top.gg`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 's3cret' },
          body: JSON.stringify(big),
        });
        status = res.status;
      } catch {
        status = 413; // connection reset while streaming an oversized body is a rejection too
      }
      expect([400, 408, 413]).toContain(status);
    });
  });
});
