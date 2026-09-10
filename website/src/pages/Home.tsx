import { Link } from 'react-router-dom';
import { useLiveData, formatNumber } from '../hooks/useLiveData';

const FEATURES = [
  {
    icon: '📮',
    title: 'Stats posting',
    body: 'One call posts server and shard counts to every list you have a token for. Each list gets its exact wire format. Retries honour Retry-After.',
  },
  {
    icon: '⚡',
    title: 'Realtime vote webhooks',
    body: 'A built-in zero-dependency HTTP server receives votes, comments, reviews and ratings from every list and re-emits them as typed events. No polling.',
  },
  {
    icon: '🔀',
    title: 'Universal parser',
    body: 'fetchBot() returns the same UniversalBot shape no matter which list answered: votes, owners, ratings, invite, everything normalized, raw kept.',
  },
  {
    icon: '🩺',
    title: 'Status tracking',
    body: 'Hourly probes detect deprecated and shutdown lists with latency. Dead lists are auto-pruned from the registry via reviewed pull requests.',
  },
  {
    icon: '🧩',
    title: 'Zero dependencies',
    body: 'Node fetch, node:http and EventEmitter only. Works on Node 18+ and Bun with discord.js, Eris or no client at all.',
  },
  {
    icon: '🔐',
    title: 'Fully typed',
    body: 'Strict TypeScript ships in the package. Every option, payload and event has a real interface, so your editor writes half the integration.',
  },
];

const LISTS_MARQUEE = [
  'top.gg', 'discordbotlist.com', 'discord.bots.gg', 'botlist.me', 'discords.com',
  'voidbots.net', 'vcodes.xyz', 'radarcord.net', 'discordextremelist.xyz', 'bots.ondiscord.xyz',
  'discordlist.gg', 'disforge.com', 'disq.ink', 'dlist.space', 'cybralist.com',
  'yabl.xyz', 'justdiscord.org', 'omniplex.gg', 'blist.xyz', 'topcord.xyz',
  'discordbot.world', 'botsdatabase.com', 'botlist.co', 'discord.services',
];

const CODE = `import { Client } from 'discord.js';
import { Botlists } from '@potenfyrstudios/discord-botlists';

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
  const live = useLiveData();

  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden py-28 text-center">
        <div className="bg-grid absolute inset-0" />
        <div className="pointer-events-none absolute -top-48 left-1/2 h-[30rem] w-[52rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl animate-pulse-glow" />
        <div className="pointer-events-none absolute top-40 -left-32 h-72 w-72 rounded-full bg-accent-2/10 blur-3xl" />
        <div className="pointer-events-none absolute top-64 -right-32 h-72 w-72 rounded-full bg-accent-3/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6">
          <div className="border-gradient mb-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            v{live.version ?? '1.0.0'} live · {live.liveLists || 33} verified lists · zero dependencies
          </div>

          <h1 className="text-5xl font-extrabold leading-tight md:text-7xl">
            Every botlist.
            <br />
            <span className="gradient-text">One SDK.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Post stats everywhere, get votes in realtime, parse any list's data into one universal
            shape. Dead lists are detected and pruned automatically while you sleep.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/docs" className="rounded-xl bg-gradient-to-r from-accent to-accent-2 px-8 py-4 font-bold text-white shadow-lg shadow-accent/30 transition hover:shadow-accent/50 hover:brightness-110">
              Get started
            </Link>
            <Link to="/status" className="rounded-xl border border-white/15 bg-white/5 px-8 py-4 font-bold text-slate-200 backdrop-blur transition hover:border-accent/50">
              Live status
            </Link>
          </div>

          {/* install command with copy feel */}
          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-black/50 px-5 py-3.5 font-mono text-sm backdrop-blur">
              <span className="shrink-0 text-accent">$</span>
              <code className="truncate text-slate-200">npm install @potenfyrstudios/discord-botlists</code>
            </div>
            <span className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-center font-mono text-xs text-slate-400 backdrop-blur">
              {formatNumber(live.downloads)} dl/mo
            </span>
          </div>
        </div>
      </section>

      {/* LISTS MARQUEE */}
      <section className="border-y border-white/5 bg-white/[0.02] py-5 overflow-hidden">
        <div className="flex w-max animate-marquee gap-10 px-5">
          {[...LISTS_MARQUEE, ...LISTS_MARQUEE].map((l, i) => (
            <span key={i} className="whitespace-nowrap font-mono text-sm text-slate-500">
              {l}
            </span>
          ))}
        </div>
      </section>

      {/* LIVE NUMBERS */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {[
            { value: String(live.liveLists || 33), label: 'verified live lists', accent: 'text-emerald-400' },
            { value: formatNumber(live.downloads), label: 'downloads / month', accent: 'text-accent' },
            { value: '0', label: 'runtime dependencies', accent: 'text-accent-2' },
            { value: '10', label: 'realtime event types', accent: 'text-accent-3' },
          ].map((s) => (
            <div key={s.label} className="glow-card text-center">
              <div className={`text-4xl font-extrabold ${s.accent}`}>{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CODE + FLOW */}
      <section className="mx-auto grid max-w-6xl items-start gap-8 px-6 pb-20 lg:grid-cols-[3fr_2fr]">
        <div>
          <h2 className="mb-4 text-3xl font-bold text-white">Ship it in 60 seconds</h2>
          <p className="mb-6 text-slate-400">
            Construct, post, listen. The SDK handles per-list formats, auth headers, retries and
            webhook parsing for you.
          </p>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#161a23] px-4 py-2">
              <span className="font-mono text-xs text-slate-500">quickstart.ts</span>
              <span className="font-mono text-xs text-slate-600">ts</span>
            </div>
            <pre className="max-h-[34rem] overflow-auto bg-[#0d1017] p-4 text-left text-[13px] leading-relaxed">
              <code className="font-mono text-slate-300">{CODE}</code>
            </pre>
          </div>
        </div>

        {/* architecture flow */}
        <div className="glow-card flex flex-col items-center justify-center gap-4">
          <h3 className="mb-2 text-lg font-bold text-white">N integrations become one</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {['top.gg', 'botlist.me', 'dbl.com', '+30'].map((l) => (
              <span key={l} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-slate-300">
                {l}
              </span>
            ))}
          </div>
          <div className="text-2xl text-accent animate-float">⇅</div>
          <div className="w-full max-w-xs">
            <div className="border-gradient rounded-xl px-8 py-4 text-center">
              <span className="font-mono font-bold text-white">discord-botlists</span>
              <p className="text-xs text-slate-500">normalize · route · emit</p>
            </div>
          </div>
          <div className="text-2xl text-accent">↓</div>
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-6 py-2 font-mono text-sm text-emerald-300">
            your bot · one emitter
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-10 text-center text-3xl font-bold">
          Everything you need, <span className="gradient-text">nothing you don't</span>
        </h2>
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

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="border-gradient rounded-3xl p-10 text-center">
          <h2 className="text-3xl font-extrabold text-white">Ready in one install</h2>
          <p className="mx-auto mt-3 max-w-md text-slate-400">
            Join the lists. Collect the votes. Never write glue code for a botlist API again.
          </p>
          <Link
            to="/docs"
            className="mt-8 inline-block rounded-xl bg-gradient-to-r from-accent to-accent-2 px-10 py-4 font-bold text-white shadow-lg shadow-accent/30 transition hover:brightness-110"
          >
            Read the docs
          </Link>
        </div>
      </section>
    </main>
  );
}
