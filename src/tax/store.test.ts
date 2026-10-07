import { describe, expect, it } from 'vitest';
import { backupName, backupsToDelete } from './store';

describe('バックアップ', () => {
  it('backupName は年と UTC 時刻', () => {
    expect(backupName(2026, new Date('2026-10-07T12:00:00.123Z'))).toBe('ledger-2026-20261007T120000Z.json');
  });

  it('年ごとに最新30件だけ残す', () => {
    const name = (year: number, i: number) => backupName(year, new Date(Date.UTC(year, 0, 1, 0, 0, i)));
    const names = [
      ...Array.from({ length: 32 }, (_, i) => name(2026, i)).reverse(),
      ...Array.from({ length: 5 }, (_, i) => name(2025, i)),
      'メモ.txt',
    ];
    expect(backupsToDelete(names, 2026)).toEqual([name(2026, 0), name(2026, 1)]);
    expect(backupsToDelete(names, 2025)).toEqual([]);
  });
});
