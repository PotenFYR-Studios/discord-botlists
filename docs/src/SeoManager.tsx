import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const META: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'discord-botlists: One SDK for every Discord botlist | Votes, Stats, Webhooks',
    description: 'Post stats to 33 verified live Discord botlists, receive realtime vote webhooks with zero delay, and parse every list into one shape. Zero dependencies.',
  },
  '/docs': {
    title: 'Documentation | discord-botlists',
    description: 'Every feature and scenario: posting stats, realtime vote webhooks, webhook security, the universal parser, custom lists and the full API reference.',
  },
  '/examples': {
    title: 'Examples | discord-botlists',
    description: 'Real recipes for the discord-botlists SDK: reward voters, post stats from any framework, ingest webhooks in Express, read bot data, monitor list health.',
  },
  '/status': {
    title: 'Live botlist status board | discord-botlists',
    description: 'Hourly probes of every Discord botlist: live, deprecated, shutdown states with latency. Dead lists are pruned automatically.',
  },
  '/about': {
    title: 'About | discord-botlists',
    description: 'discord-botlists is a zero-dependency multi-botlist SDK by PotenFYR Studios: stats posting, realtime vote webhooks and a universal parser for 33 live lists.',
  },
  '/license': {
    title: 'License | discord-botlists',
    description: 'discord-botlists is Apache-2.0 with the Commons Clause: free to use, fork and build around, even commercially. Only reselling the SDK is off limits.',
  },
};

export default function SeoManager() {
  const location = useLocation();
  useEffect(() => {
    // custom domain: swap every absolute url to the live origin automatically.
    const GH = 'https://potenfyr-studios.github.io';
    if (!window.location.origin.startsWith(GH)) {
      const selectors = [
        'link[rel="canonical"]',
        'meta[property="og:url"]',
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
      ];
      for (const selector of selectors) {
        const tag = document.querySelector(selector);
        const attr = selector.startsWith('link') ? 'href' : 'content';
        if (tag) {
          const current = tag.getAttribute('href') ?? tag.getAttribute('content') ?? '';
          if (current.startsWith(GH)) {
            tag.setAttribute(attr, current.replace(GH, window.location.origin));
          }
        }
      }
    }
    // first path segment decides the page: /docs/1.0.1/introduction -> /docs
    const base = '/' + (location.pathname.split('/').filter(Boolean)[0] ?? '');
    const meta = META[base] ?? META['/'];
    document.title = meta.title;
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', meta.description);
  }, [location.pathname]);
  return null;
}
