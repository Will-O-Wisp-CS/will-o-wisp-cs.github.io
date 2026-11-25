import { describe, expect, it } from 'vitest';
import type { ScheduleEvent } from '../shared/events';
import { announceText, eventsInMonth } from './announce';

const ev = (date: string, venue = 'フルコンプ千葉店', start = '12:20', url = `${date}-${venue}-${start}`): ScheduleEvent =>
  ({ date, venue, format: 'オリジナル', entryType: '個人', capacity: 64, start, url });

describe('announceText', () => {
  it('日付・曜日・受付・タイトル・ファイル名を作る', () => {
    expect(announceText(ev('2026-11-29'))).toEqual({
      date: '11/29',
      weekday: '日',
      dayKind: 'sunday',
      reception: '12:00~',
      title: '鬼火CS in フルコンプ千葉店',
      fileName: '2026-11-29_1220_フルコンプ千葉店.png',
    });
  });

  it('祝日は曜日より優先する', () => {
    const t = announceText(ev('2026-11-03'));
    expect(t.dayKind).toBe('holiday');
    expect(t.weekday).toBe('火');
  });

  it('土曜・平日を判定し、日付はゼロ埋めしない', () => {
    expect(announceText(ev('2026-11-28')).dayKind).toBe('saturday');
    expect(announceText(ev('2026-11-26')).dayKind).toBe('weekday');
    expect(announceText(ev('2026-12-03')).date).toBe('12/3');
  });

  it('受付時刻を上書きできる', () => {
    expect(announceText(ev('2026-11-29'), '12:10').reception).toBe('12:10~');
  });

  it('開催地に「鬼火CS」が入っている大会は、そのままタイトルにする', () => {
    expect(announceText(ev('2026-01-06', '【ミニ】鬼火CS in 晴れる屋3')).title).toBe('【ミニ】鬼火CS in 晴れる屋3');
  });

  it('ファイル名に使えない文字は _ にする', () => {
    expect(announceText(ev('2026-11-29', 'A/B')).fileName).toBe('2026-11-29_1220_A_B.png');
  });
});

describe('eventsInMonth', () => {
  it('指定した月の、今日以降の大会を日付・開始時刻の順に返す', () => {
    const list = [ev('2026-11-29', 'A', '12:20'), ev('2026-12-01', 'B'), ev('2026-11-20', 'C'), ev('2026-11-29', 'D', '10:30'), ev('2026-11-25', 'E')];
    expect(eventsInMonth(list, '2026-11', '2026-11-25').map((e) => e.venue)).toEqual(['E', 'D', 'A']);
  });
});
