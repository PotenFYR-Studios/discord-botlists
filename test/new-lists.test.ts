import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { Botlists } from '../src/index.js';
import { StatusChecker } from '../src/status/checker.js';
import { resolveList } from '../src/core/http.js';
import { VoteWebhookServer } from '../src/webhooks/server.js';

// TheDiscordList - thediscordlist.com/docs/api (OpenAPI): Bearer auth,
// POST /api/bots/{bot}/stats, signed webhooks "t={unix},v1={hex}".
const TDL_VOTE = {
  id: '5b1f0a2e-1f4d-4a51-9f26-2f9a9c0e1b77',
  event: 'listing.upvoted',
  created_at: '2026-10-18T12:00:00Z',
  listing: { id: '557628352828014614', type: 'bot', name: 'Example', url: 'https://thediscordlist.com/bots/557628352828014614' },
  data: { voted_at: '2026-10-18T12:00:00Z', total_upvotes: 42, user: { id: '299930111471640579', username: 'voter', avatar: null } },
};

describe('TheDiscordList', () => {
  test('is registered with Bearer auth', () => {
    const list = resolveList('thediscordlist.com')!;
    expect(list.authScheme).toBe('Bearer');
    expect(list.apiPost).toBe('https://thediscordlist.com/api/bots/:id/stats');
  });

  test('posts stats with an Authorization: Bearer header', async () => {
    const realFetch = globalThis.fetch;
    const seen: { url: string; auth: string | null }[] = [];
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      seen.push({ url: String(url), auth: new Headers(init?.headers).get('authorization') });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
      const client = new Botlists({ botId: '557628352828014614', tokens: { 'thediscordlist.com': 'tok' }, webhook: { autoStart: false } });
      await client.postStats({ serverCount: 5 });
    } finally {
      globalThis.fetch = realFetch;
    }
    const hit = seen.find((s) => s.url.startsWith('https://thediscordlist.com/'));
    expect(hit?.auth).toBe('Bearer tok');
  });

  test('verifies X-TDL-Signature and parses the vote', () => {
    const server = new VoteWebhookServer({
      secret: { 'thediscordlist.com': 's' },
      security: { hmac: { 'thediscordlist.com': 's' } },
    });
    let got: { voterId?: string | null; botId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const raw = JSON.stringify(TDL_VOTE);
    const t = '1760788800';
    const v1 = createHmac('sha256', 's').update(`${t}.${raw}`).digest('hex');
    const parsed = server.ingest('thediscordlist.com', TDL_VOTE, { headers: { 'x-tdl-signature': `t=${t},v1=${v1}` } });
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('299930111471640579');
    expect(got?.botId).toBe('557628352828014614');
  });

  test('non-vote events are ignored, not reported as votes', () => {
    const server = new VoteWebhookServer({ secret: { 'thediscordlist.com': 's' } });
    let votes = 0;
    server.on('vote', () => votes++);
    const bumped = server.ingest('thediscordlist.com', { ...TDL_VOTE, event: 'listing.bumped' }, { headers: { authorization: 's' } });
    const stats = server.ingest('thediscordlist.com', { ...TDL_VOTE, event: 'bot.stats_reported' }, { headers: { authorization: 's' } });
    expect(bumped).toBeNull();
    expect(stats).toBeNull();
    expect(votes).toBe(0);
  });
});

describe('registry corrections', () => {
  test('discordforge uses the v1 stats route (legacy returns 410)', () => {
    const list = resolveList('discordforge.org')!;
    expect(list.apiPost).toBe('https://discordforge.org/api/v1/bots/stats');
    expect(list.authScheme).toBe('Bearer');
  });
  test('discords.com posts to setservers on the current host', () => {
    expect(resolveList('discords.com')!.apiPost).toBe('https://discords.com/bots/api/bot/:id/setservers');
  });
  test('vcodes calls www directly (apex redirect drops the auth header)', () => {
    expect(resolveList('vcodes.xyz')!.apiPost?.startsWith('https://www.vcodes.xyz/')).toBe(true);
  });
});

