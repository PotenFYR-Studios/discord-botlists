import { useEffect, useState } from 'react';
import type { StatusEntry } from '../types';

const DOT: Record<string, string> = {
  live: '#34d399',
  deprecated: '#fbbf24',
  shutdown: '#f43f5e',
  unknown: '#6a7089',
};

interface Board {
  generatedAt: number;
  summary: { live: number; deprecated: number; shutdown: number; unknown: number };
  entries: StatusEntry[];
}

export default function Status() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    // absolute path: routes are real directories, not hash fragments
    fetch('/status.json')
      .then((r) => r.json())
      .then((d) => {
        setBoard(d);
        setLoading(false);
      })
      .catch(() => {
        setBoard(null);
        setLoading(false);
      });
  }, []);

  const entries = board?.entries.filter((e) => filter === 'all' || e.state === filter) ?? [];

  return (
    <main className="mx-auto max-w-[1080px] px-6 pb-20 pt-9">
      <p className="mono-label mb-3">live registry · hourly probe</p>
      <h1 className="text-[clamp(1.9em,3.6vw,2.6em)] font-extrabold leading-tight tracking-[-0.02em]">
        Botlist <span className="grad-text">status board</span>
      </h1>
      <p className="mt-3 max-w-[720px] text-[1.04em] leading-[1.75] text-muted">
        Probed hourly by GitHub Actions with HEAD requests (GET fallback), 8 concurrent, browser user
        agent. When a list turns deprecated or shutdown it is pruned from the registry via an
        automatic pull request, so registry changes are always human reviewed.
      </p>

      {board ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {(['live', 'deprecated', 'shutdown', 'unknown'] as const).map((k) => {
              const total = board.entries.length || 1;
              const pct = Math.round((board.summary[k] / total) * 100);
              return (
                <div key={k} className="stat-tile !p-5 text-left">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-2xl font-extrabold" style={{ color: DOT[k] }}>
                      {board.summary[k]}
                    </span>
                    <span className="font-mono text-xs text-faint">{pct}%</span>
                  </div>
                  <div className="mt-1 text-[11.5px] uppercase tracking-[1.4px] text-muted">{k}</div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: DOT[k] }} />
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
                  'rounded-full px-3 py-1.5 font-mono text-[0.72em] uppercase tracking-wider transition ' +
                  (filter === key ? 'text-white' : 'text-muted hover:text-white')
                }
                style={
                  filter === key
                    ? { border: '1px solid rgba(139, 92, 246, 0.45)', background: 'rgba(139, 92, 246, 0.18)' }
                    : { border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }
                }
              >
                {key !== 'all' && <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: DOT[key] }} />}
                {key}
                {key !== 'all' && <span className="ml-2 text-faint">{board.summary[key]}</span>}
              </button>
            ))}
          </div>
          <p className="mt-4 font-mono text-xs text-faint">
            Last checked: {new Date(board.generatedAt).toUTCString()}
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="spec-table min-w-[720px]">
              <thead>
                <tr>
                  <th>List</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>HTTP</th>
                  <th>Checked (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.listId}>
                    <td>
                      <a href={e.website} target="_blank" rel="noreferrer" className="text-ink hover:text-link">
                        {e.listName}
                      </a>
                      <span className="ml-2 font-mono text-xs text-faint">{e.listId}</span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2 capitalize">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: DOT[e.state] }} />
                        {e.state}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{e.latencyMs === null ? 'n/a' : `${e.latencyMs} ms`}</td>
                    <td className="font-mono text-xs">{e.httpStatus ?? 'n/a'}</td>
                    <td className="font-mono text-xs text-faint">
                      {new Date(e.lastChecked).toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : loading ? (
        <div className="glass-card mt-10 items-center text-center !p-10 text-muted">
          <span className="mx-auto mb-3 block h-3 w-3 animate-pulse rounded-full bg-accent" />
          Loading status board...
        </div>
      ) : (
        <div className="glass-card mt-10 text-center !p-10 text-muted">
          Status data has not been generated yet. Run <code className="inline">bun scripts/status-sync.ts</code> or
          trigger the "Status sync" workflow, then rebuild the site.
        </div>
      )}
    </main>
  );
}
