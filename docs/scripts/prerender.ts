// Static generation for every route: each page is rendered to real HTML so
// direct refreshes, crawlers and no-JS visitors get content on first response.
// Runs after `vite build`; no extra dependencies (vite + react-dom only).
import { createServer } from "vite";
import { renderToString } from "react-dom/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { DocVersion } from "../src/docs/content";

const e = React.createElement;

const CANON = "https://botlists.docs.potenfyr.in";

interface Page {
  path: string;
  file: string;
  title: string;
  description: string;
}

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

// doc versions/sections are resolved from content data, so new versions and
// sections are emitted automatically on the next build.
const content = (await vite.ssrLoadModule("/src/docs/content")) as {
  DOC_VERSIONS: DocVersion[];
  LATEST_VERSION: string;
};
const DOC_VERSIONS = content.DOC_VERSIONS;
const LATEST_VERSION = content.LATEST_VERSION;
const LATEST = DOC_VERSIONS.find((v) => v.version === LATEST_VERSION) ?? DOC_VERSIONS[0];

const pages: Page[] = [
  {
    path: "/",
    file: "index.html",
    title: "discord-botlists: One SDK for every Discord botlist",
    description:
      "Post stats to 33 verified live Discord botlists, receive realtime vote webhooks with zero delay, and parse every list into one shape. Zero dependencies.",
  },
  {
    path: "/docs",
    file: "docs/index.html",
    title: "Documentation | discord-botlists",
    description:
      "Every feature and scenario: posting stats, realtime vote webhooks, webhook security, the universal parser, custom lists and the full API reference.",
  },
  {
    path: "/examples",
    file: "examples/index.html",
    title: "Examples | discord-botlists",
    description:
      "Real recipes for the discord-botlists SDK: reward voters, post stats from any framework, ingest webhooks in Express, read bot data, monitor list health.",
  },
  {
    path: "/status",
    file: "status/index.html",
    title: "Live botlist status board | discord-botlists",
    description:
      "Hourly probes of every Discord botlist: live, deprecated, shutdown states with latency. Dead lists are pruned automatically.",
  },
  {
    path: "/about",
    file: "about/index.html",
    title: "About | discord-botlists",
    description:
      "discord-botlists is a zero-dependency multi-botlist SDK by PotenFYR Studios: stats posting, realtime vote webhooks and a universal parser for 33 live lists.",
  },
  {
    path: "/license",
    file: "license/index.html",
    title: "License | discord-botlists",
    description: "discord-botlists is Apache-2.0 with the Commons Clause: free to use, fork and build around, even commercially. Only reselling the SDK is off limits.",
  },
];

// one reader page per version
for (const v of DOC_VERSIONS) {
  pages.push({
    path: `/docs/${v.version}`,
    file: `docs/${v.version}/index.html`,
    title: `v${v.version} documentation | discord-botlists`,
    description: `discord-botlists v${v.version} documentation: stats posting, realtime vote webhooks, universal parser, status checking and the full API reference.`,
  });
  // and one per section so deep links serve real HTML
  for (const s of v.sections) {
    pages.push({
      path: `/docs/${v.version}/${s.slug}`,
      file: `docs/${v.version}/${s.slug}/index.html`,
      title: `${s.title} (v${v.version}) | discord-botlists docs`,
      description: `${s.blurb} Full discord-botlists v${v.version} documentation.`,
    });
  }
}

// react-router warns about useLayoutEffect during SSR; harmless here (static
// snapshot, client re-renders fresh), so keep output clean.
const origError = console.error;
console.error = (...args: unknown[]) => {
  if (String(args[0]).includes("useLayoutEffect")) return;
  origError(...args);
};

try {
  // Load the layout and pages (NOT src/main.tsx - it calls createRoot at
  // import time, which has no DOM in Node) and mirror its route table.
  const { default: App } = await vite.ssrLoadModule("/src/App.tsx");
  const { default: Home } = await vite.ssrLoadModule("/src/pages/Home.tsx");
  const { default: Docs } = await vite.ssrLoadModule("/src/pages/Docs.tsx");
  const { default: VersionedDocs } = await vite.ssrLoadModule("/src/pages/VersionedDocs.tsx");
  const { default: Status } = await vite.ssrLoadModule("/src/pages/Status.tsx");
  const { default: Examples } = await vite.ssrLoadModule("/src/pages/Examples.tsx");
  const { default: About } = await vite.ssrLoadModule("/src/pages/About.tsx");
  const { default: License } = await vite.ssrLoadModule("/src/pages/License.tsx");

  // fileURLToPath, not URL#pathname: pathname keeps %20-style escapes and this
  // checkout may live under a path with spaces.
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
  const shell = await readFile(resolve(dist, "index.html"), "utf8");
  if (!shell.includes('<div id="root"></div>')) {
    throw new Error("root div placeholder not found in dist/index.html");
  }

  for (const page of pages) {
    const html = renderToString(
      e(React.StrictMode, null,
        e(MemoryRouter, { initialEntries: [page.path] },
          e(Routes, null,
            e(Route, { path: "/", element: e(App) },
              e(Route, { index: true, element: e(Home) }),
              e(Route, { path: "docs", element: e(Docs) }),
              e(Route, { path: "docs/:version", element: e(VersionedDocs) }),
              e(Route, { path: "docs/:version/:section", element: e(VersionedDocs) }),
              e(Route, { path: "examples", element: e(Examples) }),
              e(Route, { path: "status", element: e(Status) }),
              e(Route, { path: "about", element: e(About) }),
              e(Route, { path: "license", element: e(License) })
            )
          )
        )
      )
    );

    const canon = `${CANON}${page.path === "/" ? "/" : `${page.path}/`}`;
    let out = shell.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
    out = out
      .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
      .replace(
        /<meta name="description" content="[^"]*"/,
        `<meta name="description" content="${page.description.replace(/"/g, "&quot;")}"`
      )
      .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${canon}"`)
      .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${canon}"`);

    const target = resolve(dist, page.file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, out);
  }

  // sitemap from the same route table so it can never drift from what is
  // actually emitted; directory (trailing-slash) URLs, the canonical form.
  const seo = (path: string): { changefreq: string; priority: string } => {
    if (path === "/") return { changefreq: "weekly", priority: "1.0" };
    if (path === "/docs") return { changefreq: "weekly", priority: "0.9" };
    if (path === "/status") return { changefreq: "hourly", priority: "0.6" };
    if (path === "/examples") return { changefreq: "monthly", priority: "0.7" };
    if (path === "/about") return { changefreq: "monthly", priority: "0.4" };
    if (path === `/docs/${LATEST.version}`) return { changefreq: "weekly", priority: "0.6" };
    if (/^\/docs\/\d+\.\d+\.\d+$/.test(path)) return { changefreq: "monthly", priority: "0.3" };
    if (path.startsWith(`/docs/${LATEST.version}/`)) return { changefreq: "weekly", priority: "0.6" };
    return { changefreq: "monthly", priority: "0.5" }; // older version sections
  };
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages
      .map((p) => {
        const { changefreq, priority } = seo(p.path);
        const loc = `${CANON}${p.path === "/" ? "/" : `${p.path}/`}`;
        return `  <url><loc>${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
      })
      .join("\n") +
    `\n</urlset>\n`;
  await writeFile(resolve(dist, "sitemap.xml"), sitemap);

  await vite.close();
  console.log(`[prerender] ${pages.length} routes + sitemap rendered to ${dist} (latest docs v${LATEST.version})`);
} catch (err) {
  await vite.close();
  throw err;
}
