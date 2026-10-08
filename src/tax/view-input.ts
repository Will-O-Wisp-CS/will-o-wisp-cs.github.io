import { el } from '../shared/dom';
import type { App } from './app';
import { ensureFresh, fileUrl } from './drive';
import { todayJst } from './format';
import { defaultSaleAmount, parseExpense, parseSale, parseTransfer, type TxDraft, type TxResult } from './journal';
import { ACCOUNTS, accountLabel, expenseOrderOf, PAYMENT_METHODS, paymentOf, type AccountId, type PaymentMethod, type Transaction } from './ledger';
import { pendingEvents } from './reminder';
import { attachReceipts, renameReceipts, trashReceipts } from './store';
import { button, field, input, select, showErrors, type Field } from './ui';
import { eventLabel } from './view-home';

type Kind = Transaction['kind'];
const KIND_LABELS: Record<Kind, string> = { sale: '売上', expense: '経費', transfer: '振替' };
const TRANSFER_FROM: AccountId[] = ['cash', 'bank', 'ownerLoan'];
const TRANSFER_TO: AccountId[] = ['cash', 'bank', 'ownerDraw'];
const TRANSFER_LABELS: Partial<Record<AccountId, string>> = {
  cash: '現金',
  bank: '普通預金',
  ownerLoan: '個人のお金（事業主借）',
  ownerDraw: '個人で使う（事業主貸）',
};

let currentKind: Kind = 'expense';

/** 入力: 売上 / 経費 / 振替。編集中の取引があればその内容で開く */
export function render(root: HTMLElement, app: App): void {
  const ctx = app.inputContext;
  const editing = ctx?.mode === 'edit' ? app.ledger.data.transactions.find((t) => t.id === ctx.id) : undefined;
  if (ctx?.mode === 'sale') currentKind = 'sale';
  if (editing) currentKind = editing.kind;

  const section = el('section', '', 'card');
  section.append(el('h2', editing ? '取引を編集' : '入力', 'card-title'));

  if (!editing) {
    const sub = el('div', '', 'tax-sub');
    for (const kind of Object.keys(KIND_LABELS) as Kind[]) {
      const b = button(KIND_LABELS[kind], () => {
        currentKind = kind;
        app.inputContext = null;
        root.replaceChildren();
        render(root, app);
      });
      b.setAttribute('aria-pressed', String(kind === currentKind));
      sub.append(b);
    }
    section.append(sub);
  }

  const form = el('form', '', 'tax-form') as HTMLFormElement;
  form.noValidate = true;
  const build = { sale: saleForm, expense: expenseForm, transfer: transferForm }[currentKind];
  const { fields, parse, files } = build(form, app, editing, ctx?.mode === 'sale' ? ctx.eventId : '');

  const actions = el('div', '', 'tax-actions');
  const submit = el('button', editing ? '保存' : '記録する', 'submit-wide') as HTMLButtonElement;
  actions.append(submit);
  if (editing) {
    actions.append(
      button('削除', () => void remove(app, editing), 'tax-secondary'),
      button('やめる', () => {
        app.inputContext = null;
        root.replaceChildren();
        render(root, app);
      }, 'tax-secondary'),
    );
  }
  form.append(actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = parse();
    showErrors(fields, result.ok ? {} : result.errors);
    if (!result.ok) return;
    submit.disabled = true;
    void save(app, result.tx, editing, files()).finally(() => {
      submit.disabled = false;
    });
  });

  section.append(form);
  root.append(section);
}

type Built = { fields: Record<string, Field>; parse: () => TxResult; files: () => File[] };

function eventOptions(app: App, emptyLabel: string) {
  return [
    { value: '', label: emptyLabel },
    ...app.ledger.data.events.filter((e) => !e.cancelled).map((e) => ({ value: e.id, label: eventLabel(e) })),
  ];
}

function defaultDate(app: App): string {
  const today = todayJst(new Date());
  return today.startsWith(`${app.ledger.data.year}-`) ? today : `${app.ledger.data.year}-12-31`;
}

