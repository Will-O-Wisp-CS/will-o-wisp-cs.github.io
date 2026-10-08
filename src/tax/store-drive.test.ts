import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ledger } from './ledger';

vi.mock('./drive', () => ({
  ensureFolder: vi.fn(async () => 'root'),
  findFile: vi.fn(),
  readJson: vi.fn(),
  createJson: vi.fn(),
  updateJson: vi.fn(),
  getVersion: vi.fn(),
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
