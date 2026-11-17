import { describe, expect, it } from 'vitest';
import type { SlotRequest } from './input';
import type { MonthPage, MonthRow } from './menu';
import { accountSlots, planAccount } from './plan';

const a1: SlotRequest = { slot: 'a1', account: 'A', venue: '竜星の嵐新宿店', date: '2027-01-10' };
const a2: SlotRequest = { slot: 'a2', account: 'A', venue: '晴れる屋3', date: '2027-01-17' };
const openRow: MonthRow = { eventId: 356, status: null, open: true };
const empty: MonthPage = { registered: [], freeSeqs: [1, 2] };
const oneApproved: MonthPage = { registered: [{ seq: 1, date: '2027-01-10', status: '承認されました' }], freeSeqs: [2] };

describe('planAccount', () => {
  it('空き2枠に2件 → 空いている Seq に順に割り当てる', () => {
    expect(planAccount([a1, a2], openRow, empty)).toEqual({
      apply: [
        { request: a1, seq: 1 },
        { request: a2, seq: 2 },
      ],
      skipped: [],
    });
  });

  it('1枠埋まっている月に2件 → すべて飛ばす', () => {
    const other = { ...oneApproved, registered: [{ seq: 1, date: '2027-01-24', status: '承認されました' }] };
    const plan = planAccount([a1, a2], openRow, other);
    expect(plan.apply).toEqual([]);
    expect(plan.skipped).toEqual([
      { request: a1, reason: '空き枠が足りません（空き 1）' },
      { request: a2, reason: '空き枠が足りません（空き 1）' },
    ]);
  });

  it('1枠埋まっている月に1件 → 残りの枠に入れる', () => {
    const other = { ...oneApproved, registered: [{ seq: 1, date: '2027-01-24', status: '承認されました' }] };
    expect(planAccount([a2], openRow, other).apply).toEqual([{ request: a2, seq: 2 }]);
  });

  it('同じ日付が登録済みの指定だけ飛ばす', () => {
    const plan = planAccount([a1, a2], openRow, oneApproved);
    expect(plan.apply).toEqual([{ request: a2, seq: 2 }]);
    expect(plan.skipped).toEqual([{ request: a1, reason: '同じ日付の開催が登録済み' }]);
  });

  it('受付期間外ならすべて飛ばす', () => {
    const closed = planAccount([a1], { eventId: 356, status: null, open: false }, null);
    expect(closed.skipped).toEqual([{ request: a1, reason: '申請受付期間外' }]);
    expect(planAccount([a1], null, null).skipped).toEqual([{ request: a1, reason: '申請受付期間外' }]);
  });

  it('保存のみの開催がある月は何もしない', () => {
    const saved: MonthPage = { registered: [{ seq: 1, date: '2027-01-24', status: '未申請' }], freeSeqs: [2] };
    expect(planAccount([a2], openRow, saved)).toEqual({
      apply: [],
      skipped: [{ request: a2, reason: '保存のみ（未申請）の開催あり。画面で確かめてください' }],
    });
  });

  it('差し戻された開催も枠に数える', () => {
    const back: MonthPage = { registered: [{ seq: 1, date: '2027-01-24', status: '差し戻されました' }], freeSeqs: [2] };
    expect(planAccount([a1, a2], openRow, back).apply).toEqual([]);
  });
});

describe('accountSlots', () => {
  it('登録済みを日付順に①②、今回の結果を後ろに足す', () => {
    const page: MonthPage = { registered: [{ seq: 2, date: '2027-01-24', status: '承認されました' }], freeSeqs: [1] };
    expect(accountSlots('A', page, [{ request: a1, state: '申請しました' }])).toEqual([
      { label: 'A①', date: '2027-01-24', venue: null, state: '承認されました' },
      { label: 'A②', date: '2027-01-10', venue: '竜星の嵐新宿店', state: '申請しました' },
    ]);
  });

  it('2行を超える分は指定した枠の名前で出す', () => {
    const page: MonthPage = { registered: [{ seq: 2, date: '2027-01-24', status: '承認されました' }], freeSeqs: [1] };
    const rows = accountSlots('A', page, [
      { request: a1, state: '空き枠が足りません（空き 1）' },
      { request: a2, state: '空き枠が足りません（空き 1）' },
    ]);
    expect(rows.map((r) => r.label)).toEqual(['A①', 'A②', 'A（指定 A②）']);
  });

  it('何も無いアカウントは空き2枠', () => {
    expect(accountSlots('B', empty, [])).toEqual([
      { label: 'B①', date: null, venue: null, state: '空き' },
      { label: 'B②', date: null, venue: null, state: '空き' },
    ]);
  });

  it('画面を読めなかったアカウントは結果だけ並べ、足りない分は「不明」', () => {
    expect(accountSlots('C', null, [{ request: { ...a1, slot: 'c1', account: 'C' }, state: 'ログインできませんでした' }])).toEqual([
      { label: 'C①', date: '2027-01-10', venue: '竜星の嵐新宿店', state: 'ログインできませんでした' },
      { label: 'C②', date: null, venue: null, state: '不明' },
    ]);
  });
});
