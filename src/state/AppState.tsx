import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as api from "../api";
import * as store from "../store";
import { applyPersonality } from "../personality";
import { dict } from "../i18n";
import { DEFAULT_CONFIG, type RegisteredRepo, type RepositoryState, type SentinelConfig } from "../types";

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
};

/** Result of a Fetch all run. */
export type FetchAllSummary = {
  succeeded: number;
  failed: Array<{ path: string; error: string }>;
};

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
  config: SentinelConfig;
  repos: RepoView[];
  updateConfig: (patch: Partial<SentinelConfig>) => Promise<void>;
  completeOnboarding: (config: SentinelConfig) => Promise<void>;
  addRepo: (path: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeRepo: (path: string) => Promise<void>;
  setReferenceBranch: (path: string, referenceBranch?: string) => Promise<void>;
  refreshOne: (path: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  fetchOne: (path: string) => Promise<{ ok: boolean; error?: string }>;
  fetchAll: () => Promise<FetchAllSummary>;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<SentinelConfig>(DEFAULT_CONFIG);
  const [repos, setRepos] = useState<RepoView[]>([]);

  // Load persisted state once on startup.
  useEffect(() => {
    (async () => {
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
      // Inspect all registered repos (local only, no network).
      for (const r of savedRepos) void inspect(r.path, r.referenceBranch);
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

  const inspect = useCallback(async (path: string, referenceBranch?: string) => {
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
    } catch (e) {
      setRepos((prev) =>
        prev.map((r) =>
          r.path === path ? { ...r, error: String(e), loading: false } : r,
        ),
      );
    }
  }, [persistRepos]);

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
    async (path: string) => inspect(path, repos.find((r) => r.path === path)?.referenceBranch),
    [inspect, repos],
  );

  const refreshAll = useCallback(async () => {
    const paths = repos.map((r) => r.path);
    await Promise.all(paths.map((p) => inspect(p, repos.find((r) => r.path === p)?.referenceBranch)));
  }, [repos, inspect]);

  const fetchOne = useCallback(
    async (path: string): Promise<{ ok: boolean; error?: string }> => {
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
        return { ok: true };
      } catch (e) {
        const error = String(e);
        setRepos((prev) =>
          prev.map((r) => (r.path === path ? { ...r, fetching: false, fetchError: error } : r)),
        );
        return { ok: false, error };
      }
    },
    [inspect, persistRepos, repos],
  );

  const fetchAll = useCallback(async (): Promise<FetchAllSummary> => {
    // A few at a time; one repo failing must not stop the others.
    const paths = repos.map((r) => r.path);
    const results = await mapWithConcurrency(paths, FETCH_ALL_CONCURRENCY, async (p) => ({
      path: p,
      ...(await fetchOne(p)),
    }));
    return {
      succeeded: results.filter((r) => r.ok).length,
      failed: results
        .filter((r) => !r.ok)
        .map((r) => ({ path: r.path, error: r.error ?? "unknown error" })),
    };
  }, [repos, fetchOne]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      config,
      repos,
      updateConfig,
      completeOnboarding,
      addRepo,
      removeRepo,
      setReferenceBranch,
      refreshOne,
      refreshAll,
      fetchOne,
      fetchAll,
    }),
    [
      ready,
      config,
      repos,
      updateConfig,
      completeOnboarding,
      addRepo,
      removeRepo,
      setReferenceBranch,
      refreshOne,
      refreshAll,
      fetchOne,
      fetchAll,
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