function saleForm(form: HTMLFormElement, app: App, editing: Transaction | undefined, eventId: string): Built {
  const ledger = app.ledger.data;
  const initialEvent = editing?.eventId ?? (eventId || pendingEvents(ledger, app.settings.data.startDate, new Date())[0]?.id || '');
  const eventSel = select(eventOptions(app, '開催を選ぶ'), initialEvent);
  const participants = input('text', editing ? String(editing.participants ?? '') : '', { inputmode: 'numeric', placeholder: '例: 32' });
  const feeDefault = app.settings.data.defaultFee ? String(app.settings.data.defaultFee) : '';
  const fee = input('text', editing ? String(editing.fee ?? '') : feeDefault, { inputmode: 'numeric', placeholder: '例: 1000' });
  const amount = input('text', editing ? String(editing.amount) : '', { inputmode: 'numeric' });
  let amountTouched = Boolean(editing);
  const refresh = () => {
    if (!amountTouched) amount.value = defaultSaleAmount(participants.value, fee.value);
  };
  participants.addEventListener('input', refresh);
  fee.addEventListener('input', refresh);
  amount.addEventListener('input', () => {
    amountTouched = true;
  });
  const fields = {
    eventId: field('開催', eventSel),
    participants: field('参加人数', participants),
    fee: field('参加費（1人）', fee),
    amount: field('受け取った金額', amount, '人数×参加費。割引・返金があれば直す'),
  };
  form.append(...Object.values(fields).map((f) => f.wrap));
  return {
    fields,
    files: () => [],
    parse: () => {
      const date = ledger.events.find((e) => e.id === eventSel.value)?.date ?? '';
      return parseSale(
        { eventId: eventSel.value, date, participants: participants.value, fee: fee.value, amount: amount.value },
        ledger.year,
      );
    },
  };
}

function expenseForm(form: HTMLFormElement, app: App, editing: Transaction | undefined): Built {
  const date = input('date', editing?.date ?? defaultDate(app));
  const amount = input('text', editing ? String(editing.amount) : '', { inputmode: 'numeric', placeholder: '例: 5500' });
  const account = select(
    [
      { value: '', label: '科目を選ぶ' },
      ...expenseOrderOf(app.settings.data.expenseOrder).map((id) => {
        const a = ACCOUNTS.find((x) => x.id === id)!;
        return { value: id, label: a.hint ? `${a.label}（${a.hint}）` : a.label };
      }),
    ],
    editing?.debit ?? '',
  );
  const payment = select(
    [{ value: '', label: '支払方法を選ぶ' }, ...PAYMENT_METHODS.map((m) => ({ value: m.id, label: m.label }))],
    (editing && paymentOf(editing)) ?? '',
  );
  const counterparty = input('text', editing?.counterparty ?? '', { placeholder: '例: 晴れる屋' });
  const memo = input('text', editing?.memo ?? '', { placeholder: '例: 10/4 会場費' });
  const eventSel = select(eventOptions(app, 'なし'), editing?.eventId ?? '');
  // 開催を選んだら、日付をその開催日にする
  eventSel.addEventListener('change', () => {
    const event = app.ledger.data.events.find((e) => e.id === eventSel.value);
    if (event) date.value = event.date;
  });
  const fields = {
    eventId: field('開催', eventSel, '会場費・賞品代など開催の経費なら選ぶ（日付も入ります）'),
    date: field('日付', date),
    amount: field('金額', amount),
    account: field('科目', account),
    payment: field('支払方法', payment, 'クレカ・PayPay・交通系IC は個人のお金として記帳'),
    counterparty: field('取引先', counterparty),
    memo: field('メモ', memo),
  };
  form.append(...Object.values(fields).map((f) => f.wrap));
  const files = receiptPicker(form, editing);
  return {
    fields,
    files,
    parse: () =>
      parseExpense(
        {
          date: date.value,
          amount: amount.value,
          account: account.value as AccountId | '',
          payment: payment.value as PaymentMethod | '',
          counterparty: counterparty.value,
          memo: memo.value,
          eventId: eventSel.value,
        },
        app.ledger.data.year,
      ),
  };
}

