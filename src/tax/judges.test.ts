import { describe, expect, it } from 'vitest';
import type { ScheduleEvent } from '../shared/events';
import { addJudgeName, judgeMonths, moveItem, receptionTime, setAssignment, venueColorOf, venuesOf } from './judges';
import type { Judges, LedgerEvent } from './ledger';

function ev(date: string, start: string, venue: string, id = `${date}-${start}`): ScheduleEvent {
  return { date, venue, format: 'オリジナル', entryType: '個人', capacity: 64, start, url: id };
}

const events = [
  ev('2026-10-25', '10:30', '竜星の嵐新宿店'),
  ev('2026-11-29', '10:30', 'フルコンプ千葉店'),
  ev('2026-11-03', '15:30', '晴れる屋3'),
  ev('2026-11-03', '10:30', '竜星のPAO千葉中央店'),
  ev('2027-01-10', '10:30', '竜星の嵐新宿店'),
];
const empty: Judges = { assignments: {} };

describe('receptionTime', () => {
  it('開始の20分前を返す', () => {
    expect(receptionTime('10:30')).toBe('10:10');
    expect(receptionTime('17:10')).toBe('16:50');
    expect(receptionTime('15:00')).toBe('14:40');
  });
});

describe('judgeMonths', () => {
  it('今月以降の開催を月ごとに、開催日・開始時刻の順で並べる', () => {
    const months = judgeMonths(events, empty, [], '2026-11-03', false);
    expect(months.map((m) => m.label)).toEqual(['2026年11月', '2027年1月']);
    expect(months[0].rows.map((r) => r.id)).toEqual(['2026-11-03-10:30', '2026-11-03-15:30', '2026-11-29-10:30']);
  });

  it('過去の開催も表示するときは前の月も出す', () => {
    const months = judgeMonths(events, empty, [], '2026-11-03', true);
    expect(months.map((m) => m.label)).toEqual(['2026年10月', '2026年11月', '2027年1月']);
  });

  it('行に開催日・曜日・受付開始時刻・会場を入れる（祝日を優先）', () => {
    const row = judgeMonths(events, empty, [], '2026-11-03', false)[0].rows[0];
    expect(row).toMatchObject({ date: '11/03', weekday: '火', dayKind: 'holiday', reception: '10:10', venue: '竜星のPAO千葉中央店' });
    const sunday = judgeMonths(events, empty, [], '2026-11-03', false)[0].rows[2];
    expect(sunday).toMatchObject({ weekday: '日', dayKind: 'sunday' });
  });

  it('帳簿で中止にした開催だけ cancelled にする', () => {
    const ledgerEvents: LedgerEvent[] = [
      { id: '2026-11-29-10:30', date: '2026-11-29', venue: 'フルコンプ千葉店', start: '10:30', cancelled: true },
      { id: '2026-11-03-10:30', date: '2026-11-03', venue: '竜星のPAO千葉中央店', start: '10:30', cancelled: false },
    ];
    const months = judgeMonths(events, empty, ledgerEvents, '2026-11-03', false);
    expect(months[0].rows.map((r) => r.cancelled)).toEqual([false, false, true]);
    expect(months[1].rows[0].cancelled).toBe(false);
  });

  it('割り当てがあればそれを、なければ空を入れる', () => {
    const judges: Judges = { assignments: { '2026-11-03-15:30': { hj: '3Can', fj: ['ペルソナ', 'べっか'] } } };
    const rows = judgeMonths(events, judges, [], '2026-11-03', false)[0].rows;
    expect(rows[1].assignment).toEqual({ hj: '3Can', fj: ['ペルソナ', 'べっか'] });
    expect(rows[0].assignment).toEqual({ hj: '', fj: [] });
  });
});

describe('setAssignment', () => {
  it('前後の空白を取り、空の FJ を詰める', () => {
    const next = setAssignment(empty, 'a', { hj: ' たか ', fj: ['', ' 3Can', ''] });
    expect(next.assignments.a).toEqual({ hj: 'たか', fj: ['3Can'] });
  });

  it('HJ・FJ が全部空ならその開催の割り当てを消す', () => {
    const judges: Judges = { assignments: { a: { hj: 'たか', fj: [] }, b: { hj: 'れとん', fj: [] } }, rev: 2 };
    const next = setAssignment(judges, 'a', { hj: '  ', fj: ['', ' '] });
    expect(next.assignments).toEqual({ b: { hj: 'れとん', fj: [] } });
    expect(next.rev).toBe(2);
  });

  it('元の割り当てを書き換えない', () => {
    const judges: Judges = { assignments: { a: { hj: 'たか', fj: [] } } };
    setAssignment(judges, 'a', { hj: 'やまつば', fj: [] });
    expect(judges.assignments.a.hj).toBe('たか');
  });
});

describe('venuesOf', () => {
  it('会場を重複なしで名前順に並べる', () => {
    const list = [ev('2026-11-01', '10:30', 'フルコンプ千葉店'), ev('2026-11-02', '10:30', '晴れる屋3'), ev('2026-11-08', '10:30', 'フルコンプ千葉店'), ev('2026-11-09', '10:30', '竜星の嵐新宿店')];
    expect(venuesOf(list)).toEqual(['フルコンプ千葉店', '晴れる屋3', '竜星の嵐新宿店'].sort((a, b) => a.localeCompare(b, 'ja')));
    expect(venuesOf(list)).toHaveLength(3);
  });
});

describe('addJudgeName', () => {
  it('前後の空白を取って最後に足す', () => {
    expect(addJudgeName(['たか'], ' ペルソナ ')).toEqual(['たか', 'ペルソナ']);
  });
  it('同じ名前・空の名前は足さない', () => {
    expect(addJudgeName(['たか'], 'たか')).toEqual(['たか']);
    expect(addJudgeName(['たか'], '  ')).toEqual(['たか']);
  });
});

describe('moveItem', () => {
  it('from の位置の要素を to に移す', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });
  it('範囲外なら元の配列のコピーを返す', () => {
    const list = ['a', 'b'];
    const moved = moveItem(list, 0, -1);
    expect(moved).toEqual(['a', 'b']);
    expect(moved).not.toBe(list);
  });
});

describe('venueColorOf', () => {
  it('設定で選んでいない会場は、スプレッドシートと同じ初期値の色にする', () => {
    expect(venueColorOf({}, '竜星のPAO千葉中央店')).toBe('yellow');
    expect(venueColorOf({}, 'フルコンプ千葉店')).toBe('green');
    expect(venueColorOf({}, '晴れる屋3')).toBe('teal');
    expect(venueColorOf({}, 'フルコンプ本厚木店')).toBe('blue');
    expect(venueColorOf({}, '竜星のPAO秋葉原ロケット無線店')).toBe('red');
    expect(venueColorOf({}, '竜星の嵐新宿店')).toBe('none');
  });
  it('初期値のない会場は none', () => {
    expect(venueColorOf({}, 'PAO千葉中央店')).toBe('none');
  });
  it('設定で選んだ色（なしも含む）を初期値より優先する', () => {
    expect(venueColorOf({ venueColors: { 'フルコンプ千葉店': 'pink' } }, 'フルコンプ千葉店')).toBe('pink');
    expect(venueColorOf({ venueColors: { 'フルコンプ千葉店': 'none' } }, 'フルコンプ千葉店')).toBe('none');
  });
});
