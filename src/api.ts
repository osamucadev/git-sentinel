// Thin wrappers around Tauri commands and plugins. The UI calls these and
// never constructs a command line itself.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ChangedFile, FileDiff, RepositoryState } from "./types";

/** Native folder picker. Returns the chosen absolute path, or null if cancelled. */
export async function pickFolder(): Promise<string | null> {
  const result = await open({ directory: true, multiple: false });
  return typeof result === "string" ? result : null;
}

/** Validates a folder with Git and returns the canonical working-tree root. */
export function validateRepository(path: string): Promise<string> {
  return invoke("validate_repository", { path });
}

/** Re-reads local Git state. Never contacts a remote. */
export function inspectRepository(path: string, referenceBranch?: string): Promise<RepositoryState> {
  return invoke("inspect_repository", { path, referenceBranch });
}

/** Explicit fetch of remote-tracking refs. */
export function fetchRepository(path: string): Promise<void> {
  return invoke("fetch_repository", { path });
}

/** Explicit normal push. The native command never passes force flags. */
export function pushRepository(path: string): Promise<void> {
  return invoke("push_repository", { path });
}

/** Read-only working-tree file list. */
export function listRepositoryChanges(path: string): Promise<ChangedFile[]> {
  return invoke("list_repository_changes", { path });
}

/** Read-only staged plus unstaged diff for one changed path. */
export function repositoryFileDiff(path: string, file: string): Promise<FileDiff> {
  return invoke("repository_file_diff", { path, file });
}

/** Starts/stops native local-state watching; it never fetches from a remote. */
export function watchRepository(path: string): Promise<void> {
  return invoke("watch_repository", { path });
}

export function unwatchRepository(path: string): Promise<void> {
  return invoke("unwatch_repository", { path });
}

export function onRepositoryLocalChange(handler: (path: string) => void): Promise<UnlistenFn> {
  return listen<string>("repository-local-change", (event) => handler(event.payload));
}

export function openInTerminal(path: string): Promise<void> {
  return invoke("open_in_terminal", { path });
}

export function openFolder(path: string): Promise<void> {
  return invoke("open_folder", { path });
}

/** Opens a web or mail URL with the system's configured application. */
export function openExternalUrl(url: string): Promise<void> {
  return openUrl(url);
}
