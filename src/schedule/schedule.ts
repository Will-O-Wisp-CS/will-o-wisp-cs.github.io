import { receptionStart, type ScheduleEvent } from '../shared/events.ts';

/** 参加表明は開催日の何日前の何時（JST）から始まるか */
export const ENTRY_OPENS_DAYS_BEFORE = 14;
export const ENTRY_OPENS_HOUR = 20;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type MonthGroup = { year: number; month: number; events: ScheduleEvent[] };

/** 参加表明の状況: 受付前（開始日時つき） / 受付中 / 開催済み */
export type EntryStatus = { kind: 'upcoming'; opensAt: Date } | { kind: 'open' } | { kind: 'finished' };

/** 受付時刻: 開始の20分前〜開始（'10:30' → '10:10〜10:30'） */
export function receptionWindow(start: string): string {
  return `${receptionStart(start)}〜${start}`;
}

/** 月ごとにまとめる。月・大会とも日付順、同日は開始時刻順 */
export function groupByMonth(events: ScheduleEvent[]): MonthGroup[] {
  const sorted = [...events].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const groups: MonthGroup[] = [];
  for (const e of sorted) {
    const year = Number(e.date.slice(0, 4));
    const month = Number(e.date.slice(5, 7));
    const last = groups.at(-1);
    if (last && last.year === year && last.month === month) last.events.push(e);
    else groups.push({ year, month, events: [e] });
  }
  return groups;
}

/** 検索の開始日: JST の当月1日（サイトの入力形式 YYYY/M/D） */
export function searchFromDate(now: Date): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return `${jst.getUTCFullYear()}/${jst.getUTCMonth() + 1}/1`;
}

/** 参加表明は開催日14日前の20時から大会開始時刻まで */
export function entryStatus(event: ScheduleEvent, now: Date): EntryStatus {
  const [y, m, d] = event.date.split('-').map(Number);
  const [h, min] = event.start.split(':').map(Number);
  const opensAt = jstDate(y, m, d - ENTRY_OPENS_DAYS_BEFORE, ENTRY_OPENS_HOUR, 0);
  const startsAt = jstDate(y, m, d, h, min);
  if (now < opensAt) return { kind: 'upcoming', opensAt };
  if (now < startsAt) return { kind: 'open' };
  return { kind: 'finished' };
}

/** 大会がすべて開催済みになった月を除く（開始前の大会が残る月は開催済みの大会ごと残す） */
export function activeMonths(groups: MonthGroup[], now: Date): MonthGroup[] {
  return groups.filter((g) => g.events.some((e) => entryStatus(e, now).kind !== 'finished'));
}

export function sameEvents(a: ScheduleEvent[], b: ScheduleEvent[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** JST の日時を Date にする（日のはみ出しは Date.UTC が前月・翌月に繰り越す） */
function jstDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - JST_OFFSET_MS);
}
