/**
 * 「保存しています…」などの待ち表示を管理する。処理が重なったり入れ子になっても、
 * 最初の開始で表示し、全部終わったときに消す（失敗しても消す）。
 * 文言を渡した処理が始まると、表示中でもその文言に切り替える
 */
export function createBusy(
  onChange: (on: boolean, message?: string) => void,
): <T>(task: () => Promise<T>, message?: string) => Promise<T> {
  let count = 0;
  return async (task, message) => {
    if (count++ === 0 || message !== undefined) onChange(true, message);
    try {
      return await task();
    } finally {
      if (--count === 0) onChange(false);
    }
  };
}
