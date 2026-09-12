import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { DOC_VERSIONS, LATEST_VERSION, type DocSection } from '../docs/content';
import { Block } from '../components/DocBlocks';

const CATEGORY_ORDER = ['Getting Started', 'Core Concepts', 'Guides', 'API Reference'] as const;

export default function VersionedDocs() {
  const { version: versionParam, section } = useParams();
  const navigate = useNavigate();

  // unknown / retired versions redirect to the current docs, not a blank page
  const known = !versionParam || DOC_VERSIONS.some((d) => d.version === versionParam);
  useEffect(() => {
    if (versionParam !== undefined && !known) {
      navigate(`/docs/${LATEST_VERSION}${section ? `/${section}` : ''}`, { replace: true });
    }
  }, [versionParam, known, section, navigate]);

  const doc = DOC_VERSIONS.find((d) => d.version === versionParam) ?? DOC_VERSIONS[0];
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const active = useMemo(() => {
    if (section && doc.sections.some((x) => x.slug === section)) {
      return doc.sections.find((x) => x.slug === section)!;
    }
    return doc.sections[0];
  }, [doc, section]);

  const filtered = useMemo(() => {
    if (!query.trim()) return doc.sections;
    const q = query.toLowerCase();
    return doc.sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.blurb.toLowerCase().includes(q) ||
        s.blocks.some((b) => JSON.stringify(b).toLowerCase().includes(q)),
    );
  }, [doc, query]);

  const idx = doc.sections.findIndex((s) => s.slug === active.slug);
  const prev: DocSection | null = idx > 0 ? doc.sections[idx - 1] : null;
  const next: DocSection | null = idx >= 0 && idx < doc.sections.length - 1 ? doc.sections[idx + 1] : null;

  // [ and ] jump between sections (SPEC 6)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === '[' && prev) navigate(`/docs/${doc.version}/${prev.slug}`);
      if (e.key === ']' && next) navigate(`/docs/${doc.version}/${next.slug}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc.version, prev, next, navigate]);

  return (
    <main className="mx-auto max-w-[1400px] px-5 pb-20 pt-9 sm:px-7">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <p className="mono-label">discord-botlists docs · archived reader</p>
        {/* version selector (SPEC 5.11 topbar variant) */}
        <div className="flex items-center gap-2">
          <label htmlFor="doc-version" className="font-mono text-xs text-faint">
            Version
          </label>
          <select
            id="doc-version"
            value={doc.version}
            onChange={(e) => navigate(`/docs/${e.target.value}/${doc.sections[0].slug}`)}
            className="rounded-lg border px-2.5 py-1 font-mono text-xs text-ink"
            style={{ borderColor: 'var(--line-light)', background: '#151828' }}
          >
            {DOC_VERSIONS.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version}
                {v.version === LATEST_VERSION ? ' (latest)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_220px]">
        {/* sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[84px] max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter sections..."
              className="mb-4 w-full rounded-lg border px-3 py-2 text-sm text-ink outline-none placeholder:text-faint"
              style={{ borderColor: 'var(--line-light)', background: 'rgba(255,255,255,0.03)' }}
            />
            {CATEGORY_ORDER.map((cat) => {
              const items = filtered.filter((s) => s.category === cat);
              if (!items.length) return null;
              const isOpen = query.trim().length > 0 || !collapsed[cat];
              return (
                <div key={cat} className="mb-5">
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [cat]: isOpen }))}
                    aria-expanded={isOpen}
                    className="mb-2 flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.15em] text-faint transition hover:text-muted"
                  >
                    {cat}
                    <span aria-hidden className={'inline-block text-[9px] transition-transform ' + (isOpen ? '' : '-rotate-90')}>
                      ▾
                    </span>
                  </button>
                  {isOpen && (
                  <ul className="space-y-0.5">
                    {items.map((s) => {
                      const isActive = s.slug === active.slug;
                      return (
                        <li key={s.slug}>
                          <Link
                            to={`/docs/${doc.version}/${s.slug}`}
                            className={
                              'block rounded-lg px-3 py-1.5 text-[13px] transition ' +
                              (isActive ? 'text-white' : 'text-muted hover:bg-white/5 hover:text-white')
                            }
                            style={
                              isActive
                                ? { background: 'rgba(139, 92, 246, 0.15)', boxShadow: 'inset 0 0 0 1px rgba(139, 92, 246, 0.4)' }
                                : undefined
                            }
                          >
                            {s.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  )}
                </div>
              );
            })}
            {!filtered.length && <p className="text-sm text-faint">No results for "{query}"</p>}
          </div>
        </aside>

        {/* content */}
        <article className="mx-auto w-full max-w-6xl">
          <nav aria-label="Breadcrumb" className="mono-label mb-3">
            <Link to="/docs" className="normal-case tracking-normal text-muted hover:text-white">
              Docs
            </Link>
            <span className="mx-1.5 text-faint">/</span>
            <Link to={`/docs/${doc.version}`} className="normal-case tracking-normal text-muted hover:text-white">
              v{doc.version}
            </Link>
            <span className="mx-1.5 text-faint">/</span>
            <span className="text-[#a78bfa]">{active.title}</span>
          </nav>
          <p className="mono-label mb-3">{active.category}</p>
          <h1 className="text-[clamp(1.9em,3.6vw,2.6em)] font-extrabold tracking-[-0.02em]">
            <span className="grad-text">{active.title}</span>
          </h1>
          <p className="mt-3 text-[1.04em] leading-[1.75] text-muted">{active.blurb}</p>
          <div className="mt-8 space-y-5">
            {active.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>

          {/* prev/next pagination cards (SPEC 6) */}
          <div className="mt-14 flex justify-between gap-4">
            {prev ? (
              <Link
                to={`/docs/${doc.version}/${prev.slug}`}
                className="flex-1 rounded-xl border p-4 transition hover:-translate-y-0.5"
                style={{ borderColor: 'var(--line-light)', background: 'rgba(255,255,255,0.02)' }}
              >
                <span className="mono-label">← Previous</span>
                <span className="mt-1 block text-sm text-ink2 hover:text-link">{prev.title}</span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}
            {next ? (
              <Link
                to={`/docs/${doc.version}/${next.slug}`}
                className="flex-1 rounded-xl border p-4 text-right transition hover:-translate-y-0.5"
                style={{ borderColor: 'var(--line-light)', background: 'rgba(255,255,255,0.02)' }}
              >
                <span className="mono-label">Next →</span>
                <span className="mt-1 block text-sm text-ink2 hover:text-linkh">{next.title}</span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </div>
        </article>

        {/* TOC: this version's sections */}
        <aside className="hidden xl:block">
          <div className="sticky top-[84px]">
            <p className="grad-text mb-2 font-mono text-[0.68em] font-bold uppercase tracking-[0.14em]">
              v{doc.version} <span className="ml-1 text-faint">{doc.sections.length}</span>
            </p>
            <ul>
              {doc.sections.map((s) => (
                <li key={s.slug}>
                  <Link
                    to={`/docs/${doc.version}/${s.slug}`}
                    aria-current={s.slug === active.slug ? 'location' : undefined}
                    className={'block border-l-2 py-1 pr-2 text-[0.82em] transition ' + (s.slug === active.slug ? 'font-semibold' : 'text-muted hover:text-ink2')}
                    style={
                      s.slug === active.slug
                        ? { borderColor: '#8b5cf6', color: '#d8ccfe', background: 'linear-gradient(90deg, rgba(139,92,246,0.12), transparent)' }
                        : { borderColor: 'var(--line)' }
                    }
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
