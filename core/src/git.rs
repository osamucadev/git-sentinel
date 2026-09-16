use std::path::Path;
use std::process::Command;

/// Runs `git` with explicit arguments and an explicit working directory.
///
/// Arguments are passed as a real argv (never a shell string), so repository
/// paths are treated as opaque data and cannot be interpreted as shell syntax.
pub fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("failed to launch git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "git {} failed: {}",
            args.join(" "),
            stderr.trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// True when `path` is inside a valid Git working tree.
///
/// Uses Git itself rather than checking for a `.git` directory, so linked
/// worktrees (which use a `.git` file) are recognized correctly.
pub fn is_work_tree(path: &Path) -> bool {
    run_git(path, &["rev-parse", "--is-inside-work-tree"])
        .map(|out| out.trim() == "true")
        .unwrap_or(false)
}

/// Absolute path of the working tree root that contains `path`.
pub fn work_tree_root(path: &Path) -> Result<String, String> {
    Ok(run_git(path, &["rev-parse", "--show-toplevel"])?
        .trim()
        .to_string())
}

/// Absolute Git metadata directory for this specific checkout. Unlike
/// `path/.git`, this also resolves linked worktrees, where `.git` is a text
/// file. For a linked worktree this is the worktree's own private
/// administrative directory (`HEAD`, `index`, per-worktree refs/logs) — it
/// is *not* shared with the repository's other worktrees.
pub fn git_dir(path: &Path) -> Result<String, String> {
    Ok(run_git(path, &["rev-parse", "--absolute-git-dir"])?
        .trim()
        .to_string())
}

/// Absolute Git directory shared by every worktree of this repository. This
/// is where repository-wide refs live (`refs/heads`, `refs/stash`, packed
/// refs, objects). For a normal (non-worktree) checkout this is the same
/// directory as `git_dir`; for a linked worktree it is the *main* repository's
/// `.git`, distinct from that worktree's own `git_dir`.
pub fn git_common_dir(path: &Path) -> Result<String, String> {
    Ok(run_git(path, &["rev-parse", "--path-format=absolute", "--git-common-dir"])?
        .trim()
        .to_string())
}

/// Directories, beyond `root`'s own recursive watch, that must be watched to
/// observe every place this checkout's Git metadata can live: its own
/// private `git_dir` (e.g. a linked worktree's `HEAD`/index/local refs) and
/// the repository-wide `git_common_dir` (e.g. `refs/stash`, shared by every
/// worktree). Pure path arithmetic — no process calls.
///
/// A candidate is dropped when it is `root` itself or already nested inside
/// something that will be watched (either `root`, or another candidate kept
/// earlier), so a normal checkout — where both directories sit inside
/// `root` — yields no extra watches, and a linked worktree — where
/// `git_dir` is nested inside `git_common_dir` — yields exactly one.
pub fn extra_watch_dirs(root: &str, git_dir: &str, git_common_dir: &str) -> Vec<String> {
    let root_path = Path::new(root);
    let mut kept: Vec<String> = Vec::new();

    for candidate in [git_dir, git_common_dir] {
        let candidate_path = Path::new(candidate);
        if candidate_path.starts_with(root_path) {
            continue;
        }
        if kept.iter().any(|k| candidate_path.starts_with(Path::new(k))) {
            continue;
        }
        // A previously-kept dir nested inside this broader candidate is now
        // redundant (e.g. a linked worktree's private `git_dir` inside its
        // repository's `git_common_dir`).
        kept.retain(|k| !Path::new(k).starts_with(candidate_path));
        kept.push(candidate.to_string());
    }

    kept
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_checkout_needs_no_extra_watch_dirs() {
        let dirs = extra_watch_dirs("/repo", "/repo/.git", "/repo/.git");
        assert!(dirs.is_empty());
    }

    #[test]
    fn linked_worktree_watches_only_the_shared_common_dir() {
        let dirs = extra_watch_dirs(
            "/repo/linked-worktree",
            "/repo/.git/worktrees/linked-worktree",
            "/repo/.git",
        );
        assert_eq!(dirs, vec!["/repo/.git".to_string()]);
    }

    #[test]
    fn unrelated_git_dir_and_common_dir_are_both_kept() {
        // Hypothetical/defensive: if the two ever resolved to unrelated,
        // non-nested locations outside `root`, neither should be dropped.
        let mut dirs = extra_watch_dirs("/repo", "/elsewhere/a", "/elsewhere/b");
        dirs.sort();
        assert_eq!(dirs, vec!["/elsewhere/a".to_string(), "/elsewhere/b".to_string()]);
    }

    #[test]
    fn duplicate_candidates_are_not_watched_twice() {
        let dirs = extra_watch_dirs("/repo", "/elsewhere", "/elsewhere");
        assert_eq!(dirs, vec!["/elsewhere".to_string()]);
    }

    #[test]
    fn a_candidate_equal_to_root_is_dropped() {
        let dirs = extra_watch_dirs("/repo", "/repo", "/repo");
        assert!(dirs.is_empty());
    }
}
