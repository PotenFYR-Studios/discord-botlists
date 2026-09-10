import { describe, expect, test } from 'bun:test';
import { Botlists } from '../src/index.js';
import { UniversalParser } from '../src/core/parser.js';
import { buildPostBody, resolveList } from '../src/core/http.js';
import { BOTLISTS } from '../src/data/lists.generated.js';

describe('botlist registry', () => {
  test('ships a verified live registry', () => {
    // 33 lists verified alive during the v2 audit. The registry is auto
    // pruned by scripts/status-sync.ts, so this is a floor, not a target.
    expect(BOTLISTS.length).toBeGreaterThanOrEqual(30);
  });

  test('every record has the required fields', () => {
    for (const list of BOTLISTS) {
      expect(list.id.length).toBeGreaterThan(0);
      expect(list.name.length).toBeGreaterThan(0);
      expect(list.tokenEnvKey.startsWith('DBL_')).toBe(true);
      expect(typeof list.supports.post).toBe('boolean');
    }
  });

  test('ids are unique', () => {
    const ids = new Set(BOTLISTS.map((l) => l.id));
    expect(ids.size).toBe(BOTLISTS.length);
  });

  test('famous lists resolve by id, name and hostname', () => {
    for (const query of ['top.gg', 'topgg', 'discordbotlist.com', 'botlist.me', 'Discord Bots', 'discord.bots.gg', 'voidbots', 'vcodes']) {
      expect(resolveList(query)).not.toBeNull();
    }
  });

  test('unknown list resolves to null', () => {
    expect(resolveList('this-list-does-not-exist-123')).toBeNull();
  });
});

describe('universal parser', () => {
  const parser = new UniversalParser();
  const topgg = resolveList('top.gg')!;

  test('parses a top.gg v0 bot payload', () => {
    const bot = parser.parseBot(topgg, {
      id: '123',
      username: 'Rythm',
      discriminator: '0',
      avatar: '/abc.png',
      server_count: 1000,
      points: 500,
      monthly_points: 100,
      owners: ['42'],
      website: 'https://rythm.fm',
      support: 'https://discord.gg/rythm',
      prefix: '!',
    });
    expect(bot.id).toBe('123');
    expect(bot.name).toBe('Rythm');
    expect(bot.serverCount).toBe(1000);
    expect(bot.votes).toBe(500);
    expect(bot.monthlyVotes).toBe(100);
    expect(bot.owners).toEqual(['42']);
    expect(bot.prefix).toBe('!');
  });

  test('parses discordbotlist.com shape with nested stats', () => {
    const dbl = resolveList('discordbotlist.com')!;
    const bot = parser.parseBot(dbl, {
      id: 777,
      username: 'TestBot',
      avatar: 'hash',
      guilds: 250,
      votes: 12,
      owners: [{ id: 42, username: 'owner' }],
    });
    expect(bot.serverCount).toBe(250);
    expect(bot.votes).toBe(12);
    expect(bot.owners).toEqual(['42']);
  });

  test('parses arrays of bots', () => {
    const bots = parser.parseBots(topgg, [{ username: 'a' }, { username: 'b' }]);
    expect(bots.length).toBe(2);
  });

  test('never throws on garbage', () => {
    const bot = parser.parseBot(topgg, null);
    expect(bot.listId).toBe('top.gg');
    expect(bot.votes).toBeNull();
  });
});

describe('post body builder', () => {
  test('uses each list wire field names', () => {
    const topgg = resolveList('top.gg')!;
    const dbb = resolveList('discord.bots.gg')!;
    const dbl = resolveList('discordbotlist.com')!;
    const stats = { serverCount: 42, shardCount: 2, shardId: 0, shards: [21, 21] };

    const topggBody = buildPostBody(topgg, stats);
    expect(topggBody['server_count']).toBe(42);
    expect(topggBody['shards']).toEqual([21, 21]);

    expect(buildPostBody(dbb, stats)['guildCount']).toBe(42);
    expect(buildPostBody(dbl, stats)['guilds']).toBe(42);
    expect(buildPostBody(dbl, stats)['shard_id']).toBe(0);
  });
});

describe('webhook ingestion', () => {
  test('emits normalized vote events with zero delay', async () => {
    const client = new Botlists({ webhook: { secret: 'test-secret' } });
    const received: unknown[] = [];
    client.on('vote', (vote: unknown) => received.push(vote));

    client.ingestWebhook('top.gg', { user: 'voter-1', bot: '123', type: 'vote' });

    expect(received.length).toBe(1);
    const vote = received[0] as { listId: string; voterId: string };
    expect(vote.listId).toBe('top.gg');
    expect(vote.voterId).toBe('voter-1');
    client.stopWebhooks();
  });

  test('parses discordbotlist.com vote shape', async () => {
    const client = new Botlists({ webhook: { secret: 'test-secret' } });
    let voter = '';
    client.on('vote', (vote: { voterId: string }) => {
      voter = vote.voterId;
    });
    client.ingestWebhook('discordbotlist.com', { id: 'u-9', username: 'sam' });
    expect(voter).toBe('u-9');
    client.stopWebhooks();
  });

  test('test webhook payloads emit the test event', () => {
    const client = new Botlists({ webhook: { secret: 'test-secret' } });
    let sawTest = false;
    client.on('test', () => {
      sawTest = true;
    });
    client.ingestWebhook('top.gg', { type: 'webhook.test', data: {} });
    expect(sawTest).toBe(true);
    client.stopWebhooks();
  });
});

describe('http server end to end', () => {
  test('accepts a posted vote over real http', async () => {
    const client = new Botlists({ webhook: { port: 0, autoStart: false, secret: 'test-secret' } });
    // port 0 lets the OS pick a free port; read it back from the server.
    const received: unknown[] = [];
    client.on('vote', (v: unknown) => received.push(v));

    const { VoteWebhookServer } = await import('../src/webhooks/server.js');
    const server = new VoteWebhookServer({ port: 0, path: '/hook/top.gg', secret: 'test-secret' });
    server.on('vote', (v: unknown) => received.push(v));
    await server.start();
    const addr = server['server']?.address();
    const port = typeof addr === 'object' && addr ? addr.port : 8080;

    const response = await fetch(`http://127.0.0.1:${port}/hook/top.gg`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'test-secret' },
      body: JSON.stringify({ user: '42', bot: '99' }),
    });
    expect(response.status).toBe(200);
    expect(received.length).toBe(1);
    await server.stop();
    client.stopWebhooks();
  });
});

describe('framework support', () => {
  test('discord.js style collection', async () => {
    const client = new Botlists({
      client: { user: { id: '1' }, guilds: { size: 42 } },
    });
    const stats = await client['resolveStats']();
    expect(stats.serverCount).toBe(42);
  });

  test('oceanic/eris style Map', async () => {
    const guilds = new Map();
    guilds.set('a', 1);
    guilds.set('b', 2);
    guilds.set('c', 3);
    const client = new Botlists({ client: { user: { id: '1' }, guilds } });
    const stats = await client['resolveStats']();
    expect(stats.serverCount).toBe(3);
  });

  test('no framework at all: explicit stats still post', async () => {
    const client = new Botlists();
    const stats = await client['resolveStats']({ serverCount: 7 });
    expect(stats.serverCount).toBe(7);
  });

  test('statsProvider works for any framework or none', async () => {
    const client = new Botlists({
      statsProvider: () => ({ serverCount: 123, shardCount: 4 }),
    });
    const stats = await client['resolveStats']();
    expect(stats.serverCount).toBe(123);
    expect(stats.shardCount).toBe(4);
  });
});
