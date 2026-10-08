import { parseAmount } from './journal';
import { paymentOf, type AccountId, type PaymentMethod, type Transaction } from './ledger';

/** 一覧の絞り込み条件（空欄は条件なし） */
export type SearchFilter = {
  from: string;
  to: string;
  amount: string;
  counterparty: string;
  account: AccountId | '';
  payment: PaymentMethod | '';
};

/** 日付・金額・取引先・科目・支払方法で絞り込み、日付の新しい順に並べる */
export function searchTransactions(transactions: Transaction[], f: SearchFilter): Transaction[] {
  const amount = f.amount.trim() ? parseAmount(f.amount, '') : null;
  const keyword = f.counterparty.normalize('NFKC').trim();
  return transactions
    .filter((t) => !f.from || t.date >= f.from)
    .filter((t) => !f.to || t.date <= f.to)
    .filter((t) => !amount || (amount.ok && t.amount === amount.value))
    .filter((t) => !keyword || (t.counterparty ?? '').normalize('NFKC').includes(keyword))
    .filter((t) => !f.account || t.debit === f.account || t.credit === f.account)
    .filter((t) => !f.payment || paymentOf(t) === f.payment)
    .sort((a, b) => b.date.localeCompare(a.date));
}
