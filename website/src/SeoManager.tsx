import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const META: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'discord-botlists: One SDK for every Discord botlist | Votes, Stats, Webhooks',
    description: 'Post stats to 33 verified live Discord botlists, receive realtime vote webhooks, parse any list into one shape. Zero dependencies, fully typed, Node 18+ and Bun.',
  },
  '/docs': {
    title: 'Documentation | discord-botlists',
    description: 'Every feature and scenario: posting stats, realtime vote webhooks, universal parser, status checking, custom lists and the full API reference.',
  },
  '/status': {
    title: 'Live botlist status board | discord-botlists',
    description: 'Hourly probes of every Discord botlist: live, deprecated, shutdown states with latency. Dead lists are pruned automatically.',
  },
};

export default function SeoManager() {
  const location = useLocation();
  useEffect(() => {
    const base = location.pathname.split('/').slice(0, 2).join('/') || '/';
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
