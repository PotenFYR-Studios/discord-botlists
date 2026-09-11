// Custom static generation: renders the home route to static HTML so
// crawlers and no-JS visitors get real content in the initial response.
// The site is hash-routed, so "/" is the only server-visible URL to render.
// Runs after `vite build`; no extra dependencies (vite + react-dom only).
import { createServer } from "vite";
import { renderToString } from "react-dom/server";
import { readFile, writeFile } from "node:fs/promises";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const e = React.createElement;

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

// react-router's NavLink warns about useLayoutEffect during SSR; harmless
// here (static snapshot, client re-renders fresh), so keep output clean.
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

  const html = renderToString(
    e(React.StrictMode, null,
      e(MemoryRouter, { initialEntries: ["/"] },
        e(Routes, null,
          e(Route, { path: "/", element: e(App) },
            e(Route, { index: true, element: e(Home) }),
            e(Route, { path: "docs", element: e(Docs) }),
            e(Route, { path: "docs/:version", element: e(VersionedDocs) }),
            e(Route, { path: "docs/:version/:section", element: e(VersionedDocs) }),
            e(Route, { path: "status", element: e(Status) })
          )
        )
      )
    )
  );
  await vite.close();

  const dist = decodeURIComponent(new URL("../dist/index.html", import.meta.url).pathname);
  const file = await readFile(dist, "utf8");
  if (!file.includes('<div id="root"></div>')) {
    throw new Error("root div placeholder not found in dist/index.html");
  }
  await writeFile(dist, file.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
  console.log(`[prerender] home route rendered to dist/index.html (${html.length} bytes)`);
} catch (err) {
  await vite.close();
  throw err;
}
