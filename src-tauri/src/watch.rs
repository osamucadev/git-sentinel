use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

/// Owns native filesystem watchers for registered repositories. The watcher
/// only emits a hint; the frontend debounces it and performs a read-only
/// inspection. Nothing here mutates Git metadata or the working tree.
#[derive(Default)]
pub struct WatchRegistry {
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

impl WatchRegistry {
    pub fn watch(&self, app: AppHandle, root: String, git_dir: String) -> Result<(), String> {
        let mut watchers = self.watchers.lock().map_err(|_| "watch registry unavailable")?;
        if watchers.contains_key(&root) {
            return Ok(());
        }

        let event_root = root.clone();
        let mut watcher = RecommendedWatcher::new(
            move |event: notify::Result<notify::Event>| {
                if event.is_ok() {
                    // The renderer owns the debounce, coalescing a commit or
                    // checkout's several filesystem updates into one inspect.
                    let _ = app.emit("repository-local-change", &event_root);
                }
            },
            Config::default(),
        )
        .map_err(|e| format!("could not watch repository: {e}"))?;

        watcher
            .watch(Path::new(&root), RecursiveMode::Recursive)
            .map_err(|e| format!("could not watch working tree: {e}"))?;

        // A linked worktree stores important refs and index data outside its
        // working-tree root, so watch its resolved Git directory as well.
        let git_path = PathBuf::from(&git_dir);
        if git_path != PathBuf::from(&root) {
            watcher
                .watch(&git_path, RecursiveMode::Recursive)
                .map_err(|e| format!("could not watch Git metadata: {e}"))?;
        }
        watchers.insert(root, watcher);
        Ok(())
    }

    pub fn unwatch(&self, root: &str) {
        if let Ok(mut watchers) = self.watchers.lock() {
            watchers.remove(root);
        }
    }
}
