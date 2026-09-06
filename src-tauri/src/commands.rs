use std::path::Path;

use git_sentinel_core::git::{git_dir, is_work_tree, work_tree_root};
use git_sentinel_core::inspect;
use git_sentinel_core::model::RepositoryState;
use git_sentinel_core::system;

/// Validates that `path` is a real Git working tree and returns the
/// canonical working-tree root to register. Read-only.
#[tauri::command]
pub fn validate_repository(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !is_work_tree(p) {
        return Err("not_a_git_repository".into());
    }
    work_tree_root(p)
}

/// Re-reads local Git state for one repository. Never contacts a remote.
#[tauri::command]
pub async fn inspect_repository(
    path: String,
    reference_branch: Option<String>,
) -> Result<RepositoryState, String> {
    tauri::async_runtime::spawn_blocking(move || {
        inspect::inspect_with_reference(&path, reference_branch.as_deref())
    })
    .await
    .map_err(|e| format!("inspection task failed: {e}"))?
}

/// Explicit user-triggered fetch. Updates remote-tracking refs only.
#[tauri::command]
pub async fn fetch_repository(path: String) -> Result<(), String> {
    // `git fetch` may wait indefinitely on DNS, credentials or a remote. Keep
    // that blocking child-process wait off Tauri's GUI/event runtime.
    tauri::async_runtime::spawn_blocking(move || inspect::fetch(&path))
        .await
        .map_err(|e| format!("fetch task failed: {e}"))?
}

#[tauri::command]
pub fn watch_repository(
    app: tauri::AppHandle,
    registry: tauri::State<'_, crate::watch::WatchRegistry>,
    path: String,
) -> Result<(), String> {
    let root = work_tree_root(Path::new(&path))?;
    let metadata = git_dir(Path::new(&root))?;
    registry.watch(app, root, metadata)
}

#[tauri::command]
pub fn unwatch_repository(
    registry: tauri::State<'_, crate::watch::WatchRegistry>,
    path: String,
) {
    registry.unwatch(&path);
}

#[tauri::command]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    system::open_in_terminal(&path)
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    system::open_folder(&path)
}
