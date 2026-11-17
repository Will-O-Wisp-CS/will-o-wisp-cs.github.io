import { describe, expect, it } from 'vitest';
import { parseApplyInput, parseDay } from './input';

describe('parseDay', () => {
  it('日だけ・月/日・年-月-日を受け付ける', () => {
    expect(parseDay('10', 2027, 1)).toEqual({ ok: true, date: '2027-01-10' });
    expect(parseDay('1/10', 2027, 1)).toEqual({ ok: true, date: '2027-01-10' });
    expect(parseDay('2027-01-10', 2027, 1)).toEqual({ ok: true, date: '2027-01-10' });
  });

  it('全角を受け付ける', () => {
    expect(parseDay('１／１０', 2027, 1)).toEqual({ ok: true, date: '2027-01-10' });
  });

  it('申請する月以外はエラー', () => {
    expect(parseDay('2/1', 2027, 1).ok).toBe(false);
    expect(parseDay('2026-01-10', 2027, 1).ok).toBe(false);
  });

  it('存在しない日はエラー', () => {
    expect(parseDay('2/30', 2027, 2).ok).toBe(false);
    expect(parseDay('0', 2027, 1).ok).toBe(false);
  });

  it('日付でない文字はエラー', () => {
    expect(parseDay('あした', 2027, 1).ok).toBe(false);
  });
});

describe('parseApplyInput', () => {
  const venues = ['竜星の嵐新宿店', '晴れる屋3'];

  it('埋めた枠だけを申請の対象にする', () => {
    const r = parseApplyInput(
      { month: '２０２７−０１', a1_venue: '竜星の嵐新宿店', a1_date: '10', b2_venue: '晴れる屋3', b2_date: '1/17', dry_run: 'false' },
      venues,
    );
    expect(r).toEqual({
      ok: true,
      value: {
        year: 2027,
        month: 1,
        dryRun: false,
        requests: [
          { slot: 'a1', account: 'A', venue: '竜星の嵐新宿店', date: '2027-01-10' },
          { slot: 'b2', account: 'B', venue: '晴れる屋3', date: '2027-01-17' },
        ],
      },
    });
  });

  it('全部空欄なら requests は空（状態の一覧だけ）', () => {
    const r = parseApplyInput({ month: '2027-01', a1_venue: '', a1_date: ' ', dry_run: 'true' }, venues);
    expect(r).toEqual({ ok: true, value: { year: 2027, month: 1, dryRun: true, requests: [] } });
  });

  it('dry_run が無い・"true" なら確認だけ', () => {
    const none = parseApplyInput({ month: '2027-01' }, venues);
    const yes = parseApplyInput({ month: '2027-01', dry_run: 'true' }, venues);
    expect(none.ok && none.value.dryRun).toBe(true);
    expect(yes.ok && yes.value.dryRun).toBe(true);
  });

  it('月は 2027/1 や 2027年1月 でもよい', () => {
    const r = parseApplyInput({ month: '2027年1月' }, venues);
    expect(r.ok && [r.value.year, r.value.month]).toEqual([2027, 1]);
    const s = parseApplyInput({ month: '2027/1' }, venues);
    expect(s.ok && [s.value.year, s.value.month]).toEqual([2027, 1]);
  });

  it('会場と日付の片方だけはエラー', () => {
    const r = parseApplyInput({ month: '2027-01', a1_venue: '竜星の嵐新宿店' }, venues);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.messages.join('\n')).toContain('A①');
    const s = parseApplyInput({ month: '2027-01', c2_date: '10' }, venues);
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.messages.join('\n')).toContain('C②');
  });

  it('知らない会場はエラー', () => {
    expect(parseApplyInput({ month: '2027-01', a1_venue: 'どこか', a1_date: '10' }, venues).ok).toBe(false);
  });

  it('2つの枠に同じ日付・同じ会場はエラー', () => {
    const r = parseApplyInput(
      { month: '2027-01', a1_venue: '晴れる屋3', a1_date: '10', c1_venue: '晴れる屋3', c1_date: '1/10' },
      venues,
    );
    expect(r.ok).toBe(false);
  });

  it('月が不正ならエラー', () => {
    expect(parseApplyInput({ month: '2027-13' }, venues).ok).toBe(false);
    expect(parseApplyInput({}, venues).ok).toBe(false);
  });

  it('エラーはまとめて返す', () => {
    const r = parseApplyInput(
      { month: '2027-01', a1_venue: '晴れる屋3', b1_date: '10', c1_venue: 'どこか', c1_date: '10' },
      venues,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.messages).toHaveLength(3);
  });
});
