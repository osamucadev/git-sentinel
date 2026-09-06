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
  state?: RepositoryState;
  error?: string;
  loading: boolean;
  fetching: boolean;
};

type AppState = {
  ready: boolean;
  config: SentinelConfig;
  repos: RepoView[];
  updateConfig: (patch: Partial<SentinelConfig>) => Promise<void>;
  completeOnboarding: (config: SentinelConfig) => Promise<void>;
  addRepo: (path: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeRepo: (path: string) => Promise<void>;
  refreshOne: (path: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  fetchOne: (path: string) => Promise<{ ok: boolean; error?: string }>;
  fetchAll: () => Promise<void>;
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
          loading: true,
          fetching: false,
        })),
      );
      setReady(true);
      // Inspect all registered repos (local only, no network).
      for (const r of savedRepos) void inspect(r.path);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistRepos = useCallback((next: RepoView[]) => {
    const toSave: RegisteredRepo[] = next.map((r) => ({
      path: r.path,
      lastSuccessfulFetch: r.lastSuccessfulFetch,
    }));
    void store.saveRepos(toSave);
  }, []);

  const inspect = useCallback(async (path: string) => {
    setRepos((prev) =>
      prev.map((r) => (r.path === path ? { ...r, loading: true, error: undefined } : r)),
    );
    try {
      const state = await api.inspectRepository(path);
      setRepos((prev) =>
        prev.map((r) => (r.path === path ? { ...r, state, loading: false } : r)),
      );
    } catch (e) {
      setRepos((prev) =>
        prev.map((r) =>
          r.path === path ? { ...r, error: String(e), loading: false } : r,
        ),
      );
    }
  }, []);

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

  const refreshOne = inspect;

  const refreshAll = useCallback(async () => {
    const paths = repos.map((r) => r.path);
    await Promise.all(paths.map((p) => inspect(p)));
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
            r.path === path ? { ...r, fetching: false, lastSuccessfulFetch: when } : r,
          );
          persistRepos(next);
          return next;
        });
        await inspect(path);
        return { ok: true };
      } catch (e) {
        setRepos((prev) =>
          prev.map((r) => (r.path === path ? { ...r, fetching: false } : r)),
        );
        return { ok: false, error: String(e) };
      }
    },
    [inspect, persistRepos],
  );

  const fetchAll = useCallback(async () => {
    // One repo failing must not stop the others.
    const paths = repos.map((r) => r.path);
    await Promise.all(paths.map((p) => fetchOne(p)));
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
