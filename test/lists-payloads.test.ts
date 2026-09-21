import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { VoteWebhookServer } from '../src/webhooks/server.js';

/**
 * Real vote webhook payloads for the lists whose docs were audited for 1.0.3
 * (official docs, September 2026). Each fixture is the exact body the list
 * POSTs; assertions pin the normalized UniversalVote fields.
 */

// DisQ - docs.disq.ink/webhooks/overview (custom webhook JSON).
const DISQ_VOTE = {
  type: 'vote',
  bot: { id: '1130656856990289961', name: 'Example Bot' },
  user: { id: '123456789012345678', username: 'voter_name' },
  timestamp: '2026-05-11T22:08:00.000Z',
};
const DISQ_REVIEW = {
  type: 'review',
  bot: { id: '1130656856990289961', name: 'Example Bot' },
  user: { id: '123456789012345678', username: 'voter_name' },
  timestamp: '2026-05-11T22:08:00.000Z',
  review: { rating: 5, content: 'Great bot!' },
};

// Bots for Discord / discords.com - docs.botsfordiscord.com/methods/receiving-votes.
const BFD_VOTE = {
  user: '299930111471640579',
  bot: '1130656856990289961',
  votes: { totalVotes: 12, votesMonth: 3, votes24: 1, hasVoted: [], Voted24: [] },
  type: 'vote',
};

// DList.Space - dlist.space/docs#webhooks (page payload) + official npm SDK
// (test flag from the dashboard's Test Webhook button).
const DLIST_VOTE = { user_id: '123456789012345678', username: 'CoolUser', avatar: 'https://cdn.discordapp.com/avatars/123/a.png', weekend: true };
const DLIST_TEST = { user_id: '123456789012345678', username: 'CoolUser', avatar: 'https://cdn.discordapp.com/avatars/123/a.png', weekend: false, test: true };

// botlist.me - docs.botlist.me/Webhooks/Vote_Webhooks. Their docs example
// shows ids unquoted, but snowflakes exceed Number.MAX_SAFE_INTEGER - real
// deliveries (per DiscordAnalytics' openapi model) use strings. The user id
// here is a SAFE number on purpose: it pins the number->string coercion path.
const BOTLISTME_VOTE = { bot: '589901741672103958', user: 123456789012345, type: 'Upvote' };
const BOTLISTME_TEST = { bot: '589901741672103958', user: 123456789012345, type: 'Test' };

// Discord Bot List - docs.discordbotlist.com/vote-webhooks.md (field table).
const DBLCOM_VOTE = { admin: false, avatar: 'a_hash', username: 'voter', id: '555666777888999000' };

// DiscordList.gg - body is an HS256 JWT signed with the webhook secret;
// claims {user_id, bot_id, is_test} (archived official OpenAPI + dlist.js).
const DLISTGG_CLAIMS = { user_id: '857230367350063104', bot_id: '821472922140803112', is_test: false };
const DLISTGG_TEST_CLAIMS = { user_id: '857230367350063104', bot_id: '821472922140803112', is_test: true };

// Radarcord - docs.radarcord.net/api/bots (Vote Notification).
const RADAR_VOTE = { user: '299930111471640579', type: 'vote', bot: '1130656856990289961' };

// Void Bots - docs.voidbots.net/docs/webhooks.md (type "vote" | "test").
const VOIDBOTS_VOTE = { bot: '1130656856990289961', user: '299930111471640579', type: 'vote' };
const VOIDBOTS_TEST = { bot: '1130656856990289961', user: '299930111471640579', type: 'test' };

// vCodes - HTTP webhook undocumented; their official example bot consumes
// nested user/bot objects, flattenNested covers the shape.
const VCODES_VOTE = {
  user: { id: '299930111471640579', tag: 'voter#0001', username: 'voter' },
  bot: { id: '1130656856990289961', username: 'Example Bot' },
  avatar: 'https://cdn.discordapp.com/avatars/299/a.png',
  votes: { daily: 1, weekly: 2, monthly: 3, total: 10 },
};

// TopBot - topbot.gg/en/developers/api: {event, flagged, user}, signed with
// x-topbot-signature (hex hmac of "<x-topbot-timestamp>.<raw body>").
const TOPBOT_VOTE = { event: 'vote', flagged: false, user: '299930111471640579' };

