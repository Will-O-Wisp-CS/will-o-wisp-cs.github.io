import { mergeEventLists, type ScheduleEvent } from '../shared/events.ts';

/**
 * 大会の記録（shared/events-archive.json）。events.json は当月以降しか持たないので、
 * 帳簿のために過去の大会もここに貯める。取得済みの過去の月は months に持ち、二度は取りに行かない
 */
export type ArchiveData = { updatedAt: string; months: string[]; events: ScheduleEvent[] };

/** 記録を始める月 */
export const ARCHIVE_START = '2026-01';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** ARCHIVE_START から先月（JST）までのうち、まだ取っていない月（'YYYY-MM'） */
export function missingMonths(fetched: string[], now: Date): string[] {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const current = jst.toISOString().slice(0, 7);
  const months: string[] = [];
  let [y, m] = ARCHIVE_START.split('-').map(Number);
  for (;;) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    if (month >= current) break;
    if (!fetched.includes(month)) months.push(month);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

/** 記録に大会と取得済みの月を足す。記録からは消さない */
export function mergeArchive(archive: ArchiveData, events: ScheduleEvent[], months: string[]): ArchiveData {
  return {
    updatedAt: archive.updatedAt,
    months: [...new Set([...archive.months, ...months])].sort(),
    events: mergeEventLists(archive.events, events),
  };
}
