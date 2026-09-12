export default function License() {
  return (
    <main className="mx-auto max-w-[820px] px-6 pb-20 pt-9">
      <p className="mono-label mb-3">discord-botlists · legal</p>
      <h1 className="text-[clamp(1.9em,3.6vw,2.6em)] font-extrabold leading-tight tracking-[-0.02em]">
        <span className="grad-text">License</span>
      </h1>
      <p className="mt-3 text-[1.04em] leading-[1.75] text-muted">
        discord-botlists is released under the Apache License 2.0 with the Commons Clause. In plain
        terms: the SDK is free for almost everything. The one thing you cannot do is sell the SDK
        itself.
      </p>

      <h2 className="mb-3 mt-10 border-b pb-[0.35em] text-[1.32em] font-bold tracking-[-0.015em] text-white" style={{ borderColor: 'var(--line)' }}>
        What you can do
      </h2>
      <ul className="space-y-2 text-[1.02em] leading-[1.7] text-ink2">
        <li>Use it in any project, personal or commercial, at any scale, forever.</li>
        <li>Fork it, modify it, and ship your changes under the same license.</li>
        <li>Build products, services and businesses on top of it, paid or free.</li>
        <li>Self-host it and redistribute your copies.</li>
        <li>Bundle it into closed-source applications; the Apache-2.0 terms cover that.</li>
      </ul>

      <h2 className="mb-3 mt-10 border-b pb-[0.35em] text-[1.32em] font-bold tracking-[-0.015em] text-white" style={{ borderColor: 'var(--line)' }}>
        What you cannot do
      </h2>
      <ul className="space-y-2 text-[1.02em] leading-[1.7] text-ink2">
        <li>
          Sell the software itself: offering <code className="inline">@potenfyrstudios/discord-botlists</code> (or a
          fork of it) as a paid product.
        </li>
        <li>
          Charge for a product or service whose value comes entirely or substantially from the
          functionality of the SDK. That is the Commons Clause, and it is the only restriction.
        </li>
        <li>
          Use PotenFYR Studios names, logos or project branding in ways that imply endorsement.
          See <a className="text-link hover:text-linkh" href="https://github.com/PotenFYR-Studios/discord-botlists/blob/master/NOTICE.md" target="_blank" rel="noopener noreferrer">NOTICE.md</a> for
          trademark ownership, including the botlist names.
        </li>
      </ul>

      <h2 className="mb-3 mt-10 border-b pb-[0.35em] text-[1.32em] font-bold tracking-[-0.015em] text-white" style={{ borderColor: 'var(--line)' }}>
        Keep the notices
      </h2>
      <p className="text-[1.02em] leading-[1.7] text-ink2">
        Copies and substantial extracts must carry the Apache-2.0 license text and the Commons
        Clause notice. That attribution line is the whole catch; keep it and you are fine.
      </p>

      <h2 className="mb-3 mt-10 border-b pb-[0.35em] text-[1.32em] font-bold tracking-[-0.015em] text-white" style={{ borderColor: 'var(--line)' }}>
        The document that rules
      </h2>
      <p className="text-[1.02em] leading-[1.7] text-ink2">
        This page is a summary for humans, not legal advice. The{' '}
        <a className="text-link hover:text-linkh" href="https://github.com/PotenFYR-Studios/discord-botlists/blob/master/LICENSE" target="_blank" rel="noopener noreferrer">LICENSE file in the repo</a> is
        the authoritative document; where this page and the LICENSE disagree, the LICENSE wins.
      </p>
    </main>
  );
}
