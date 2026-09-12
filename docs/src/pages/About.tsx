import { Link } from 'react-router-dom';

export default function About() {
  return (
    <main className="mx-auto max-w-[820px] px-6 pb-20 pt-9">
      <p className="mono-label mb-3">the project</p>
      <h1 className="text-[clamp(1.9em,3.6vw,2.6em)] font-extrabold leading-tight tracking-[-0.02em]">
        <span className="grad-text">About discord-botlists</span>
      </h1>

      <div className="mt-8 space-y-5 leading-[1.75] text-ink2">
        <p>
          <strong className="font-semibold text-ink">discord-botlists</strong> is a zero-dependency
          SDK that connects a Discord bot to every botlist at once. It posts server and shard counts
          in each list's exact wire format, receives votes, comments, reviews and ratings in realtime
          through one hardened webhook server, parses any list API into a single{' '}
          <code className="inline">UniversalBot</code> shape, and tracks the health of every list it
          supports. The registry currently ships 33 verified live lists and is re-audited hourly.
        </p>
        <p>
          The package is installable from npm as{' '}
          <code className="inline">@potenfyrstudios/discord-botlists</code>, runs on Node 18+ and
          Bun, works with discord.js, Eris, Oceanic, any framework (or none at all) and is fully
          typed with strict TypeScript.
        </p>

        <h2 className="border-b pb-[0.35em] pt-6 text-[1.32em] font-bold text-white" style={{ borderColor: 'var(--line)' }}>
          PotenFYR Studios
        </h2>
        <p>
          discord-botlists is built and maintained by{' '}
          <a href="https://potenfyr.in" target="_blank" rel="noopener noreferrer" className="text-link hover:text-linkh underline-offset-3 hover:underline">
            PotenFYR Studios
          </a>
          , an independent studio shipping developer tools and open-source projects. Explore the rest
          of the ecosystem on the{' '}
          <a href="https://github.com/PotenFYR-Studios" target="_blank" rel="noopener noreferrer" className="text-link hover:text-linkh underline-offset-3 hover:underline">
            GitHub organization
          </a>{' '}
          or at{' '}
          <a href="https://potenfyr.in" target="_blank" rel="noopener noreferrer" className="text-link hover:text-linkh underline-offset-3 hover:underline">
            potenfyr.in
          </a>
          .
        </p>

        <h2 className="border-b pb-[0.35em] pt-6 text-[1.32em] font-bold text-white" style={{ borderColor: 'var(--line)' }}>
          Links
        </h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Source:{' '}
            <a href="https://github.com/PotenFYR-Studios/discord-botlists" target="_blank" rel="noopener noreferrer" className="text-link hover:text-linkh underline-offset-3 hover:underline">
              github.com/PotenFYR-Studios/discord-botlists
            </a>
          </li>
          <li>
            Package:{' '}
            <a href="https://www.npmjs.com/package/@potenfyrstudios/discord-botlists" target="_blank" rel="noopener noreferrer" className="text-link hover:text-linkh underline-offset-3 hover:underline">
              npmjs.com/package/@potenfyrstudios/discord-botlists
            </a>
          </li>
          <li>
            Issues and list requests:{' '}
            <a href="https://github.com/PotenFYR-Studios/discord-botlists/issues" target="_blank" rel="noopener noreferrer" className="text-link hover:text-linkh underline-offset-3 hover:underline">
              GitHub Issues
            </a>
          </li>
          <li>
            Support Discord:{' '}
            <a href="https://discord.com/invite/zUaN2FPBec" target="_blank" rel="noopener noreferrer" className="text-link hover:text-linkh underline-offset-3 hover:underline">
              discord.com/invite/zUaN2FPBec
            </a>
          </li>
          <li>
            Registry health: the{' '}
            <Link to="/status" className="text-link hover:text-linkh underline-offset-3 hover:underline">
              live status board
            </Link>
          </li>
        </ul>

        <h2 className="border-b pb-[0.35em] pt-6 text-[1.32em] font-bold text-white" style={{ borderColor: 'var(--line)' }}>
          License &amp; notices
        </h2>
        <p>
          Released under <strong className="font-semibold text-ink">Apache-2.0 with the Commons Clause</strong>:
          fork, modify, use and build around it freely: just don't sell the package itself as a
          product. The{' '}
          <a href="https://github.com/PotenFYR-Studios/discord-botlists/blob/master/LICENSE" target="_blank" rel="noopener noreferrer" className="text-link hover:text-linkh underline-offset-3 hover:underline">
            LICENSE file
          </a>{' '}
          is authoritative.
        </p>
        <p>
          Botlist metadata is collected from public botlist API documentation and the{' '}
          <a href="https://botblock.org" target="_blank" rel="noopener noreferrer" className="text-link hover:text-linkh underline-offset-3 hover:underline">
            BotBlock
          </a>{' '}
          open directory. All botlist names, logos and trademarks belong to their respective owners;
          this project is not affiliated with, endorsed by, or sponsored by any botlist.
        </p>
      </div>
    </main>
  );
}
