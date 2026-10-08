import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ledger } from './ledger';

vi.mock('./drive', () => ({
  ensureFolder: vi.fn(async () => 'root'),
  findFile: vi.fn(),
  readJson: vi.fn(),
  createJson: vi.fn(),
  updateJson: vi.fn(),
  getVersion: vi.fn(),
  copyFile: vi.fn(),
  listFiles: vi.fn(async () => []),
  trashFile: vi.fn(),
  uploadFile: vi.fn(),
}));

const drive = await import('./drive');
const store = await import('./store');

const ledger2026: Ledger = {
  year: 2026,
  opening: { cash: 10000, bank: 0 },
  events: [],
  transactions: [{ id: 't', kind: 'sale', date: '2026-12-31', amount: 5000, debit: 'cash', credit: 'sales', receipts: [], updatedAt: '' }],
};
const stale2027: Ledger = {
  year: 2027,
  opening: { cash: 10000, bank: 0 },
  events: [],
  transactions: [{ id: 'u', kind: 'expense', date: '2027-01-05', amount: 100, debit: 'misc', credit: 'cash', receipts: [], updatedAt: '' }],
};

function files(map: Record<string, { id: string; data: unknown }>) {
  vi.mocked(drive.findFile).mockImplementation(async (_p, name) => (map[name] ? { id: map[name].id, name, version: '1' } : null));
  vi.mocked(drive.readJson).mockImplementation(async (id) => Object.values(map).find((f) => f.id === id)!.data as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  store.resetStore();
});

describe('前年からの期首残高の引き継ぎ', () => {
  it('前年の帳簿が後から変わっても、読み込むたびに期首残高を前年の期末に合わせる', async () => {
    files({ 'ledger-2026.json': { id: 'a', data: ledger2026 }, 'ledger-2027.json': { id: 'b', data: stale2027 } });
    const loaded = await store.loadLedger(2027);
    expect('needsOpening' in loaded).toBe(false);
    if ('needsOpening' in loaded) return;
    expect(loaded.data.opening).toEqual({ cash: 15000, bank: 0 });
    expect(loaded.openingChanged).toBe(true);
  });

  it('前年の期末と同じなら変更なし', async () => {
    files({ 'ledger-2026.json': { id: 'a', data: ledger2026 }, 'ledger-2027.json': { id: 'b', data: { ...stale2027, opening: { cash: 15000, bank: 0 } } } });
    const loaded = await store.loadLedger(2027);
    expect(!('needsOpening' in loaded) && loaded.openingChanged).toBe(false);
  });

  it('前年の帳簿があれば期首残高は変更できない', async () => {
    files({ 'ledger-2026.json': { id: 'a', data: ledger2026 } });
    expect(await store.hasPreviousLedger(2027)).toBe(true);
    expect(await store.hasPreviousLedger(2026)).toBe(false);
  });
});

describe('帳簿の作成', () => {
  it('同じ年の帳簿がすでにあれば作らずにそれを使う', async () => {
    files({ 'ledger-2026.json': { id: 'a', data: ledger2026 } });
    const loaded = await store.createLedger(2026, { cash: 1, bank: 1 });
    expect(drive.createJson).not.toHaveBeenCalled();
    expect(loaded.fileId).toBe('a');
    expect(loaded.data).toEqual(ledger2026);
  });
});

