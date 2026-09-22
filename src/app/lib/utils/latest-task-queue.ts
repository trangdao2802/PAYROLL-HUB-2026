/** Keep one running write and only the newest pending full-state write. */
export function createLatestTaskQueue(onError: (error: unknown) => void = console.error) {
  let pending: (() => Promise<void>) | undefined;
  let running = false;
  let completion = Promise.resolve();
  return {
    enqueue(task: () => Promise<void>): Promise<void> {
      pending = task;
      if (!running) {
        running = true;
        completion = Promise.resolve().then(async () => {
          try {
            while (pending) {
              const current = pending;
              pending = undefined;
              try { await current(); } catch (error) { onError(error); }
            }
          } finally { running = false; }
        });
      }
      return completion;
    },
  };
}
