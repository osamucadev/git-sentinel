// Thin wrappers around Tauri commands and plugins. The UI calls these and
// never constructs a command line itself.

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { RepositoryState } from "./types";

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
export function inspectRepository(path: string): Promise<RepositoryState> {
  return invoke("inspect_repository", { path });
}

/** Explicit fetch of remote-tracking refs. */
export function fetchRepository(path: string): Promise<void> {
  return invoke("fetch_repository", { path });
}

export function openInTerminal(path: string): Promise<void> {
  return invoke("open_in_terminal", { path });
}

export function openFolder(path: string): Promise<void> {
  return invoke("open_folder", { path });
}
