import { describe, expect, it } from 'vitest';
import { defaultSaleAmount, parseAmount, parseExpense, parseSale, parseTransfer } from './journal';

const expense = {
  date: '2026-10-04',
  amount: '5000',
  account: 'rent' as const,
  payment: 'ownerLoan' as const,
  counterparty: '晴れる屋',
  memo: '',
  eventId: '',
};

describe('parseAmount', () => {
  it('金額の書き方の揺れを受け付ける', () => {
    for (const raw of ['5,500', '¥5500', '￥5,500', '５５００円', ' 5500 ']) {
      expect(parseAmount(raw, '金額')).toEqual({ ok: true, value: 5500 });
    }
  });

  it('0・負数・小数・空は拒否', () => {
    for (const raw of ['0', '-100', '1.5', '', 'abc']) {
      expect(parseAmount(raw, '金額').ok).toBe(false);
    }
  });
});

describe('parseSale', () => {
  it('売上は 現金/売上高', () => {
    const r = parseSale({ eventId: 'u', date: '2026-10-04', participants: '20', fee: '1000', amount: '20000' }, 2026);
    expect(r).toEqual({
      ok: true,
      tx: { kind: 'sale', date: '2026-10-04', amount: 20000, debit: 'cash', credit: 'sales', eventId: 'u', participants: 20, fee: 1000 },
    });
  });

  it('売上金額の初期値は人数×参加費', () => {
    expect(defaultSaleAmount('２０', '1,000')).toBe('20000');
    expect(defaultSaleAmount('', '1000')).toBe('');
    expect(defaultSaleAmount('20', 'x')).toBe('');
  });

  it('開催が未選択なら拒否', () => {
    const r = parseSale({ eventId: '', date: '2026-10-04', participants: '20', fee: '1000', amount: '20000' }, 2026);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.eventId).toBeTruthy();
  });
});

describe('parseExpense', () => {
  it('経費は 経費科目/支払方法', () => {
    const r = parseExpense(expense, 2026);
    expect(r).toEqual({
      ok: true,
      tx: { kind: 'expense', date: '2026-10-04', amount: 5000, debit: 'rent', credit: 'ownerLoan', counterparty: '晴れる屋', memo: '' },
    });
  });

  it('開催を選んだ経費には eventId が付く', () => {
    const r = parseExpense({ ...expense, eventId: 'u' }, 2026);
    expect(r.ok && r.tx.eventId).toBe('u');
  });

  it('経費の科目・支払方法が未選択なら拒否', () => {
    const r = parseExpense({ ...expense, account: '', payment: '' }, 2026);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.account).toBeTruthy();
      expect(r.errors.payment).toBeTruthy();
    }
  });

  it('帳簿と違う年の日付は拒否', () => {
    const r = parseExpense({ ...expense, date: '2025-12-31' }, 2026);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.date).toBe('2025年の帳簿に切り替えてから入力してください');
  });

  it('日付が空・不正なら拒否', () => {
    for (const date of ['', '2026-13-01', '2026-02-30']) {
      const r = parseExpense({ ...expense, date }, 2026);
      expect(r.ok).toBe(false);
    }
  });
});

describe('parseTransfer', () => {
  it('振替は 移動先/移動元', () => {
    const r = parseTransfer({ date: '2026-12-31', amount: '15000', from: 'cash', to: 'ownerDraw', memo: '生活費' }, 2026);
    expect(r).toEqual({
      ok: true,
      tx: { kind: 'transfer', date: '2026-12-31', amount: 15000, debit: 'ownerDraw', credit: 'cash', memo: '生活費' },
    });
  });

  it('移動元と移動先が同じなら拒否', () => {
    const r = parseTransfer({ date: '2026-12-31', amount: '100', from: 'cash', to: 'cash', memo: '' }, 2026);
    expect(r.ok).toBe(false);
  });

  it('使えない組み合わせは拒否', () => {
    const r = parseTransfer({ date: '2026-12-31', amount: '100', from: 'ownerDraw', to: 'ownerLoan', memo: '' }, 2026);
    expect(r.ok).toBe(false);
  });
});
