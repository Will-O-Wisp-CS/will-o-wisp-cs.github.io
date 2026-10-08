import { describe, expect, it } from 'vitest';
import type { Ledger } from './ledger';
import { generalLedgerCsv, journalCsv } from './csv';

const sample: Ledger = {
  year: 2026,
  opening: { cash: 10000, bank: 0 },
  events: [{ id: 'u', date: '2026-10-04', venue: '晴れる屋3', start: '17:10', cancelled: false }],
  transactions: [
    { id: 't2', kind: 'expense', date: '2026-10-05', amount: 5000, debit: 'rent', credit: 'cash', counterparty: '晴れる屋, 新宿', receipts: [], updatedAt: '' },
    { id: 't1', kind: 'sale', date: '2026-10-04', amount: 20000, debit: 'cash', credit: 'sales', eventId: 'u', participants: 20, fee: 1000, receipts: [], updatedAt: '' },
  ],
};

describe('journalCsv', () => {
  it('仕訳帳は日付順で 日付,借方科目,貸方科目,金額,摘要', () => {
    const lines = journalCsv(sample).replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('日付,借方科目,貸方科目,金額,摘要');
    expect(lines[1]).toBe('2026-10-04,現金,売上高,20000,鬼火CS in 晴れる屋3 20人');
    expect(lines[2]).toBe('2026-10-05,地代家賃,現金,5000,"晴れる屋, 新宿"');
  });
});

describe('generalLedgerCsv', () => {
  it('取引がある科目ごとに前期繰越と残高', () => {
    const csv = generalLedgerCsv(sample);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.replace('﻿', '').split('\r\n');
    const i = lines.indexOf('現金');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(lines[i + 1]).toBe('日付,相手科目,摘要,借方金額,貸方金額,残高');
    expect(lines[i + 2]).toBe('2026-01-01,,前期繰越,,,10000');
    expect(lines[i + 3]).toBe('2026-10-04,売上高,鬼火CS in 晴れる屋3 20人,20000,,30000');
    expect(lines[i + 4]).toBe('2026-10-05,地代家賃,"晴れる屋, 新宿",,5000,25000');
    expect(lines).not.toContain('普通預金');
  });
});
