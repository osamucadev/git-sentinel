use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

/// Owns native filesystem watchers for registered repositories. The watcher
/// only emits a hint; the frontend debounces it and performs a read-only
/// inspection. Nothing here mutates Git metadata or the working tree.
#[derive(Default)]
pub struct WatchRegistry {
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

impl WatchRegistry {
    /// `extra` is the pre-deduped set of additional directories to watch
    /// beyond `root` (see `git::extra_watch_dirs`): a linked worktree's own
    /// private Git directory, and/or the repository-wide common Git
    /// directory where shared refs such as `refs/stash` live. Already
    /// filtered against `root` and against each other by the caller, so this
    /// never registers a redundant watch on the same path twice.
    pub fn watch(&self, app: AppHandle, root: String, extra: Vec<String>) -> Result<(), String> {
        let mut watchers = self.watchers.lock().map_err(|_| "watch registry unavailable")?;
        if watchers.contains_key(&root) {
            return Ok(());
        }

        let event_root = root.clone();
        let mut watcher = RecommendedWatcher::new(
            move |event: notify::Result<notify::Event>| {
                if event.is_ok_and(|event| is_local_change(&event.kind)) {
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

        for dir in &extra {
            watcher
                .watch(Path::new(dir), RecursiveMode::Recursive)
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

/// True for events that can change what an inspection reports. Access events
/// (a file or directory merely being opened, read or closed) never can, and
/// must not count: every inspection opens files in the watched tree itself,
/// so reacting to them makes each inspection schedule the next one forever.
/// A write still counts through its own `Modify` event.
fn is_local_change(kind: &EventKind) -> bool {
    !matches!(kind, EventKind::Access(_))
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{
        AccessKind, AccessMode, CreateKind, DataChange, MetadataKind, ModifyKind, RemoveKind,
        RenameMode,
    };

    #[test]
    fn reads_are_not_local_changes() {
        assert!(!is_local_change(&EventKind::Access(AccessKind::Open(AccessMode::Any))));
        assert!(!is_local_change(&EventKind::Access(AccessKind::Read)));
        assert!(!is_local_change(&EventKind::Access(AccessKind::Close(AccessMode::Read))));
        assert!(!is_local_change(&EventKind::Access(AccessKind::Close(AccessMode::Write))));
    }

    #[test]
    fn writes_creations_removals_and_renames_are_local_changes() {
        assert!(is_local_change(&EventKind::Create(CreateKind::File)));
        assert!(is_local_change(&EventKind::Modify(ModifyKind::Data(DataChange::Any))));
        assert!(is_local_change(&EventKind::Modify(ModifyKind::Metadata(MetadataKind::Any))));
        assert!(is_local_change(&EventKind::Modify(ModifyKind::Name(RenameMode::Both))));
        assert!(is_local_change(&EventKind::Remove(RemoveKind::File)));
    }

    #[test]
    fn unclassified_events_are_kept_rather_than_silently_dropped() {
        assert!(is_local_change(&EventKind::Any));
        assert!(is_local_change(&EventKind::Other));
    }
}
