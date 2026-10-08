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

/**
 * version は中身の rev（文字列）。ドライブのファイルの version は作成直後などに
 * ドライブ側で勝手に増えることがあり、他の端末での保存の判定に使えない
 */
export type Loaded<T> = { data: T; fileId: string; version: string };

type Revisioned = { rev?: number };

function loaded<T extends Revisioned>(data: T, fileId: string): Loaded<T> {
  return { data, fileId, version: String(data.rev ?? 0) };
}

/** ドライブ上の中身の rev が読み込んだときと同じなら、rev を1進めて保存する */
async function saveChecked<T extends Revisioned>(l: Loaded<T>, beforeWrite?: () => Promise<void>): Promise<Loaded<T>> {
  const current = await drive.readJson<Revisioned>(l.fileId);
  if (String(current.rev ?? 0) !== l.version) throw new ConflictError();
  await beforeWrite?.();
  const data = { ...l.data, rev: Number(l.version) + 1 };
  await drive.updateJson(l.fileId, data);
  return loaded(data, l.fileId);
}

/** 読み込んだ帳簿。openingChanged は前年の期末に合わせて期首残高を直した（まだ保存していない）とき true */
export type LoadedLedger = Loaded<Ledger> & { openingChanged: boolean };

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
  if (file) return loaded(await drive.readJson<Settings>(file.id), file.id);
  const data = DEFAULT_SETTINGS(today);
  const created = await drive.createJson(parent, SETTINGS, data);
  return loaded(data, created.id);
}

export async function saveSettings(s: Loaded<Settings>): Promise<Loaded<Settings>> {
  return saveChecked(s);
}

/**
 * その年の帳簿。前年の帳簿があれば、期首残高は読み込むたびに前年の期末に合わせる
 * （年が明けてから前年分を入力しても翌年の期首がずれないように）。
 * なければ前年の期末残高から作る。前年もなければ期首残高の入力が必要
 */
export async function loadLedger(year: number): Promise<LoadedLedger | { needsOpening: true }> {
  const parent = await root();
  const prevFile = await drive.findFile(parent, ledgerName(year - 1));
  const prevOpening = prevFile ? nextOpening(await drive.readJson<Ledger>(prevFile.id)) : null;
  const file = await drive.findFile(parent, ledgerName(year));
  if (!file) {
    if (!prevOpening) return { needsOpening: true };
    return { ...(await createLedger(year, prevOpening)), openingChanged: false };
  }
  const data = await drive.readJson<Ledger>(file.id);
  const current = loaded(data, file.id);
  if (!prevOpening || (prevOpening.cash === data.opening.cash && prevOpening.bank === data.opening.bank)) {
    return { ...current, openingChanged: false };
  }
  return { ...current, data: { ...data, opening: prevOpening }, openingChanged: true };
}

/** 前年の帳簿があるか（あれば期首残高は自動で決まり、手で変えない） */
export async function hasPreviousLedger(year: number): Promise<boolean> {
  return (await drive.findFile(await root(), ledgerName(year - 1))) !== null;
}

/** 帳簿を作る。同じ年の帳簿がすでにあれば（再試行・別の端末）作らずにそれを使う */
export async function createLedger(year: number, opening: { cash: number; bank: number }): Promise<Loaded<Ledger>> {
  const parent = await root();
  const existing = await drive.findFile(parent, ledgerName(year));
  if (existing) return loaded(await drive.readJson<Ledger>(existing.id), existing.id);
  const data: Ledger = { year, opening, events: [], transactions: [] };
  const created = await drive.createJson(parent, ledgerName(year), data);
  return loaded(data, created.id);
}

/** 衝突を確かめ、直前の版を backup/ に残してから保存する */
export async function saveLedger(l: Loaded<Ledger>): Promise<Loaded<Ledger>> {
  return saveChecked(l, async () => {
    const backup = await folder('backup');
    await drive.copyFile(l.fileId, backup, backupName(l.data.year, new Date()));
    const existing = await drive.listFiles(backup);
    for (const name of backupsToDelete(existing.map((f) => f.name), l.data.year, BACKUP_KEEP)) {
      const target = existing.find((f) => f.name === name);
      if (target) await drive.trashFile(target.id);
    }
  });
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
