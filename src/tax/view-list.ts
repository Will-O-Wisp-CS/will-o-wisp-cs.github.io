import { el } from '../shared/dom';
import type { App } from './app';
import { fileUrl } from './drive';
import { formatYen } from './format';
import { ACCOUNTS, accountLabel, type AccountId } from './ledger';
import { eventBalance, eventStatus } from './reminder';
import { summaryOf } from './report';
import { searchTransactions, type SearchFilter } from './search';
import { button, input, select, table } from './ui';
import { eventLabel } from './view-home';

const KIND_LABELS = { sale: '売上', expense: '経費', transfer: '振替' } as const;

/** 画面を切り替えても絞り込み条件を保つ */
let filter: SearchFilter = { from: '', to: '', amount: '', counterparty: '', account: '' };

/** 一覧: 取引の検索・編集と、開催ごとの収支 */
export function render(root: HTMLElement, app: App): void {
  const ledger = app.ledger.data;
  const section = el('section', '', 'card');
  section.append(el('h2', `${ledger.year}年の取引`, 'card-title'));

  const controls = el('div', '', 'tax-filter');
  const from = input('date', filter.from, { 'aria-label': '日付（から）' });
  const to = input('date', filter.to, { 'aria-label': '日付（まで）' });
  const amount = input('text', filter.amount, { inputmode: 'numeric', placeholder: '金額', 'aria-label': '金額' });
  const counterparty = input('text', filter.counterparty, { placeholder: '取引先', 'aria-label': '取引先' });
  const account = select(
    [{ value: '', label: 'すべての科目' }, ...ACCOUNTS.map((a) => ({ value: a.id, label: a.label }))],
    filter.account,
  );
  account.setAttribute('aria-label', '科目');
  controls.append(from, to, amount, counterparty, account);
  section.append(controls);

  const list = el('ul', '', 'tax-list');
  const update = () => {
    filter = {
      from: from.value,
      to: to.value,
      amount: amount.value,
      counterparty: counterparty.value,
      account: account.value as AccountId | '',
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
  for (const c of [from, to, amount, counterparty, account]) c.addEventListener('input', update);
  update();
  section.append(list);

  const balances = el('section', '', 'card');
  balances.append(el('h2', '開催ごとの収支', 'card-title'));
  const now = new Date();
  const rows = ledger.events
    .filter((e) => !e.cancelled && eventStatus(e, ledger.transactions, now) !== 'upcoming')
    .map((e) => {
      const b = eventBalance(e, ledger.transactions);
      return [eventLabel(e), formatYen(b.sales), formatYen(b.expenses), formatYen(b.sales - b.expenses)];
    });
  balances.append(
    rows.length > 0 ? table(['開催', '売上', '経費', '差額'], rows, [1, 2, 3]) : el('p', 'まだ開催はありません', 'tax-empty'),
  );

  root.append(section, balances);
}
