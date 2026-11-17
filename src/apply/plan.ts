/**
 * 1アカウント分の指定を、月の申請画面の空き枠に割り当てる。
 * 迷う場合（空きが足りない・保存のみの開催がある）は勝手に選ばず、そのアカウントの指定をすべて飛ばす。
 */
import { slotLabel, type Account, type SlotRequest } from './input.ts';
import { APPLIED_STATUSES, type MonthPage, type MonthRow } from './menu.ts';

export type AccountPlan = {
  apply: { request: SlotRequest }[];
  skipped: { request: SlotRequest; reason: string }[];
};

export type SlotResult = { label: string; date: string | null; venue: string | null; state: string };

const skipAll = (requests: SlotRequest[], reason: string): AccountPlan => ({
  apply: [],
  skipped: requests.map((request) => ({ request, reason })),
});

export function planAccount(requests: SlotRequest[], row: MonthRow | null, page: MonthPage | null): AccountPlan {
  if (!row || !row.open || !page) return skipAll(requests, '申請受付期間外');
  if (page.registered.some((r) => !APPLIED_STATUSES.includes(r.status))) {
    return skipAll(requests, '保存のみ（未申請）の開催あり。画面で確かめてください');
  }
  const registeredDates = new Set(page.registered.map((r) => r.date));
  const skipped: AccountPlan['skipped'] = [];
  const rest: SlotRequest[] = [];
  for (const request of requests) {
    if (registeredDates.has(request.date)) skipped.push({ request, reason: '同じ日付の開催が登録済み' });
    else rest.push(request);
  }
  if (rest.length > page.free) {
    const reason = `空き枠が足りません（空き ${page.free}）`;
    return { apply: [], skipped: [...skipped, ...rest.map((request) => ({ request, reason }))] };
  }
  return { apply: rest.map((request) => ({ request })), skipped };
}

/**
 * 1アカウント分の状態表の行。登録済みの開催を日付順に①②と並べ、今回の結果（申請・飛ばした指定）を後ろに足す。
 * 2行に満たなければ「空き」（画面を読めなかったときは「不明」）で埋める。
 */
export function accountSlots(
  account: Account,
  page: MonthPage | null,
  results: { request: SlotRequest; state: string }[],
): SlotResult[] {
  const rows: Omit<SlotResult, 'label'>[] = [
    ...[...(page?.registered ?? [])]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ date: r.date, venue: null, state: r.status })),
    ...results.map((r) => ({ date: r.request.date, venue: r.request.venue, state: r.state })),
  ];
  while (rows.length < 2) rows.push({ date: null, venue: null, state: page ? '空き' : '不明' });
  return rows.map((row, i) => ({
    label: i < 2 ? `${account}${i === 0 ? '①' : '②'}` : `${account}（指定 ${slotLabel(results[i - (rows.length - results.length)].request.slot)}）`,
    ...row,
  }));
}
