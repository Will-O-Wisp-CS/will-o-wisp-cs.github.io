import { el } from '../shared/dom';
import { formatEventDate } from '../shared/events';
import type { App } from './app';
import { formatYen } from './format';
import type { LedgerEvent } from './ledger';
import { pendingEvents } from './reminder';
import { profitLoss } from './report';
import { button } from './ui';

/** ホーム: 未記録の開催のリマインドと今年の集計 */
export function render(root: HTMLElement, app: App): void {
  const ledger = app.ledger.data;
  const pending = pendingEvents(ledger, app.settings.data.startDate, new Date());

  const remind = el('section', '', 'card');
  remind.append(
    el('h2', pending.length > 0 ? `未記録の開催が ${pending.length} 件あります` : '未記録の開催はありません', 'card-title'),
  );
  const list = el('ul', '', 'tax-list');
  for (const e of pending) {
    const item = el('li', '', 'tax-item');
    item.append(el('div', eventLabel(e), 'tax-item-head'));
    const actions = el('div', '', 'tax-actions');
    actions.append(
      button('売上を入力', () => app.openSaleForm(e.id)),
      button('中止にする', () => void setCancelled(app, e.id, true), 'tax-secondary'),
    );
    item.append(actions);
    list.append(item);
  }
  remind.append(list);

  const cancelled = ledger.events.filter((e) => e.cancelled);
  if (cancelled.length > 0) {
    const details = el('details', '', 'tax-details');
    details.append(el('summary', `中止にした開催（${cancelled.length}件）`));
    const cl = el('ul', '', 'tax-list');
    for (const e of cancelled) {
      const item = el('li', '', 'tax-item');
      item.append(el('div', eventLabel(e), 'tax-item-head'));
      item.append(button('中止を取り消す', () => void setCancelled(app, e.id, false), 'tax-secondary'));
      cl.append(item);
    }
    details.append(cl);
    remind.append(details);
  }

  const pl = profitLoss(ledger);
  const summary = el('section', '', 'card');
  summary.append(el('h2', `${ledger.year}年の集計`, 'card-title'));
  const grid = el('div', '', 'tax-summary');
  for (const [label, value] of [
    ['売上', pl.sales],
    ['経費', pl.expenseTotal],
    ['所得', pl.income],
  ] as const) {
    const cell = el('div', '');
    cell.append(el('span', label), el('strong', formatYen(value), `tax-amount${value < 0 ? ' minus' : ''}`));
    grid.append(cell);
  }
  summary.append(grid, el('p', '所得は青色申告特別控除の前の金額です', 'note'));

  root.append(remind, summary);
}

/** '10/04(日) 晴れる屋3 17:10' */
export function eventLabel(e: LedgerEvent): string {
  return `${formatEventDate(e.date)} ${e.venue} ${e.start}`;
}

async function setCancelled(app: App, id: string, cancelled: boolean): Promise<void> {
  await app.save((ledger) => ({ ...ledger, events: ledger.events.map((e) => (e.id === id ? { ...e, cancelled } : e)) }));
}
