/** 6枠の状態表（Markdown）。開催日・会場・状態だけを出す */
import type { SlotResult } from './plan.ts';

export function summaryMarkdown(year: number, month: number, dryRun: boolean, slots: SlotResult[]): string {
  const title = `## ${year}年${month}月の公認CSサポート申請${dryRun ? '（確認だけ。保存・申請はしていません）' : ''}`;
  const rows = slots.map((s) => `| ${s.label} | ${s.date ?? '-'} | ${s.venue ?? '-'} | ${s.state} |`);
  return [title, '', '| 枠 | 開催日 | 会場 | 状態 |', '|---|---|---|---|', ...rows, ''].join('\n');
}
