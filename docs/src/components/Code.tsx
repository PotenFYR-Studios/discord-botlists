import { useState, type ReactNode } from 'react';

interface CodeBlockProps {
  content: string;
  lang?: string;
  title?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * SPEC 5.8 code block: panel background, violet hairline, mono language tag
 * top-right and a hover-revealed copy button that flips to "Copied!".
 */
export default function Code({ content, lang = 'ts', title, className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(content).then(done, () => undefined);
    } else {
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    }
  };

  return (
    <div className={className}>
      {title && <p className="mb-1.5 font-mono text-xs text-faint">{title}</p>}
      <pre className="spec-pre" data-lang={lang}>
        <code>{content}</code>
        <button type="button" className={`copy-btn${copied ? ' ok' : ''}`} onClick={copy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </pre>
    </div>
  );
}
