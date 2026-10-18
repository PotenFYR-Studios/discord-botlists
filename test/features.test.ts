import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Botlists, FileVoteStore, VoteLedger } from '../src/index.js';
import { VoteWebhookServer } from '../src/webhooks/server.js';
import type { UniversalVote } from '../src/types.js';

const vote = (over: Partial<UniversalVote> = {}): UniversalVote => ({
  listId: 'top.gg',
  listName: 'Top.gg',
  voterId: '111',
  voterName: null,
  voterAvatar: null,
  botId: '1',
  isTest: false,
  weight: 1,
  query: {},
  weekend: false,
  raw: {},
  receivedAt: Date.now(),
  ...over,
});

describe('VoteLedger', () => {
  test('records votes across lists and answers hasVoted anywhere', async () => {
    const ledger = new VoteLedger();
    await ledger.record(vote({ listId: 'top.gg' }));
    await ledger.record(vote({ listId: 'discordbotlist.com' }));
    expect(await ledger.hasVoted('111')).toBe(true);
    expect(await ledger.hasVoted('111', { listId: 'botlist.me' })).toBe(false);
    expect((await ledger.get('111'))?.total).toBe(2);
    expect(await ledger.hasVoted('999')).toBe(false);
  });

  test('ignores test votes unless asked, weekend weight 2 counts double', async () => {
    const ledger = new VoteLedger();
    expect(await ledger.record(vote({ isTest: true }))).toBeNull();
    await ledger.record(vote({ weight: 2 }));
    expect((await ledger.get('111'))?.total).toBe(2);
    const withTests = new VoteLedger({ includeTests: true });
    expect(await withTests.record(vote({ isTest: true }))).not.toBeNull();
  });

  test('claim() rewards once per vote, safe against retries', async () => {
    const ledger = new VoteLedger();
    await ledger.record(vote());
    expect(await ledger.claim('111')).toBe(true);
    expect(await ledger.claim('111')).toBe(false);
    await ledger.record(vote({ receivedAt: Date.now() + 1 }));
    expect(await ledger.claim('111')).toBe(true);
  });

  test('streak counts consecutive UTC days', async () => {
    const ledger = new VoteLedger();
    const now = Date.UTC(2026, 9, 18, 12);
    for (const d of [0, 1, 2, 4]) await ledger.record(vote({}), now - d * 86_400_000);
    expect(await ledger.streak('111', now)).toBe(3);
    expect(await ledger.streak('nobody', now)).toBe(0);
  });

  test('nextVoteAt and top()', async () => {
    const ledger = new VoteLedger({ cooldowns: { 'top.gg': 3_600_000 } });
    await ledger.record(vote());
    await ledger.record(vote({ voterId: '222' }));
    await ledger.record(vote({ voterId: '222' }));
    expect(await ledger.nextVoteAt('111', 'top.gg')).toBeGreaterThan(Date.now());
    expect(await ledger.nextVoteAt('111', 'botlist.me')).toBe(0);
    expect((await ledger.top(1))[0]).toEqual({ userId: '222', votes: 2 });
  });

  test('FileVoteStore persists and reloads', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'ledger-')), 'votes.json');
    const store = new FileVoteStore(path, 10_000);
    await new VoteLedger({ store }).record(vote());
    store.flush();
    expect(JSON.parse(readFileSync(path, 'utf8'))[0].userId).toBe('111');
    expect(await new VoteLedger({ store: new FileVoteStore(path) }).hasVoted('111')).toBe(true);
  });

  test('Botlists feeds the ledger from webhook votes', async () => {
    const client = new Botlists({ voteLedger: true, webhook: { autoStart: false, secret: { 'top.gg': 's' } } });
    client.webhook.ingest('top.gg', { user: '123456789', type: 'upvote' }, { headers: { authorization: 's' } });
    await new Promise((r) => setTimeout(r, 10));
    expect(await client.ledger!.hasVoted('123456789')).toBe(true);
  });
});

describe('handleRequest (Web-standard)', () => {
  const server = new VoteWebhookServer({ secret: { 'botlist.me': 'sek' } });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    server.handleRequest(new Request(`https://bot.example${path}`, { method: 'POST', body: JSON.stringify(body), headers }));

  test('accepts an authorized vote mounted on any path', async () => {
    let got: { voterId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const res = await post('/api/votes/botlist.me', { user: '42', type: 'Upvote' }, { authorization: 'sek' });
    expect(res.status).toBe(200);
    expect(got?.voterId).toBe('42');
  });

  test('rejects a wrong secret and non-POST', async () => {
    server.on('error', () => {});
    expect((await post('/api/votes/botlist.me', { user: '42' }, { authorization: 'nope' })).status).toBe(401);
    expect((await server.handleRequest(new Request('https://bot.example/x', { method: 'PUT' }))).status).toBe(405);
  });

  test('invalid json is a 400', async () => {
    const res = await server.handleRequest(
      new Request('https://bot.example/botlist.me', { method: 'POST', body: '{nope', headers: { authorization: 'sek' } }),
    );
    expect(res.status).toBe(400);
  });
});

describe('doctor()', () => {
  test('flags rejected tokens, missing bot id and env typos', async () => {
    const realFetch = globalThis.fetch;
    process.env['DBL_TOPGGG'] = 'typo';
    globalThis.fetch = (async () => new Response('no', { status: 401 })) as typeof fetch;
    try {
      const client = new Botlists({ botId: '1', tokens: { 'discord.bots.gg': 'bad' }, webhook: { autoStart: false } });
      const report = await client.doctor();
      expect(report.entries.find((e) => e.listId === 'discord.bots.gg')?.auth).toBe('bad-token');
      expect(report.entries.find((e) => e.listId === 'botlist.me')?.auth).toBe('no-token');
      expect(report.unrecognizedEnv).toContain('DBL_TOPGGG');
      expect(report.problems.some((p) => p.includes('discord.bots.gg'))).toBe(true);
      const noId = await new Botlists({ webhook: { autoStart: false } }).doctor();
      expect(noId.problems[0]).toContain('no bot id');
    } finally {
      globalThis.fetch = realFetch;
      delete process.env['DBL_TOPGGG'];
    }
  });
});

describe('typed events', () => {
  test('on("vote") receives a UniversalVote', () => {
    const client = new Botlists({ webhook: { autoStart: false } });
    let id: string | null = null;
    client.on('vote', (v) => {
      id = v.voterId;
    });
    client.emit('vote', vote());
    expect(id).toBe('111');
  });
});
