import { describe, expect, it } from 'vitest';
import type { Transaction } from './ledger';
import { searchTransactions } from './search';

function tx(id: string, date: string, amount: number, counterparty = '', debit: Transaction['debit'] = 'rent'): Transaction {
  return { id, kind: 'expense', date, amount, debit, credit: 'cash', counterparty, receipts: [], updatedAt: '' };
}

const txs = [tx('a', '2026-10-04', 5500, '晴れる屋'), tx('b', '2026-10-05', 3000, 'カードショップ', 'advertising'), tx('c', '2026-11-01', 5500, '竜星の嵐')];
const none = { from: '', to: '', amount: '', counterparty: '', account: '' as const };

describe('searchTransactions', () => {
  it('条件なしなら日付の新しい順に全件', () => {
    expect(searchTransactions(txs, none).map((t) => t.id)).toEqual(['c', 'b', 'a']);
  });

  it('日付の範囲（両端を含む）', () => {
    expect(searchTransactions(txs, { ...none, from: '2026-10-05', to: '2026-11-01' }).map((t) => t.id)).toEqual(['c', 'b']);
  });

  it('金額は書き方の揺れを許して一致', () => {
    expect(searchTransactions(txs, { ...none, amount: '５,５００' }).map((t) => t.id)).toEqual(['c', 'a']);
  });

  it('取引先は部分一致', () => {
    expect(searchTransactions(txs, { ...none, counterparty: '晴れる' }).map((t) => t.id)).toEqual(['a']);
  });

  it('科目は借方か貸方のどちらかが一致', () => {
    expect(searchTransactions(txs, { ...none, account: 'advertising' }).map((t) => t.id)).toEqual(['b']);
    expect(searchTransactions(txs, { ...none, account: 'cash' })).toHaveLength(3);
  });
});
