import { describe, expect, it } from 'vitest';
import { createBusy } from './busy';

describe('createBusy', () => {
  it('処理中だけ表示し、終わったら消す', async () => {
    const log: boolean[] = [];
    const busy = createBusy((on) => log.push(on));
    await busy(async () => {
      expect(log).toEqual([true]);
    });
    expect(log).toEqual([true, false]);
  });

  it('入れ子・重なっても、全部終わるまで消さない', async () => {
    const log: boolean[] = [];
    const busy = createBusy((on) => log.push(on));
    let release!: () => void;
    const outer = busy(async () => {
      await busy(async () => {});
      await new Promise<void>((r) => (release = r));
    });
    const other = busy(async () => {});
    await other;
    expect(log).toEqual([true]);
    release();
    await outer;
    expect(log).toEqual([true, false]);
  });

  it('失敗しても消して、エラーはそのまま返す', async () => {
    const log: boolean[] = [];
    const busy = createBusy((on) => log.push(on));
    await expect(busy(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(log).toEqual([true, false]);
  });
});

describe('表示する文言', () => {
  it('処理ごとに文言を渡し、始まるたびに切り替える', async () => {
    const log: [boolean, string | undefined][] = [];
    const busy = createBusy((on, message) => log.push([on, message]));
    await busy(async () => {
      await busy(async () => {}, '保存しています…');
    }, '読み込んでいます…');
    expect(log).toEqual([
      [true, '読み込んでいます…'],
      [true, '保存しています…'],
      [false, undefined],
    ]);
  });
});
