import type { ScheduleEvent } from '../shared/events.ts';
import { toCsv } from '../shared/csv.ts';
import { groupByMonth, receptionWindow } from './schedule.ts';

/** 月指定のパース結果（形は shared/parse.ts の ParseResult に合わせる） */
export type MonthParseResult = { ok: true; year: number; month: number } | { ok: false; message: string };

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const HEADER = ['開催日', '開催地', '定員', '受付'];

/** '2026-10' / '2026/10' / '2026年10月'（全角可）→ 年と月 */
export function parseMonth(text: string): MonthParseResult {
  const m = text.normalize('NFKC').trim().match(/^(\d{4})\s*(?:[-/]|年)\s*(\d{1,2})\s*月?$/);
  if (!m) return { ok: false, message: `月は 2026-10 や 2026年10月 の形で指定してください: ${text}` };
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return { ok: false, message: `月は1〜12で指定してください: ${text}` };
  return { ok: true, year, month };
}

/** 検索に使う月初と月末（サイトの入力形式 YYYY/M/D） */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}/${month}/1`, to: `${year}/${month}/${lastDay}` };
}

/**
 * 大会一覧を「開催日,開催地,定員,受付」の CSV にする。
 * Excel でそのまま開けるよう BOM 付き・CRLF 改行にする。
 */
export function eventsCsv(events: ScheduleEvent[]): string {
  const sorted = groupByMonth(events).flatMap((g) => g.events);
  const rows = sorted.map((e) => [formatDate(e.date), e.venue, String(e.capacity), receptionWindow(e.start)]);
  return toCsv([HEADER, ...rows]);
}

/** '2026-10-04' → '2026/10/04(日)' */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${iso.replaceAll('-', '/')}(${weekday})`;
}
