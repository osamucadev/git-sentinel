import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as api from "../api";
import * as store from "../store";
import { applyPersonality } from "../personality";
import { dict } from "../i18n";
import { DEFAULT_CONFIG, type RegisteredRepo, type RepositoryState, type SentinelConfig } from "../types";
import { beginActivity, completeActivity, finishActivityItem, startActivityItem, type Activity, type ActivityKind } from "../activity";
import { createLocalRefreshScheduler } from "../localRefresh";

/** Per-repository inspection result plus UI status flags. */
export type RepoView = {
  path: string;
  lastSuccessfulFetch?: string;
  referenceBranch?: string;
  state?: RepositoryState;
  error?: string;
  /** Git error from the most recent failed fetch, kept until the next success. */
  fetchError?: string;
  loading: boolean;
  fetching: boolean;
  pushing?: boolean;
};

export type BootState = {
  phase: "starting" | "restoring" | "inspecting" | "complete";
  total: number;
  completed: number;
  currentPath?: string;
};

/** Result of a Fetch all run. */
export type FetchAllSummary = {
  succeeded: number;
  failed: Array<{ path: string; error: string }>;
};

type InspectResult = { ok: boolean; error?: string };

/** Runs `task` over `items`, at most `limit` in flight at once. No framework:
 * a fixed pool of workers pulling from a shared index. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

const FETCH_ALL_CONCURRENCY = 4;

type AppState = {
  ready: boolean;
  boot: BootState;
  config: SentinelConfig;
  repos: RepoView[];
  activity: Activity | null;
  updateConfig: (patch: Partial<SentinelConfig>) => Promise<void>;
  completeOnboarding: (config: SentinelConfig) => Promise<void>;
  addRepo: (path: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeRepo: (path: string) => Promise<void>;
  setReferenceBranch: (path: string, referenceBranch?: string) => Promise<void>;
  refreshOne: (path: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  fetchOne: (path: string) => Promise<{ ok: boolean; error?: string }>;
  fetchAll: (kind?: "fetchAll" | "autoFetch") => Promise<FetchAllSummary>;
  pushOne: (path: string) => Promise<{ ok: boolean; error?: string }>;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [boot, setBoot] = useState<BootState>({ phase: "starting", total: 0, completed: 0 });
  const [config, setConfig] = useState<SentinelConfig>(DEFAULT_CONFIG);
  const [repos, setRepos] = useState<RepoView[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const repoMeta = useRef(new Map<string, { referenceBranch?: string }>());
  const inspectionRuns = useRef(new Map<string, Promise<InspectResult>>());
  const fetchAllRunning = useRef(false);
  const activityClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted state once on startup.
  useEffect(() => {
    (async () => {
      setBoot({ phase: "restoring", total: 0, completed: 0 });
      const [savedConfig, savedRepos] = await Promise.all([
        store.loadConfig(),
        store.loadRepos(),
      ]);
      setConfig(savedConfig);
      applyPersonality(savedConfig.personality);
      setRepos(
        savedRepos.map((r) => ({
          path: r.path,
          lastSuccessfulFetch: r.lastSuccessfulFetch,
          referenceBranch: r.referenceBranch,
          loading: true,
          fetching: false,
        })),
      );
      setReady(true);
      for (const r of savedRepos) void api.watchRepository(r.path).catch(() => {});
      // Inspect all registered repos (local only, no network).
      if (savedRepos.length === 0) {
        setBoot({ phase: "complete", total: 0, completed: 0 });
      } else {
        setBoot({ phase: "inspecting", total: savedRepos.length, completed: 0 });
        void runInspectionBatch("startup", savedRepos, (completed, currentPath) => {
          setBoot({ phase: completed === savedRepos.length ? "complete" : "inspecting", total: savedRepos.length, completed, currentPath });
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistRepos = useCallback((next: RepoView[]) => {
    const toSave: RegisteredRepo[] = next.map((r) => ({
      path: r.path,
      lastSuccessfulFetch: r.lastSuccessfulFetch,
      referenceBranch: r.referenceBranch,
    }));
    void store.saveRepos(toSave);
  }, []);

  useEffect(() => {
    repoMeta.current = new Map(repos.map((repo) => [repo.path, { referenceBranch: repo.referenceBranch }]));
  }, [repos]);

  const settleActivity = useCallback((next: Activity) => {
    const done = completeActivity(next);
    setActivity(done);
    if (activityClearTimer.current) clearTimeout(activityClearTimer.current);
    activityClearTimer.current = setTimeout(() => setActivity(null), 3500);
  }, []);

  const inspect = useCallback((path: string, referenceBranch?: string): Promise<InspectResult> => {
    const existing = inspectionRuns.current.get(path);
    if (existing) return existing;
    const task = (async (): Promise<InspectResult> => {
      setRepos((prev) =>
        prev.map((r) => (r.path === path ? { ...r, loading: true, error: undefined } : r)),
      );
      try {
        const state = await api.inspectRepository(path, referenceBranch);
        setRepos((prev) => {
          const next = prev.map((r) =>
            r.path === path
              ? { ...r, state, loading: false, referenceBranch: state.referenceBranch ?? undefined }
              : r,
          );
          persistRepos(next);
          return next;
        });
        return { ok: true };
      } catch (e) {
        const error = String(e);
        setRepos((prev) =>
          prev.map((r) => (r.path === path ? { ...r, error, loading: false } : r)),
        );
        return { ok: false, error };
      }
    })();
    inspectionRuns.current.set(path, task);
    void task.finally(() => {
      if (inspectionRuns.current.get(path) === task) inspectionRuns.current.delete(path);
    });
    return task;
  }, [persistRepos]);

  const runInspectionBatch = useCallback(async (
    kind: Extract<ActivityKind, "refresh" | "startup">,
    targets: Array<{ path: string; referenceBranch?: string }>,
    onProgress?: (completed: number, currentPath?: string) => void,
  ) => {
    if (targets.length === 0) return;
    setActivity(beginActivity(kind, targets.length));
    let completed = 0;
    const results = await Promise.all(targets.map(async (target) => {
      setActivity((current) => current && current.phase === "running" ? startActivityItem(current, target.path) : current);
      onProgress?.(0, target.path);
      const result = await inspect(target.path, target.referenceBranch);
      setActivity((current) => current && current.phase === "running"
        ? finishActivityItem(current, target.path, result.ok ? undefined : result.error)
        : current);
      completed += 1;
      onProgress?.(completed, undefined);
      return { path: target.path, ...result };
    }));
    settleActivity({
      ...beginActivity(kind, targets.length),
      completed: results.length,
      failed: results.filter((result) => !result.ok).map((result) => ({ path: result.path, error: result.error ?? "unknown error" })),
    });
  }, [inspect, settleActivity]);

  useEffect(() => {
    const scheduler = createLocalRefreshScheduler(async (path) => {
      await inspect(path, repoMeta.current.get(path)?.referenceBranch);
    });
    let unlisten: (() => void) | undefined;
    void api.onRepositoryLocalChange((path) => {
      if (repoMeta.current.has(path)) scheduler.notify(path);
    }).then((stop) => { unlisten = stop; });
    return () => { scheduler.dispose(); unlisten?.(); };
  }, [inspect]);

  const updateConfig = useCallback(
    async (patch: Partial<SentinelConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...patch };
        void store.saveConfig(next);
        if (patch.personality) applyPersonality(patch.personality);
        return next;
      });
    },
    [],
  );

  const completeOnboarding = useCallback(async (next: SentinelConfig) => {
    const finalConfig = { ...next, onboarded: true };
    setConfig(finalConfig);
    applyPersonality(finalConfig.personality);
    await store.saveConfig(finalConfig);
  }, []);

  const addRepo = useCallback(
    async (rawPath: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      let canonical: string;
      try {
        canonical = await api.validateRepository(rawPath);
      } catch {
        return { ok: false, error: "notAGitRepo" };
      }
      let duplicate = false;
      setRepos((prev) => {
        if (prev.some((r) => r.path === canonical)) {
          duplicate = true;
          return prev;
        }
        const next = [...prev, { path: canonical, loading: true, fetching: false }];
        persistRepos(next);
        return next;
      });
      if (duplicate) return { ok: false, error: "alreadyRegistered" };
      await inspect(canonical);
      void api.watchRepository(canonical).catch(() => {});
      return { ok: true };
    },
    [inspect, persistRepos],
  );

  const removeRepo = useCallback(
    async (path: string) => {
      // Sentinel-only: drop our reference. No Git or filesystem operation.
      setRepos((prev) => {
        const next = prev.filter((r) => r.path !== path);
        persistRepos(next);
        return next;
      });
      void api.unwatchRepository(path).catch(() => {});
    },
    [persistRepos],
  );

  const setReferenceBranch = useCallback(
    async (path: string, referenceBranch?: string) => {
      setRepos((prev) => {
        const next = prev.map((r) => (r.path === path ? { ...r, referenceBranch } : r));
        persistRepos(next);
        return next;
      });
      await inspect(path, referenceBranch);
    },
    [inspect, persistRepos],
  );

  const refreshOne = useCallback(
    async (path: string) => { await inspect(path, repos.find((r) => r.path === path)?.referenceBranch); },
    [inspect, repos],
  );

  const refreshAll = useCallback(async () => {
    await runInspectionBatch("refresh", repos.map((repo) => ({ path: repo.path, referenceBranch: repo.referenceBranch })));
  }, [repos, runInspectionBatch]);

  const fetchOne = useCallback(
    async (path: string, aggregate = false): Promise<{ ok: boolean; error?: string }> => {
      if (fetchAllRunning.current && !aggregate) return { ok: false, error: "fetch_all_in_progress" };
      if (!aggregate) setActivity(beginActivity("fetch", 1));
      setRepos((prev) =>
        prev.map((r) => (r.path === path ? { ...r, fetching: true } : r)),
      );
      try {
        await api.fetchRepository(path);
        const when = new Date().toISOString();
        setRepos((prev) => {
          const next = prev.map((r) =>
            r.path === path
              ? { ...r, fetching: false, lastSuccessfulFetch: when, fetchError: undefined }
              : r,
          );
          persistRepos(next);
          return next;
        });
        await inspect(path, repos.find((r) => r.path === path)?.referenceBranch);
        if (!aggregate) settleActivity({ ...beginActivity("fetch", 1), completed: 1 });
        return { ok: true };
      } catch (e) {
        const error = String(e);
        setRepos((prev) =>
          prev.map((r) => (r.path === path ? { ...r, fetching: false, fetchError: error } : r)),
        );
        if (!aggregate) settleActivity({ ...beginActivity("fetch", 1), completed: 1, failed: [{ path, error }] });
        return { ok: false, error };
      }
    },
    [inspect, persistRepos, repos, settleActivity],
  );

  const fetchAll = useCallback(async (kind: "fetchAll" | "autoFetch" = "fetchAll"): Promise<FetchAllSummary> => {
    // A few at a time; one repo failing must not stop the others.
    const targets = repos.map((repo) => ({ path: repo.path, referenceBranch: repo.referenceBranch }));
    if (targets.length === 0) return { succeeded: 0, failed: [] };
    fetchAllRunning.current = true;
    setActivity(beginActivity(kind, targets.length));
    const results = await mapWithConcurrency(targets, FETCH_ALL_CONCURRENCY, async (target) => {
      setActivity((current) => current && current.phase === "running" ? startActivityItem(current, target.path) : current);
      const result = await fetchOne(target.path, true);
      setActivity((current) => current && current.phase === "running"
        ? finishActivityItem(current, target.path, result.ok ? undefined : result.error)
        : current);
      return { path: target.path, ...result };
    });
    fetchAllRunning.current = false;
    const failed = results
      .filter((r) => !r.ok)
      .map((r) => ({ path: r.path, error: r.error ?? "unknown error" }));
    settleActivity({ ...beginActivity(kind, targets.length), completed: results.length, failed });
    return {
      succeeded: results.filter((r) => r.ok).length,
      failed,
    };
  }, [repos, fetchOne, settleActivity]);

  const pushOne = useCallback(async (path: string): Promise<{ ok: boolean; error?: string }> => {
    const repo = repos.find((item) => item.path === path);
    const ahead = repo?.state?.trackingDivergence?.ahead ?? 0;
    if (!repo?.state?.upstream || ahead === 0) return { ok: false, error: "nothing_to_push" };
    if (fetchAllRunning.current || activity?.phase === "running") return { ok: false, error: "operation_in_progress" };
    setActivity(beginActivity("push", 1));
    setRepos((prev) => prev.map((item) => item.path === path ? { ...item, pushing: true } : item));
    try {
      await api.pushRepository(path);
      setRepos((prev) => prev.map((item) => item.path === path ? { ...item, pushing: false } : item));
      await inspect(path, repo.referenceBranch);
      settleActivity({ ...beginActivity("push", 1), completed: 1 });
      return { ok: true };
    } catch (e) {
      const error = String(e);
      setRepos((prev) => prev.map((item) => item.path === path ? { ...item, pushing: false } : item));
      settleActivity({ ...beginActivity("push", 1), completed: 1, failed: [{ path, error }] });
      return { ok: false, error };
    }
  }, [activity?.phase, inspect, repos, settleActivity]);

  useEffect(() => {
    if (!ready || !config.autoFetchEnabled || repos.length === 0) return;
    const timer = window.setInterval(() => {
      if (!fetchAllRunning.current && !activity) void fetchAll("autoFetch");
    }, config.autoFetchIntervalMinutes * 60_000);
    return () => window.clearInterval(timer);
  }, [activity, config.autoFetchEnabled, config.autoFetchIntervalMinutes, fetchAll, ready, repos.length]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      config,
      repos,
      activity,
      boot,
      updateConfig,
      completeOnboarding,
      addRepo,
      removeRepo,
      setReferenceBranch,
      refreshOne,
      refreshAll,
      fetchOne,
      fetchAll,
      pushOne,
    }),
    [
      ready,
      config,
      repos,
      activity,
      boot,
      updateConfig,
      completeOnboarding,
      addRepo,
      removeRepo,
      setReferenceBranch,
      refreshOne,
      refreshAll,
      fetchOne,
      fetchAll,
      pushOne,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}

/** Convenience: the active translation dictionary. */
export function useDict() {
  return dict(useApp().config.language);
}
