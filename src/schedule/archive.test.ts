import { describe, expect, it } from 'vitest';
import type { ScheduleEvent } from '../shared/events';
import { ARCHIVE_START, mergeArchive, missingMonths } from './archive';

function ev(date: string, url: string, venue = '晴れる屋3', start = '10:30'): ScheduleEvent {
  return { date, venue, format: 'オリジナル', entryType: '個人', capacity: 64, start, url };
}

describe('missingMonths', () => {
  it('記録の始まりの月から先月（JST）までのうち、まだ取っていない月', () => {
    expect(ARCHIVE_START).toBe('2026-01');
    // 2026-10-01 00:30 JST = 2026-09-30T15:30Z → 先月は9月
    const now = new Date('2026-09-30T15:30:00Z');
    expect(missingMonths(['2026-01', '2026-03'], now)).toEqual(['2026-02', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('全部取ってあれば空', () => {
    const now = new Date('2026-02-10T00:00:00Z');
    expect(missingMonths(['2026-01'], now)).toEqual([]);
  });

  it('年をまたいでも数える', () => {
    const now = new Date('2027-01-05T00:00:00Z');
    const all = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
    expect(missingMonths(all, now)).toEqual(['2026-12']);
  });
});

describe('mergeArchive', () => {
  it('同じ URL は新しい内容で上書きし、日付・開始時刻の順に並べ、月を足す', () => {
    const archive = { updatedAt: '', months: ['2026-01'], events: [ev('2026-01-11', 'a'), ev('2026-10-04', 'b', '晴れる屋3', '17:10')] };
    const merged = mergeArchive(archive, [ev('2026-10-04', 'b', '竜星の嵐', '17:10'), ev('2026-10-04', 'c', '晴れる屋3', '10:30')], ['2026-02']);
    expect(merged.events.map((e) => `${e.url}:${e.venue}`)).toEqual(['a:晴れる屋3', 'c:晴れる屋3', 'b:竜星の嵐']);
    expect(merged.months).toEqual(['2026-01', '2026-02']);
  });

  it('記録からは消さない（大会スケジュールから消えた大会も残す）', () => {
    const archive = { updatedAt: '', months: [], events: [ev('2026-09-06', 'old')] };
    expect(mergeArchive(archive, [], []).events.map((e) => e.url)).toEqual(['old']);
  });
});
