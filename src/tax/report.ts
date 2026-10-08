import { EXPENSE_ACCOUNTS, isDebitNormal, paymentLabel, type AccountId, type Ledger, type LedgerEvent, type Transaction } from './ledger';

export type BalanceRow = { cash: number; bank: number; ownerDraw: number; ownerLoan: number; capital: number };

export type LedgerLine = { date: string; counter: AccountId; summary: string; debit: number; credit: number; balance: number };

/** 損益計算書（青色申告決算書 1ページ目・月別売上） */
export function profitLoss(ledger: Ledger): {
  monthlySales: number[];
  sales: number;
  expenses: { account: AccountId; amount: number }[];
  expenseTotal: number;
  income: number;
} {
  const monthlySales = Array<number>(12).fill(0);
  for (const t of ledger.transactions) {
    if (t.credit === 'sales') monthlySales[Number(t.date.slice(5, 7)) - 1] += t.amount;
  }
  const sales = monthlySales.reduce((a, b) => a + b, 0);
  const expenses = EXPENSE_ACCOUNTS.map((account) => ({ account, amount: movement(ledger.transactions, account) }));
  const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
  return { monthlySales, sales, expenses, expenseTotal, income: sales - expenseTotal };
}

/** 貸借対照表（期首・期末）。期末の元入金は期首と同じで、所得は別に返す */
export function balanceSheet(ledger: Ledger): { opening: BalanceRow; closing: BalanceRow; income: number } {
  const opening = openingRow(ledger);
  const closing: BalanceRow = {
    cash: openingBalance(ledger, 'cash') + movement(ledger.transactions, 'cash'),
    bank: openingBalance(ledger, 'bank') + movement(ledger.transactions, 'bank'),
    ownerDraw: movement(ledger.transactions, 'ownerDraw'),
    ownerLoan: movement(ledger.transactions, 'ownerLoan'),
    capital: opening.capital,
  };
  return { opening, closing, income: profitLoss(ledger).income };
}

/** 翌年の期首残高（期末の現金・普通預金） */
export function nextOpening(ledger: Ledger): { cash: number; bank: number } {
  const { closing } = balanceSheet(ledger);
  return { cash: closing.cash, bank: closing.bank };
}

/** 総勘定元帳の1科目分。日付順（同じ日は入力順） */
export function generalLedger(ledger: Ledger, account: AccountId): { opening: number; lines: LedgerLine[] } {
  const opening = openingBalance(ledger, account);
  const sign = isDebitNormal(account) ? 1 : -1;
  let balance = opening;
  const lines = sortByDate(ledger.transactions)
    .filter((t) => t.debit === account || t.credit === account)
    .map((t) => {
      const isDebit = t.debit === account;
      balance += (isDebit ? 1 : -1) * sign * t.amount;
      return {
        date: t.date,
        counter: isDebit ? t.credit : t.debit,
        summary: summaryOf(t, ledger.events),
        debit: isDebit ? t.amount : 0,
        credit: isDebit ? 0 : t.amount,
        balance,
      };
    });
  return { opening, lines };
}

/** 摘要に支払方法を付ける支払方法（科目だけでは分からないもの） */
const NOTED_PAYMENTS = ['card', 'paypay', 'ic'];

/** 摘要。売上は「鬼火CS in ○○ N人」、それ以外は「取引先 メモ」。クレカ・PayPay・交通系IC は「（クレカ）」を付ける */
export function summaryOf(tx: Transaction, events: LedgerEvent[]): string {
  if (tx.kind === 'sale') {
    const venue = events.find((e) => e.id === tx.eventId)?.venue ?? '';
    return `鬼火CS in ${venue} ${tx.participants ?? 0}人`;
  }
  const text = `${tx.counterparty ?? ''} ${tx.memo ?? ''}`.trim();
  return tx.payment && NOTED_PAYMENTS.includes(tx.payment) ? `${text}（${paymentLabel(tx.payment)}）` : text;
}

/** 日付順に並べる（同じ日は元の順を保つ） */
export function sortByDate(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => a.date.localeCompare(b.date));
}

function openingRow(ledger: Ledger): BalanceRow {
  const { cash, bank } = ledger.opening;
  return { cash, bank, ownerDraw: 0, ownerLoan: 0, capital: cash + bank };
}

function openingBalance(ledger: Ledger, account: AccountId): number {
  const row = openingRow(ledger);
  return account in row ? row[account as keyof BalanceRow] : 0;
}

/** 期中の増減（その科目の残高が増える向きを正とする） */
function movement(transactions: Transaction[], account: AccountId): number {
  const sign = isDebitNormal(account) ? 1 : -1;
  let total = 0;
  for (const t of transactions) {
    if (t.debit === account) total += sign * t.amount;
    if (t.credit === account) total -= sign * t.amount;
  }
  return total;
}
