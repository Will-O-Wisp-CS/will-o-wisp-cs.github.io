import { describe, expect, it } from 'vitest';
import type { ScheduleEvent } from '../shared/events';
import type { Ledger, LedgerEvent, Transaction } from './ledger';
import { eventBalance, eventStatus, mergeEvents, pendingEvents } from './reminder';

function schedule(date: string, start: string, url: string, venue = '晴れる屋3'): ScheduleEvent {
  return { date, venue, format: 'オリジナル', entryType: '個人', capacity: 108, start, url };
}

function ledger(events: LedgerEvent[] = [], transactions: Transaction[] = []): Ledger {
  return { year: 2026, opening: { cash: 0, bank: 0 }, events, transactions };
}

function ev(id: string, date: string, start = '17:10', cancelled = false): LedgerEvent {
  return { id, date, venue: '晴れる屋3', start, cancelled };
}

function tx(kind: Transaction['kind'], eventId: string, amount: number): Transaction {
  const accounts = kind === 'sale' ? { debit: 'cash', credit: 'sales' } : { debit: 'rent', credit: 'cash' };
  return { id: `${kind}-${amount}`, kind, date: '2026-10-04', amount, ...accounts, eventId, receipts: [], updatedAt: '' } as Transaction;
}

describe('mergeEvents', () => {
  it('開催を取り込み、同じ URL は重複しない', () => {
    const events = [schedule('2026-10-04', '17:10', 'a'), schedule('2026-10-04', '10:30', 'b')];
    const once = mergeEvents(ledger(), events);
    const twice = mergeEvents(once, events);
    expect(twice.events.map((e) => e.id)).toEqual(['b', 'a']);
    expect(twice.events[0]).toEqual({ id: 'b', date: '2026-10-04', venue: '晴れる屋3', start: '10:30', cancelled: false });
  });

  it('events.json から消えた過去の開催は残る', () => {
    const merged = mergeEvents(ledger([ev('old', '2026-09-06')]), [schedule('2026-10-04', '17:10', 'a')]);
    expect(merged.events.map((e) => e.id)).toEqual(['old', 'a']);
  });

  it('日程が変わった開催は上書きし、中止は保つ', () => {
    const merged = mergeEvents(ledger([ev('a', '2026-10-04', '17:10', true)]), [schedule('2026-10-11', '10:30', 'a', '竜星の嵐')]);
    expect(merged.events).toEqual([{ id: 'a', date: '2026-10-11', venue: '竜星の嵐', start: '10:30', cancelled: true }]);
  });

  it('別の年の開催は取り込まない', () => {
    expect(mergeEvents(ledger(), [schedule('2027-01-03', '10:30', 'x')]).events).toEqual([]);
  });

  it('元の帳簿は変更しない', () => {
    const original = ledger();
    mergeEvents(original, [schedule('2026-10-04', '17:10', 'a')]);
    expect(original.events).toEqual([]);
  });
});

describe('eventStatus', () => {
  const e = ev('a', '2026-10-04', '17:10');

  it('開始時刻の前後で upcoming と pending が切り替わる', () => {
    expect(eventStatus(e, [], new Date('2026-10-04T08:09:00Z'))).toBe('upcoming');
    expect(eventStatus(e, [], new Date('2026-10-04T08:10:00Z'))).toBe('pending');
  });

  it('売上があれば recorded、経費だけでは recorded にならない', () => {
    const now = new Date('2026-10-05T00:00:00Z');
    expect(eventStatus(e, [tx('sale', 'a', 20000)], now)).toBe('recorded');
    expect(eventStatus(e, [tx('expense', 'a', 5000)], now)).toBe('pending');
  });

  it('中止は売上より優先', () => {
    expect(eventStatus({ ...e, cancelled: true }, [tx('sale', 'a', 1)], new Date('2026-10-05T00:00:00Z'))).toBe('cancelled');
  });
});

describe('pendingEvents', () => {
  it('記帳開始日より前の開催はリマインドしない', () => {
    const l = ledger([ev('a', '2026-10-03'), ev('b', '2026-10-04'), ev('c', '2026-10-05', '17:10', true)]);
    const pending = pendingEvents(l, '2026-10-04', new Date('2026-10-06T00:00:00Z'));
    expect(pending.map((e) => e.id)).toEqual(['b']);
  });
});

describe('eventBalance', () => {
  it('開催ごとの収支', () => {
    const txs = [tx('sale', 'a', 20000), tx('expense', 'a', 5000), tx('expense', 'other', 999)];
    expect(eventBalance(ev('a', '2026-10-04'), txs)).toEqual({ sales: 20000, expenses: 5000 });
  });
});
