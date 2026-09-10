import { Link } from 'react-router-dom';

const FEATURES = [
  {
    icon: '📮',
    title: 'Stats posting',
    body: 'One call posts your server and shard counts to every list you have a token for. Each list gets its exact wire format: server_count, guildCount, guilds, servers or count. Retries honour Retry-After.',
  },
  {
    icon: '⚡',
    title: 'Realtime vote webhooks',
    body: 'A built-in zero-dependency HTTP server receives votes, comments, reviews and ratings from every list and re-emits them as typed events on one emitter. No polling, no delay.',
  },
  {
    icon: '🔀',
    title: 'Universal parser',
    body: 'fetchBot() returns the same UniversalBot shape no matter which list answered: votes, owners, description, ratings, invite, everything normalized, raw payload always kept.',
  },
  {
    icon: '🩺',
    title: 'Status tracking',
    body: 'An hourly probe checks every list website: live, deprecated, shutdown, plus latency. Dead lists are auto-pruned from the registry and surfaced on the status page.',
  },
  {
    icon: '🧩',
    title: 'Zero dependencies',
    body: 'Node fetch, node:http and EventEmitter only. About 15 KB min+gzip. Works on Node 18+ and Bun with discord.js, Eris or no client at all.',
  },
  {
    icon: '🔐',
    title: 'Fully typed',
    body: 'Strict TypeScript ships in the package. Every option, payload and event has a real interface, so your editor writes half the integration for you.',
  },
];

const CODE = `import { Client } from 'discord.js';
import { Botlists } from 'discord-botlists';

const client = new Client({ intents: ['Guilds'] });

const lists = new Botlists({
  client,
  tokens: {
    'top.gg': process.env.TOPGG_TOKEN,
    'discordbotlist.com': process.env.DBL_TOKEN,
  },
  webhook: { port: 8080, secret: process.env.WEBHOOK_SECRET },
});

client.on('ready', async () => {
  await lists.postStats();       // every list, correct format each
  await lists.startWebhooks();   // realtime votes
});

lists.on('vote', (vote) => {
  console.log(vote.voterId, 'voted on', vote.listName, 'x' + vote.weight);
});`;

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden py-24 text-center">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent-2">
            33 verified live lists · zero dependencies · MIT
          </p>
          <h1 className="text-5xl font-extrabold leading-tight md:text-6xl">
            One SDK for <span className="gradient-text">every Discord botlist</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Post stats everywhere, get votes in realtime, and parse any botlist's data into one
            universal shape. Dead lists are detected and pruned automatically.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/docs" className="rounded-xl bg-accent px-8 py-4 font-bold text-white transition hover:bg-accent/80">
              Read the docs
            </Link>
            <Link to="/status" className="rounded-xl border border-white/15 px-8 py-4 font-bold text-slate-200 transition hover:border-accent/50">
              Live status board
            </Link>
          </div>
          <div className="code-block mt-12 max-w-2xl mx-auto text-left">$ npm install discord-botlists</div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="code-block text-left">{CODE}</div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-10 text-center text-3xl font-bold">Everything you need, nothing you don't</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glow-card">
              <div className="mb-3 text-3xl">{f.icon}</div>
              <h3 className="mb-2 text-lg font-bold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
