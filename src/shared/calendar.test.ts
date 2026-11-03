import { describe, expect, it } from 'vitest';
import { dayKind, holidayName } from './calendar';

describe('holidayName', () => {
  it('2026年の祝日をすべて判定する（内閣府の一覧どおり）', () => {
    const holidays: [string, string][] = [
      ['2026-01-01', '元日'],
      ['2026-01-12', '成人の日'],
      ['2026-02-11', '建国記念の日'],
      ['2026-02-23', '天皇誕生日'],
      ['2026-03-20', '春分の日'],
      ['2026-04-29', '昭和の日'],
      ['2026-05-03', '憲法記念日'],
      ['2026-05-04', 'みどりの日'],
      ['2026-05-05', 'こどもの日'],
      ['2026-05-06', '振替休日'],
      ['2026-07-20', '海の日'],
      ['2026-08-11', '山の日'],
      ['2026-09-21', '敬老の日'],
      ['2026-09-22', '国民の休日'],
      ['2026-09-23', '秋分の日'],
      ['2026-10-12', 'スポーツの日'],
      ['2026-11-03', '文化の日'],
      ['2026-11-23', '勤労感謝の日'],
    ];
    for (const [date, name] of holidays) expect(holidayName(date), date).toBe(name);

    let count = 0;
    for (let d = new Date(Date.UTC(2026, 0, 1)); d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 1)) {
      if (holidayName(d.toISOString().slice(0, 10))) count++;
    }
    expect(count).toBe(holidays.length);
  });

  it('日曜の祝日の翌日は振替休日（2027-03-21 日曜の春分の日 → 22日）', () => {
    expect(holidayName('2027-03-21')).toBe('春分の日');
    expect(holidayName('2027-03-22')).toBe('振替休日');
  });

  it('平日は null', () => {
    expect(holidayName('2026-10-13')).toBeNull();
  });
});

describe('dayKind', () => {
  it('土曜・日曜・平日を判定する', () => {
    expect(dayKind('2026-10-03')).toBe('saturday');
    expect(dayKind('2026-10-04')).toBe('sunday');
    expect(dayKind('2026-10-05')).toBe('weekday');
  });

  it('祝日は曜日より優先する（2026-05-03 は日曜の憲法記念日）', () => {
    expect(dayKind('2026-10-12')).toBe('holiday');
    expect(dayKind('2026-05-03')).toBe('holiday');
  });
});
