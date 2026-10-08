/**
 * 「保存しています」の表示を管理する。処理が重なったり入れ子になっても、
 * 最初の開始で表示し、全部終わったときに消す（失敗しても消す）
 */
export function createBusy(onChange: (on: boolean) => void): <T>(task: () => Promise<T>) => Promise<T> {
  let count = 0;
  return async (task) => {
    if (count++ === 0) onChange(true);
    try {
      return await task();
    } finally {
      if (--count === 0) onChange(false);
    }
  };
}
