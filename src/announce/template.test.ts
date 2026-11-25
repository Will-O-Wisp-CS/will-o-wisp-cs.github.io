import { describe, expect, it } from 'vitest';
import type { AnnounceText } from './announce';
import { announceSvg, DAY_COLORS } from './template';

const base: AnnounceText = {
  date: '11/29',
  weekday: '日',
  dayKind: 'sunday',
  reception: '12:00~',
  title: '鬼火CS in フルコンプ千葉店',
  fileName: 'x.png',
};

const titleSize = (svg: string) => Number(/id="title"[^>]*font-size="([\d.]+)"/.exec(svg)?.[1]);

describe('announceSvg', () => {
  it('1200×675 の SVG に日付・受付・タイトルを入れる', () => {
    const svg = announceSvg(base, 'data:image/jpeg;base64,AAAA');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="1200" height="675"');
    expect(svg).toContain('11/29');
    expect(svg).toContain('12:00~');
    expect(svg).toContain('鬼火CS in フルコンプ千葉店');
    expect(svg).toContain('data:image/jpeg;base64,AAAA');
  });

  it('曜日の四角の色: 日＝赤、土＝青、祝日＝黄', () => {
    expect(announceSvg(base, '')).toContain(`fill="${DAY_COLORS.sunday.box}"`);
    expect(announceSvg({ ...base, dayKind: 'saturday', weekday: '土' }, '')).toContain(`fill="${DAY_COLORS.saturday.box}"`);
    expect(announceSvg({ ...base, dayKind: 'holiday', weekday: '火' }, '')).toContain(`fill="${DAY_COLORS.holiday.box}"`);
  });

  it('平日も祝日と同じ黄色の四角にする（今の告知画像と同じ）', () => {
    const svg = announceSvg({ ...base, dayKind: 'weekday', weekday: '木' }, '');
    expect(svg).toContain('id="day-box"');
    expect(svg).toContain(`fill="${DAY_COLORS.holiday.box}"`);
  });

  it('タイトルの & や < をエスケープする', () => {
    expect(announceSvg({ ...base, title: 'A&B<C' }, '')).toContain('A&amp;B&lt;C');
  });

  it('長いタイトルは文字を小さくして幅に収める', () => {
    const long = '鬼火CS in 竜星のPAO秋葉原ロケット無線店'.repeat(2);
    expect(titleSize(announceSvg({ ...base, title: long }, ''))).toBeLessThan(titleSize(announceSvg(base, '')));
  });

  it('英大文字の長い開催地名も幅 1100px に収める（W は Noto Sans JP ExtraBold で 0.925em）', () => {
    const title = `鬼火CS in ${'W'.repeat(34)}`;
    const size = titleSize(announceSvg({ ...base, title }, ''));
    // 鬼火 2em + 'CS in ' + W×34 を実際の字幅で見積もる
    const em = 2 + (662 + 631 + 228 + 313 + 649 + 228) / 1000 + 34 * 0.925;
    expect(size * em).toBeLessThanOrEqual(1100);
  });
});
