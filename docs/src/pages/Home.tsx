import { Link } from 'react-router-dom';
import { useLiveData, formatNumber } from '../hooks/useLiveData';
import Code from '../components/Code';

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
    body: 'Node fetch, node:http and EventEmitter only. Works on Node 18+ and Bun with discord.js, Eris, Oceanic or no client at all.',
  },
  {
    icon: '🔐',
    title: 'Fully typed',
    body: 'Strict TypeScript ships in the package. Every option, payload and event has a real interface, so your editor writes half the integration.',
  },
];

/** every id in the generated registry (src/data/lists.generated.ts) */
const LISTS_MARQUEE = [
  'top.gg', 'discordbotlist.com', 'discord.bots.gg', 'botlist.me', 'discords.com',
  'voidbots.net', 'vcodes.xyz', 'radarcord.net', 'discordextremelist.xyz', 'bots.ondiscord.xyz',
  'discordlist.gg', 'disforge.com', 'disq.ink', 'dlist.space', 'cybralist.com',
  'discord.rovelstars.com', 'yabl.xyz', 'justdiscord.org', 'omniplex.gg', 'discover.fluxpoint.dev',
  'blist.xyz', 'motiondevelopment.top', 'topcord.xyz', 'discordbot.world', 'bots.discordlabs.org',
  'botsdatabase.com', 'discordbotlist.xyz', 'space-bot-list.xyz', 'botlist.co', 'discord.services',
  'stellarbotlist.com', 'carbonitex.net', 'discord.place',
];

