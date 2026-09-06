/** Coalesces filesystem hints into one local inspection per repository. */
export function createLocalRefreshScheduler(
  refresh: (path: string) => Promise<void>,
  delayMs = 650,
) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const running = new Map<string, Promise<void>>();
  const pending = new Set<string>();

  const run = (path: string) => {
    if (running.has(path)) {
      pending.add(path);
      return;
    }
    const task = refresh(path).finally(() => {
      running.delete(path);
      if (pending.delete(path)) schedule(path);
    });
    running.set(path, task);
  };

  const schedule = (path: string) => {
    const old = timers.get(path);
    if (old) clearTimeout(old);
    timers.set(path, setTimeout(() => {
      timers.delete(path);
      run(path);
    }, delayMs));
  };

  return {
    notify(path: string) { schedule(path); },
    dispose() {
      timers.forEach(clearTimeout);
      timers.clear();
      pending.clear();
    },
  };
}
