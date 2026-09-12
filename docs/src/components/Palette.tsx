import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DOC_VERSIONS, LATEST_VERSION, type DocSection } from '../docs/content';

interface PaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ⌘K command palette (SPEC 5.12): searches every docs section across every
 * version, arrow keys + Enter navigate, Esc closes. Rows jump to the
 * per-section reader pages, which are all statically emitted.
 */
export default function Palette({ open, onClose }: PaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(
    () =>
      DOC_VERSIONS.flatMap((v) =>
        v.sections.map((s: DocSection) => ({ version: v.version, latest: v.version === LATEST_VERSION, section: s })),
      ),
    [],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? index.filter(
          (e) =>
            e.section.title.toLowerCase().includes(q) ||
            e.section.blurb.toLowerCase().includes(q) ||
            e.section.slug.includes(q),
        )
      : index.filter((e) => e.latest);
    return matches.slice(0, 14);
  }, [index, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // autofocus after the overlay mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open) return null;

  const jump = (version: string, slug: string) => {
    onClose();
    navigate(`/docs/${version}/${slug}`);
  };

  return (
    <div
      className="fixed inset-0 z-[100] pt-28 backdrop-blur-sm"
      style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
        style={{ border: '1px solid var(--line)', background: '#101320' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            }
            if (e.key === 'Enter' && results[cursor]) {
              jump(results[cursor].version, results[cursor].section.slug);
            }
          }}
          placeholder="Search the docs..."
          className="w-full border-b px-4 py-3.5 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          style={{ borderColor: 'var(--line-light)' }}
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {results.map((e, i) => (
            <button
              key={`${e.version}/${e.section.slug}`}
              onClick={() => jump(e.version, e.section.slug)}
              onMouseEnter={() => setCursor(i)}
              className={
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition ' +
                (i === cursor ? 'bg-[rgba(139,92,246,0.15)] text-white' : 'text-ink2 hover:bg-white/5')
              }
            >
              <span className="font-mono text-[10px] text-faint">§</span>
              <span className="flex-1 truncate">{e.section.title}</span>
              <span className="font-mono text-[10px] text-faint">
                {e.latest ? `v${e.version}` : `archived v${e.version}`}
              </span>
            </button>
          ))}
          {!results.length && <p className="px-3 py-6 text-center text-sm text-faint">No matching sections.</p>}
        </div>
        <div className="border-t px-4 py-2 font-mono text-[10px] text-faint" style={{ borderColor: 'var(--line-light)' }}>
          ↑↓ navigate · Enter open · Esc close
        </div>
      </div>
    </div>
  );
}
