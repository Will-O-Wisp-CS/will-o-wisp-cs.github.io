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

/** 開催ごとの収支。差額は売上からひも付いた経費をすべて引いたもの（その他は上の3科目以外の経費） */
export type EventBalance = { sales: number; advertising: number; outsourcing: number; travel: number; other: number; net: number };

/** 開催にひも付いた売上と、経費の科目別の合計 */
export function eventBalance(event: LedgerEvent, transactions: Transaction[]): EventBalance {
  const b: EventBalance = { sales: 0, advertising: 0, outsourcing: 0, travel: 0, other: 0, net: 0 };
  for (const t of transactions) {
    if (t.eventId !== event.id) continue;
    if (t.kind === 'sale') b.sales += t.amount;
    else if (t.kind === 'expense') {
      if (t.debit === 'advertising' || t.debit === 'outsourcing' || t.debit === 'travel') b[t.debit] += t.amount;
      else b.other += t.amount;
    }
  }
  b.net = b.sales - b.advertising - b.outsourcing - b.travel - b.other;
  return b;
}
