import type { StatusBoard, StatusEntry } from '../types.js';

/**
 * ConsoleReport: renders the status board as a modern unicode table for the
 * terminal and builds GitHub issue URLs for dead lists.
 */
export class ConsoleReport {
  /** unicode table with box drawing, color coded state dots. */
  public static table(board: StatusBoard): string {
    const rows: [string, string, string, string][] = board.entries.map((e) => [
      e.listName,
      `${stateDot(e.state)} ${e.state}`,
      e.latencyMs === null ? 'n/a' : `${e.latencyMs} ms`,
      e.httpStatus === null ? 'n/a' : String(e.httpStatus),
    ]);
    const headers: [string, string, string, string] = ['List', 'Status', 'Latency', 'HTTP'];
    const widths = [0, 1, 2, 3].map((i) =>
      Math.max(headers[i].length, ...rows.map((r) => visibleLength(r[i]))),
    );
    const line = (l: string, m: string, r: string) => l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r;
    const row = (cells: string[]) =>
      '│ ' + cells.map((c, i) => c.padEnd(widths[i])).join(' │ ') + ' │';

    const out: string[] = [];
    out.push(line('┌', '┬', '┐'));
    out.push(row(headers));
    out.push(line('├', '┼', '┤'));
    for (const r of rows) out.push(row(r));
    out.push(line('└', '┴', '┘'));
    const s = board.summary;
    out.push('');
    out.push(`  ${stateDot('live')} ${s.live} live   ${stateDot('deprecated')} ${s.deprecated} deprecated   ${stateDot('shutdown')} ${s.shutdown} shutdown   ${stateDot('unknown')} ${s.unknown} unknown`);
    return out.join('\n');
  }

  /** one prefilled github issue URL per dead list, so users can report/add alternatives. */
  public static issueUrls(dead: StatusEntry[], repo = 'PotenFYR-Studios/discord-botlists'): string[] {
    const base = `https://github.com/${repo}/issues/new`;
    return dead.map((entry) => {
      const title = encodeURIComponent(`${entry.listName} (${entry.listId}) appears ${entry.state}: add an alternative?`);
      const body = encodeURIComponent(
        [
          `discord-botlists status sync flagged **${entry.listName}** as \`${entry.state}\`.`,
          '',
          `- Website: ${entry.website}`,
          `- Probe result: HTTP ${entry.httpStatus ?? 'no response'}, latency ${entry.latencyMs ?? 'n/a'}`,
          `- Checked at: ${new Date(entry.lastChecked).toISOString()}`,
          '',
          'If this list is actually alive, please share a working URL or API docs link.',
          'If it is really gone, suggest an alternative list to support.',
        ].join('\n'),
      );
      return `${base}?title=${title}&body=${body}&labels=list-status`;
    });
  }
}

const ANSI = /\u001b\[[0-9;]*m/g;

function visibleLength(text: string): number {
  return text.replace(ANSI, '').length;
}

function padVisible(text: string, width: number): string {
  const visible = visibleLength(text);
  return visible >= width ? text : text + ' '.repeat(width - visible);
}

function stateDot(state: StatusEntry['state']): string {
  switch (state) {
    case 'live':
      return '\u001b[32m\u25cf\u001b[0m'; // green dot
    case 'deprecated':
      return '\u001b[33m\u25cf\u001b[0m'; // yellow dot
    case 'shutdown':
      return '\u001b[31m\u25cf\u001b[0m'; // red dot
    default:
      return '\u001b[90m\u25cf\u001b[0m'; // grey dot
  }
}
