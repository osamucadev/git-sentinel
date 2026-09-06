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

/// Absolute Git metadata directory for a working tree. Unlike `path/.git`,
/// this also resolves linked worktrees, where `.git` is a text file.
pub fn git_dir(path: &Path) -> Result<String, String> {
    Ok(run_git(path, &["rev-parse", "--absolute-git-dir"])?
        .trim()
        .to_string())
}
