import { describe, expect, it } from 'vitest';
import type { AccountId, Ledger, Transaction } from './ledger';
import { balanceSheet, generalLedger, nextOpening, profitLoss, summaryOf } from './report';

function tx(id: string, date: string, amount: number, debit: AccountId, credit: AccountId, extra: Partial<Transaction> = {}): Transaction {
  const kind = credit === 'sales' ? 'sale' : debit === 'ownerDraw' ? 'transfer' : 'expense';
  return { id, kind, date, amount, debit, credit, receipts: [], updatedAt: '', ...extra };
}

/** 期首 現金10000、10/4 売上20000、10/4 会場費5000 を現金、10/5 賞品3000 を個人のお金、12/31 現金→事業主貸 15000 */
const sample: Ledger = {
  year: 2026,
  opening: { cash: 10000, bank: 0 },
  events: [{ id: 'u', date: '2026-10-04', venue: '晴れる屋3', start: '17:10', cancelled: false }],
  transactions: [
    tx('t5', '2026-12-31', 15000, 'ownerDraw', 'cash', { memo: '生活費' }),
    tx('t1', '2026-10-04', 20000, 'cash', 'sales', { eventId: 'u', participants: 20, fee: 1000 }),
    tx('t2', '2026-10-04', 5000, 'rent', 'cash', { counterparty: '晴れる屋', memo: '' }),
    tx('t3', '2026-10-05', 3000, 'advertising', 'ownerLoan', { counterparty: 'カードショップ', memo: '賞品' }),
  ],
};

describe('profitLoss', () => {
  it('損益計算書', () => {
    const pl = profitLoss(sample);
    expect(pl.monthlySales).toHaveLength(12);
    expect(pl.monthlySales[9]).toBe(20000);
    expect(pl.sales).toBe(20000);
    expect(pl.expenses.find((e) => e.account === 'rent')?.amount).toBe(5000);
    expect(pl.expenses.find((e) => e.account === 'advertising')?.amount).toBe(3000);
    expect(pl.expenses.find((e) => e.account === 'misc')?.amount).toBe(0);
    expect(pl.expenseTotal).toBe(8000);
    expect(pl.income).toBe(12000);
  });
});

describe('balanceSheet', () => {
  it('貸借対照表の期首と期末', () => {
    const bs = balanceSheet(sample);
    expect(bs.opening).toEqual({ cash: 10000, bank: 0, ownerDraw: 0, ownerLoan: 0, capital: 10000 });
    expect(bs.closing).toEqual({ cash: 10000, bank: 0, ownerDraw: 15000, ownerLoan: 3000, capital: 10000 });
    expect(bs.income).toBe(12000);
  });

  it('貸借が一致する', () => {
    const { closing: c, income } = balanceSheet(sample);
    expect(c.cash + c.bank + c.ownerDraw).toBe(c.ownerLoan + c.capital + income);
  });
});

describe('nextOpening', () => {
  it('翌年の期首は期末の現金・普通預金', () => {
    expect(nextOpening(sample)).toEqual({ cash: 10000, bank: 0 });
  });
});

describe('generalLedger', () => {
  it('現金の残高の推移', () => {
    const gl = generalLedger(sample, 'cash');
    expect(gl.opening).toBe(10000);
    expect(gl.lines.map((l) => l.balance)).toEqual([30000, 25000, 10000]);
    expect(gl.lines[0]).toMatchObject({ date: '2026-10-04', counter: 'sales', debit: 20000, credit: 0 });
  });

  it('事業主借は貸方で増える', () => {
    const gl = generalLedger(sample, 'ownerLoan');
    expect(gl.opening).toBe(0);
    expect(gl.lines.map((l) => l.balance)).toEqual([3000]);
  });
});

describe('summaryOf', () => {
  it('売上は開催地と人数', () => {
    expect(summaryOf(sample.transactions[1], sample.events)).toBe('鬼火CS in 晴れる屋3 20人');
  });

  it('取引先だけの経費は末尾に空白が残らない', () => {
    expect(summaryOf(sample.transactions[2], sample.events)).toBe('晴れる屋');
    expect(summaryOf(sample.transactions[3], sample.events)).toBe('カードショップ 賞品');
  });
});
