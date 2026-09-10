import { Link, Outlet } from 'react-router-dom';
import SeoManager from './SeoManager';

export default function App() {
  return (
    <div className="min-h-screen">
      <SeoManager />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-surface/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span>
              discord<span className="gradient-text">-botlists</span>
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-slate-300">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/docs" className="hover:text-white">Docs</Link>
            <Link to="/status" className="hover:text-white">Status</Link>
            <Link to="/status" className="hover:text-white">Status</Link>
            <a
              href="https://www.npmjs.com/package/discord-botlists"
              className="rounded-lg bg-accent px-4 py-2 font-semibold text-white transition hover:bg-accent/80"
            >
              npm install
            </a>
          </div>
        </nav>
      </header>
      <Outlet />
      <footer className="border-t border-white/10 py-10 text-center text-sm text-slate-500">
        <p>
          Built by <a className="text-accent hover:underline" href="https://github.com/PotenFYR-Studios">PotenFYR Studios</a> |
          MIT License | botlist names and trademarks belong to their owners.
        </p>
      </footer>
    </div>
  );
}