describe('他の端末との衝突の判定', () => {
  it('ドライブ側の version が勝手に増えても、帳簿の中身が同じなら保存できる', async () => {
    files({ 'ledger-2026.json': { id: 'a', data: ledger2026 } });
    vi.mocked(drive.getVersion).mockResolvedValue('99');
    vi.mocked(drive.updateJson).mockResolvedValue({ id: 'a', name: 'ledger-2026.json', version: '100' });
    const loaded = await store.loadLedger(2026);
    if ('needsOpening' in loaded) throw new Error('帳簿があるはず');
    const saved = await store.saveLedger(loaded);
    expect(vi.mocked(drive.updateJson).mock.calls[0][1]).toMatchObject({ rev: 1 });
    expect(saved.data.rev).toBe(1);
  });

  it('他の端末で保存されて rev が進んでいたら衝突', async () => {
    files({ 'ledger-2026.json': { id: 'a', data: ledger2026 } });
    const loaded = await store.loadLedger(2026);
    if ('needsOpening' in loaded) throw new Error('帳簿があるはず');
    vi.mocked(drive.readJson).mockResolvedValue({ ...ledger2026, rev: 1 } as never);
    await expect(store.saveLedger(loaded)).rejects.toBeInstanceOf(store.ConflictError);
    expect(drive.updateJson).not.toHaveBeenCalled();
  });

  it('設定も中身の rev で判定する', async () => {
    const settings = { startDate: '2026-01-01', defaultFee: 1000, expenseOrder: [] };
    files({ 'settings.json': { id: 's', data: settings } });
    vi.mocked(drive.getVersion).mockResolvedValue('99');
    vi.mocked(drive.updateJson).mockResolvedValue({ id: 's', name: 'settings.json', version: '100' });
    const loaded = await store.loadSettings('2026-10-08');
    const saved = await store.saveSettings(loaded);
    expect(saved.data.rev).toBe(1);
  });
});

describe('保存の速さ', () => {
  afterEach(() => vi.useRealTimers());

  it('バックアップは開いて最初の保存と、その後1時間ごとだけ', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-08T10:00:00Z'));
    let content: unknown = ledger2026;
    vi.mocked(drive.findFile).mockImplementation(async (_p, name) => (name === 'ledger-2026.json' ? { id: 'a', name, version: '1' } : null));
    vi.mocked(drive.readJson).mockImplementation(async () => content as never);
    vi.mocked(drive.updateJson).mockImplementation(async (_id, data) => {
      content = data;
      return { id: 'a', name: 'ledger-2026.json', version: '2' };
    });
    const first = await store.loadLedger(2026);
    if ('needsOpening' in first) throw new Error('帳簿があるはず');
    const second = await store.saveLedger(first);
    expect(drive.copyFile).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-10-08T10:30:00Z'));
    const third = await store.saveLedger(second);
    expect(drive.copyFile).toHaveBeenCalledTimes(1);
    expect(drive.listFiles).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-10-08T11:01:00Z'));
    await store.saveLedger(third);
    expect(drive.copyFile).toHaveBeenCalledTimes(2);
  });

  it('領収書は同時にアップロードし、順番どおりに返す', async () => {
    let inflight = 0;
    let maxInflight = 0;
    vi.mocked(drive.uploadFile).mockImplementation(async (_parent, name) => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 10));
      inflight--;
      return { fileId: name, name, mimeType: 'application/pdf' };
    });
    const tx = { ...ledger2026.transactions[0], counterparty: '晴れる屋' };
    const files = ['a.pdf', 'b.pdf', 'c.pdf'].map((n) => new File(['%PDF'], n, { type: 'application/pdf' }));
    const receipts = await store.attachReceipts(2026, tx, files);
    expect(maxInflight).toBe(3);
    expect(receipts.map((r) => r.name)).toEqual([
      '2026-12-31_5000_晴れる屋.pdf',
      '2026-12-31_5000_晴れる屋_2.pdf',
      '2026-12-31_5000_晴れる屋_3.pdf',
    ]);
  });
});

describe('フォルダの先読み', () => {
  it('ログイン後に先読みしておけば、保存のときにフォルダを探さない', async () => {
    vi.mocked(drive.uploadFile).mockResolvedValue({ fileId: 'r', name: 'r.pdf', mimeType: 'application/pdf' });
    await store.prefetchFolders(2026);
    vi.mocked(drive.ensureFolder).mockClear();
    await store.attachReceipts(2026, ledger2026.transactions[0], [new File(['%PDF'], 'r.pdf', { type: 'application/pdf' })]);
    expect(drive.ensureFolder).not.toHaveBeenCalled();
  });
});
