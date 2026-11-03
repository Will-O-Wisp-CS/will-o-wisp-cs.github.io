import { dayKind, type DayKind } from '../shared/calendar';
import type { ScheduleEvent } from '../shared/events';
import type { JudgeAssignment, Judges, LedgerEvent } from './ledger';

/** ジャッジタブの表の1行 */
export type JudgeRow = {
  /** 大会詳細ページの URL */
  id: string;
  /** '26/11/03' */
  date: string;
  /** '火' */
  weekday: string;
  dayKind: DayKind;
  /** 受付開始 'HH:MM' */
  reception: string;
  venue: string;
  cancelled: boolean;
  /** なければ { hj: '', fj: [] } */
  assignment: JudgeAssignment;
};

/** 月ごとの区切り。label は '2026年11月' */
export type JudgeMonth = { label: string; rows: JudgeRow[] };

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
/** 受付は開始の20分前から */
const RECEPTION_MINUTES = 20;

/** 受付開始時刻（開始の20分前） */
export function receptionTime(start: string): string {
  const [h, m] = start.split(':').map(Number);
  const total = Math.max(0, h * 60 + m - RECEPTION_MINUTES);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * 表の行を月ごとに作る（開催日・開始時刻の順）。showPast でなければ today（JST 'YYYY-MM-DD'）の月より前は出さない。
 * 中止は帳簿にある開催の cancelled で判定する
 */
export function judgeMonths(events: ScheduleEvent[], judges: Judges, ledgerEvents: LedgerEvent[], today: string, showPast: boolean): JudgeMonth[] {
  const cancelled = new Set(ledgerEvents.filter((e) => e.cancelled).map((e) => e.id));
  const thisMonth = today.slice(0, 7);
  const sorted = events
    .filter((e) => showPast || e.date.slice(0, 7) >= thisMonth)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const months: JudgeMonth[] = [];
  for (const e of sorted) {
    const [y, m, d] = e.date.split('-').map(Number);
    const label = `${y}年${m}月`;
    if (months.at(-1)?.label !== label) months.push({ label, rows: [] });
    months.at(-1)!.rows.push({
      id: e.url,
      date: `${e.date.slice(2, 4)}/${e.date.slice(5, 7)}/${e.date.slice(8, 10)}`,
      weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
      dayKind: dayKind(e.date),
      reception: receptionTime(e.start),
      venue: e.venue,
      cancelled: cancelled.has(e.url),
      assignment: judges.assignments[e.url] ?? { hj: '', fj: [] },
    });
  }
  return months;
}

/** 1開催の割り当てを置き換える。前後の空白を取り、空の FJ を詰め、全部空なら割り当てを消す */
export function setAssignment(judges: Judges, id: string, a: JudgeAssignment): Judges {
  const hj = a.hj.trim();
  const fj = a.fj.map((name) => name.trim()).filter((name) => name !== '');
  const { [id]: _, ...rest } = judges.assignments;
  return { ...judges, assignments: hj === '' && fj.length === 0 ? rest : { ...rest, [id]: { hj, fj } } };
}

/** 大会一覧に出てくる会場（重複なし、名前順） */
export function venuesOf(events: ScheduleEvent[]): string[] {
  return [...new Set(events.map((e) => e.venue))].sort((a, b) => a.localeCompare(b, 'ja'));
}

/** ジャッジの名前を最後に足す。空・重複は足さない */
export function addJudgeName(names: string[], raw: string): string[] {
  const name = raw.trim();
  return name === '' || names.includes(name) ? [...names] : [...names, name];
}

/** from の位置の要素を to に移す。範囲外なら元のコピー */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
