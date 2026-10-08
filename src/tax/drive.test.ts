import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let requests = 0;
let expiresIn = 0;

beforeEach(() => {
  requests = 0;
  expiresIn = 0;
  vi.stubGlobal('google', {
    accounts: {
      oauth2: {
        initTokenClient: (cfg: { callback: (r: { access_token: string; expires_in: number }) => void }) => ({
          requestAccessToken: () => {
            requests++;
            setTimeout(() => cfg.callback({ access_token: 'tok', expires_in: expiresIn }));
          },
        }),
        revoke: () => {},
      },
    },
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ version: '1' }), { status: 200 })));
  vi.resetModules();
});

afterEach(() => vi.unstubAllGlobals());

describe('トークン', () => {
  it('期限切れのとき同時に呼んでも取り直しは1回で、どちらも終わる', async () => {
    const drive = await import('./drive');
    await drive.signIn('client');
    expect(requests).toBe(1);
    expiresIn = 3600;
    const results = await Promise.all([drive.getVersion('a'), drive.getVersion('b')]);
    expect(results).toEqual(['1', '1']);
    expect(requests).toBe(2);
  });

  it('ensureFresh は期限切れなら同期的に取り直しを始める（クリック直後に呼ぶため）', async () => {
    const drive = await import('./drive');
    await drive.signIn('client');
    const before = requests;
    const p = drive.ensureFresh();
    expect(requests).toBe(before + 1);
    await p;
  });
});
