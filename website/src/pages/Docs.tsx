import { Link } from 'react-router-dom';
import { CURRENT_DOC, LATEST_VERSION } from '../docs/content';

const SCENARIOS = [
  {
    icon: '🗳️',
    title: 'Reward voters instantly',
    body: 'Give a role or currency the second someone votes on any list.',
    route: `/docs/${LATEST_VERSION}/realtime-events`,
    snippet: "lists.on('vote', (v) => addRole(v.voterId));",
  },
  {
    icon: '📊',
    title: 'Post stats everywhere',
    body: 'One call, every list, each with its exact wire format and auth header.',
    route: `/docs/${LATEST_VERSION}/posting-stats`,
    snippet: 'await lists.postStats({ serverCount: 120 });',
  },
  {
    icon: '🔎',
    title: 'Read bot data from any list',
    body: 'Normalized UniversalBot shape from every list response, raw kept.',
    route: `/docs/${LATEST_VERSION}/universal-parser`,
    snippet: "await lists.fetchBot('top.gg', id);",
  },
  {
    icon: '🩺',
    title: 'Know when a list dies',
    body: 'Hourly probes with latency, and dead lists auto-pruned from the registry.',
    route: `/docs/${LATEST_VERSION}/status-checking`,
    snippet: 'await lists.checkAndReportStatus();',
  },
  {
    icon: '🧵',
    title: 'Shard aware posting',
    body: 'Per-shard counts, shard totals and per-shard arrays, mapped per list.',
    route: `/docs/${LATEST_VERSION}/posting-stats`,
    snippet: 'await lists.postStats({ shards: [21, 21] });',
  },
  {
    icon: '🛠️',
    title: 'Add your own list',
    body: 'Self-hosted list? One record and it works with everything.',
    route: `/docs/${LATEST_VERSION}/custom-lists`,
    snippet: 'new Botlists({ lists: [myList] });',
  },
];

const STATS = [
  { value: '33', label: 'verified live lists' },
  { value: '0', label: 'runtime dependencies' },
  { value: '10', label: 'realtime event types' },
  { value: '<15KB', label: 'gzipped core' },
];

/** tiny bar chart: vote flow latency comparison (illustrative, from webhook push model) */
function LatencyGraph() {
  const bars = [
    { label: 'discord-botlists webhooks', ms: 0, w: '6%', color: 'from-emerald-400 to-emerald-600' },
    { label: 'Typical polling (60s)', ms: 30000, w: '92%', color: 'from-slate-500 to-slate-600' },
    { label: 'Cron-based posting checks', ms: 120000, w: '100%', color: 'from-rose-500 to-rose-700' },
  ];
  return (
    <div className="glow-card">
      <h3 className="mb-1 text-lg font-bold text-white">Vote detection latency</h3>
      <p className="mb-5 text-sm text-slate-400">Push beats poll: webhooks fire the moment a vote lands.</p>
      <div className="space-y-4">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>{b.label}</span>
              <span className="font-mono">{b.ms === 0 ? 'instant' : `${b.ms / 1000}s`}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/5">
              <div className={`h-full rounded-full bg-gradient-to-r ${b.color} animate-shimmer`} style={{ width: b.w, backgroundSize: '200% 100%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** architecture flow diagram in pure css */
function FlowDiagram() {
  const lists = ['top.gg', 'botlist.me', 'dbl.com', '+30 more'];
  return (
    <div className="glow-card">
      <h3 className="mb-5 text-lg font-bold text-white">How one SDK replaces N integrations</h3>
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap justify-center gap-2">
          {lists.map((l) => (
            <span key={l} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono text-slate-300">
              {l}
            </span>
          ))}
        </div>
        <div className="text-2xl text-accent animate-float">⇅</div>
        <div className="rounded-xl bg-gradient-to-r from-accent/30 via-accent-2/30 to-accent-3/30 p-px">
          <div className="rounded-xl bg-card px-8 py-4 text-center">
            <span className="font-mono font-bold text-white">discord-botlists</span>
            <p className="text-xs text-slate-400">normalize · route · emit</p>
          </div>
        </div>
        <div className="text-2xl text-accent">↓</div>
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-6 py-2 font-mono text-sm text-emerald-300">
          your bot · one event emitter
        </div>
      </div>
    </div>
  );
}

export default function Docs() {
  const latest = CURRENT_DOC;
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent">{LATEST_VERSION} docs</span>
        <Link to={`/docs/${latest.version}`} className="text-sm text-slate-400 hover:text-accent">
          Prefer reading by section? Open the versioned reader →
        </Link>
      </div>
      <h1 className="text-4xl font-extrabold md:text-5xl">
        <span className="gradient-text">Documentation</span>
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-400">
        Every feature, every scenario, every type. Start with a scenario below or open the full reference.
      </p>

      {/* stat chips */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-card px-5 py-4 text-center">
            <div className="text-2xl font-extrabold text-white">{s.value}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* scenario cards */}
      <h2 className="mb-6 mt-14 text-2xl font-bold text-white">Start from your scenario</h2>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {SCENARIOS.map((s) => (
          <Link key={s.title} to={s.route} className="glow-card group block">
            <div className="mb-3 text-3xl">{s.icon}</div>
            <h3 className="mb-1 font-bold text-white group-hover:text-accent">{s.title}</h3>
            <p className="mb-4 text-sm text-slate-400">{s.body}</p>
            <code className="block overflow-x-auto rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-emerald-300">
              {s.snippet}
            </code>
          </Link>
        ))}
      </div>

      {/* visuals */}
      <h2 className="mb-6 mt-14 text-2xl font-bold text-white">Why it wins</h2>
      <div className="grid gap-5 lg:grid-cols-2">
        <FlowDiagram />
        <LatencyGraph />
      </div>

      {/* full reference card */}
      <div className="mt-14 flex flex-col items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 via-accent-2/10 to-accent-3/10 p-8 md:flex-row">
        <div>
          <h2 className="text-xl font-bold text-white">Full API reference</h2>
          <p className="text-sm text-slate-400">
            Every class, method, option and event with tables and copy-paste examples.
          </p>
        </div>
        <Link
          to={`/docs/${latest.version}`}
          className="rounded-xl bg-accent px-8 py-4 font-bold text-white transition hover:bg-accent/80"
        >
          Open reference
        </Link>
      </div>
    </main>
  );
}