const QUICKSTART = `import { Client } from 'discord.js';
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

client.once('ready', async () => {
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
      {/* HERO: glow orbs + vivid 90deg display gradient are landing-only (SPEC 5.14, appendix) */}
      <section className="relative overflow-hidden pb-16 pt-[72px] text-center">
        <div className="pointer-events-none absolute -top-48 left-1/2 h-[30rem] w-[52rem] -translate-x-1/2 rounded-full blur-3xl" style={{ background: 'rgba(139, 92, 246, 0.18)' }} />
        <div className="pointer-events-none absolute -left-32 top-40 h-[31rem] w-[31rem] rounded-full blur-3xl" style={{ background: 'rgba(236, 72, 153, 0.15)' }} />
        <div className="pointer-events-none absolute -right-32 top-64 h-[26rem] w-[26rem] rounded-full blur-3xl" style={{ background: 'rgba(6, 182, 212, 0.12)' }} />

        <div className="relative mx-auto max-w-4xl px-6">
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[0.75em] text-muted backdrop-blur-md"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px rgba(16,185,129,.5)' }} />
            v{live.version ?? '1.0.1'} live · {live.liveLists || 33} verified lists · zero dependencies
          </div>

          <h1 className="text-[clamp(2.6em,6vw,4em)] font-extrabold leading-[1.08] tracking-tight">
            Every botlist.
            <br />
            <span className="grad-text-vivid">One SDK.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[720px] text-[1.04em] leading-[1.75] text-muted">
            Post stats everywhere, get votes in realtime, parse any list's data into one universal
            shape. Dead lists are detected and pruned automatically while you sleep.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/docs" className="btn-primary">
              Get started
            </Link>
            <Link to="/status" className="btn-ghost">
              Live status
            </Link>
          </div>

          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex items-center gap-2 overflow-hidden rounded-xl px-5 py-3.5 font-mono text-sm backdrop-blur"
              style={{ border: '1px solid var(--line)', background: '#151828' }}
            >
              <span className="shrink-0 text-accent">$</span>
              <code className="truncate text-ink2">npm install @potenfyrstudios/discord-botlists</code>
            </div>
            <span
              className="shrink-0 rounded-xl px-4 py-3.5 text-center font-mono text-xs text-muted backdrop-blur"
              style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
            >
              {formatNumber(live.downloads)} dl/mo
            </span>
          </div>
        </div>
      </section>

      {/* LISTS MARQUEE: mono micro-labels, pause on hover (SPEC 7) */}
      <section className="overflow-hidden border-y border-white/[0.06] bg-white/[0.02] py-5">
        <div className="flex w-max animate-marquee gap-10 px-5">
          {[...LISTS_MARQUEE, ...LISTS_MARQUEE].map((l, i) => (
            <span key={i} className="flex items-center gap-2 whitespace-nowrap font-mono text-xs uppercase tracking-widest text-faint">
              <span className="text-accent">◆</span>
              {l}
            </span>
          ))}
        </div>
      </section>

      {/* LIVE NUMBERS: stat tiles (SPEC 5.6) */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3.5 sm:grid-cols-4">
          {[
            { value: String(live.liveLists || 33), label: 'verified live lists', icon: '🟢', color: 'text-emerald-400' },
            { value: formatNumber(live.downloads), label: 'downloads / month', icon: '📥', color: 'grad-text font-mono' },
            { value: '0', label: 'runtime dependencies', icon: '📦', color: 'text-[#ec4899]' },
            { value: '10', label: 'realtime event types', icon: '⚡', color: 'text-[#f97316]' },
          ].map((s) => (
            <div key={s.label} className="stat-tile">
              <div className={`text-3xl font-extrabold font-mono ${s.color}`}>{s.value}</div>
              <div className="mt-1 text-[11.5px] uppercase tracking-[1.4px] text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CODE + FLOW */}
      <section className="mx-auto grid max-w-6xl items-start gap-8 px-6 pb-20 lg:grid-cols-[3fr_2fr]">
        <div>
          <p className="mono-label mb-2">Quickstart</p>
          <h2 className="mb-4 text-3xl font-bold text-white">Ship it in 60 seconds</h2>
          <p className="mb-6 text-muted">
            Construct, post, listen. The SDK handles per-list formats, auth headers, retries and
            webhook parsing for you.
          </p>
          <Code content={QUICKSTART} lang="quickstart.ts" />
        </div>

        <div className="glass-card flex flex-col items-center justify-center gap-4 !p-6">
          <h3 className="mb-2 text-lg font-bold text-white">N integrations become one</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {['top.gg', 'botlist.me', 'discords.com', '+30'].map((l) => (
              <span
                key={l}
                className="rounded-lg px-3 py-1.5 font-mono text-xs text-ink2"
                style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
              >
                {l}
              </span>
            ))}
          </div>
          <div className="text-2xl text-accent">⇅</div>
          <div
            className="w-full max-w-xs rounded-xl px-8 py-4 text-center"
            style={{ border: '1px solid var(--line)', background: '#151828' }}
          >
            <span className="font-mono font-bold text-white">discord-botlists</span>
            <p className="text-xs text-faint">normalize · route · emit</p>
          </div>
          <div className="text-2xl text-accent">↓</div>
          <div
            className="rounded-lg px-6 py-2 font-mono text-sm"
            style={{ border: '1px solid rgba(16,185,129,.3)', background: 'rgba(16,185,129,.12)', color: '#34d399' }}
          >
            your bot · one emitter
          </div>
        </div>
      </section>

      {/* FEATURES: glass cards + beam (landing only, SPEC 11.7) */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <p className="mono-label mb-2 text-center">Features</p>
        <h2 className="mb-10 text-center text-3xl font-bold text-white">
          Everything you need, <span className="grad-text">nothing you don't</span>
        </h2>
        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-card">
              <div className="icon-tile">{f.icon}</div>
              <h3 className="mt-1.5 text-[0.98em] font-bold text-white">{f.title}</h3>
              <p className="text-[0.83em] leading-[1.55] text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="glass-card items-center !p-10 text-center">
          <h2 className="text-3xl font-extrabold text-white">Ready in one install</h2>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Join the lists. Collect the votes. Never write glue code for a botlist API again.
          </p>
          <Link to="/docs" className="btn-primary mt-8">
            Read the docs
          </Link>
        </div>
      </section>
    </main>
  );
}
