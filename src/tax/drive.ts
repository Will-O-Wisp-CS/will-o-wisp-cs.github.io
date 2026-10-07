import type { Receipt } from './ledger';

/** Google ドライブの REST API（v3）を fetch で呼ぶ薄い層。トークンはメモリにだけ置く */

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const FIELDS = 'id,name,version';

export type DriveFile = { id: string; name: string; version: string };

export class DriveError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let client: google.accounts.oauth2.TokenClient | null = null;
let token: string | null = null;
let expiresAt = 0;
let pending: { resolve: () => void; reject: (e: Error) => void } | null = null;

/** Google でログインして drive.file のトークンを取る */
export async function signIn(clientId: string): Promise<void> {
  if (!client) {
    if (typeof google === 'undefined' || !google.accounts?.oauth2) {
      throw new Error('Google のログイン機能を読み込めませんでした。再読み込みしてください');
    }
    client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (res) => {
        if (res.error || !res.access_token) {
          pending?.reject(new Error(res.error_description || res.error || 'ログインできませんでした'));
        } else {
          token = res.access_token;
          expiresAt = Date.now() + res.expires_in * 1000;
          pending?.resolve();
        }
        pending = null;
      },
      error_callback: (err) => {
        pending?.reject(new Error(err.type === 'popup_closed' ? 'ログインがキャンセルされました' : 'ログインできませんでした'));
        pending = null;
      },
    });
  }
  await requestToken();
}

export function signOut(): void {
  if (token) google.accounts.oauth2.revoke(token);
  token = null;
  expiresAt = 0;
}

export function isSignedIn(): boolean {
  return token !== null;
}

function requestToken(): Promise<void> {
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    client!.requestAccessToken({ prompt: '' });
  });
}

/** 期限まで60秒を切っていたら取り直す */
async function ensureToken(): Promise<string> {
  if (!client) throw new DriveError(401, 'ログインしてください');
  if (!token || Date.now() > expiresAt - 60_000) await requestToken();
  return token!;
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const auth = await ensureToken();
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${auth}` } });
  if (!res.ok) throw new DriveError(res.status, `Google ドライブのエラー (${res.status}): ${await res.text()}`);
  return res;
}

async function callJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  return (await call(url, init)).json() as Promise<T>;
}

function quote(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

/** parentId が null ならマイドライブ直下 */
export async function findFile(parentId: string | null, name: string, folder = false): Promise<DriveFile | null> {
  const q = [`name = ${quote(name)}`, `${quote(parentId ?? 'root')} in parents`, 'trashed = false'];
  if (folder) q.push(`mimeType = '${FOLDER}'`);
  const params = new URLSearchParams({ q: q.join(' and '), fields: `files(${FIELDS})`, spaces: 'drive' });
  const res = await callJson<{ files: DriveFile[] }>(`${API}/files?${params}`);
  return res.files[0] ?? null;
}

export async function ensureFolder(parentId: string | null, name: string): Promise<string> {
  const found = await findFile(parentId, name, true);
  if (found) return found.id;
  const created = await callJson<DriveFile>(`${API}/files?fields=${FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: parentId ? [parentId] : undefined }),
  });
  return created.id;
}

export async function listFiles(parentId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `${quote(parentId)} in parents and trashed = false`,
      fields: `nextPageToken,files(${FIELDS})`,
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await callJson<{ files: DriveFile[]; nextPageToken?: string }>(`${API}/files?${params}`);
    files.push(...res.files);
    pageToken = res.nextPageToken ?? '';
  } while (pageToken);
  return files;
}

export async function readJson<T>(fileId: string): Promise<T> {
  return callJson<T>(`${API}/files/${fileId}?alt=media`);
}

export async function getVersion(fileId: string): Promise<string> {
  return (await callJson<{ version: string }>(`${API}/files/${fileId}?fields=version`)).version;
}

/** メタデータと中身を multipart/related で送って新しいファイルを作る */
async function createWithContent(parentId: string, name: string, blob: Blob): Promise<DriveFile & { mimeType: string }> {
  const boundary = `oni-${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name, parents: [parentId] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  return callJson(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS},mimeType`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

function jsonBlob(data: unknown): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

export async function createJson(parentId: string, name: string, data: unknown): Promise<DriveFile> {
  const { id, version } = await createWithContent(parentId, name, jsonBlob(data));
  return { id, name, version };
}

export async function updateJson(fileId: string, data: unknown): Promise<DriveFile> {
  return callJson<DriveFile>(`${UPLOAD}/files/${fileId}?uploadType=media&fields=${FIELDS}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: jsonBlob(data),
  });
}

export async function copyFile(fileId: string, parentId: string, name: string): Promise<void> {
  await call(`${API}/files/${fileId}/copy?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [parentId] }),
  });
}

export async function uploadFile(parentId: string, name: string, blob: Blob): Promise<Receipt> {
  const created = await createWithContent(parentId, name, blob);
  return { fileId: created.id, name, mimeType: created.mimeType || blob.type };
}

async function patchMeta(fileId: string, meta: object): Promise<void> {
  await call(`${API}/files/${fileId}?fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
}

export function renameFile(fileId: string, name: string): Promise<void> {
  return patchMeta(fileId, { name });
}

export function trashFile(fileId: string): Promise<void> {
  return patchMeta(fileId, { trashed: true });
}

/** ドライブの画面でファイルを開く URL */
export function fileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
