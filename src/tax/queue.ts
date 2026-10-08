/** 非同期の処理を1つずつ順に実行する（保存が重なって古い帳簿で上書きしないため） */
export function createQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const result = tail.then(task, task);
    tail = result.catch(() => {});
    return result;
  };
}
