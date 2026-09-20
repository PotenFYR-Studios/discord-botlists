import { describe, expect, test } from 'bun:test';
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { VoteAnnouncer, isDiscordWebhookUrl } from '../src/announcer.js';
import { Botlists } from '../src/index.js';
import type { UniversalVote } from '../src/types.js';

/**
 * VoteAnnouncer suite. Every test exchanges REAL http requests against a
 * local receiver server (the same wire format Discord's execute-webhook
 * endpoint accepts) - no transport mocks.
 */

const VOTE: UniversalVote = {
  listId: 'top.gg',
  listName: 'top.gg',
  voterId: '264811613708746752',
  voterName: 'voterperson',
  voterAvatar: 'https://cdn.discordapp.com/avatars/2/a.png',
  botId: '1470079725106888817',
  isTest: false,
  weight: 1,
  query: {},
  weekend: false,
  raw: {},
  receivedAt: 1_758_000_000_000,
};

interface Received {
  body: Record<string, unknown>;
  respond: (req: IncomingMessage, res: ServerResponse) => void;
}

/** a real http receiver. handler controls each response (429, delay, 200). */
async function withReceiver(handler: (req: IncomingMessage, res: ServerResponse, calls: number) => void, fn: (url: string, received: Received[]) => Promise<void>) {
  const received: Received[] = [];
  let calls = 0;
  const server: Server = createServer((req, res) => {
    calls++;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const entry: Received = { body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'), respond: () => undefined };
      received.push(entry);
      handler(req, res, calls);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}/hook`, received);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const okHandler = (_req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end('{ "ok": true }');
};

describe('vote announcer rendering', () => {
  test('text format fills the {placeholder} template', () => {
    const announcer = new VoteAnnouncer({ format: 'text', template: '{voter} ({voterId}) voted on {list} for {bot} x{weight}' });
    const payload = announcer.render(VOTE);
    expect(payload.content).toBe('voterperson (264811613708746752) voted on top.gg for <@1470079725106888817> x1');
    expect(payload.embeds).toBeUndefined();
  });

  test('embed format produces a rich embed', () => {
    const announcer = new VoteAnnouncer({ format: 'embed', color: 0xff0000 });
    const payload = announcer.render(VOTE);
    const embed = payload.embeds?.[0] as Record<string, unknown>;
    expect(embed.color).toBe(0xff0000);
    expect(String(embed.title)).toContain('top.gg');
    expect(embed.timestamp).toBe(new Date(VOTE.receivedAt).toISOString());
  });

  test('embed-v2 format uses Components V2 flag + component types', () => {
    const announcer = new VoteAnnouncer({
      format: 'embed-v2',
      links: [{ label: 'Vote Again', url: 'https://top.gg/bot/1/vote', emoji: '🗳️' }],
    });
    const payload = announcer.render(VOTE);
    expect(payload.flags).toBe(32768);
    const types = (payload.components ?? []).map((c) => c.type);
    expect(types).toContain(17); // section
    expect(types).toContain(14); // separator
    expect(types).toContain(1); // action row
    const row = (payload.components ?? []).find((c) => c.type === 1) as { components: { label: string; style: number }[] };
    expect(row.components[0]!.label).toBe('Vote Again');
    expect(row.components[0]!.style).toBe(5);
  });

  test('customize hook can rewrite the payload', () => {
    const announcer = new VoteAnnouncer({ format: 'text', customize: (_vote, payload) => ({ ...payload, content: 'custom!' }) });
    expect(announcer.render(VOTE).content).toBe('custom!');
  });

  test('non-discord webhook urls are rejected at construction', () => {
    const announcer = new VoteAnnouncer({ webhooks: ['https://evil.example.com/api/webhooks/x'], external: ['http://insecure.example.com'] });
    expect(announcer.webhooks.length).toBe(0);
    expect(announcer.external.length).toBe(0);
  });

  test('isDiscordWebhookUrl accepts discord.com and canary, rejects others', () => {
    expect(isDiscordWebhookUrl('https://discord.com/api/webhooks/1/abc')).toBe(true);
    expect(isDiscordWebhookUrl('https://discordapp.com/api/webhooks/1/abc')).toBe(true);
    expect(isDiscordWebhookUrl('https://canary.discord.com/api/webhooks/1/abc')).toBe(true);
    expect(isDiscordWebhookUrl('https://evil.example.com/api/webhooks/1/abc')).toBe(false);
  });
});

describe('vote announcer delivery (real http)', () => {
  test('delivers the external JSON envelope to an external endpoint', async () => {
    await withReceiver(okHandler, async (url, received) => {
      const announcer = new VoteAnnouncer({ format: 'text', external: [url], minIntervalMs: 10 });
      await announcer.announce(VOTE);
      await Bun.sleep(100);
      expect(received.length).toBe(1);
      expect(received[0]!.body).toMatchObject({ source: 'discord-botlists', event: 'vote', list: { id: 'top.gg', name: 'top.gg' } });
      expect((received[0]!.body.vote as { voterId: string }).voterId).toBe('264811613708746752');
    });
  });

  test('delivers the rendered payload to a discord webhook target', async () => {
    await withReceiver(okHandler, async (url, received) => {
      const announcer = new VoteAnnouncer({ format: 'embed-v2', minIntervalMs: 10 });
      // bypass the discord.com regex by announcing through the internal path:
      (announcer as unknown as { webhooks: string[] }).webhooks.push(url);
      await announcer.announce(VOTE);
      await Bun.sleep(150);
      expect(received.length).toBe(1);
      expect(received[0]!.body.flags).toBe(32768);
      expect(Array.isArray(received[0]!.body.components)).toBe(true);
    });
  });

  test('test votes are skipped unless announceTestVotes is set', async () => {
    await withReceiver(okHandler, async (url, received) => {
      const announcer = new VoteAnnouncer({ format: 'text', external: [url], minIntervalMs: 10 });
      await announcer.announce({ ...VOTE, isTest: true });
      await Bun.sleep(80);
      expect(received.length).toBe(0);
      const announcer2 = new VoteAnnouncer({ format: 'text', external: [url], announceTestVotes: true, minIntervalMs: 10 });
      await announcer2.announce({ ...VOTE, isTest: true });
      await Bun.sleep(80);
      expect(received.length).toBe(1);
    });
  });

  test('429 with a small retry-after is waited out and the vote is delivered', async () => {
    await withReceiver((req, res, calls) => {
      if (calls === 1) {
        res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0.05' });
        res.end('{ "retry_after": 0.05 }');
      } else {
        okHandler(req, res);
      }
    }, async (url, received) => {
      const announcer = new VoteAnnouncer({ format: 'text', external: [url], minIntervalMs: 10 });
      await announcer.announce(VOTE);
      await Bun.sleep(400);
      expect(received.length).toBe(2); // 429 + retry
    });
  });

  test('queue is bounded: oldest vote is dropped when a target stalls', async () => {
    await withReceiver((_req, res, _calls) => {
      // stall the first response so the queue builds up behind it
      setTimeout(() => {
        res.writeHead(200);
        res.end('{}');
      }, 250);
    }, async (url) => {
      const announcer = new VoteAnnouncer({ format: 'text', external: [url], minIntervalMs: 30, maxQueueSize: 2 });
      const errors: string[] = [];
      announcer.on('error', (e: Error) => errors.push(e.message));
      announcer.announce({ ...VOTE, voterId: '1' });
      announcer.announce({ ...VOTE, voterId: '2' });
      announcer.announce({ ...VOTE, voterId: '3' });
      announcer.announce({ ...VOTE, voterId: '4' });
      await Bun.sleep(600);
      expect(errors.some((m) => m.includes('queue full'))).toBe(true);
      announcer.stop();
    });
  });
});

describe('announcer wiring in Botlists (default off)', () => {
  test('no announcer is wired by default', () => {
    const lists = new Botlists({ announcer: { webhooks: ['https://discord.com/api/webhooks/1/abc'] } });
    expect(lists.voteAnnouncer).toBeNull();
  });

  test('enabled announcer receives vote events through the pipeline', async () => {
    await withReceiver(okHandler, async (url, received) => {
      const lists = new Botlists({
        announcer: { enabled: true, format: 'text', external: [url], minIntervalMs: 10 },
      });
      expect(lists.voteAnnouncer).not.toBeNull();
      lists.emit('vote', VOTE);
      await Bun.sleep(120);
      expect(received.length).toBe(1);
    });
  });
});
