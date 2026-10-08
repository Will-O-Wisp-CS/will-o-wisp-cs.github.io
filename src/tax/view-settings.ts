import { el } from '../shared/dom';
import type { App } from './app';
import { parseAmount } from './journal';
import { accountLabel, expenseOrderOf, type AccountId } from './ledger';
import { parseTravelTemplate, travelTemplatesOf } from './travel';
import { button, field, input, showErrors } from './ui';

/** 設定: 記帳開始日・参加費の初期値・経費科目の並び・期首残高・ログアウト */
export function render(root: HTMLElement, app: App): void {
  const settings = app.settings.data;
  const ledger = app.ledger.data;

  const basic = el('section', '', 'card');
  basic.append(el('h2', '設定', 'card-title'));
  const form = el('form', '', 'tax-form') as HTMLFormElement;
  form.noValidate = true;
  const startDate = input('date', settings.startDate);
  const fee = input('text', settings.defaultFee ? String(settings.defaultFee) : '', { inputmode: 'numeric' });
  const fields = {
    startDate: field('記帳開始日', startDate, 'この日より前の開催はリマインドしません'),
    fee: field('参加費の初期値', fee),
  };
  form.append(...Object.values(fields).map((f) => f.wrap));
  form.append(el('button', '保存', 'submit-wide'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!startDate.value) errors.startDate = '記帳開始日を入力してください';
    const parsedFee = fee.value.trim() ? parseAmount(fee.value, '参加費') : ({ ok: true, value: 0 } as const);
    if (!parsedFee.ok) errors.fee = parsedFee.message;
    showErrors(fields, errors);
    if (Object.keys(errors).length > 0 || !parsedFee.ok) return;
    void app.saveSettings((s) => ({ ...s, startDate: startDate.value, defaultFee: parsedFee.value }));
  });
  basic.append(form);

  const order = el('section', '', 'card');
  order.append(el('h2', '経費科目の並び', 'card-title'));
  const list = el('ul', '', 'tax-list');
  const move = (i: number, d: number) => {
    void app.saveSettings((s) => {
      const next = expenseOrderOf(s.expenseOrder);
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return { ...s, expenseOrder: next as AccountId[] };
    });
  };
  const expenseOrder = expenseOrderOf(settings.expenseOrder);
  expenseOrder.forEach((id, i) => {
    const item = el('li', '', 'tax-item');
    const head = el('div', '', 'tax-item-head');
    head.append(el('span', accountLabel(id)));
    const actions = el('div', '', 'tax-actions');
    const up = button('↑', () => move(i, -1), 'tax-secondary');
    const down = button('↓', () => move(i, 1), 'tax-secondary');
    up.setAttribute('aria-label', `${accountLabel(id)}を上へ`);
    down.setAttribute('aria-label', `${accountLabel(id)}を下へ`);
    up.disabled = i === 0;
    down.disabled = i === expenseOrder.length - 1;
    actions.append(up, down);
    head.append(actions);
    item.append(head);
    list.append(item);
  });
  order.append(list);

  const travel = el('section', '', 'card');
  travel.append(el('h2', '旅費交通費のテンプレ', 'card-title'));
  travel.append(el('p', '経費で旅費交通費を選ぶと、ここの区間から金額（片道）を選べます', 'note'));
  const templates = travelTemplatesOf(settings);
  const tlist = el('ul', '', 'tax-list');
  templates.forEach((t, i) => {
    const item = el('li', '', 'tax-item');
    const head = el('div', '', 'tax-item-head');
    head.append(el('span', t.label), el('span', `${t.amount.toLocaleString()}円`, 'tax-amount'));
    const del = button('削除', () => {
      void app.saveSettings((s) => ({ ...s, travelTemplates: travelTemplatesOf(s).filter((_, j) => j !== i) }));
    }, 'tax-secondary');
    del.setAttribute('aria-label', `${t.label}を削除`);
    item.append(head, del);
    tlist.append(item);
  });
  if (templates.length > 0) travel.append(tlist);
  const tform = el('form', '', 'tax-form') as HTMLFormElement;
  tform.noValidate = true;
  const label = input('text', '', { placeholder: '例: 笹塚⇔新宿' });
  const fare = input('text', '', { inputmode: 'numeric', placeholder: '例: 140' });
  const tfields = { label: field('区間', label), amount: field('片道の運賃', fare) };
  tform.append(tfields.label.wrap, tfields.amount.wrap, el('button', 'テンプレを追加', 'submit-wide'));
  tform.addEventListener('submit', (event) => {
    event.preventDefault();
    const r = parseTravelTemplate(label.value, fare.value);
    showErrors(tfields, r.ok ? {} : r.errors);
    if (!r.ok) return;
    void app.saveSettings((s) => ({ ...s, travelTemplates: [...travelTemplatesOf(s), r.template] }));
  });
  travel.append(tform);

  const opening = el('section', '', 'card');
  opening.append(el('h2', `${ledger.year}年の期首残高`, 'card-title'));
  if (app.openingLocked) {
    opening.append(
      el('p', `現金 ${ledger.opening.cash.toLocaleString()}円 / 普通預金 ${ledger.opening.bank.toLocaleString()}円`, 'rules-text'),
      el('p', `${ledger.year - 1}年の帳簿の期末残高から自動で決まります`, 'note'),
    );
  } else {
    if (ledger.transactions.length > 0) {
      opening.append(el('p', '取引の入力後に変えると、決算書の期首の数字が変わります。最初の年の入力ミスを直すときだけ変えてください', 'note'));
    }
    const oform = el('form', '', 'tax-form') as HTMLFormElement;
    oform.noValidate = true;
    const cash = input('text', String(ledger.opening.cash), { inputmode: 'numeric' });
    const bank = input('text', String(ledger.opening.bank), { inputmode: 'numeric' });
    const ofields = { cash: field('現金', cash), bank: field('普通預金', bank) };
    oform.append(...Object.values(ofields).map((f) => f.wrap), el('button', '期首残高を保存', 'submit-wide'));
    oform.addEventListener('submit', (event) => {
      event.preventDefault();
      const errors: Record<string, string> = {};
      const amount = (raw: string, name: string, label: string) => {
        if (raw.normalize('NFKC').trim() === '0') return 0;
        const r = parseAmount(raw, label);
        if (!r.ok) errors[name] = r.message;
        return r.ok ? r.value : 0;
      };
      const next = { cash: amount(cash.value, 'cash', '現金'), bank: amount(bank.value, 'bank', '普通預金') };
      showErrors(ofields, errors);
      if (Object.keys(errors).length === 0) void app.save((l) => ({ ...l, opening: next }));
    });
    opening.append(oform);
  }

  const account = el('section', '', 'card');
  account.append(el('h2', 'ログイン', 'card-title'));
  account.append(button('ログアウト', () => app.signOut(), 'tax-secondary'));

  root.append(basic, travel, order, opening, account);
}
