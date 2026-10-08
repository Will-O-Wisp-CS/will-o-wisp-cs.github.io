const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 12345 → '¥12,345'、-5000 → '-¥5,000' */
export function formatYen(n: number): string {
  return `${n < 0 ? '-' : ''}¥${Math.abs(n).toLocaleString('en-US')}`;
}

/** JST の今日 'YYYY-MM-DD' */
export function todayJst(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}
