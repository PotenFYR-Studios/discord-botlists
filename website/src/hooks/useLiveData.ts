import { useEffect, useState } from 'react';

export interface LiveData {
  downloads: number | null;
  version: string | null;
  lists: number;
  liveLists: number;
}

/** live numbers for hero + badges, fetched from public APIs on mount. */
export function useLiveData(): LiveData {
  const [data, setData] = useState<LiveData>({ downloads: null, version: null, lists: 0, liveLists: 0 });

  useEffect(() => {
    let cancelled = false;

    // npm downloads (last month)
    fetch('https://api.npmjs.org/downloads/point/last-month/@potenfyrstudios%2Fdiscord-botlists')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.downloads === 'number') {
          setData((prev) => ({ ...prev, downloads: d.downloads }));
        }
      })
      .catch(() => undefined);

    // latest npm version
    fetch('https://registry.npmjs.org/@potenfyrstudios%2Fdiscord-botlists/latest')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.version) {
          setData((prev) => ({ ...prev, version: d.version }));
        }
      })
      .catch(() => undefined);

    // status board summary
    fetch('status.json')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.summary) {
          setData((prev) => ({ ...prev, lists: d.entries.length, liveLists: d.summary.live }));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

export function formatNumber(n: number | null): string {
  if (n === null) return '...';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
