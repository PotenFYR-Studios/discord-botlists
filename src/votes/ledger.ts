import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { UniversalVote } from '../types.js';

/** Everything the ledger remembers about one voter. */
export interface VoterRecord {
  userId: string;
  total: number;
  /** per list: last vote time (epoch ms) and vote count. */
  lists: Record<string, { last: number; count: number }>;
  /** UTC day numbers (epoch ms / 86_400_000) with at least one vote, newest last, capped. */
  days: number[];
  /** epoch ms of the newest vote a reward was already handed out for. */
  claimedUpTo: number;
}

/** Storage backend. Implement it for redis/sqlite/postgres; sync or async. */
export interface VoteStore {
  get(userId: string): VoterRecord | undefined | Promise<VoterRecord | undefined>;
  set(userId: string, record: VoterRecord): void | Promise<void>;
  all(): Iterable<VoterRecord> | Promise<Iterable<VoterRecord>>;
}

export class MemoryVoteStore implements VoteStore {
  protected readonly map = new Map<string, VoterRecord>();
  public get(userId: string): VoterRecord | undefined {
    return this.map.get(userId);
  }
  public set(userId: string, record: VoterRecord): void {
    this.map.set(userId, record);
  }
  public all(): Iterable<VoterRecord> {
    return this.map.values();
  }
}

/**
 * JSON file store: loaded once, written atomically (tmp + rename), debounced
 * so a burst of votes is one write. Good up to tens of thousands of voters;
 * bring your own VoteStore beyond that.
 */
export class FileVoteStore extends MemoryVoteStore {
  private timer: ReturnType<typeof setTimeout> | null = null;

  public constructor(private readonly path: string, private readonly debounceMs = 500) {
    super();
    try {
      const data = JSON.parse(readFileSync(path, 'utf8')) as VoterRecord[];
      for (const record of data) this.map.set(record.userId, record);
    } catch {
      // first run or unreadable file: start empty.
    }
  }

  public override set(userId: string, record: VoterRecord): void {
    super.set(userId, record);
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
    this.timer.unref?.();
  }

  /** write now (also call this on shutdown). */
  public flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify([...this.map.values()]));
    renameSync(tmp, this.path);
  }
}

export interface VoteLedgerOptions {
  store?: VoteStore;
  /** count webhook test deliveries as votes. default false. */
  includeTests?: boolean;
  /** vote cooldown per list id in ms, used by nextVoteAt. default 12h for every list. */
  cooldowns?: Record<string, number>;
}

const DAY = 86_400_000;
const DEFAULT_COOLDOWN = 12 * 3_600_000;
const MAX_DAYS = 400;

/**
 * VoteLedger: remembers who voted where and when, so reward logic never has
 * to poll a list API. One ledger spans every list: `hasVoted(user)` is true if
 * the user voted ANYWHERE recently. Fed automatically from webhook votes when
 * you pass `voteLedger` to Botlists.
 */
export class VoteLedger {
  private readonly store: VoteStore;
  private readonly includeTests: boolean;
  private readonly cooldowns: Record<string, number>;

  public constructor(options: VoteLedgerOptions = {}) {
    this.store = options.store ?? new MemoryVoteStore();
    this.includeTests = options.includeTests ?? false;
    this.cooldowns = options.cooldowns ?? {};
  }

  /** record one normalized vote. Returns the updated record, or null if ignored. */
  public async record(vote: UniversalVote, at = vote.receivedAt ?? Date.now()): Promise<VoterRecord | null> {
    if (!vote.voterId || (vote.isTest && !this.includeTests)) return null;
    const record: VoterRecord = (await this.store.get(vote.voterId)) ?? {
      userId: vote.voterId,
      total: 0,
      lists: {},
      days: [],
      claimedUpTo: 0,
    };
    const weight = Math.max(1, vote.weight || 1);
    const entry = record.lists[vote.listId] ?? { last: 0, count: 0 };
    entry.last = Math.max(entry.last, at);
    entry.count += weight;
    record.lists[vote.listId] = entry;
    record.total += weight;
    const day = Math.floor(at / DAY);
    if (!record.days.includes(day)) {
      record.days.push(day);
      record.days.sort((a, b) => a - b);
      if (record.days.length > MAX_DAYS) record.days.splice(0, record.days.length - MAX_DAYS);
    }
    await this.store.set(record.userId, record);
    return record;
  }

  public async get(userId: string): Promise<VoterRecord | undefined> {
    return this.store.get(userId);
  }

  /** newest vote time for the user (optionally on one list), or null. */
  public async lastVote(userId: string, listId?: string): Promise<number | null> {
    const record = await this.store.get(userId);
    if (!record) return null;
    if (listId) return record.lists[listId]?.last ?? null;
    const times = Object.values(record.lists).map((l) => l.last);
    return times.length ? Math.max(...times) : null;
  }

  /** did the user vote within `withinMs` (default 12h), on any list or the given one? */
  public async hasVoted(userId: string, options: { listId?: string; withinMs?: number } = {}): Promise<boolean> {
    const last = await this.lastVote(userId, options.listId);
    return last !== null && Date.now() - last <= (options.withinMs ?? DEFAULT_COOLDOWN);
  }

  /** when the user can vote on a list again (epoch ms), 0 if they can vote now. */
  public async nextVoteAt(userId: string, listId: string): Promise<number> {
    const last = await this.lastVote(userId, listId);
    if (last === null) return 0;
    const next = last + (this.cooldowns[listId] ?? DEFAULT_COOLDOWN);
    return next > Date.now() ? next : 0;
  }

  /** consecutive UTC days with a vote, ending today or yesterday. */
  public async streak(userId: string, now = Date.now()): Promise<number> {
    const record = await this.store.get(userId);
    if (!record?.days.length) return 0;
    const today = Math.floor(now / DAY);
    const days = new Set(record.days);
    let cursor = days.has(today) ? today : today - 1;
    let streak = 0;
    while (days.has(cursor)) {
      streak++;
      cursor--;
    }
    return streak;
  }

  /**
   * hand out a reward exactly once per vote: true when the user has a vote
   * newer than the last claim (then the claim is consumed), false otherwise.
   * Safe against webhook retries and double-clicks in your reward command.
   */
  public async claim(userId: string, options: { listId?: string; withinMs?: number } = {}): Promise<boolean> {
    const record = await this.store.get(userId);
    if (!record) return false;
    const last = await this.lastVote(userId, options.listId);
    if (last === null || last <= record.claimedUpTo) return false;
    if (Date.now() - last > (options.withinMs ?? 24 * 3_600_000)) return false;
    record.claimedUpTo = last;
    await this.store.set(userId, record);
    return true;
  }

  /** leaderboard by total votes, optionally limited to votes on a list. */
  public async top(limit = 10, listId?: string): Promise<{ userId: string; votes: number }[]> {
    const rows: { userId: string; votes: number }[] = [];
    for (const record of await this.store.all()) {
      const votes = listId ? (record.lists[listId]?.count ?? 0) : record.total;
      if (votes > 0) rows.push({ userId: record.userId, votes });
    }
    return rows.sort((a, b) => b.votes - a.votes).slice(0, limit);
  }
}
