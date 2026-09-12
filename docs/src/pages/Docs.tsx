import { useEffect, useMemo, useRef, useState } from 'react';
import { CURRENT_DOC, LATEST_VERSION } from '../docs/content';
import { Block } from '../components/DocBlocks';
import Palette from '../components/Palette';

/** sidebar groups: 2-3 headers max (SPEC 5.10) */
const GROUPS: { title: string; match: (category: string) => boolean }[] = [
  { title: 'Get started', match: (c) => c === 'Getting Started' },
  { title: 'Core topics', match: (c) => c === 'Core Concepts' },
  { title: 'Guides & reference', match: (c) => c === 'Guides' || c === 'API Reference' },
];

export default function Docs() {
  const sections = CURRENT_DOC.sections;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeSlug, setActiveSlug] = useState(sections[0].slug);
  const headingRefs = useRef<Record<string, HTMLElement | null>>({});

  // ⌘K / Ctrl+K opens the palette (SPEC 5.12)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // TOC scroll-spy (SPEC 6: IntersectionObserver, h2 level)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSlug(entry.target.id);
        }
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    for (const el of Object.values(headingRefs.current)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({ title: g.title, items: sections.filter((s) => g.match(s.category)) })).filter(
        (g) => g.items.length,
      ),
    [sections],
  );

  return (
    <main className="mx-auto max-w-[1400px] px-5 pb-20 pt-9 sm:px-7">
      <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* breadcrumb eyebrow (SPEC 5.11) */}
      <p className="mono-label mb-3">
        discord-botlists docs · v{LATEST_VERSION} ·{' '}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="normal-case tracking-normal text-link hover:text-linkh"
          aria-label="Open search palette"
        >
          Search ⌘K
        </button>
      </p>
      <h1 className="text-[clamp(1.9em,3.6vw,2.6em)] font-extrabold leading-tight tracking-[-0.02em]">
        <span className="grad-text">Documentation</span>
      </h1>
      <p className="mt-3 max-w-[720px] text-[1.04em] leading-[1.75] text-muted">
        Every feature, scenario and type: straight from the SDK surface. Or press{' '}
        <kbd className="inline border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-muted">⌘K</kbd>{' '}
        to jump anywhere.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)_220px]">
        {/* sidebar (SPEC 5.10) */}
        <aside className="hidden lg:block">
          <div className="sticky top-[84px] max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
            {groups.map((g) => {
              const isOpen = !collapsed[g.title];
              return (
                <div key={g.title} className="mb-6">
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [g.title]: isOpen }))}
                    aria-expanded={isOpen}
                    className="mb-2 flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.15em] text-faint transition hover:text-muted"
                  >
                    {g.title}
                    <span aria-hidden className={'inline-block text-[9px] transition-transform ' + (isOpen ? '' : '-rotate-90')}>
                      ▾
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="space-y-0.5 border-l border-white/[0.05]">
                  {g.items.map((s) => (
                    <li key={s.slug}>
                      <a
                        href={`#${s.slug}`}
                        className="block rounded-lg px-3 py-1.5 text-[13px] text-muted transition hover:bg-white/5 hover:text-white"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* content column, full org docs width (fix round 2: 1152px) */}
        <article className="mx-auto w-full max-w-6xl">
          {sections.map((section) => (
            <section key={section.slug} id={section.slug} className="mb-14">
              <h2
                ref={(el) => {
                  headingRefs.current[section.slug] = el;
                }}
                className="mb-2 border-b pb-[0.35em] text-[1.32em] font-bold tracking-[-0.015em] text-white"
                style={{ borderColor: 'var(--line)', scrollMarginTop: '76px' }}
              >
                {section.title}
              </h2>
              <p className="mb-6 text-sm text-faint">{section.blurb}</p>
              <div className="space-y-5">
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
            </section>
          ))}
        </article>

        {/* TOC right rail (SPEC 5.9) */}
        <aside className="hidden xl:block">
          <div className="sticky top-[84px] max-h-[calc(100vh-140px)] overflow-y-auto">
            <p className="grad-text mb-2 font-mono text-[0.68em] font-bold uppercase tracking-[0.14em]">
              On this page <span className="ml-1 text-faint">{sections.length}</span>
            </p>
            <ul>
              {sections.map((s) => (
                <li key={s.slug}>
                  <a
                    href={`#${s.slug}`}
                    aria-current={activeSlug === s.slug ? 'location' : undefined}
                    className={'block border-l-2 py-1 pr-2 text-[0.82em] transition ' + (activeSlug === s.slug ? 'font-semibold' : 'text-muted hover:text-ink2')}
                    style={
                      activeSlug === s.slug
                        ? { borderColor: '#8b5cf6', color: '#d8ccfe', background: 'linear-gradient(90deg, rgba(139,92,246,0.12), transparent)' }
                        : { borderColor: 'var(--line)' }
                    }
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
