import { describe, expect, it, vi } from "vitest";
import { createLocalRefreshScheduler } from "./localRefresh";

describe("local refresh scheduler", () => {
  it("debounces nearby change events into one inspection", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const scheduler = createLocalRefreshScheduler(refresh, 100);
    scheduler.notify("/one"); scheduler.notify("/one"); scheduler.notify("/one");
    await vi.advanceTimersByTimeAsync(100);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith("/one");
    scheduler.dispose();
    vi.useRealTimers();
  });

  it("refreshes only the changed repository and queues an event during inspection", async () => {
    vi.useFakeTimers();
    const resolvers = new Map<string, () => void>();
    const refresh = vi.fn((path: string) => new Promise<void>((done) => { resolvers.set(path, done); }));
    const scheduler = createLocalRefreshScheduler(refresh, 50);
    scheduler.notify("/one"); scheduler.notify("/two");
    await vi.advanceTimersByTimeAsync(50);
    expect(refresh.mock.calls.map(([path]) => path).sort()).toEqual(["/one", "/two"]);
    scheduler.notify("/one");
    resolvers.get("/one")!();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(50);
    expect(refresh).toHaveBeenCalledTimes(3);
    scheduler.dispose();
    vi.useRealTimers();
  });
});
