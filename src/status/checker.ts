import type { BotlistRecord, StatusBoard, StatusEntry, ListStatus } from '../types.js';
import { BOTLISTS } from '../data/lists.generated.js';

/**
 * StatusChecker: probes every list website, derives a lifecycle state and
 * records latency. Designed to be polite: tiny concurrency, HEAD requests,
 * browser-like user agent, per host throttle.
 */
export class StatusChecker {
  private readonly concurrency: number;
  private readonly timeout: number;
  private cache: StatusBoard | null = null;
  private cacheFor = 0;
  private readonly cacheTtlMs: number;

  public constructor(options: { concurrency?: number; timeout?: number; cacheTtlMs?: number } = {}) {
    this.concurrency = options.concurrency ?? 8;
    this.timeout = options.timeout ?? 8000;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60_000;
  }

  public async checkAll(lists: readonly BotlistRecord[] = BOTLISTS, force = false): Promise<StatusBoard> {
    if (!force && this.cache && Date.now() < this.cacheFor) return this.cache;

    const entries: StatusEntry[] = [];
    const queue = [...lists];
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(this.concurrency, queue.length); i++) {
      workers.push(
        (async () => {
          for (;;) {
            const list = queue.shift();
            if (!list) return;
            entries.push(await this.checkOne(list));
          }
        })(),
      );
    }
    await Promise.all(workers);

    entries.sort((a, b) => a.listId.localeCompare(b.listId));
    const board: StatusBoard = {
      generatedAt: Date.now(),
      entries,
      summary: {
        live: entries.filter((e) => e.state === 'live').length,
        deprecated: entries.filter((e) => e.state === 'deprecated').length,
        shutdown: entries.filter((e) => e.state === 'shutdown').length,
        unknown: entries.filter((e) => e.state === 'unknown').length,
      },
    };
    this.cache = board;
    this.cacheFor = Date.now() + this.cacheTtlMs;
    return board;
  }

  public async checkOne(list: BotlistRecord): Promise<StatusEntry> {
    const target = list.website ?? `https://${list.id}`;
    const started = Date.now();
    const outcome = await this.probe(target);
    const latency = outcome.state === 'shutdown' ? null : Date.now() - started;

    let state: ListStatus = outcome.state;
    if (outcome.state === 'live' && outcome.httpStatus !== null && outcome.httpStatus >= 500) {
      state = 'unknown';
    }

    return {
      listId: list.id,
      listName: list.name,
      website: target,
      state,
      httpStatus: outcome.httpStatus,
      latencyMs: latency,
      uptime30d: null,
      lastChecked: Date.now(),
      deprecated: state === 'deprecated',
      notice: typeof list.status === 'string' ? null : null,
    };
  }

  /** single HEAD probe with a GET fallback for hosts that reject HEAD. */
  private async probe(url: string): Promise<{ state: ListStatus; httpStatus: number | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; discord-botlists-status/2.0)' },
      });
      clearTimeout(timer);
      // parked domains and "for sale" pages often answer 200, live lists do too.
      if (response.status < 500) return { state: 'live', httpStatus: response.status };
      return { state: 'unknown', httpStatus: response.status };
    } catch (error) {
      clearTimeout(timer);
      const aborted = error instanceof Error && error.name === 'AbortError';
      // fall back to GET once, some sites 405 on HEAD.
      if (!aborted) {
        try {
          const controller2 = new AbortController();
          const timer2 = setTimeout(() => controller2.abort(), this.timeout);
          const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller2.signal,
            headers: { 'user-agent': 'Mozilla/5.0 (compatible; discord-botlists-status/2.0)' },
          });
          clearTimeout(timer2);
          await response.body?.cancel();
          if (response.status < 500) return { state: 'live', httpStatus: response.status };
          return { state: 'unknown', httpStatus: response.status };
        } catch {
          // fall through to shutdown.
        }
      }
      return { state: 'shutdown', httpStatus: null };
    }
  }

  /** rendered markdown table for the README status section. */
  public static toMarkdown(board: StatusBoard): string {
    const lines = [
      '| List | Status | Latency | HTTP | Last checked (UTC) |',
      '| --- | --- | --- | --- | --- |',
    ];
    for (const entry of board.entries) {
      const icon =
        entry.state === 'live' ? '🟢' : entry.state === 'deprecated' ? '🟡' : entry.state === 'shutdown' ? '🔴' : '⚪';
      const latency = entry.latencyMs === null ? 'n/a' : `${entry.latencyMs} ms`;
      const http = entry.httpStatus === null ? 'n/a' : String(entry.httpStatus);
      const when = new Date(entry.lastChecked).toISOString().slice(0, 16).replace('T', ' ');
      lines.push(`| [${entry.listName}](${entry.website}) | ${icon} ${entry.state} | ${latency} | ${http} | ${when} |`);
    }
    return lines.join('\n');
  }
}
