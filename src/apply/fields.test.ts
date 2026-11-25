import { describe, expect, it } from 'vitest';
import { buildFields, shiftVenue, type Venue, type VenueFile } from './fields';
import venues from './venues.json';

const file = venues as VenueFile;

describe('buildFields', () => {
  it('竜星の嵐新宿店 2026-12-19 はシートと同じ値になる', () => {
    const f = buildFields(file, '竜星の嵐新宿店', '2026-12-19', 'x@example.com');
    expect(f.texts).toMatchObject({
      EventName: '鬼火CS in 竜星の嵐新宿店',
      EventDate: '2026/12/19',
      EntryFee: '1500',
      Capacity: '80',
      EntryStart: '2026/12/05',
      EntryLimit: '2026/12/19',
      DeckStart: '2026/12/05',
      DeckLimit: '2026/12/19',
      Venue: '竜星の嵐新宿店',
      Jusho: '新宿区西新宿1-18-1小川ビル 5F',
      Tel: '03-6276-6167',
      TwitterID: '@Will_O_Wisp_CS',
      Organizer: '鬼火CS運営',
      Mail: 'x@example.com',
      MapURL: '',
      HeadJudge: '',
      MoushikomiInput: '',
      SubEventInput: '',
      StuffInput: '',
      NotesInput: '',
    });
    expect(f.texts.FormatBikoInput).toContain('・ラウンド数：5回戦');
    expect(f.texts.ScheduleInput).toContain('10:10～10:30：大会受付');
    expect(f.texts.PrizeInput).toContain('商品券10,000円分');
    expect(f.texts.DetailsInput).toContain('■マッチングサイトについて');
    expect(f.texts.BringingInput).toBe('・デッキ\n・スマートフォン\n・予備スリーブ\n・参加費');
    expect(f.selects).toEqual({
      ReceptionHour: '10',
      ReceptionMinute: '10',
      EventStartHour: '10',
      EventStartMinute: '30',
      EventTeam: '1',
      EventDendo: '6',
      EventFormat: '1',
      EntryStartHour: '20',
      EntryStartMinute: '00',
      EntryLimitHour: '10',
      EntryLimitMinute: '00',
      EntryOver: '1',
      DeckStartHour: '20',
      DeckStartMinute: '00',
      DeckLimitHour: '23',
      DeckLimitMinute: '59',
      DeckLimitEdit: '0',
      Pref: '13',
      Coordinate: '1',
    });
    expect(f.judges).toEqual([6012]);
  });

  it('晴れる屋3 の参加表明締切は受付の10分前（16:50）', () => {
    const f = buildFields(file, '晴れる屋3', '2026-12-06', 'x@example.com');
    expect(f.selects).toMatchObject({ EntryLimitHour: '16', EntryLimitMinute: '50', ReceptionHour: '17', EventStartMinute: '20' });
    expect(f.texts).toMatchObject({ Capacity: '104', EntryStart: '2026/11/22', EntryLimit: '2026/12/06' });
    expect(f.hidden).toEqual({ Lat: '35.7135625', Lng: '139.7034415' });
  });

  it('月初の開催は参加表明の開始が前の月になる', () => {
    const f = buildFields(file, '晴れる屋3', '2027-01-03', 'x@example.com');
    expect(f.texts.EntryStart).toBe('2026/12/20');
    expect(f.texts.DeckStart).toBe('2026/12/20');
  });

  it('受付が 0 分台でも10分前を正しく繰り下げる', () => {
    const custom: VenueFile = { ...file, venues: [{ ...file.venues[0], reception: '10:05' }] };
    const f = buildFields(custom, '竜星の嵐新宿店', '2027-01-10', 'x@example.com');
    expect(f.selects).toMatchObject({ EntryLimitHour: '09', EntryLimitMinute: '55' });
  });

  it('座標が空の会場は hidden を入れない', () => {
    const custom: VenueFile = { ...file, venues: [{ ...file.venues[0], lat: '', lng: '' }] };
    expect(buildFields(custom, '竜星の嵐新宿店', '2027-01-10', 'x@example.com').hidden).toEqual({});
  });

  it('知らない会場は例外', () => {
    expect(() => buildFields(file, 'どこか', '2027-01-10', 'x@example.com')).toThrow('どこか');
  });
});

const ryusei = file.venues.find((v) => v.name === '竜星の嵐新宿店') as Venue;
const hareruya = file.venues.find((v) => v.name === '晴れる屋3') as Venue;

function shifted(venue: Venue, reception: string): Venue {
  const r = shiftVenue(venue, reception);
  if (!r.ok) throw new Error(r.message);
  return r.venue;
}

describe('shiftVenue', () => {
  it('受付を遅らせると開始とタイムスケジュールの時刻も同じだけずれる', () => {
    const v = shifted(ryusei, '10:40');
    expect(v.reception).toBe('10:40');
    expect(v.start).toBe('11:00');
    expect(v.schedule).toBe(
      '10:40～11:00：大会受付（事前受付・当日枠共に）\n11:10～11:20：開会式\n11:20～13:30：予選スイスドロー5回戦\n13:40～15:10：決勝トーナメント',
    );
  });

  it('受付を早めると時が1桁になり、1桁のまま書く', () => {
    const v = shifted(ryusei, '09:40');
    expect(v.start).toBe('10:00');
    expect(v.schedule.split('\n')[0]).toBe('9:40～10:00：大会受付（事前受付・当日枠共に）');
  });

  it('全角スペース区切りの文面もずれる', () => {
    const v = shifted(hareruya, '17:30');
    expect(v.schedule.split('\n')[3]).toBe('20:50～22:20　決勝トーナメント');
  });

  it('会場と同じ受付ならひな形のまま', () => {
    expect(shifted(ryusei, '10:10')).toEqual(ryusei);
  });

  it('文面の時刻が24時をこえるとエラー', () => {
    expect(shiftVenue(hareruya, '20:00').ok).toBe(false);
  });

  it('文面に元の受付時刻が H:MM で書かれていない会場はエラー（ずらせない）', () => {
    const odd: Venue = { ...ryusei, schedule: '１０：１０～１０：３０：大会受付' };
    expect(shiftVenue(odd, '10:40').ok).toBe(false);
  });

  it('参加表明締切が前の日になるとエラー', () => {
    expect(shiftVenue(ryusei, '00:05').ok).toBe(false);
  });
});

describe('buildFields の受付開始の指定', () => {
  it('受付・開始・締切・タイムスケジュールがずれる', () => {
    const f = buildFields(file, '竜星の嵐新宿店', '2026-12-19', 'x@example.com', '10:40');
    expect(f.selects).toMatchObject({
      ReceptionHour: '10',
      ReceptionMinute: '40',
      EventStartHour: '11',
      EventStartMinute: '00',
      EntryLimitHour: '10',
      EntryLimitMinute: '30',
    });
    expect(f.texts.ScheduleInput).toBe(shifted(ryusei, '10:40').schedule);
  });

  it('日をまたぐ受付は例外', () => {
    expect(() => buildFields(file, '晴れる屋3', '2026-12-06', 'x@example.com', '20:00')).toThrow('20:00');
  });
});
