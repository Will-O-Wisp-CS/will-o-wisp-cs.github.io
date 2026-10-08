import type { ParseResult } from '../shared/parse';
import type { AccountId, Transaction } from './ledger';

/** 保存前の取引（ID・領収書・更新日時は保存時に付ける） */
export type TxDraft = Omit<Transaction, 'id' | 'receipts' | 'updatedAt'>;

/** 取引の入力のパース結果。errors のキーは入力欄名 */
export type TxResult = { ok: true; tx: TxDraft } | { ok: false; errors: Record<string, string> };

const TRANSFER_FROM: AccountId[] = ['cash', 'bank', 'ownerLoan'];
const TRANSFER_TO: AccountId[] = ['cash', 'bank', 'ownerDraw'];

/** 金額（円）。全角・カンマ・¥・円を受け付け、1以上の整数だけ通す */
export function parseAmount(raw: string, label: string): ParseResult {
  const text = raw.normalize('NFKC').replace(/[,¥￥円\s]/g, '');
  if (text === '') return { ok: false, message: `${label}を入力してください` };
  if (!/^\d+$/.test(text)) return { ok: false, message: `${label}は整数で入力してください` };
  const value = Number(text);
  if (value < 1) return { ok: false, message: `${label}は1以上で入力してください` };
  return { ok: true, value };
}

/** 売上金額の初期値（参加人数 × 参加費）。どちらかが数値でなければ空 */
export function defaultSaleAmount(participants: string, fee: string): string {
  const p = parseAmount(participants, '');
  const f = parseAmount(fee, '');
  return p.ok && f.ok ? String(p.value * f.value) : '';
}

export function parseSale(
  input: { eventId: string; date: string; participants: string; fee: string; amount: string },
  year: number,
): TxResult {
  const errors: Record<string, string> = {};
  if (!input.eventId) errors.eventId = '開催を選んでください';
  const date = checkDate(input.date, year, errors);
  const participants = field(parseAmount(input.participants, '参加人数'), 'participants', errors);
  const fee = field(parseAmount(input.fee, '参加費'), 'fee', errors);
  const amount = field(parseAmount(input.amount, '金額'), 'amount', errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    tx: { kind: 'sale', date, amount, debit: 'cash', credit: 'sales', eventId: input.eventId, participants, fee },
  };
}

export function parseExpense(
  input: {
    date: string;
    amount: string;
    account: AccountId | '';
    payment: AccountId | '';
    counterparty: string;
    memo: string;
    eventId: string;
  },
  year: number,
): TxResult {
  const errors: Record<string, string> = {};
  const date = checkDate(input.date, year, errors);
  const amount = field(parseAmount(input.amount, '金額'), 'amount', errors);
  if (!input.account) errors.account = '科目を選んでください';
  if (!input.payment) errors.payment = '支払方法を選んでください';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const tx: TxDraft = {
    kind: 'expense',
    date,
    amount,
    debit: input.account as AccountId,
    credit: input.payment as AccountId,
    counterparty: input.counterparty.trim(),
    memo: input.memo.trim(),
  };
  if (input.eventId) tx.eventId = input.eventId;
  return { ok: true, tx };
}

export function parseTransfer(
  input: { date: string; amount: string; from: AccountId | ''; to: AccountId | ''; memo: string },
  year: number,
): TxResult {
  const errors: Record<string, string> = {};
  const date = checkDate(input.date, year, errors);
  const amount = field(parseAmount(input.amount, '金額'), 'amount', errors);
  if (!input.from || !TRANSFER_FROM.includes(input.from)) errors.from = '移動元を選んでください';
  if (!input.to || !TRANSFER_TO.includes(input.to)) errors.to = '移動先を選んでください';
  else if (input.from === input.to) errors.to = '移動元と違うものを選んでください';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    tx: { kind: 'transfer', date, amount, debit: input.to as AccountId, credit: input.from as AccountId, memo: input.memo.trim() },
  };
}

/** 'YYYY-MM-DD' の実在する日付で、帳簿の年と同じか */
function checkDate(raw: string, year: number, errors: Record<string, string>): string {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const valid = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString().slice(0, 10) === raw;
  if (!m || !valid) {
    errors.date = '日付を入力してください';
  } else if (Number(m[1]) !== year) {
    errors.date = `${m[1]}年の帳簿に切り替えてから入力してください`;
  }
  return raw;
}

function field(result: ParseResult, name: string, errors: Record<string, string>): number {
  if (result.ok) return result.value;
  errors[name] = result.message;
  return 0;
}
