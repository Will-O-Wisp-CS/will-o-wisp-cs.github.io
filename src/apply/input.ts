/**
 * Run workflow の入力（申請する月・6枠の会場と日付と受付開始・確認だけ）を解釈する。
 * 誤りは全部集めて返し、1つでもあればどの枠も申請しない。
 */

export type Account = 'A' | 'B' | 'C';
export type SlotKey = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';
export const SLOT_KEYS: SlotKey[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

/** reception は受付開始 'HH:MM'。null なら会場のひな形の時刻 */
export type SlotRequest = { slot: SlotKey; account: Account; venue: string; date: string; reception: string | null };
export type ApplyInput = { year: number; month: number; dryRun: boolean; requests: SlotRequest[] };

/** 'a1' → 'A①' */
export function slotLabel(slot: SlotKey): string {
  return `${slot[0].toUpperCase()}${slot[1] === '1' ? '①' : '②'}`;
}

export function slotAccount(slot: SlotKey): Account {
  return slot[0].toUpperCase() as Account;
}

/** 全角を半角にし、ハイフンの仲間（−・ー など）を - にそろえる */
function normalize(text: string): string {
  return text.normalize('NFKC').replace(/[−‐‑–—ー]/g, '-').trim();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** '10' / '1/10' / '2027-01-10'（全角可）→ 'YYYY-MM-DD'。申請する月の日付だけ受け付ける */
export function parseDay(
  text: string,
  year: number,
  month: number,
): { ok: true; date: string } | { ok: false; message: string } {
  const t = normalize(text);
  let y = year;
  let m = month;
  let d: number;
  let match: RegExpMatchArray | null;
  if ((match = t.match(/^(\d{1,2})$/))) {
    d = Number(match[1]);
  } else if ((match = t.match(/^(\d{1,2})\s*[/月]\s*(\d{1,2})\s*日?$/))) {
    m = Number(match[1]);
    d = Number(match[2]);
  } else if ((match = t.match(/^(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})\s*日?$/))) {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else {
    return { ok: false, message: `日付は 10 / 1/10 / 2027-01-10 の形で入れてください: ${text}` };
  }
  if (y !== year || m !== month) {
    return { ok: false, message: `${year}年${month}月の日付ではありません: ${text}` };
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (d < 1 || d > lastDay) return { ok: false, message: `存在しない日付です: ${text}` };
  return { ok: true, date: `${year}-${pad(month)}-${pad(d)}` };
}

/** '10:40' / '1040' / '10時40分' / '10時'（全角可）→ 'HH:MM' */
export function parseTime(text: string): { ok: true; time: string } | { ok: false; message: string } {
  const t = normalize(text).replace(/\s+/g, '');
  const match = t.match(/^(\d{1,2}):(\d{2})$/) ?? t.match(/^(\d{1,2})(\d{2})$/) ?? t.match(/^(\d{1,2})時(?:(\d{1,2})分)?$/);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2] ?? 0);
  if (!match || hour > 23 || minute > 59) {
    return { ok: false, message: `受付開始は 10:40 / 1040 / 10時40分 の形で入れてください: ${text}` };
  }
  return { ok: true, time: `${pad(hour)}:${pad(minute)}` };
}

function parseMonth(text: string): { year: number; month: number } | null {
  const m = normalize(text).match(/^(\d{4})\s*(?:[-/]|年)\s*(\d{1,2})\s*月?$/);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month };
}

export function parseApplyInput(
  raw: Record<string, string | undefined>,
  venueNames: string[],
): { ok: true; value: ApplyInput } | { ok: false; messages: string[] } {
  const messages: string[] = [];
  const ym = parseMonth(raw.month ?? '');
  if (!ym) {
    return { ok: false, messages: [`申請する月は 2027-01 や 2027年1月 の形で入れてください: ${raw.month ?? '（空欄）'}`] };
  }
  const requests: SlotRequest[] = [];
  for (const slot of SLOT_KEYS) {
    const label = slotLabel(slot);
    // 会場の選択肢の「なし」は空欄と同じ（Run workflow の choice は空の選択肢を置けないため）
    const venueText = normalize(raw[`${slot}_venue`] ?? '');
    const venue = venueText === 'なし' ? '' : venueText;
    const dateText = (raw[`${slot}_date`] ?? '').trim();
    const receptionText = (raw[`${slot}_reception`] ?? '').trim();
    if (!venue && !dateText && !receptionText) continue;
    if (!venue && !dateText) {
      messages.push(`${label}: 受付開始だけでなく会場と日付も入れてください`);
      continue;
    }
    if (!venue || !dateText) {
      messages.push(`${label}: 会場と日付の両方を入れてください`);
      continue;
    }
    const name = venueNames.find((v) => normalize(v) === venue);
    if (!name) {
      messages.push(`${label}: 会場「${venue}」のひな形がありません`);
      continue;
    }
    const day = parseDay(dateText, ym.year, ym.month);
    if (!day.ok) {
      messages.push(`${label}: ${day.message}`);
      continue;
    }
    let reception: string | null = null;
    if (receptionText) {
      const time = parseTime(receptionText);
      if (!time.ok) {
        messages.push(`${label}: ${time.message}`);
        continue;
      }
      reception = time.time;
    }
    const same = requests.find((r) => r.venue === name && r.date === day.date);
    if (same) {
      messages.push(`${label}: ${slotLabel(same.slot)} と同じ日付・会場です`);
      continue;
    }
    // 同じアカウントの2枠が同じ日付だと、保存できたかを日付で確かめられないため止める
    const sameDay = requests.find((r) => r.account === slotAccount(slot) && r.date === day.date);
    if (sameDay) {
      messages.push(`${label}: 同じアカウントの ${slotLabel(sameDay.slot)} と同じ日付です`);
      continue;
    }
    requests.push({ slot, account: slotAccount(slot), venue: name, date: day.date, reception });
  }
  if (messages.length > 0) return { ok: false, messages };
  return { ok: true, value: { ...ym, dryRun: raw.dry_run?.trim() !== 'false', requests } };
}
