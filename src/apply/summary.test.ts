import { describe, expect, it } from 'vitest';
import { summaryMarkdown } from './summary';

describe('summaryMarkdown', () => {
  it('状態表に日付・会場・状態だけを出す', () => {
    const md = summaryMarkdown(2027, 1, true, [
      { label: 'A①', date: '2027-01-10', venue: '竜星の嵐新宿店', state: '確認だけ（保存していません）' },
      { label: 'A②', date: null, venue: null, state: '空き' },
    ]);
    expect(md).toContain('2027年1月');
    expect(md).toContain('確認だけ');
    expect(md).toContain('| 枠 | 開催日 | 会場 | 状態 |');
    expect(md).toContain('| A① | 2027-01-10 | 竜星の嵐新宿店 | 確認だけ（保存していません） |');
    expect(md).toContain('| A② | - | - | 空き |');
  });

  it('本番の実行では確認だけと書かない', () => {
    expect(summaryMarkdown(2027, 1, false, [])).not.toContain('確認だけ');
  });
});
