import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import SeoManager from './SeoManager';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/docs', label: 'Docs' },
  { to: '/status', label: 'Status' },
];

export default function App() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <SeoManager />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-surface/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5 font-bold" onClick={() => setOpen(false)}>
            <img src="/discord-botlists/favicon.svg" alt="" className="h-7 w-7" />
            <span>
              discord<span className="gradient-text">-botlists</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  'rounded-lg px-4 py-2 text-sm transition ' +
                  (isActive ? 'bg-accent/15 font-semibold text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white')
                }
              >
                {n.label}
              </NavLink>
            ))}
            <a
              href="https://www.npmjs.com/package/@potenfyrstudios/discord-botlists"
              className="ml-3 rounded-lg bg-gradient-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              npm install
            </a>
          </div>

          <button className="rounded-lg border border-white/10 p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </nav>
        {open && (
          <div className="border-t border-white/10 px-6 py-4 md:hidden">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-slate-300 hover:bg-white/5">
                {n.label}
              </Link>
            ))}
            <a href="https://www.npmjs.com/package/@potenfyrstudios/discord-botlists" className="mt-2 block rounded-lg bg-accent px-3 py-2.5 text-center font-semibold text-white">
              npm install
            </a>
          </div>
        )}
      </header>
      <Outlet />
      <footer className="border-t border-white/10 py-12 text-center text-sm text-slate-500">
        <div className="mx-auto mb-5 flex max-w-md flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link to="/docs" className="hover:text-accent">Docs</Link>
          <Link to="/status" className="hover:text-accent">Status</Link>
          <a href="https://github.com/PotenFYR-Studios/discord-botlists" className="hover:text-accent">GitHub</a>
          <a href="https://www.npmjs.com/package/@potenfyrstudios/discord-botlists" className="hover:text-accent">npm</a>
          <a href="https://potenfyr.in" className="hover:text-accent">PotenFYR.in</a>
        </div>
        <p>
          Built by <a className="text-accent hover:underline" href="https://github.com/PotenFYR-Studios">PotenFYR Studios</a> · Apache-2.0 + Commons Clause
        </p>
        <p className="mt-1 text-xs text-slate-600">Botlist names and trademarks belong to their respective owners.</p>
      </footer>
    </div>
  );
}
