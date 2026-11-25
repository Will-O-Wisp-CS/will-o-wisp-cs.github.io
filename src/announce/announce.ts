import { dayKind, type DayKind } from '../shared/calendar.ts';
import { receptionStart, type ScheduleEvent } from '../shared/events.ts';

/** 告知画像に載せる文字と、書き出すファイル名 */
export type AnnounceText = {
  /** '11/29'（ゼロ埋めしない） */
  date: string;
  /** '日' */
  weekday: string;
  dayKind: DayKind;
  /** '12:00~' */
  reception: string;
  /** '鬼火CS in フルコンプ千葉店' */
  title: string;
  /** '2026-11-29_1220_フルコンプ千葉店.png'（時刻は開始時刻） */
  fileName: string;
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 大会 → 告知画像の文字。receptionOverride（'HH:MM'）を渡すと受付時刻をそれにする */
export function announceText(e: ScheduleEvent, receptionOverride?: string): AnnounceText {
  const [y, m, d] = e.date.split('-').map(Number);
  const safeVenue = e.venue.replace(/[\/:*?"<>|\s]/g, '_');
  return {
    date: `${m}/${d}`,
    weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
    dayKind: dayKind(e.date),
    reception: `${receptionOverride ?? receptionStart(e.start)}~`,
    // 記録には「【ミニ】鬼火CS in ○○」のように開催地に大会名ごと入っているものがある
    title: e.venue.includes('鬼火CS') ? e.venue : `鬼火CS in ${e.venue}`,
    fileName: `${e.date}_${e.start.replace(':', '')}_${safeVenue}.png`,
  };
}

/** month（'YYYY-MM'）の大会のうち today（'YYYY-MM-DD'）以降のものを、日付・開始時刻の順に */
export function eventsInMonth(events: ScheduleEvent[], month: string, today: string): ScheduleEvent[] {
  return events
    .filter((e) => e.date.startsWith(`${month}-`) && e.date >= today)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}
