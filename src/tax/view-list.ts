import { el } from '../shared/dom';
import type { App } from './app';
import { fileUrl } from './drive';
import { formatYen } from './format';
import { ACCOUNTS, accountLabel, PAYMENT_METHODS, type AccountId, type PaymentMethod } from './ledger';
import { eventBalance, eventStatus } from './reminder';
import { summaryOf } from './report';
import { searchTransactions, type SearchFilter } from './search';
import { button, input, select } from './ui';
import { eventLabel } from './view-home';

const KIND_LABELS = { sale: '売上', expense: '経費', transfer: '振替' } as const;

/** 画面を切り替えても絞り込み条件を保つ */
let filter: SearchFilter = { from: '', to: '', amount: '', counterparty: '', account: '', payment: '' };

/** 一覧: 取引の検索・編集と、開催ごとの収支 */
export function render(root: HTMLElement, app: App): void {
  const ledger = app.ledger.data;
  const section = el('section', '', 'card');
  section.append(el('h2', `${ledger.year}年の取引`, 'card-title'));

  const controls = el('div', '', 'tax-filter');
  const from = input('date', filter.from);
  const to = input('date', filter.to);
  const amount = input('text', filter.amount, { inputmode: 'numeric', placeholder: '金額', 'aria-label': '金額' });
  const counterparty = input('text', filter.counterparty, { placeholder: '取引先', 'aria-label': '取引先' });
  const account = select(
    [{ value: '', label: '科目すべて' }, ...ACCOUNTS.map((a) => ({ value: a.id, label: a.label }))],
    filter.account,
  );
  account.setAttribute('aria-label', '科目');
  const payment = select(
    [{ value: '', label: '支払方法すべて' }, ...PAYMENT_METHODS.map((m) => ({ value: m.id, label: m.label }))],
    filter.payment,
  );
  payment.setAttribute('aria-label', '支払方法');
  // iPhone では空の日付欄に何も出ないので、見出しを付ける
  const dateField = (text: string, control: HTMLInputElement) => {
    const wrap = el('label', '', 'tax-filter-date');
    wrap.append(el('span', text), control);
    return wrap;
  };
  controls.append(dateField('いつから', from), dateField('いつまで', to), amount, counterparty, account, payment);
  section.append(controls);

  const list = el('ul', '', 'tax-list');
  const update = () => {
    filter = {
      from: from.value,
      to: to.value,
      amount: amount.value,
      counterparty: counterparty.value,
      account: account.value as AccountId | '',
      payment: payment.value as PaymentMethod | '',
    };
    const found = searchTransactions(ledger.transactions, filter);
    list.replaceChildren();
    if (found.length === 0) list.append(el('li', '該当する取引はありません', 'tax-empty'));
    for (const t of found) {
      const item = el('li', '', 'tax-item');
      const head = el('div', '', 'tax-item-head');
      head.append(el('span', `${t.date.slice(5).replace('-', '/')} ${KIND_LABELS[t.kind]}`), el('span', formatYen(t.amount), 'tax-amount'));
      item.append(head);
      item.append(el('div', `${accountLabel(t.debit)} / ${accountLabel(t.credit)}　${summaryOf(t, ledger.events)}`, 'tax-item-sub'));
      if (t.receipts.length > 0) {
        const files = el('div', '', 'tax-item-sub');
        t.receipts.forEach((r, i) => {
          const a = el('a', `領収書${t.receipts.length > 1 ? i + 1 : ''}`) as HTMLAnchorElement;
          a.href = fileUrl(r.fileId);
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          files.append(a, ' ');
        });
        item.append(files);
      }
      const actions = el('div', '', 'tax-actions');
      actions.append(button('編集', () => app.editTransaction(t.id), 'tax-secondary'));
      item.append(actions);
      list.append(item);
    }
  };
  for (const c of [from, to, amount, counterparty, account, payment]) c.addEventListener('input', update);
  update();
  section.append(list);

  const balances = el('section', '', 'card');
  balances.append(el('h2', '開催ごとの収支', 'card-title'));
  const now = new Date();
  const shown = ledger.events.filter((e) => !e.cancelled && eventStatus(e, ledger.transactions, now) !== 'upcoming');
  const rows = shown.map((e) => ({ e, b: eventBalance(e, ledger.transactions) }));
  // 3科目以外の経費（会場費など）を付けた開催だけ「その他」を出す（差額が合うように）
  const hasOther = rows.some((r) => r.b.other > 0);
  if (rows.length > 0) {
    const list = el('ul', '', 'tax-list');
    for (const { e, b } of rows) {
      const item = el('li', '', 'tax-item');
      item.append(el('div', eventLabel(e), 'tax-item-head'));
      const grid = el('dl', '', 'tax-balance');
      const cells: [string, number][] = [
        ['売上', b.sales],
        ['広告宣伝費', b.advertising],
        ['外注工賃', b.outsourcing],
        ['旅費交通費', b.travel],
        ...(b.other > 0 ? ([['その他', b.other]] as [string, number][]) : []),
        ['差額', b.net],
      ];
      for (const [label, value] of cells) {
        const cell = el('div', '', label === '差額' ? 'net' : '');
        cell.append(el('dt', label), el('dd', formatYen(value), `tax-amount${value < 0 ? ' minus' : ''}`));
        grid.append(cell);
      }
      item.append(grid);
      list.append(item);
    }
    balances.append(list);
    if (hasOther) balances.append(el('p', 'その他は会場費（地代家賃）など、上の3科目以外で開催に付けた経費です', 'note'));
  } else {
    balances.append(el('p', 'まだ開催はありません', 'tax-empty'));
  }

  root.append(section, balances);
}
