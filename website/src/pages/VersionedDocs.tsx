import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DOC_VERSIONS, LATEST_VERSION, type DocBlock, type DocSection } from '../docs/content';

const CATEGORY_ORDER = ['Getting Started', 'Core Concepts', 'Guides', 'API Reference'] as const;

export default function VersionedDocs() {
  const { version } = useParams();
  const navigate = useNavigate();

  // unknown / retired versions (e.g. the old v2.0.0 URLs) redirect to the
  // current docs instead of rendering a blank page.
  const known = DOC_VERSIONS.some((d) => d.version === version);
  useEffect(() => {
    if (version !== undefined && !known) navigate(`/docs/${LATEST_VERSION}`, { replace: true });
  }, [version, known, navigate]);

  const doc = DOC_VERSIONS.find((d) => d.version === version) ?? DOC_VERSIONS[0];
  const [query, setQuery] = useState('');
  const [activeSlug, setActiveSlug] = useState(doc.sections[0].slug);

  // keep the selected section valid when the version changes or a search
  // filters the current section away.
  const validSlugs = useMemo(() => new Set(doc.sections.map((x) => x.slug)), [doc]);
  useEffect(() => {
    if (!validSlugs.has(activeSlug)) setActiveSlug(doc.sections[0].slug);
  }, [validSlugs, activeSlug, doc]);

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

  const active = doc.sections.find((s) => s.slug === activeSlug) ?? filtered[0] ?? doc.sections[0];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {/* version switcher */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-slate-500">Docs version</span>
        {DOC_VERSIONS.map((v) => (
          <button
            key={v.version}
            onClick={() => navigate(`/docs/${v.version}`)}
            className={
              'rounded-lg border px-3 py-1.5 text-sm transition ' +
              (v.version === doc.version
                ? 'border-accent bg-accent/20 text-white'
                : 'border-white/10 text-slate-400 hover:border-white/30') +
              (v.deprecated ? ' line-through opacity-60' : '')
            }
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* sidebar */}
        <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the docs..."
            className="mb-5 w-full rounded-xl border border-white/10 bg-card px-4 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-accent/60"
          />
          {CATEGORY_ORDER.map((cat) => {
            const sections = filtered.filter((s) => s.category === cat);
            if (!sections.length) return null;
            return (
              <div key={cat} className="mb-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">{cat}</p>
                <ul className="space-y-1">
                  {sections.map((s) => (
                    <li key={s.slug}>
                      <button
                        onClick={() => setActiveSlug(s.slug)}
                        className={
                          'w-full rounded-lg px-3 py-2 text-left text-sm transition ' +
                          (s.slug === active.slug
                            ? 'bg-accent/15 font-semibold text-white'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white')
                        }
                      >
                        {s.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!filtered.length && <p className="text-sm text-slate-500">No results for "{query}"</p>}
        </aside>

        {/* content */}
        <article className="min-w-0">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">{active.category}</div>
          <h1 className="text-4xl font-extrabold text-white">{active.title}</h1>
          <p className="mt-2 text-lg text-slate-400">{active.blurb}</p>
          <div className="mt-8 space-y-5">
            {active.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>

          {/* pager */}
          <div className="mt-14 flex justify-between border-t border-white/10 pt-6 text-sm">
            {pager(doc.sections, active.slug, -1) ? (
              <button
                onClick={() => setActiveSlug(pager(doc.sections, active.slug, -1)!.slug)}
                className="text-slate-400 hover:text-accent"
              >
                {pager(doc.sections, active.slug, -1)!.title}
              </button>
            ) : <span />}
            {pager(doc.sections, active.slug, +1) ? (
              <button
                onClick={() => setActiveSlug(pager(doc.sections, active.slug, +1)!.slug)}
                className="font-semibold text-accent hover:underline"
              >
                {pager(doc.sections, active.slug, +1)!.title}
              </button>
            ) : <span />}
          </div>
        </article>
      </div>
    </main>
  );
}

function pager(sections: DocSection[], current: string, dir: -1 | 1): DocSection | null {
  const idx = sections.findIndex((s) => s.slug === current);
  const next = sections[idx + dir];
  return next ?? null;
}

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case 'text':
      return <p className="leading-relaxed text-slate-300">{block.content}</p>;
    case 'h3':
      return <h3 className="pt-3 text-xl font-bold text-white">{block.content}</h3>;
    case 'code':
      return <CodeBlock title={block.title} content={block.content} lang={block.lang} />;
    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-card text-slate-400">
              <tr>
                {block.headers.map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-t border-white/5">
                  {row.map((cell, j) => (
                    <td key={j} className={'px-4 py-2.5 ' + (j === 0 ? 'font-mono text-xs text-accent' : 'text-slate-300')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'list':
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-slate-300">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'note':
      return (
        <div
          className={
            'rounded-xl border-l-4 bg-card px-5 py-4 text-sm ' +
            (block.tone === 'warn'
              ? 'border-amber-400 text-amber-100'
              : block.tone === 'tip'
                ? 'border-emerald-400 text-emerald-100'
                : 'border-accent text-slate-200')
          }
        >
          {block.content}
        </div>
      );
  }
}


function CodeBlock({ title, content, lang }: { title?: string; content: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(content).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#161a23] px-4 py-2">
        <span className="font-mono text-xs text-slate-500">{title ?? lang}</span>
        <button onClick={copy} className="text-xs text-slate-400 transition hover:text-accent">
          {copied ? 'copied!' : 'copy'}
        </button>
      </div>
      <pre className="max-h-[32rem] overflow-auto bg-[#0d1017] p-4 text-sm leading-relaxed">
        <code className="font-mono text-slate-300">{content}</code>
      </pre>
    </div>
  );
}