describe('status detection tolerates slow lists', () => {
  const list = resolveList('botlist.me')!;
  const withFetch = async (impl: typeof fetch, run: () => Promise<void>) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = impl;
    try {
      await run();
    } finally {
      globalThis.fetch = realFetch;
    }
  };

  test('timeouts are unknown, never shutdown', async () => {
    await withFetch((async () => {
      throw Object.assign(new Error('timeout'), { name: 'AbortError' });
    }) as typeof fetch, async () => {
      const entry = await new StatusChecker({ timeout: 5 }).checkOne(list);
      expect(entry.state).toBe('unknown');
    });
  });

  test('a slow first attempt followed by an answer is live', async () => {
    let calls = 0;
    await withFetch((async () => {
      if (++calls < 3) throw Object.assign(new Error('timeout'), { name: 'AbortError' });
      return new Response('', { status: 200 });
    }) as typeof fetch, async () => {
      expect((await new StatusChecker({ timeout: 5 }).checkOne(list)).state).toBe('live');
    });
  });

  test('DNS failure on every attempt is shutdown', async () => {
    await withFetch((async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }) as typeof fetch, async () => {
      expect((await new StatusChecker({ timeout: 5 }).checkOne(list)).state).toBe('shutdown');
    });
  });

  test('403/429 bot walls count as live', async () => {
    await withFetch((async () => new Response('', { status: 403 })) as typeof fetch, async () => {
      expect((await new StatusChecker({ timeout: 5 }).checkOne(list)).state).toBe('live');
    });
  });
});

describe('restored lists', () => {
  test('lists wrongly killed by the old timeout probe are live again', () => {
    for (const id of ['discordextremelist.xyz', 'disforge.com', 'disq.ink', 'omniplex.gg', 'radarcord.net']) {
      expect(resolveList(id)!.status).toBeUndefined();
    }
    expect(resolveList('bots.discordlabs.org')!.status).toBe('deprecated');
  });
});

describe('circuit breaker', () => {
  const mk = (extra = {}) =>
    new Botlists({
      botId: '1',
      tokens: { 'botlist.me': 't', 'top.gg': 't' },
      postSpacingMs: 100,
      webhook: { autoStart: false },
      circuitBreaker: { threshold: 2, baseMs: 60_000 },
      ...extra,
    });

  test('opens after repeated systemic failures and skips the list', async () => {
    const realFetch = globalThis.fetch;
    let botlistCalls = 0;
    globalThis.fetch = (async (url: string | URL) => {
      if (String(url).includes('botlist.me')) {
        botlistCalls++;
        return new Response('boom', { status: 502 });
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      const client = mk();
      for (let i = 0; i < 2; i++) await client.postStats({ serverCount: 3 }, { only: ['botlist.me'] });
      const before = botlistCalls;
      const report = await client.postStats({ serverCount: 3 });
      expect(botlistCalls).toBe(before);
      const skipped = report.results.find((r) => r.listId === 'botlist.me');
      expect(skipped?.error).toContain('circuit open');
      expect(report.skipped).toBeGreaterThanOrEqual(1);
      expect(client.health.find((h) => h.listId === 'botlist.me')?.state).toBe('open');
      client.resetHealth('botlist.me');
      expect(client.health.length).toBe(0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test('auth errors (401/403/429) never trip the breaker', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('no', { status: 401 })) as typeof fetch;
    try {
      const client = mk();
      for (let i = 0; i < 4; i++) await client.postStatsTo('botlist.me', { serverCount: 1 });
      expect(client.health.length).toBe(0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('webhook delivery dedupe', () => {
  const TDL = {
    id: 'delivery-1',
    event: 'listing.upvoted',
    created_at: '2026-10-18T12:00:00Z',
    listing: { id: '1', type: 'bot', name: 'x', url: 'https://x' },
    data: { user: { id: '299930111471640579' } },
  };
  test('a retried delivery emits once', () => {
    const server = new VoteWebhookServer({ secret: { 'thediscordlist.com': 's' } });
    let votes = 0;
    server.on('vote', () => votes++);
    const headers = { authorization: 's' };
    expect(server.ingest('thediscordlist.com', TDL, { headers })?.event).toBe('vote');
    expect(server.ingest('thediscordlist.com', TDL, { headers })).toBeNull();
    expect(votes).toBe(1);
  });
  test('discordbotlist.com ids (the voter) are never deduped', () => {
    const server = new VoteWebhookServer({ secret: { 'discordbotlist.com': 's' } });
    let votes = 0;
    server.on('vote', () => votes++);
    const headers = { authorization: 's' };
    server.ingest('discordbotlist.com', { id: '123', username: 'a' }, { headers });
    server.ingest('discordbotlist.com', { id: '123', username: 'a' }, { headers });
    expect(votes).toBe(2);
  });
  test('dedupeTtlMs: 0 disables it', () => {
    const server = new VoteWebhookServer({ secret: { 'thediscordlist.com': 's' }, dedupeTtlMs: 0 });
    let votes = 0;
    server.on('vote', () => votes++);
    server.ingest('thediscordlist.com', TDL, { headers: { authorization: 's' } });
    server.ingest('thediscordlist.com', TDL, { headers: { authorization: 's' } });
    expect(votes).toBe(2);
  });
});
