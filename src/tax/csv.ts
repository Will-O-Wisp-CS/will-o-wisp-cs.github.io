import { toCsv } from '../shared/csv';
import { ACCOUNTS, accountLabel, type Ledger } from './ledger';
import { generalLedger, sortByDate, summaryOf } from './report';

/** 仕訳帳（日付順） */
export function journalCsv(ledger: Ledger): string {
  const rows = sortByDate(ledger.transactions).map((t) => [
    t.date,
    accountLabel(t.debit),
    accountLabel(t.credit),
    String(t.amount),
    summaryOf(t, ledger.events),
  ]);
  return toCsv([['日付', '借方科目', '貸方科目', '金額', '摘要'], ...rows]);
}

/** 総勘定元帳。期首残高か取引がある科目ごとに、科目名・見出し・前期繰越・各行・空行 */
export function generalLedgerCsv(ledger: Ledger): string {
  const rows: string[][] = [];
  for (const { id, label } of ACCOUNTS) {
    const { opening, lines } = generalLedger(ledger, id);
    if (opening === 0 && lines.length === 0) continue;
    rows.push([label], ['日付', '相手科目', '摘要', '借方金額', '貸方金額', '残高']);
    rows.push([`${ledger.year}-01-01`, '', '前期繰越', '', '', String(opening)]);
    for (const l of lines) {
      rows.push([l.date, accountLabel(l.counter), l.summary, amountCell(l.debit), amountCell(l.credit), String(l.balance)]);
    }
    rows.push([]);
  }
  return toCsv(rows);
}

function amountCell(n: number): string {
  return n === 0 ? '' : String(n);
}
