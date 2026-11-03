/**
 * 日本の祝日判定（国民の祝日に関する法律の現行ルール。2026年以降の表示用）。
 * 春分・秋分は 1980〜2099 年の近似式で求める。振替休日・国民の休日も含む。
 */

export type DayKind = 'holiday' | 'sunday' | 'saturday' | 'weekday';

/** 表示の色分け用。祝日を曜日より優先する */
export function dayKind(iso: string): DayKind {
  if (holidayName(iso)) return 'holiday';
  const weekday = toDate(iso).getUTCDay();
  if (weekday === 0) return 'sunday';
  if (weekday === 6) return 'saturday';
  return 'weekday';
}

/** 'YYYY-MM-DD' の祝日名。祝日でなければ null */
export function holidayName(iso: string): string | null {
  const date = toDate(iso);
  const named = namedHoliday(date);
  if (named) return named;

  // 振替休日: 日曜の祝日以降、最初の祝日でない日
  for (let d = addDays(date, -1); namedHoliday(d); d = addDays(d, -1)) {
    if (d.getUTCDay() === 0) return '振替休日';
  }
  // 国民の休日: 前後の日が祝日に挟まれた平日
  if (date.getUTCDay() !== 0 && namedHoliday(addDays(date, -1)) && namedHoliday(addDays(date, 1))) {
    return '国民の休日';
  }
  return null;
}

/** 法律で名前が決まっている祝日（振替休日・国民の休日を除く） */
function namedHoliday(date: Date): string | null {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const nthMonday = (n: number) => d === nthMondayOf(y, m, n);

  switch (m) {
    case 1:
      if (d === 1) return '元日';
      if (nthMonday(2)) return '成人の日';
      break;
    case 2:
      if (d === 11) return '建国記念の日';
      if (d === 23) return '天皇誕生日';
      break;
    case 3:
      if (d === equinoxDay(y, 20.8431)) return '春分の日';
      break;
    case 4:
      if (d === 29) return '昭和の日';
      break;
    case 5:
      if (d === 3) return '憲法記念日';
      if (d === 4) return 'みどりの日';
      if (d === 5) return 'こどもの日';
      break;
    case 7:
      if (nthMonday(3)) return '海の日';
      break;
    case 8:
      if (d === 11) return '山の日';
      break;
    case 9:
      if (nthMonday(3)) return '敬老の日';
      if (d === equinoxDay(y, 23.2488)) return '秋分の日';
      break;
    case 10:
      if (nthMonday(2)) return 'スポーツの日';
      break;
    case 11:
      if (d === 3) return '文化の日';
      if (d === 23) return '勤労感謝の日';
      break;
  }
  return null;
}

/** 春分（base=20.8431）・秋分（base=23.2488）の日 */
function equinoxDay(year: number, base: number): number {
  const n = year - 1980;
  return Math.floor(base + 0.242194 * n - Math.floor(n / 4));
}

function nthMondayOf(year: number, month: number, n: number): number {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstMonday = 1 + ((8 - firstWeekday) % 7);
  return firstMonday + (n - 1) * 7;
}

function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
