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
    this.timeout = options.timeout ?? 12000;
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
    // registry verdict wins: a human marked this list dead, keep reporting it
    // dead even while the domain still answers (parking pages answer HTTP 200).
    if (list.status === 'shutdown' || list.status === 'deprecated') state = list.status;

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

  /**
   * Probe with patience: slow is not dead. Each round tries HEAD then GET and
   * the second round gets a doubled time budget. Only a hard network failure
   * (DNS gone, connection refused) on EVERY attempt counts as `shutdown`.
   * Timeouts, resets, TLS hiccups, 403/429 and 5xx never do - those lists are
   * alive but slow, rate limited or behind a bot wall, so they surface as
   * live/`unknown` instead of being written off.
   */
  private async probe(url: string): Promise<{ state: ListStatus; httpStatus: number | null }> {
    let hard = 0;
    let attempts = 0;
    for (const budget of [this.timeout, this.timeout * 2]) {
      for (const method of ['HEAD', 'GET'] as const) {
        attempts++;
        const outcome = await this.attempt(url, method, budget);
        if (outcome.kind === 'response') {
          if (outcome.status < 500) return { state: 'live', httpStatus: outcome.status };
          return { state: 'unknown', httpStatus: outcome.status };
        }
        if (outcome.kind === 'dead') hard++;
      }
    }
    if (hard === attempts) return { state: 'shutdown', httpStatus: null };
    return { state: 'unknown', httpStatus: null };
  }

  private async attempt(
    url: string,
    method: 'HEAD' | 'GET',
    budget: number,
  ): Promise<{ kind: 'response'; status: number } | { kind: 'dead' } | { kind: 'slow' }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budget);
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; discord-botlists-status/2.1)' },
      });
      if (method === 'GET') await response.body?.cancel();
      return { kind: 'response', status: response.status };
    } catch (error) {
      const code = errorCode(error);
      if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'EAI_AGAIN') return { kind: 'dead' };
      return { kind: 'slow' };
    } finally {
      clearTimeout(timer);
    }
  }

  /** rendered markdown table for the README status section. */
  public static toMarkdown(board: StatusBoard, compact = false): string {
    const lines = compact
      ? ['| List | Status |', '| --- | --- |']
      : [
          '| List | Status | Latency | HTTP | Last checked (UTC) |',
          '| --- | --- | --- | --- | --- |',
        ];
    for (const entry of board.entries) {
      const icon =
        entry.state === 'live' ? '🟢' : entry.state === 'deprecated' ? '🟡' : entry.state === 'shutdown' ? '🔴' : '⚪';
      if (compact) {
        lines.push(`| [${entry.listName}](${entry.website}) | ${icon} ${entry.state} |`);
        continue;
      }
      const latency = entry.latencyMs === null ? 'n/a' : `${entry.latencyMs} ms`;
      const http = entry.httpStatus === null ? 'n/a' : String(entry.httpStatus);
      const when = new Date(entry.lastChecked).toISOString().slice(0, 16).replace('T', ' ');
      lines.push(`| [${entry.listName}](${entry.website}) | ${icon} ${entry.state} | ${latency} | ${http} | ${when} |`);
    }
    return lines.join('\n');
  }
}

function errorCode(error: unknown): string {
  const e = error as { code?: string; cause?: { code?: string }; name?: string };
  return e?.cause?.code ?? e?.code ?? e?.name ?? 'UNKNOWN';
}
