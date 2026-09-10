import { useEffect, useState } from 'react';
import type { StatusEntry } from '../types';

const DOT: Record<string, string> = {
  live: 'bg-emerald-400',
  deprecated: 'bg-amber-400',
  shutdown: 'bg-rose-500',
  unknown: 'bg-slate-500',
};

interface Board {
  generatedAt: number;
  summary: { live: number; deprecated: number; shutdown: number; unknown: number };
  entries: StatusEntry[];
}

export default function Status() {
  const [board, setBoard] = useState<Board | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/discord-botlists/status.json')
      .then((r) => r.json())
      .then(setBoard)
      .catch(() => setBoard(null));
  }, []);

  const entries = board?.entries.filter((e) => filter === 'all' || e.state === filter) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-4xl font-extrabold">
        Botlist <span className="gradient-text">status board</span>
      </h1>
      <p className="mt-3 max-w-2xl text-slate-400">
        Probed hourly by GitHub Actions with HEAD requests, 8 concurrent, browser user agent. When a
        list turns deprecated or shutdown it is pruned from the registry via an automatic pull request.
      </p>

      {board ? (
        <>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {(['live', 'deprecated', 'shutdown', 'unknown'] as const).map((k) => {
            const total = board.entries.length || 1;
            const pct = Math.round((board.summary[k] / total) * 100);
            const grad = k === 'live' ? 'from-emerald-400 to-emerald-600' : k === 'deprecated' ? 'from-amber-400 to-amber-600' : k === 'shutdown' ? 'from-rose-500 to-rose-700' : 'from-slate-500 to-slate-600';
            return (
              <div key={k} className="rounded-xl border border-white/10 bg-card px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold capitalize text-white">{board.summary[k]}</span>
                  <span className="text-xs text-slate-500">{pct}%</span>
                </div>
                <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">{k}</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div className={`h-full rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            {(['all', 'live', 'deprecated', 'shutdown', 'unknown'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={
                  'rounded-lg border px-4 py-2 capitalize transition ' +
                  (filter === key
                    ? 'border-accent bg-accent/20 text-white'
                    : 'border-white/10 text-slate-400 hover:border-white/25')
                }
              >
                {key === 'all' ? 'all' : `${DOT[key]} ${key}`}
                {key !== 'all' && (
                  <span className="ml-2 text-slate-500">{board.summary[key]}</span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Last checked: {new Date(board.generatedAt).toUTCString()}
          </p>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-card text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">List</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Latency</th>
                  <th className="px-5 py-3 font-semibold">HTTP</th>
                  <th className="px-5 py-3 font-semibold">Checked</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.listId} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-5 py-3">
                      <a href={e.website} target="_blank" rel="noreferrer" className="text-slate-200 hover:text-accent">
                        {e.listName}
                      </a>
                      <span className="ml-2 text-xs text-slate-600">{e.listId}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2 capitalize">
                        <span className={`h-2.5 w-2.5 rounded-full ${DOT[e.state]}`} />
                        {e.state}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{e.latencyMs === null ? 'n/a' : `${e.latencyMs} ms`}</td>
                    <td className="px-5 py-3 text-slate-400">{e.httpStatus ?? 'n/a'}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(e.lastChecked).toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-10 rounded-2xl border border-white/10 bg-card p-10 text-center text-slate-400">
          Status data has not been generated yet. Run <code className="text-accent">bun scripts/status-sync.ts</code> or
          trigger the "Status sync" workflow, then rebuild the site.
        </div>
      )}
    </main>
  );
}
