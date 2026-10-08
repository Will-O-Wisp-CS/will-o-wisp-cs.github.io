import { describe, expect, it } from 'vitest';
import type { TxDraft } from './journal';
import { defaultPaymentFor, parseTravelTemplate, tripTransactions, travelTemplatesOf } from './travel';

const draft: TxDraft = { kind: 'expense', date: '2026-10-04', amount: 140, debit: 'travel', credit: 'ownerLoan', payment: 'ic', counterparty: '', memo: '笹塚⇔新宿' };

describe('旅費交通費の支払方法', () => {
  it('旅費交通費を選んだら交通系IC', () => {
    expect(defaultPaymentFor('travel')).toBe('ic');
  });

  it('ほかの科目は決めない', () => {
    expect(defaultPaymentFor('rent')).toBeUndefined();
    expect(defaultPaymentFor('')).toBeUndefined();
  });
});

describe('片道・往復', () => {
  it('片道は1件', () => {
    expect(tripTransactions(draft, 'oneWay')).toEqual([draft]);
  });

  it('往復は同じ内容で2件', () => {
    const trips = tripTransactions(draft, 'roundTrip');
    expect(trips).toEqual([draft, draft]);
    expect(trips[0]).not.toBe(trips[1]);
  });
});

describe('テンプレ', () => {
  it('区間と片道運賃を受け付ける（全角・カンマ可）', () => {
    expect(parseTravelTemplate(' 笹塚⇔新宿 ', '１４０円')).toEqual({ ok: true, template: { label: '笹塚⇔新宿', amount: 140 } });
  });

  it('区間が空・運賃が不正なら拒否', () => {
    const r = parseTravelTemplate('', '0');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.label).toBeTruthy();
      expect(r.errors.amount).toBeTruthy();
    }
  });

  it('テンプレがまだない設定は空', () => {
    expect(travelTemplatesOf({ startDate: '2026-01-01', defaultFee: 0, expenseOrder: [] })).toEqual([]);
  });
});
