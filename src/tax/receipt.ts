import type { Transaction } from './ledger';

/** 領収書のファイル名 `YYYY-MM-DD_金額_取引先.拡張子`（2枚目以降は `_2` などを付ける） */
export function receiptFileName(
  tx: Pick<Transaction, 'date' | 'amount' | 'counterparty'>,
  ext: string,
  index: number,
): string {
  const counterparty = (tx.counterparty ?? '').trim().replace(/[/\\:*?"<>|]/g, '_') || '取引先なし';
  const suffix = index === 0 ? '' : `_${index + 1}`;
  return `${tx.date}_${tx.amount}_${counterparty}${suffix}.${ext}`;
}

/** 保存するときの拡張子。画像は JPEG に縮小するので jpg */
export function extensionOf(file: { name: string; type: string }): string {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'pdf' : 'jpg';
}

/** 縦横比を保って長辺を max 以下にする */
export function fitSize(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** 画像を長辺 max px の JPEG にする（ブラウザ専用） */
export async function resizeImage(file: File, max = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitSize(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('画像を変換できませんでした'))), 'image/jpeg', 0.85),
  );
}