function transferForm(form: HTMLFormElement, app: App, editing: Transaction | undefined): Built {
  const date = input('date', editing?.date ?? defaultDate(app));
  const amount = input('text', editing ? String(editing.amount) : '', { inputmode: 'numeric' });
  const options = (ids: AccountId[], empty: string) => [
    { value: '', label: empty },
    ...ids.map((id) => ({ value: id, label: TRANSFER_LABELS[id] ?? accountLabel(id) })),
  ];
  const from = select(options(TRANSFER_FROM, '移動元を選ぶ'), editing?.credit ?? '');
  const to = select(options(TRANSFER_TO, '移動先を選ぶ'), editing?.debit ?? '');
  const memo = input('text', editing?.memo ?? '', { placeholder: '例: 生活費に回す' });
  const fields = {
    date: field('日付', date),
    amount: field('金額', amount),
    from: field('移動元', from),
    to: field('移動先', to),
    memo: field('メモ', memo),
  };
  form.append(...Object.values(fields).map((f) => f.wrap));
  return {
    fields,
    files: () => [],
    parse: () =>
      parseTransfer(
        { date: date.value, amount: amount.value, from: from.value as AccountId | '', to: to.value as AccountId | '', memo: memo.value },
        app.ledger.data.year,
      ),
  };
}

/** 領収書の追加（capture なし: スマホで撮影とファイル選択の両方を選べる） */
function receiptPicker(form: HTMLFormElement, editing: Transaction | undefined): () => File[] {
  const wrap = el('div', '', 'field');
  wrap.append(el('label', '領収書'));
  if (editing && editing.receipts.length > 0) {
    const existing = el('ul', '', 'tax-files');
    for (const r of editing.receipts) {
      const li = document.createElement('li');
      const a = el('a', r.name) as HTMLAnchorElement;
      a.href = fileUrl(r.fileId);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.append(a);
      existing.append(li);
    }
    wrap.append(existing);
  }
  const picker = el('label', '＋ 領収書を追加（撮影・ファイル）', 'tax-upload');
  const fileInput = input('file', '', { accept: 'image/*,application/pdf', multiple: '' });
  picker.append(fileInput);
  const chosen = el('ul', '', 'tax-files');
  let files: File[] = [];
  fileInput.addEventListener('change', () => {
    files = [...files, ...Array.from(fileInput.files ?? [])];
    fileInput.value = '';
    chosen.replaceChildren(...files.map((f) => el('li', `${f.name}（保存時にアップロード）`)));
  });
  wrap.append(picker, chosen);
  form.append(wrap);
  return () => files;
}

async function save(app: App, draft: TxDraft, editing: Transaction | undefined, files: File[]): Promise<void> {
  // 画像の縮小などで時間が経つ前（クリック直後）にトークンの取り直しを始める
  const fresh = ensureFresh();
  const ledger = app.ledger.data;
  const tx: Transaction = {
    ...draft,
    id: editing?.id ?? crypto.randomUUID(),
    receipts: editing?.receipts ?? [],
    updatedAt: new Date().toISOString(),
  };
  try {
    await fresh;
    const renamed =
      editing && (editing.date !== tx.date || editing.amount !== tx.amount || editing.counterparty !== tx.counterparty);
    if (renamed && tx.receipts.length > 0) tx.receipts = await renameReceipts(tx);
    if (files.length > 0) tx.receipts = [...tx.receipts, ...(await attachReceipts(ledger.year, tx, files))];
  } catch (e) {
    app.fail(e);
    return;
  }
  const context = app.inputContext;
  app.inputContext = null;
  const ok = await app.save((latest) => ({
    ...latest,
    transactions: editing ? latest.transactions.map((t) => (t.id === tx.id ? tx : t)) : [...latest.transactions, tx],
  }));
  if (!ok) {
    app.inputContext = context;
    return;
  }
  const fee = tx.fee;
  if (tx.kind === 'sale' && fee && fee !== app.settings.data.defaultFee) {
    // 売上は保存済み。ここで失敗しても売上の入れ直しを促さない
    await app.saveSettings((s) => ({ ...s, defaultFee: fee }), '売上は保存しました（参加費の初期値は更新できませんでした）');
  }
}

async function remove(app: App, tx: Transaction): Promise<void> {
  const note = tx.receipts.length > 0 ? `\n領収書 ${tx.receipts.length} 件はドライブのゴミ箱に移します。` : '';
  if (!confirm(`この取引を削除しますか？${note}`)) return;
  app.inputContext = null;
  const ok = await app.save((ledger) => ({ ...ledger, transactions: ledger.transactions.filter((t) => t.id !== tx.id) }));
  if (!ok) {
    app.inputContext = { mode: 'edit', id: tx.id };
    return;
  }
  try {
    await trashReceipts(tx);
  } catch (e) {
    app.fail(e);
  }
}
