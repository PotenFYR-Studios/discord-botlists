import type { DocBlock } from '../docs/content';
import Code from './Code';

/** shared renderer for the markdown-ish DocBlock list used by every docs page. */
export function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case 'text':
      return <p className="leading-[1.75] text-ink2">{block.content}</p>;
    case 'h3':
      return <h3 className="pt-3 text-[1.1em] font-bold text-white">{block.content}</h3>;
    case 'code':
      return <Code content={block.content} lang={block.lang} title={block.title} />;
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="spec-table">
            <thead>
              <tr>
                {block.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={j === 0 ? 'font-mono text-xs' : undefined}>
                      {j === 0 ? <code className="inline">{cell}</code> : cell}
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
        <ul className="list-disc space-y-1.5 pl-5 text-ink2">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'note': {
      const tones = {
        info: { border: 'rgba(139, 92, 246, 0.45)', bg: 'rgba(139, 92, 246, 0.08)', color: '#d8ccfe' },
        warn: { border: 'rgba(245, 158, 11, 0.3)', bg: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' },
        tip: { border: 'rgba(16, 185, 129, 0.3)', bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399' },
      } as const;
      const t = tones[block.tone];
      return (
        <div
          className="rounded-xl px-5 py-4 text-sm text-ink2"
          style={{ borderLeft: `3px solid ${t.border}`, background: t.bg }}
        >
          <span className="mono-label mr-2" style={{ color: t.color }}>
            {block.tone === 'warn' ? 'Note' : block.tone === 'tip' ? 'Tip' : 'Info'}
          </span>
          {block.content}
        </div>
      );
    }
  }
}
