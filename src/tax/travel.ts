import { parseAmount, type TxDraft } from './journal';
import type { AccountId, PaymentMethod, Settings, TravelTemplate } from './ledger';

export type Trip = 'oneWay' | 'roundTrip';

/** 科目を選んだときの支払方法の初期値。旅費交通費は交通系IC */
export function defaultPaymentFor(account: AccountId | ''): PaymentMethod | undefined {
  return account === 'travel' ? 'ic' : undefined;
}

/** 片道は1件、往復は同じ内容で2件 */
export function tripTransactions(draft: TxDraft, trip: Trip): TxDraft[] {
  return trip === 'roundTrip' ? [{ ...draft }, { ...draft }] : [draft];
}

export type TemplateResult = { ok: true; template: TravelTemplate } | { ok: false; errors: Record<string, string> };

/** テンプレの入力（区間・片道運賃） */
export function parseTravelTemplate(label: string, amount: string): TemplateResult {
  const errors: Record<string, string> = {};
  const name = label.trim();
  if (!name) errors.label = '区間を入力してください';
  const fare = parseAmount(amount, '運賃');
  if (!fare.ok) errors.amount = fare.message;
  if (Object.keys(errors).length > 0 || !fare.ok) return { ok: false, errors };
  return { ok: true, template: { label: name, amount: fare.value } };
}

export function travelTemplatesOf(settings: Settings): TravelTemplate[] {
  return settings.travelTemplates ?? [];
}
