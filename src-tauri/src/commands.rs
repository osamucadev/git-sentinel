use std::path::Path;

use git_sentinel_core::git::{is_work_tree, work_tree_root};
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
pub fn inspect_repository(path: String) -> Result<RepositoryState, String> {
    inspect::inspect(&path)
}

/// Explicit user-triggered fetch. Updates remote-tracking refs only.
#[tauri::command]
pub fn fetch_repository(path: String) -> Result<(), String> {
    inspect::fetch(&path)
}

#[tauri::command]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    system::open_in_terminal(&path)
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    system::open_folder(&path)
}
