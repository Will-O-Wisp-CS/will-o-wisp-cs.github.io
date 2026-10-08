import type { ScheduleEvent } from '../shared/events';
import type { Ledger, LedgerEvent, Transaction } from './ledger';

export type EventStatus = 'upcoming' | 'pending' | 'recorded' | 'cancelled';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 大会スケジュールの開催のうち、帳簿の年のものを取り込む（ID は大会詳細ページの URL）。
 * 既存の開催は日付・開催地・開始時刻を新しい値にし、中止フラグは保つ。スケジュールから消えた開催も残す
 */
export function mergeEvents(ledger: Ledger, events: ScheduleEvent[]): Ledger {
  const byId = new Map(ledger.events.map((e) => [e.id, e]));
  for (const s of events) {
    if (!s.date.startsWith(`${ledger.year}-`)) continue;
    const cancelled = byId.get(s.url)?.cancelled ?? false;
    byId.set(s.url, { id: s.url, date: s.date, venue: s.venue, start: s.start, cancelled });
  }
  const merged = [...byId.values()].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return { ...ledger, events: merged };
}

/** 開催の状態。中止 → 売上あり → 開始時刻（JST）を過ぎた → これから の順で判定する */
export function eventStatus(event: LedgerEvent, transactions: Transaction[], now: Date): EventStatus {
  if (event.cancelled) return 'cancelled';
  if (transactions.some((t) => t.kind === 'sale' && t.eventId === event.id)) return 'recorded';
  const jst = new Date(now.getTime() + JST_OFFSET_MS).toISOString();
  const nowKey = `${jst.slice(0, 10)} ${jst.slice(11, 16)}`;
  return `${event.date} ${event.start}` <= nowKey ? 'pending' : 'upcoming';
}

/** 売上の記録が必要な開催（記帳開始日以降） */
export function pendingEvents(ledger: Ledger, startDate: string, now: Date): LedgerEvent[] {
  return ledger.events.filter(
    (e) => e.date >= startDate && eventStatus(e, ledger.transactions, now) === 'pending',
  );
}

/** 開催にひも付いた売上と経費の合計 */
export function eventBalance(event: LedgerEvent, transactions: Transaction[]): { sales: number; expenses: number } {
  let sales = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (t.eventId !== event.id) continue;
    if (t.kind === 'sale') sales += t.amount;
    else if (t.kind === 'expense') expenses += t.amount;
  }
  return { sales, expenses };
}
