// Runs against the BUILT package (npm run build first): proves require() and
// import both load, on plain node, with every subpath.
const test = require('node:test');
const assert = require('node:assert');

test('CommonJS require works for every export path', () => {
  const root = require('../../dist/cjs/index.js');
  assert.equal(typeof root.Botlists, 'function');
  assert.equal(typeof root.expressHandler, 'function');
  assert.equal(typeof root.VoteLedger, 'function');
  assert.ok(require('../../dist/cjs/adapters/index.js').fetchHandler);
  assert.ok(require('../../dist/cjs/webhooks/server.js').VoteWebhookServer);
  assert.ok(require('../../dist/cjs/data/lists.generated.js').BOTLISTS.length >= 27);
});

test('ESM import works and exposes the same API', async () => {
  const esm = await import('../../dist/index.js');
  assert.equal(typeof esm.Botlists, 'function');
  assert.equal(typeof esm.lambdaHandler, 'function');
});

test('a CJS-loaded client handles a vote without starting any server', async () => {
  const { Botlists } = require('../../dist/cjs/index.js');
  const lists = new Botlists({ webhook: { secret: { 'botlist.me': 's' } }, voteLedger: true });
  const votes = [];
  lists.on('vote', (v) => votes.push(v.voterId));
  const res = await lists.webhook.handleRequest(
    new Request('https://x.test/votes/botlist.me', { method: 'POST', headers: { authorization: 's' }, body: JSON.stringify({ user: '77', type: 'Upvote' }) }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(votes, ['77']);
  assert.equal(lists.webhook.isRunning, false);
});
