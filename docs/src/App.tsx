import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import SeoManager from './SeoManager';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/docs', label: 'Docs' },
  { to: '/examples', label: 'Examples' },
  { to: '/status', label: 'Status' },
  { to: '/about', label: 'About' },
];

const RIGHT_LINKS = [
  { href: 'https://potenfyr.in', label: 'Website' },
  { href: 'https://discord.com/invite/zUaN2FPBec', label: 'Discord' },
  { href: 'https://github.com/PotenFYR-Studios/discord-botlists', label: 'GitHub' },
];

export default function App() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // close the mobile drawer on navigation
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen">
      <SeoManager />

      {/* 56px sticky blur navbar (SPEC 5.1) */}
      <header
        className="sticky top-0 z-50 flex h-14 items-center gap-3.5 border-b border-white/[0.08] px-5"
        style={{ background: 'rgba(11, 13, 20, 0.72)', backdropFilter: 'blur(14px) saturate(1.4)' }}
      >
        <Link to="/" className="flex shrink-0 items-center gap-2.5 font-semibold text-white" style={{ fontSize: '0.95em' }}>
          <img src="/favicon.png" alt="" className="h-6 w-6" style={{ filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' }} />
          <span>
            discord-botlists<span className="brand-dot">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                'rounded-[7px] px-2.5 py-[5px] text-[0.84em] font-medium transition ' +
                (isActive ? 'text-white' : 'text-muted hover:bg-white/5 hover:text-white')
              }
              style={({ isActive }) =>
                isActive
                  ? { background: 'rgba(139, 92, 246, 0.18)', boxShadow: 'inset 0 0 0 1px rgba(139, 92, 246, 0.45)' }
                  : undefined
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 md:flex">
          {RIGHT_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted transition hover:text-link"
              aria-label={`${l.label} (opens in a new tab)`}
            >
              {l.label}
            </a>
          ))}
        </div>

        <button
          className="ml-auto rounded-lg border border-white/10 p-2 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </header>

      {open && (
        <div
          className="fixed inset-x-0 top-14 z-40 border-b border-white/10 px-6 py-4 md:hidden"
          style={{ background: 'rgba(11, 13, 20, 0.98)' }}
        >
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="block rounded-lg px-3 py-2.5 text-ink2 hover:bg-white/5">
              {n.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-4 border-t border-white/10 pt-3">
            {RIGHT_LINKS.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="text-xs text-muted">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="relative z-[1]">
        <Outlet />
      </div>

      {/* full-bleed 3-zone footer (SPEC 5.2) */}
      <footer className="relative z-[1] border-t border-white/[0.08]" style={{ background: 'rgba(14, 17, 29, 0.6)' }}>
        <div className="mx-auto max-w-[1280px] px-6 py-10">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
            <div>
              <p className="font-mono text-sm font-bold text-white">
                discord-botlists<span className="brand-dot">.</span>
              </p>
              <p className="mt-2 max-w-[420px] text-[0.8em] leading-relaxed text-muted">
                One SDK for every Discord botlist: stats posting, realtime votes, a universal data
                parser and live registry health, with zero dependencies.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[0.78em]" aria-label="Footer">
              <a href="https://github.com/PotenFYR-Studios" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white">
                GitHub Org
              </a>
              <a href="https://potenfyr.in" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white">
                potenfyr.in
              </a>
              <a href="https://discord.com/invite/zUaN2FPBec" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white">
                Support Discord
              </a>
              <a
                href="https://www.npmjs.com/package/@potenfyrstudios/discord-botlists"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-white"
              >
                npm
              </a>
              <Link to="/docs" className="font-bold" style={{ color: '#a78bfa' }}>
                Docs
              </Link>
                          <Link to="/license" className="text-[#a78bfa] hover:text-white">
                License
              </Link>
</nav>
          </div>
          <div className="mt-6 flex flex-col justify-between gap-2 border-t border-white/[0.08] pt-4 text-[0.75em] text-faint sm:flex-row">
            <p>© 2026 PotenFYR Studios. Released under Apache-2.0 with the Commons Clause.</p>
            <p>Crafted with ♥ for bot developers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