// DiscordForge - discordforge.org webhooks v2 envelope + legacy shape.
const FORGE_V2_VOTE = {
  id: 'df_delivery_1',
  type: 'vote.created',
  created_at: '2026-09-21T00:00:00.000Z',
  bot_id: '1130656856990289961',
  data: { voter_id: '299930111471640579', streak: 3, total_votes: 42, weekly_votes: 7 },
};
const FORGE_LEGACY_VOTE = { id: '299930111471640579', username: 'voter', weeklyVotes: 7, totalVotes: 42, isTest: false };

/** Sign an HS256 JWT the way discordlist.gg does (b64url header.payload.hmac). */
function signJwt(claims: Record<string, unknown>, secret: string): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64(claims);
  const s = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

describe('DisQ nested-object payloads', () => {
  test('vote: voter/bot arrive as objects, flatten to ids', () => {
    const server = new VoteWebhookServer({ secret: { 'disq.ink': 'disq-token' } });
    let got: { voterId?: string | null; voterName?: string | null; botId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('disq.ink', DISQ_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('123456789012345678'); // user.id, not a null `user` object
    expect(got?.voterName).toBe('voter_name');
    expect(got?.botId).toBe('1130656856990289961'); // bot.id
  });

  test('review: nested review object flattens to rating + content', () => {
    const server = new VoteWebhookServer({ secret: { 'disq.ink': 'disq-token' } });
    let got: { userId?: string | null; rating?: number | null; content?: string | null } | null = null;
    server.on('review', (v: typeof got) => (got = v));
    const parsed = server.ingest('disq.ink', DISQ_REVIEW);
    expect(parsed?.event).toBe('review');
    expect(got?.userId).toBe('123456789012345678');
    expect(got?.rating).toBe(5);
    expect(got?.content).toBe('Great bot!');
  });

  test('x-disq-signature (t=,v1= hmac) verifies like top.gg v1', () => {
    const server = new VoteWebhookServer({ secret: { 'disq.ink': 'disq-token' }, security: { hmac: { 'disq.ink': 'disq-token' } } });
    let ok: string | null = null;
    server.on('vote', (v: { voterId: string | null }) => (ok = v.voterId));
    const raw = JSON.stringify(DISQ_VOTE);
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', 'disq-token').update(`${t}.${raw}`).digest('hex');
    const parsed = server.ingest('disq.ink', DISQ_VOTE, { headers: { 'x-disq-signature': `t=${t},v1=${v1}` } });
    expect(parsed?.event).toBe('vote');
    expect(ok).toBe('123456789012345678');
  });

  test('tampered x-disq-signature body is rejected', () => {
    const server = new VoteWebhookServer({ secret: { 'disq.ink': 'disq-token' }, security: { hmac: { 'disq.ink': 'disq-token' } } });
    server.on('error', () => undefined); // rejection is expected
    const votes: unknown[] = [];
    server.on('vote', (v: unknown) => votes.push(v));
    const raw = JSON.stringify(DISQ_VOTE);
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', 'disq-token').update(`${t}.${raw}`).digest('hex');
    const tampered = raw.replace('123456789012345678', '111111111111111111');
    const parsed = server.ingest('disq.ink', JSON.parse(tampered), { headers: { 'x-disq-signature': `t=${t},v1=${v1}` } });
    expect(parsed).toBeNull();
    expect(votes.length).toBe(0);
  });
});

describe('Bots for Discord (discords.com) flat payload', () => {
  test('vote parses: user/bot/type flat fields', () => {
    const server = new VoteWebhookServer({ secret: { 'discords.com': 'bfd-secret' } });
    let got: { voterId?: string | null; botId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('discords.com', BFD_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('299930111471640579');
    expect(got?.botId).toBe('1130656856990289961');
  });
});

describe('DList.Space payload', () => {
  test('vote parses with weekend multiplier flag', () => {
    const server = new VoteWebhookServer({ secret: { 'dlist.space': 'dlist-secret' } });
    let got: { voterId?: string | null; voterName?: string | null; weekend?: boolean } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('dlist.space', DLIST_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('123456789012345678');
    expect(got?.voterName).toBe('CoolUser');
    expect(got?.weekend).toBe(true);
  });

  test('dashboard test delivery (test: true) routes to the test event', () => {
    const server = new VoteWebhookServer({ secret: { 'dlist.space': 'dlist-secret' } });
    let got: { voterId?: string | null; isTest?: boolean } | null = null;
    server.on('test', (v: typeof got) => (got = v));
    const parsed = server.ingest('dlist.space', DLIST_TEST);
    expect(parsed?.event).toBe('test');
    expect(got?.voterId).toBe('123456789012345678');
    expect(got?.isTest).toBe(true);
  });
});

describe('botlist.me payload (type Upvote/Test)', () => {
  test('numeric ids parse; "Upvote" is a vote', () => {
    const server = new VoteWebhookServer({ secret: { 'botlist.me': 'me-secret' } });
    let got: { voterId?: string | null; botId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('botlist.me', BOTLISTME_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('123456789012345'); // number coerced to string
    expect(got?.botId).toBe('589901741672103958');
  });

  test('type "Test" routes to the test event', () => {
    const server = new VoteWebhookServer({ secret: { 'botlist.me': 'me-secret' } });
    let got: { voterId?: string | null; isTest?: boolean } | null = null;
    server.on('test', (v: typeof got) => (got = v));
    const parsed = server.ingest('botlist.me', BOTLISTME_TEST);
    expect(parsed?.event).toBe('test');
    expect(got?.voterId).toBe('123456789012345');
    expect(got?.isTest).toBe(true);
  });
});

describe('discordbotlist.com payload (id/username/avatar)', () => {
  test('vote parses: voter in id, name in username, avatar in avatar', () => {
    const server = new VoteWebhookServer({ secret: { 'discordbotlist.com': 'dbl-secret' } });
    let got: { voterId?: string | null; voterName?: string | null; voterAvatar?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('discordbotlist.com', DBLCOM_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('555666777888999000');
    expect(got?.voterName).toBe('voter');
    expect(got?.voterAvatar).toBe('a_hash');
  });
});

describe('discordlist.gg JWT body', () => {
  test('ingest() verifies the HS256 JWT and parses its claims', () => {
    const server = new VoteWebhookServer({ secret: { 'discordlist.gg': 'dlistgg-secret' } });
    let got: { voterId?: string | null; botId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('discordlist.gg', signJwt(DLISTGG_CLAIMS, 'dlistgg-secret'));
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('857230367350063104');
    expect(got?.botId).toBe('821472922140803112');
  });

  test('is_test claim routes to the test event', () => {
    const server = new VoteWebhookServer({ secret: { 'discordlist.gg': 'dlistgg-secret' } });
    let got: { voterId?: string | null; isTest?: boolean } | null = null;
    server.on('test', (v: typeof got) => (got = v));
    const parsed = server.ingest('discordlist.gg', signJwt(DLISTGG_TEST_CLAIMS, 'dlistgg-secret'));
    expect(parsed?.event).toBe('test');
    expect(got?.voterId).toBe('857230367350063104');
    expect(got?.isTest).toBe(true);
  });

  test('JWT signed with the wrong secret is rejected', () => {
    const server = new VoteWebhookServer({ secret: { 'discordlist.gg': 'dlistgg-secret' } });
    server.on('error', () => undefined); // rejection is expected
    const votes: unknown[] = [];
    server.on('vote', (v: unknown) => votes.push(v));
    const parsed = server.ingest('discordlist.gg', signJwt(DLISTGG_CLAIMS, 'wrong-secret'));
    expect(parsed).toBeNull();
    expect(votes.length).toBe(0);
  });

  test('http server accepts a raw JWT body without an Authorization header', async () => {
    let voterId: string | null = null;
    const server = new VoteWebhookServer({ port: 0, path: '/hook', secret: { 'discordlist.gg': 'dlistgg-secret' } });
    await server.start();
    const addr = server['server']?.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    try {
      server.on('vote', (v: { voterId: string | null }) => (voterId = v.voterId));
      const res = await fetch(`http://127.0.0.1:${port}/hook/discordlist.gg`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: signJwt(DLISTGG_CLAIMS, 'dlistgg-secret'),
      });
      expect(res.status).toBe(200);
    } finally {
      await server.stop();
    }
    expect(voterId).toBe('857230367350063104');
  });
});

describe('radarcord.net / voidbots.net / vcodes.xyz payloads', () => {
  test('radarcord flat {user, type, bot} parses', () => {
    const server = new VoteWebhookServer({ secret: { 'radarcord.net': 'radar-secret' } });
    let got: { voterId?: string | null; botId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('radarcord.net', RADAR_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('299930111471640579');
    expect(got?.botId).toBe('1130656856990289961');
  });

  test('voidbots vote parses; type "test" is the test event', () => {
    const server = new VoteWebhookServer({ secret: { 'voidbots.net': 'void-secret' } });
    let vote: { voterId?: string | null } | null = null;
    let test: { voterId?: string | null; isTest?: boolean } | null = null;
    server.on('vote', (v: typeof vote) => (vote = v));
    server.on('test', (v: typeof test) => (test = v));
    expect(server.ingest('voidbots.net', VOIDBOTS_VOTE)?.event).toBe('vote');
    expect(vote?.voterId).toBe('299930111471640579');
    expect(server.ingest('voidbots.net', VOIDBOTS_TEST)?.event).toBe('test');
    expect(test?.voterId).toBe('299930111471640579');
    expect(test?.isTest).toBe(true);
  });

  test('vcodes nested user/bot objects flatten', () => {
    const server = new VoteWebhookServer({ secret: { 'vcodes.xyz': 'vc-secret' } });
    let got: { voterId?: string | null; voterName?: string | null; voterAvatar?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('vcodes.xyz', VCODES_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('299930111471640579');
    expect(got?.voterName).toBe('voter');
    expect(got?.voterAvatar).toBe('https://cdn.discordapp.com/avatars/299/a.png');
  });
});

describe('TopBot (topbot.gg) payload', () => {
  test('vote parses via the event field', () => {
    const server = new VoteWebhookServer({ secret: { 'topbot.gg': 'tb-secret' } });
    let got: { voterId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('topbot.gg', TOPBOT_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('299930111471640579');
  });

  test('x-topbot-signature + x-topbot-timestamp verify (hmac over "<ts>.<body>")', () => {
    const server = new VoteWebhookServer({
      secret: { 'topbot.gg': 'tb-secret' },
      security: { hmac: { 'topbot.gg': 'tb-secret' } },
    });
    let got: { voterId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const raw = JSON.stringify(TOPBOT_VOTE);
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', 'tb-secret').update(`${ts}.${raw}`).digest('hex');
    const parsed = server.ingest('topbot.gg', TOPBOT_VOTE, {
      headers: { 'x-topbot-signature': sig, 'x-topbot-timestamp': ts },
    });
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('299930111471640579');
  });
});

describe('DiscordForge (discordforge.org) payloads', () => {
  test('webhooks v2 envelope: envelope bot_id + data voter_id both survive', () => {
    const server = new VoteWebhookServer({ secret: { 'discordforge.org': 'forge-secret' } });
    let got: { voterId?: string | null; botId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('discordforge.org', FORGE_V2_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('299930111471640579'); // data.voter_id
    expect(got?.botId).toBe('1130656856990289961'); // envelope bot_id
  });

  test('v2 test delivery (data.test) routes to the test event', () => {
    const server = new VoteWebhookServer({ secret: { 'discordforge.org': 'forge-secret' } });
    let got: { voterId?: string | null; isTest?: boolean } | null = null;
    server.on('test', (v: typeof got) => (got = v));
    const parsed = server.ingest('discordforge.org', { ...FORGE_V2_VOTE, data: { ...FORGE_V2_VOTE.data, test: true } });
    expect(parsed?.event).toBe('test');
    expect(got?.voterId).toBe('299930111471640579');
    expect(got?.isTest).toBe(true);
  });

  test('legacy {id, username, isTest} shape parses', () => {
    const server = new VoteWebhookServer({ secret: { 'discordforge.org': 'forge-secret' } });
    let got: { voterId?: string | null; voterName?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const parsed = server.ingest('discordforge.org', FORGE_LEGACY_VOTE);
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('299930111471640579');
    expect(got?.voterName).toBe('voter');
  });

  test('X-Forge-Signature: sha256=<hex hmac of raw body> verifies', () => {
    const server = new VoteWebhookServer({
      secret: { 'discordforge.org': 'forge-secret' },
      security: { hmac: { 'discordforge.org': 'forge-secret' } },
    });
    let got: { voterId?: string | null } | null = null;
    server.on('vote', (v: typeof got) => (got = v));
    const raw = JSON.stringify(FORGE_V2_VOTE);
    const sig = createHmac('sha256', 'forge-secret').update(raw).digest('hex');
    const parsed = server.ingest('discordforge.org', FORGE_V2_VOTE, {
      headers: { 'x-forge-signature': `sha256=${sig}` },
    });
    expect(parsed?.event).toBe('vote');
    expect(got?.voterId).toBe('299930111471640579');
  });
});
