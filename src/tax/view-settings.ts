import { el } from '../shared/dom';
import type { App } from './app';
import { parseAmount } from './journal';
import { addJudgeName, moveItem, venueColorOf, venuesOf } from './judges';
import { accountLabel, expenseOrderOf, VENUE_COLORS, type AccountId, type VenueColor } from './ledger';
import { parseTravelTemplate, travelTemplatesOf } from './travel';
import { button, field, input, select, showErrors } from './ui';

const VENUE_COLOR_LABELS: Record<VenueColor, string> = {
  red: '赤',
  orange: 'オレンジ',
  yellow: '黄',
  green: '緑',
  teal: '青緑',
  blue: '青',
  purple: '紫',
  pink: 'ピンク',
};

/** 設定: 記帳開始日・参加費の初期値・経費科目の並び・ジャッジの名前・会場の色・期首残高・ログアウト */
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

  root.append(basic, travel, order, judgeNamesCard(app), venueColorsCard(app), opening, account);
}

/** ジャッジタブのプルダウンの候補 */
function judgeNamesCard(app: App): HTMLElement {
  const card = el('section', '', 'card');
  card.append(el('h2', 'ジャッジの名前', 'card-title'));
  card.append(el('p', 'ジャッジタブの HJ・FJ の候補になります（この並びで出ます）', 'note'));
  const names = app.settings.data.judgeNames ?? [];
  const list = el('ul', '', 'tax-list');
  names.forEach((name, i) => {
    const item = el('li', '', 'tax-item');
    const head = el('div', '', 'tax-item-head');
    head.append(el('span', name));
    const actions = el('div', '', 'tax-actions');
    const move = (to: number) => void app.saveSettings((s) => ({ ...s, judgeNames: moveItem(s.judgeNames ?? [], i, to) }));
    const up = button('↑', () => move(i - 1), 'tax-secondary');
    const down = button('↓', () => move(i + 1), 'tax-secondary');
    const del = button('削除', () => {
      void app.saveSettings((s) => ({ ...s, judgeNames: (s.judgeNames ?? []).filter((_, j) => j !== i) }));
    }, 'tax-secondary');
    up.setAttribute('aria-label', `${name}を上へ`);
    down.setAttribute('aria-label', `${name}を下へ`);
    del.setAttribute('aria-label', `${name}を削除`);
    up.disabled = i === 0;
    down.disabled = i === names.length - 1;
    actions.append(up, down, del);
    head.append(actions);
    item.append(head);
    list.append(item);
  });
  if (names.length > 0) card.append(list);
  const form = el('form', '', 'tax-form') as HTMLFormElement;
  form.noValidate = true;
  const name = input('text', '', { placeholder: '例: たか' });
  const fields = { name: field('名前', name) };
  form.append(fields.name.wrap, el('button', '名前を追加', 'submit-wide'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const trimmed = name.value.trim();
    const error = trimmed === '' ? '名前を入力してください' : names.includes(trimmed) ? 'すでに登録しています' : '';
    showErrors(fields, error ? { name: error } : {});
    if (error) return;
    void app.saveSettings((s) => ({ ...s, judgeNames: addJudgeName(s.judgeNames ?? [], trimmed) }));
  });
  card.append(form);
  return card;
}

/** ジャッジタブの会場名の札の色 */
function venueColorsCard(app: App): HTMLElement {
  const card = el('section', '', 'card');
  card.append(el('h2', '会場の色', 'card-title'));
  card.append(el('p', 'ジャッジタブの会場名の色です。主な会場には初めから色が付いています', 'note'));
  const list = el('ul', '', 'tax-list');
  const options = [{ value: 'none', label: 'なし' }, ...VENUE_COLORS.map((c) => ({ value: c, label: VENUE_COLOR_LABELS[c] }))];
  for (const venue of venuesOf(app.schedule)) {
    const item = el('li', '', 'tax-item');
    const head = el('div', '', 'tax-item-head');
    const current = venueColorOf(app.settings.data, venue);
    head.append(el('span', venue, `tax-venue tax-venue-${current}`));
    const colorSel = select(options, current);
    colorSel.setAttribute('aria-label', `${venue}の色`);
    colorSel.addEventListener('change', () => {
      // 「なし」も 'none' として残す（消すと初期値の色に戻ってしまうため）
      void app.saveSettings((s) => ({ ...s, venueColors: { ...s.venueColors, [venue]: colorSel.value as VenueColor | 'none' } }));
    });
    head.append(colorSel);
    item.append(head);
    list.append(item);
  }
  card.append(list);
  return card;
}
