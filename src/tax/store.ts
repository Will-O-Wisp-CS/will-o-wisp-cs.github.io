import * as drive from './drive';
import { DEFAULT_SETTINGS, type Ledger, type Receipt, type Settings, type Transaction } from './ledger';
import { extensionOf, receiptFileName, resizeImage } from './receipt';
import { nextOpening } from './report';

/** 帳簿の読み書き。ドライブのフォルダ構成は spec「Google ドライブ」のとおり */

const ROOT = '鬼火CS帳簿';
const SETTINGS = 'settings.json';
const BACKUP_KEEP = 30;

/** 他の端末で先に保存されていた */
export class ConflictError extends Error {
  constructor() {
    super('他の端末で更新されています。再読み込みしてください');
  }
}

export type Loaded<T> = { data: T; fileId: string; version: string };

let rootId: string | null = null;
const folderIds = new Map<string, string>();

async function root(): Promise<string> {
  rootId ??= await drive.ensureFolder(null, ROOT);
  return rootId;
}

/** 鬼火CS帳簿/ の下のフォルダ（'backup' や 'receipts/2026'） */
async function folder(path: string): Promise<string> {
  const cached = folderIds.get(path);
  if (cached) return cached;
  let parent = await root();
  for (const name of path.split('/')) parent = await drive.ensureFolder(parent, name);
  folderIds.set(path, parent);
  return parent;
}

/** ログアウト時にフォルダ ID のキャッシュを捨てる */
export function resetStore(): void {
  rootId = null;
  folderIds.clear();
}

const ledgerName = (year: number) => `ledger-${year}.json`;

export async function loadSettings(today: string): Promise<Loaded<Settings>> {
  const parent = await root();
  const file = await drive.findFile(parent, SETTINGS);
  if (file) return { data: await drive.readJson<Settings>(file.id), fileId: file.id, version: file.version };
  const data = DEFAULT_SETTINGS(today);
  const created = await drive.createJson(parent, SETTINGS, data);
  return { data, fileId: created.id, version: created.version };
}

export async function saveSettings(s: Loaded<Settings>): Promise<Loaded<Settings>> {
  if ((await drive.getVersion(s.fileId)) !== s.version) throw new ConflictError();
  const updated = await drive.updateJson(s.fileId, s.data);
  return { ...s, version: updated.version };
}

/** その年の帳簿。なければ前年の期末残高から作る。前年もなければ期首残高の入力が必要 */
export async function loadLedger(year: number): Promise<Loaded<Ledger> | { needsOpening: true }> {
  const parent = await root();
  const file = await drive.findFile(parent, ledgerName(year));
  if (file) return { data: await drive.readJson<Ledger>(file.id), fileId: file.id, version: file.version };
  const prev = await drive.findFile(parent, ledgerName(year - 1));
  if (!prev) return { needsOpening: true };
  return createLedger(year, nextOpening(await drive.readJson<Ledger>(prev.id)));
}

export async function createLedger(year: number, opening: { cash: number; bank: number }): Promise<Loaded<Ledger>> {
  const data: Ledger = { year, opening, events: [], transactions: [] };
  const created = await drive.createJson(await root(), ledgerName(year), data);
  return { data, fileId: created.id, version: created.version };
}

/** 衝突を確かめ、直前の版を backup/ に残してから保存する */
export async function saveLedger(l: Loaded<Ledger>): Promise<Loaded<Ledger>> {
  if ((await drive.getVersion(l.fileId)) !== l.version) throw new ConflictError();
  const backup = await folder('backup');
  await drive.copyFile(l.fileId, backup, backupName(l.data.year, new Date()));
  const existing = await drive.listFiles(backup);
  for (const name of backupsToDelete(existing.map((f) => f.name), l.data.year, BACKUP_KEEP)) {
    const target = existing.find((f) => f.name === name);
    if (target) await drive.trashFile(target.id);
  }
  const updated = await drive.updateJson(l.fileId, l.data);
  return { ...l, version: updated.version };
}

/** 領収書をアップロードする。画像は縮小して JPEG に、PDF はそのまま */
export async function attachReceipts(year: number, tx: Transaction, files: File[]): Promise<Receipt[]> {
  const parent = await folder(`receipts/${year}`);
  const receipts: Receipt[] = [];
  for (const [i, file] of files.entries()) {
    const ext = extensionOf(file);
    const blob = ext === 'pdf' ? file : await resizeImage(file);
    const name = receiptFileName(tx, ext, tx.receipts.length + i);
    receipts.push(await drive.uploadFile(parent, name, blob));
  }
  return receipts;
}

/** 日付・金額・取引先が変わったら領収書のファイル名も合わせる */
export async function renameReceipts(tx: Transaction): Promise<Receipt[]> {
  const renamed: Receipt[] = [];
  for (const [i, r] of tx.receipts.entries()) {
    const name = receiptFileName(tx, r.name.split('.').pop() ?? 'jpg', i);
    if (name !== r.name) await drive.renameFile(r.fileId, name);
    renamed.push({ ...r, name });
  }
  return renamed;
}

export async function trashReceipts(tx: Transaction): Promise<void> {
  for (const r of tx.receipts) await drive.trashFile(r.fileId);
}

/** バックアップのファイル名（UTC の秒まで） */
export function backupName(year: number, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `ledger-${year}-${stamp}.json`;
}

/** その年のバックアップのうち、新しい keep 件より古いもの */
export function backupsToDelete(names: string[], year: number, keep = BACKUP_KEEP): string[] {
  const pattern = new RegExp(`^ledger-${year}-\\d{8}T\\d{6}Z\\.json$`);
  const sorted = names.filter((n) => pattern.test(n)).sort();
  return sorted.slice(0, Math.max(0, sorted.length - keep));
}
