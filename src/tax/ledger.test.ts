import { describe, expect, it } from 'vitest';
import { accountLabel, ACCOUNTS, DEFAULT_SETTINGS, EXPENSE_ACCOUNTS, isDebitNormal, paymentOf, PAYMENT_METHODS } from './ledger';
import type { Transaction } from './ledger';

describe('勘定科目', () => {
  it('ACCOUNTS の表示名が決算書の科目名と一致する', () => {
    expect(accountLabel('rent')).toBe('地代家賃');
    expect(accountLabel('ownerLoan')).toBe('事業主借');
    expect(accountLabel('advertising')).toBe('広告宣伝費');
  });

  it('経費科目に用途の例がある', () => {
    const hint = (id: string) => ACCOUNTS.find((a) => a.id === id)?.hint ?? '';
    expect(hint('rent')).toContain('会場費');
    expect(hint('advertising')).toContain('賞品代');
  });

  it('借方が増える科目の判定', () => {
    expect(isDebitNormal('cash')).toBe(true);
    expect(isDebitNormal('ownerDraw')).toBe(true);
    expect(isDebitNormal('rent')).toBe(true);
    expect(isDebitNormal('ownerLoan')).toBe(false);
    expect(isDebitNormal('capital')).toBe(false);
    expect(isDebitNormal('sales')).toBe(false);
  });

  it('設定の初期値は経費科目をすべて並べる', () => {
    const s = DEFAULT_SETTINGS('2026-10-07');
    expect(s.startDate).toBe('2026-10-07');
    expect(s.expenseOrder).toEqual(EXPENSE_ACCOUNTS);
  });
});

describe('支払方法', () => {
  it('クレカ・PayPay・交通系ICは個人のお金（事業主借）', () => {
    const account = (id: string) => PAYMENT_METHODS.find((m) => m.id === id)?.account;
    expect(PAYMENT_METHODS.map((m) => m.label)).toEqual(['現金', '普通預金', '個人のお金', 'クレカ', 'PayPay', '交通系IC']);
    expect(account('card')).toBe('ownerLoan');
    expect(account('paypay')).toBe('ownerLoan');
    expect(account('ic')).toBe('ownerLoan');
    expect(account('cash')).toBe('cash');
  });

  it('支払方法を持たない以前の経費は貸方の科目から判断する', () => {
    const tx = (credit: Transaction['credit'], payment?: Transaction['payment']) =>
      ({ id: 'x', kind: 'expense', date: '2026-10-04', amount: 1, debit: 'rent', credit, payment, receipts: [], updatedAt: '' }) as Transaction;
    expect(paymentOf(tx('ownerLoan'))).toBe('personal');
    expect(paymentOf(tx('cash'))).toBe('cash');
    expect(paymentOf(tx('ownerLoan', 'paypay'))).toBe('paypay');
    expect(paymentOf({ ...tx('cash'), kind: 'sale' })).toBeUndefined();
  });
});
