import { describe, expect, it } from 'vitest';
import { formatEventDate, mergeEventLists, nextEventDay, type ScheduleEvent } from './events';

function event(date: string, start: string, venue = '晴れる屋3'): ScheduleEvent {
  return {
    date,
    venue,
    format: 'オリジナル',
    entryType: '個人',
    capacity: 64,
    start,
    url: `https://www.dmp-ranking.com/event.asp?${date}${start}`,
  };
}

describe('nextEventDay', () => {
  const events = [
    event('2026-10-11', '10:30', 'C'),
    event('2026-10-04', '15:20', 'B'),
    event('2026-10-04', '10:30', 'A'),
    event('2026-09-27', '10:30', 'Z'),
  ];

  it('今日以降で一番近い開催日の大会を開始時刻順に返す', () => {
    const day = nextEventDay(events, new Date('2026-09-30T03:00:00Z'));
    expect(day?.date).toBe('2026-10-04');
    expect(day?.events.map((e) => e.venue)).toEqual(['A', 'B']);
  });

  it('開催当日は大会が終わった後もその日の大会を返す', () => {
    // 2026-10-04 23:59 JST
    const day = nextEventDay(events, new Date('2026-10-04T14:59:00Z'));
    expect(day?.date).toBe('2026-10-04');
  });

  it('JST で日付が変わったら次の開催日に進む', () => {
    // 2026-10-05 00:00 JST
    const day = nextEventDay(events, new Date('2026-10-04T15:00:00Z'));
    expect(day?.date).toBe('2026-10-11');
    expect(day?.events.map((e) => e.venue)).toEqual(['C']);
  });

  it('予定の大会がなければ null', () => {
    expect(nextEventDay(events, new Date('2026-10-12T00:00:00Z'))).toBeNull();
    expect(nextEventDay([], new Date('2026-10-01T00:00:00Z'))).toBeNull();
  });
});

describe('formatEventDate', () => {
  it('月/日(曜日) にする', () => {
    expect(formatEventDate('2026-10-04')).toBe('10/04(日)');
    expect(formatEventDate('2026-10-24')).toBe('10/24(土)');
  });
});

describe('mergeEventLists', () => {
  const e = (date: string, url: string, venue = 'A', start = '10:30') =>
    ({ date, venue, format: 'オリジナル', entryType: '個人', capacity: 64, start, url });

  it('同じ URL は後のリストの内容を使い、日付・開始時刻の順に並べる', () => {
    const merged = mergeEventLists([e('2026-10-04', 'x', 'A', '17:10'), e('2026-01-11', 'y')], [e('2026-10-04', 'x', 'B', '17:10'), e('2026-10-04', 'z')]);
    expect(merged.map((m) => `${m.url}:${m.venue}`)).toEqual(['y:A', 'z:A', 'x:B']);
  });
});
