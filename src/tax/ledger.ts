/** 勘定科目 */
export type AccountId =
  | 'cash'
  | 'bank'
  | 'ownerDraw'
  | 'ownerLoan'
  | 'capital'
  | 'sales'
  | 'rent'
  | 'advertising'
  | 'travel'
  | 'entertainment'
  | 'supplies'
  | 'communication'
  | 'fees'
  | 'misc';

export type AccountKind = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

/** ドライブに保存した領収書ファイル */
export type Receipt = { fileId: string; name: string; mimeType: string };

/** 経費の支払方法。クレカ・PayPay・交通系IC は個人のもの（事業主借）として扱う */
export type PaymentMethod = 'cash' | 'bank' | 'personal' | 'card' | 'paypay' | 'ic';

/** 1取引＝1仕訳（借方1つ・貸方1つ） */
export type Transaction = {
  id: string;
  kind: 'sale' | 'expense' | 'transfer';
  /** 'YYYY-MM-DD' */
  date: string;
  /** 円（正の整数） */
  amount: number;
  debit: AccountId;
  credit: AccountId;
  /** 開催 ID（大会詳細ページの URL）。売上は必須、経費は任意 */
  eventId?: string;
  /** 経費の支払方法（追加前に入力した経費にはない。paymentOf で貸方から判断する） */
  payment?: PaymentMethod;
  participants?: number;
  fee?: number;
  counterparty?: string;
  memo?: string;
  receipts: Receipt[];
  /** ISO 日時 */
  updatedAt: string;
};

/** 帳簿に取り込んだ開催 */
export type LedgerEvent = { id: string; date: string; venue: string; start: string; cancelled: boolean };

/** 1年分の帳簿（ドライブの ledger-YYYY.json） */
export type Ledger = {
  year: number;
  /** 期首残高。元入金 = cash + bank */
  opening: { cash: number; bank: number };
  /** 開催日がその年の開催だけ */
  events: LedgerEvent[];
  transactions: Transaction[];
  /** 保存のたびに1増やす。他の端末で保存されたかをこれで判定する（古いファイルにはない＝0） */
  rev?: number;
};

/** 設定（ドライブの settings.json） */
export type Settings = {
  /** 記帳開始日。これより前の開催はリマインドしない */
  startDate: string;
  /** 参加費の初期値 */
  defaultFee: number;
  /** 経費科目の表示順 */
  expenseOrder: AccountId[];
  /** 保存のたびに1増やす（Ledger.rev と同じ） */
  rev?: number;
};

/** 勘定科目の一覧。表示名は決算書の科目名 */
export const ACCOUNTS: { id: AccountId; label: string; kind: AccountKind; hint?: string }[] = [
  { id: 'cash', label: '現金', kind: 'asset' },
  { id: 'bank', label: '普通預金', kind: 'asset' },
  { id: 'ownerDraw', label: '事業主貸', kind: 'asset' },
  { id: 'ownerLoan', label: '事業主借', kind: 'liability' },
  { id: 'capital', label: '元入金', kind: 'equity' },
  { id: 'sales', label: '売上高', kind: 'revenue' },
  { id: 'rent', label: '地代家賃', kind: 'expense', hint: '会場費など' },
  { id: 'advertising', label: '広告宣伝費', kind: 'expense', hint: '賞品代など' },
  { id: 'travel', label: '旅費交通費', kind: 'expense', hint: '電車・バス・駐車場など' },
  { id: 'entertainment', label: '接待交際費', kind: 'expense', hint: '打ち合わせ・お礼の飲食など' },
  { id: 'supplies', label: '消耗品費', kind: 'expense', hint: 'スリーブ・文房具など' },
  { id: 'communication', label: '通信費', kind: 'expense', hint: '携帯・切手など' },
  { id: 'fees', label: '支払手数料', kind: 'expense', hint: '振込手数料など' },
  { id: 'misc', label: '雑費', kind: 'expense', hint: 'ほかに当てはまらないもの' },
];

export const EXPENSE_ACCOUNTS: AccountId[] = ACCOUNTS.filter((a) => a.kind === 'expense').map((a) => a.id);

/** 経費の支払方法と、貸方に記入する科目 */
export const PAYMENT_METHODS: { id: PaymentMethod; label: string; account: AccountId }[] = [
  { id: 'cash', label: '現金', account: 'cash' },
  { id: 'bank', label: '普通預金', account: 'bank' },
  { id: 'personal', label: '個人のお金', account: 'ownerLoan' },
  { id: 'card', label: 'クレカ', account: 'ownerLoan' },
  { id: 'paypay', label: 'PayPay', account: 'ownerLoan' },
  { id: 'ic', label: '交通系IC', account: 'ownerLoan' },
];

/** 経費の支払方法。支払方法のない以前の経費は貸方の科目から判断する。経費以外は undefined */
export function paymentOf(tx: Transaction): PaymentMethod | undefined {
  if (tx.kind !== 'expense') return undefined;
  if (tx.payment) return tx.payment;
  return tx.credit === 'cash' ? 'cash' : tx.credit === 'bank' ? 'bank' : 'personal';
}

export function paymentLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.id === method)!.label;
}

export function accountLabel(id: AccountId): string {
  return ACCOUNTS.find((a) => a.id === id)!.label;
}

/** 借方に記入すると残高が増える科目（資産・経費） */
export function isDebitNormal(id: AccountId): boolean {
  const kind = ACCOUNTS.find((a) => a.id === id)!.kind;
  return kind === 'asset' || kind === 'expense';
}

export function DEFAULT_SETTINGS(today: string): Settings {
  return { startDate: today, defaultFee: 0, expenseOrder: [...EXPENSE_ACCOUNTS] };
}
