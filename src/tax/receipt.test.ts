import { describe, expect, it } from 'vitest';
import { extensionOf, fitSize, receiptFileName } from './receipt';

const tx = { date: '2026-10-04', amount: 5500, counterparty: '晴れる屋' };

describe('receiptFileName', () => {
  it('日付_金額_取引先 のファイル名', () => {
    expect(receiptFileName(tx, 'pdf', 0)).toBe('2026-10-04_5500_晴れる屋.pdf');
  });

  it('2枚目以降は連番', () => {
    expect(receiptFileName(tx, 'jpg', 1)).toBe('2026-10-04_5500_晴れる屋_2.jpg');
  });

  it('取引先が空なら取引先なし', () => {
    expect(receiptFileName({ ...tx, counterparty: '  ' }, 'jpg', 0)).toBe('2026-10-04_5500_取引先なし.jpg');
    expect(receiptFileName({ date: tx.date, amount: 1 }, 'jpg', 0)).toBe('2026-10-04_1_取引先なし.jpg');
  });

  it('ファイル名に使えない文字は _ に置き換える', () => {
    expect(receiptFileName({ ...tx, counterparty: 'A/B:C*?"<>|\\' }, 'pdf', 0)).toBe('2026-10-04_5500_A_B_C_______.pdf');
  });
});

describe('extensionOf', () => {
  it('PDF は pdf、画像は縮小後の jpg', () => {
    expect(extensionOf({ name: 'r.PDF', type: 'application/pdf' })).toBe('pdf');
    expect(extensionOf({ name: 'IMG_1.HEIC', type: 'image/heic' })).toBe('jpg');
  });
});

describe('fitSize', () => {
  it('長辺を max に収める', () => {
    expect(fitSize(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitSize(1000, 800, 2000)).toEqual({ width: 1000, height: 800 });
    expect(fitSize(3000, 4001, 2000)).toEqual({ width: 1500, height: 2000 });
  });
});
