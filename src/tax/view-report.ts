import { el } from '../shared/dom';
import type { App } from './app';
import { generalLedgerCsv, journalCsv } from './csv';
import { formatYen, todayJst } from './format';
import { accountLabel } from './ledger';
import { balanceSheet, profitLoss } from './report';
import { button, download, select, table } from './ui';

/** 決算: 確定申告書等作成コーナーに入力する数字と、帳簿の CSV */
export function render(root: HTMLElement, app: App): void {
  const ledger = app.ledger.data;
  const thisYear = Number(todayJst(new Date()).slice(0, 4));

  const head = el('section', '', 'card');
  head.append(el('h2', '年を選ぶ', 'card-title'));
  const years = Array.from({ length: 7 }, (_, i) => thisYear - i);
  if (!years.includes(ledger.year)) years.push(ledger.year);
  const yearSel = select(years.map((y) => ({ value: String(y), label: `${y}年` })), String(ledger.year));
  yearSel.setAttribute('aria-label', '年');
  yearSel.addEventListener('change', () => void app.switchYear(Number(yearSel.value)));
  const yearWrap = el('div', '', 'tax-form');
  yearWrap.append(yearSel);
  head.append(yearWrap, el('p', '入力・一覧もこの年の帳簿になります', 'note'));

  const pl = profitLoss(ledger);
  const plCard = el('section', '', 'card');
  plCard.append(el('h2', '損益計算書', 'card-title'));
  plCard.append(el('h3', '月別売上（収入）金額', 'rules-heading'));
  const monthRows = pl.monthlySales.map((v, i) => [`${i + 1}月`, formatYen(v)]);
  const monthTable = table(['月', '売上（収入）金額'], [...monthRows, ['計', formatYen(pl.sales)]], [1]);
  monthTable.rows[monthTable.rows.length - 1].classList.add('total');
  plCard.append(monthTable);
  plCard.append(el('h3', '経費', 'rules-heading'));
  const expenseTable = table(
    ['科目', '金額'],
    [...pl.expenses.map((e) => [accountLabel(e.account), formatYen(e.amount)]), ['計', formatYen(pl.expenseTotal)]],
    [1],
  );
  expenseTable.rows[expenseTable.rows.length - 1].classList.add('total');
  plCard.append(expenseTable);
  const incomeTable = table(['', '金額'], [['青色申告特別控除前の所得金額', formatYen(pl.income)]], [1]);
  plCard.append(incomeTable);
  plCard.append(el('p', '広告宣伝費は賞品代を含みます。作成コーナーの同じ名前の欄に入力してください', 'note'));

  const bs = balanceSheet(ledger);
  const bsCard = el('section', '', 'card');
  bsCard.append(el('h2', '貸借対照表', 'card-title'));
  const row = (label: string, key: keyof typeof bs.opening) => [label, formatYen(bs.opening[key]), formatYen(bs.closing[key])];
  bsCard.append(el('h3', '資産の部', 'rules-heading'));
  bsCard.append(
    table(['科目', `1月1日（期首）`, `12月31日（期末）`], [row('現金', 'cash'), row('普通預金', 'bank'), row('事業主貸', 'ownerDraw')], [1, 2]),
  );
  bsCard.append(el('h3', '負債・資本の部', 'rules-heading'));
  bsCard.append(
    table(
      ['科目', `1月1日（期首）`, `12月31日（期末）`],
      [row('事業主借', 'ownerLoan'), row('元入金', 'capital'), ['青色申告特別控除前の所得金額', '', formatYen(bs.income)]],
      [1, 2],
    ),
  );

  const csvCard = el('section', '', 'card');
  csvCard.append(el('h2', '帳簿の書き出し', 'card-title'));
  const actions = el('div', '', 'tax-actions');
  actions.append(
    button('仕訳帳 CSV', () => download(`鬼火CS帳簿_仕訳帳_${ledger.year}.csv`, journalCsv(ledger), 'text/csv'), 'tax-secondary'),
    button('総勘定元帳 CSV', () => download(`鬼火CS帳簿_総勘定元帳_${ledger.year}.csv`, generalLedgerCsv(ledger), 'text/csv'), 'tax-secondary'),
  );
  csvCard.append(actions);

  root.append(head, plCard, bsCard, csvCard);
}
