// Persistence via tauri-plugin-store: a single JSON file in the app's data
// directory (~/.local/share/com.gitsentinel.app/sentinel.json on Linux).
// Holds only Sentinel's own state: preferences and registered repo paths.

import { load, type Store } from "@tauri-apps/plugin-store";
import { DEFAULT_CONFIG, type RegisteredRepo, type SentinelConfig } from "./types";

const FILE = "sentinel.json";
const CONFIG_KEY = "config";
const REPOS_KEY = "repos";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) storePromise = load(FILE, { autoSave: true });
  return storePromise;
}

export async function loadConfig(): Promise<SentinelConfig> {
  const store = await getStore();
  const saved = await store.get<Partial<SentinelConfig>>(CONFIG_KEY);
  return { ...DEFAULT_CONFIG, ...saved };
}

export async function saveConfig(config: SentinelConfig): Promise<void> {
  const store = await getStore();
  await store.set(CONFIG_KEY, config);
}

export async function loadRepos(): Promise<RegisteredRepo[]> {
  const store = await getStore();
  return (await store.get<RegisteredRepo[]>(REPOS_KEY)) ?? [];
}

export async function saveRepos(repos: RegisteredRepo[]): Promise<void> {
  const store = await getStore();
  await store.set(REPOS_KEY, repos);
}
