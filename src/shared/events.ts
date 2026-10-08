/** 大会スケジュールの1大会分（dmp-ranking.com の大会日程の1行） */
export type ScheduleEvent = {
  /** 開催日 'YYYY-MM-DD' */
  date: string;
  /** 開催地（大会名「鬼火CS in ○○」の ○○） */
  venue: string;
  format: string;
  entryType: string;
  capacity: number;
  /** 開始時刻 'HH:MM' */
  start: string;
  /** 大会詳細ページ */
  url: string;
};

export type EventDay = { date: string; events: ScheduleEvent[] };

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** JST の今日以降で一番近い開催日と、その日の大会（開始時刻順）。当日の大会はその日のうち表示を続ける */
export function nextEventDay(events: ScheduleEvent[], now: Date): EventDay | null {
  const today = new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today);
  if (upcoming.length === 0) return null;
  const date = upcoming.reduce((min, e) => (e.date < min ? e.date : min), upcoming[0].date);
  const sameDay = upcoming.filter((e) => e.date === date).sort((a, b) => a.start.localeCompare(b.start));
  return { date, events: sameDay };
}

/** '2026-10-04' → '10/04(日)' */
export function formatEventDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}(${weekday})`;
}

/** 大会の一覧をまとめる。同じ大会（大会詳細ページの URL）は後の一覧の内容を使い、日付・開始時刻の順に並べる */
export function mergeEventLists(...lists: ScheduleEvent[][]): ScheduleEvent[] {
  const byUrl = new Map<string, ScheduleEvent>();
  for (const list of lists) for (const e of list) byUrl.set(e.url, e);
  return [...byUrl.values()].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}
