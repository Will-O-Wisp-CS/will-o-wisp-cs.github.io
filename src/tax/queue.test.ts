import { describe, expect, it } from 'vitest';
import { createQueue } from './queue';

describe('createQueue', () => {
  it('前の処理が終わってから次を始める', async () => {
    const run = createQueue();
    const log: string[] = [];
    let release!: () => void;
    const first = run(async () => {
      log.push('1 start');
      await new Promise<void>((r) => (release = r));
      log.push('1 end');
    });
    const second = run(async () => {
      log.push('2 start');
    });
    await Promise.resolve();
    expect(log).toEqual(['1 start']);
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(['1 start', '1 end', '2 start']);
  });

  it('前の処理が失敗しても次は動く', async () => {
    const run = createQueue();
    await expect(run(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(run(async () => 'ok')).resolves.toBe('ok');
  });
});
