/**
 * 店舗管理画面の HTML（Shift_JIS をデコード済み）を読む。
 * - shopmenu.asp: 申請の一覧から対象月の「公認CSサポートYYYY年M月開催申請」の行
 * - shopevent.asp: 月の申請画面の登録済み開催と空き枠
 */

/** 申請済みとみなす状態。これ以外の状態の登録済み開催は「保存のみ（未申請）」 */
export const APPLIED_STATUSES = ['申請確認中です', '承認されました', '差し戻されました'];

/** open = 申請受付期間内で、申請画面に入れる */
export type MonthRow = { eventId: number; status: string | null; open: boolean };
export type Registered = { seq: number; date: string; status: string };
export type MonthPage = { registered: Registered[]; freeSeqs: number[] };
