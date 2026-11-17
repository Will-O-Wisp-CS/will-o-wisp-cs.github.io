import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findMonthRow, isLoginPage, parseMonthPage } from './menu';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const menu = fixture('shopmenu.html');
const approved = fixture('shopevent-approved.html');
const empty = fixture('shopevent-empty.html');
const login = fixture('login.html');

describe('findMonthRow', () => {
  it('2027年1月の行は未申請で申請画面に入れる', () => {
    expect(findMonthRow(menu, 2027, 1, '2026-11-17')).toEqual({ eventId: 356, status: null, open: true });
  });

  it('2026年12月の行は承認済みで受付期間外', () => {
    expect(findMonthRow(menu, 2026, 12, '2026-11-17')).toEqual({ eventId: 353, status: '承認されました', open: false });
  });

  it('【リモートデュエマ】の行は選ばない', () => {
    expect(findMonthRow(menu, 2026, 12, '2026-11-17')?.eventId).not.toBe(358);
    expect(findMonthRow(menu, 2026, 11, '2026-11-17')).toEqual({ eventId: 351, status: '承認されました', open: false });
  });

  it('受付期間は初日と締切日を含む（JST の日付で比べる）', () => {
    expect(findMonthRow(menu, 2027, 1, '2026-11-10')?.open).toBe(true);
    expect(findMonthRow(menu, 2027, 1, '2026-11-25')?.open).toBe(true);
    expect(findMonthRow(menu, 2027, 1, '2026-11-26')?.open).toBe(false);
    expect(findMonthRow(menu, 2027, 1, '2026-11-09')?.open).toBe(false);
  });

  it('無い月は null', () => {
    expect(findMonthRow(menu, 2030, 1, '2026-11-17')).toBeNull();
  });
});

describe('parseMonthPage', () => {
  it('承認済みの月の登録済み開催を読む（ブロックの順と Seq は一致しない）', () => {
    expect(parseMonthPage(approved)).toEqual({
      registered: [
        { seq: 2, date: '2026-12-06', status: '承認されました' },
        { seq: 1, date: '2026-12-19', status: '承認されました' },
      ],
      free: 0,
    });
  });

  it('未申請の月は空き枠が2つ', () => {
    expect(parseMonthPage(empty)).toEqual({ registered: [], free: 2 });
  });

  it('1つだけ登録済みの月は空き枠が1つ', () => {
    const one = approved.replace(/(name="EventDate2" value=")2026\/12\/19/g, '$1');
    expect(parseMonthPage(one).free).toBe(1);
    expect(parseMonthPage(one).registered).toHaveLength(1);
  });
});

describe('isLoginPage', () => {
  it('ログイン画面を見分ける', () => {
    expect(isLoginPage(login)).toBe(true);
    expect(isLoginPage(menu)).toBe(false);
  });
});
