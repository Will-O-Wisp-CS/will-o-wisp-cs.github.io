/**
 * 店舗管理画面の HTML（Shift_JIS をデコード済み）を読む。
 * - shopmenu.asp: 申請の一覧から対象月の「公認CSサポートYYYY年M月開催申請」の行
 * - shopevent.asp: 月の申請画面の登録済み開催と空き枠
 */

/** 申請済みとみなす状態。これ以外の状態の登録済み開催は「保存のみ（未申請）」 */
export const APPLIED_STATUSES = ['申請確認中です', '承認されました', '差し戻されました'];

/**
 * eventId = 月の申請画面（shopevent.asp?EventID=…）。申請ボタンもリンクも無い行は null
 * status = 状態の欄。未申請（「申請する」ボタン）なら null
 * open = 申請受付期間内で、申請画面に入れる
 */
export type MonthRow = { eventId: number | null; status: string | null; open: boolean };
export type Registered = { seq: number; date: string; status: string };
/** free = 開催を足せる空き枠の数（空き枠は Seq が空の「○回目開催情報」から足す） */
export type MonthPage = { registered: Registered[]; free: number };

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** '26/11/25' → '2026-11-25' */
function shortDate(s: string): string {
  const [y, m, d] = s.split('/').map(Number);
  return `${2000 + y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** today は JST の 'YYYY-MM-DD' */
export function findMonthRow(html: string, year: number, month: number, today: string): MonthRow | null {
  const name = `公認CSサポート${year}年${month}月開催申請`;
  for (const row of html.split(/<tr[\s>]/i).slice(1)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 5 || text(cells[0]) !== name) continue;
    const window = text(cells[2]).match(/(\d{2}\/\d{2}\/\d{2})\s*～\s*(\d{2}\/\d{2}\/\d{2})/);
    const id = row.match(/shopevent\.asp\?EventID=(\d+)/);
    const eventId = id ? Number(id[1]) : null;
    const status = /value="申請する"/.test(cells[3]) ? null : text(cells[3]) || null;
    const inWindow = !!window && shortDate(window[1]) <= today && today <= shortDate(window[2]);
    return { eventId, status, open: inWindow && eventId !== null };
  }
  return null;
}

export function parseMonthPage(html: string): MonthPage {
  const registered: Registered[] = [];
  let free = 0;
  for (const block of html.split("EventAdd('").slice(1)) {
    const seq = block.match(/^(\d*)'/)?.[1] ?? '';
    const date = block.match(/name="EventDate\d+" value="([^"]*)"/)?.[1] ?? '';
    const status = block.match(/padding:3px;">\s*([^<]+?)\s*<\/td>/)?.[1].trim() ?? '';
    if (!date) {
      free++;
      continue;
    }
    registered.push({ seq: Number(seq), date: date.replaceAll('/', '-'), status });
  }
  return { registered, free };
}

export function isLoginPage(html: string): boolean {
  return /name="LoginID"/.test(html);
}
