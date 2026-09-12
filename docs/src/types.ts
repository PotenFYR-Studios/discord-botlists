export type ListStatus = 'live' | 'deprecated' | 'shutdown' | 'unknown';

export interface StatusEntry {
  listId: string;
  listName: string;
  website: string;
  state: ListStatus;
  httpStatus: number | null;
  latencyMs: number | null;
  uptime30d: number | null;
  lastChecked: number;
  deprecated: boolean;
  notice: string | null;
}
