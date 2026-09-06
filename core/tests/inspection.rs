//! Integration tests that run real Git commands against throwaway repositories.

use std::fs;
use std::path::Path;
use std::process::Command;

use git_sentinel_core::git::is_work_tree;
use git_sentinel_core::inspect::inspect;

fn git(dir: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(args)
        .current_dir(dir)
        .env("GIT_AUTHOR_NAME", "Test")
        .env("GIT_AUTHOR_EMAIL", "test@example.com")
        .env("GIT_COMMITTER_NAME", "Test")
        .env("GIT_COMMITTER_EMAIL", "test@example.com")
        .status()
        .unwrap();
    assert!(status.success(), "git {args:?} failed");
}

fn new_repo() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    git(dir.path(), &["init", "-q", "-b", "main"]);
    dir
}

fn commit_file(dir: &Path, name: &str, contents: &str, message: &str) {
    fs::write(dir.join(name), contents).unwrap();
    git(dir, &["add", name]);
    git(dir, &["commit", "-q", "-m", message]);
}

#[test]
fn rejects_a_non_git_directory() {
    let dir = tempfile::tempdir().unwrap();
    assert!(!is_work_tree(dir.path()));
    assert!(inspect(dir.path().to_str().unwrap()).is_err());
}

#[test]
fn clean_repository_reports_clean_tree_and_branch() {
    let repo = new_repo();
    commit_file(repo.path(), "README.md", "hello", "initial");

    let state = inspect(repo.path().to_str().unwrap()).unwrap();
    assert_eq!(state.current_branch.as_deref(), Some("main"));
    assert!(!state.detached_head);
    assert!(state.working_tree.clean);
    assert_eq!(state.local_branches.count, 1);
    let commit = state.latest_commit.unwrap();
    assert_eq!(commit.subject, "initial");
}

#[test]
fn dirty_repository_reports_staged_modified_and_untracked() {
    let repo = new_repo();
    let p = repo.path();
    commit_file(p, "a.txt", "one", "initial");

    fs::write(p.join("a.txt"), "one changed").unwrap(); // modified, unstaged
    fs::write(p.join("b.txt"), "staged").unwrap();
    git(p, &["add", "b.txt"]); // staged add
    fs::write(p.join("c.txt"), "untracked").unwrap(); // untracked

    let state = inspect(p.to_str().unwrap()).unwrap();
    assert!(!state.working_tree.clean);
    assert_eq!(state.working_tree.staged, 1);
    assert_eq!(state.working_tree.modified, 1);
    assert_eq!(state.working_tree.untracked, 1);
}

#[test]
fn detached_head_is_reported() {
    let repo = new_repo();
    let p = repo.path();
    commit_file(p, "a.txt", "one", "first");
    commit_file(p, "b.txt", "two", "second");
    git(p, &["checkout", "-q", "HEAD~1"]);

    let state = inspect(p.to_str().unwrap()).unwrap();
    assert!(state.detached_head);
    assert_eq!(state.current_branch, None);
}

#[test]
fn local_divergence_is_measured_against_base_branch() {
    let repo = new_repo();
    let p = repo.path();
    commit_file(p, "a.txt", "one", "base 1");
    git(p, &["checkout", "-q", "-b", "feature/foo"]);
    commit_file(p, "b.txt", "two", "feat 1");
    commit_file(p, "c.txt", "three", "feat 2");
    // main gets one commit the feature branch does not have
    git(p, &["checkout", "-q", "main"]);
    commit_file(p, "d.txt", "four", "main extra");
    git(p, &["checkout", "-q", "feature/foo"]);

    let state = inspect(p.to_str().unwrap()).unwrap();
    let div = state.local_divergence.expect("divergence expected");
    assert_eq!(div.base_branch, "main");
    assert_eq!(div.ahead, 2);
    assert_eq!(div.behind, 1);
}

#[test]
fn unresolved_merge_conflict_is_reported() {
    let repo = new_repo();
    let p = repo.path();
    commit_file(p, "shared.txt", "base\n", "base");
    git(p, &["checkout", "-q", "-b", "other"]);
    commit_file(p, "shared.txt", "other change\n", "other");
    git(p, &["checkout", "-q", "main"]);
    commit_file(p, "shared.txt", "main change\n", "main");
    // Merge is expected to fail with a conflict; ignore its exit status.
    let _ = Command::new("git")
        .args(["merge", "other"])
        .current_dir(p)
        .env("GIT_AUTHOR_NAME", "Test")
        .env("GIT_AUTHOR_EMAIL", "test@example.com")
        .env("GIT_COMMITTER_NAME", "Test")
        .env("GIT_COMMITTER_EMAIL", "test@example.com")
        .output()
        .unwrap();

    let state = inspect(p.to_str().unwrap()).unwrap();
    assert_eq!(state.working_tree.conflicted, 1);
    assert!(!state.working_tree.clean);
}

#[test]
fn repository_without_remote_still_inspects() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");

    let state = inspect(repo.path().to_str().unwrap()).unwrap();
    assert!(state.remotes.is_empty());
    assert_eq!(state.upstream, None);
    assert_eq!(state.tracking_divergence.is_none(), true);
}

#[test]
fn upstream_tracking_divergence_is_reported() {
    // "remote" is a bare repo; "local" clones it and diverges by one commit.
    let remote = tempfile::tempdir().unwrap();
    git(remote.path(), &["init", "-q", "--bare", "-b", "main"]);

    let seed = new_repo();
    commit_file(seed.path(), "a.txt", "one", "initial");
    git(seed.path(), &["remote", "add", "origin", remote.path().to_str().unwrap()]);
    git(seed.path(), &["push", "-q", "origin", "main"]);

    let local = tempfile::tempdir().unwrap();
    let local_path = local.path().join("clone");
    git(
        local.path(),
        &[
            "clone",
            "-q",
            remote.path().to_str().unwrap(),
            local_path.to_str().unwrap(),
        ],
    );
    commit_file(&local_path, "b.txt", "two", "local ahead");

    let state = inspect(local_path.to_str().unwrap()).unwrap();
    assert_eq!(state.upstream.as_deref(), Some("origin/main"));
    let tracking = state.tracking_divergence.expect("tracking divergence expected");
    assert_eq!(tracking.ahead, 1);
    assert_eq!(tracking.behind, 0);
    assert_eq!(state.remotes.len(), 1);
    assert_eq!(state.remotes[0].name, "origin");
}

#[test]
fn removing_from_sentinel_does_not_touch_the_repository() {
    // Sentinel's "remove" is purely a frontend registry deletion; the backend
    // exposes no mutation command. This test asserts that inspecting a repo
    // (the only backend interaction during registration/removal) leaves the
    // working tree and Git history byte-for-byte identical.
    let repo = new_repo();
    let p = repo.path();
    commit_file(p, "a.txt", "one", "initial");

    let head_before = String::from_utf8(
        Command::new("git").args(["rev-parse", "HEAD"]).current_dir(p).output().unwrap().stdout,
    )
    .unwrap();
    let status_before = String::from_utf8(
        Command::new("git").args(["status", "--porcelain"]).current_dir(p).output().unwrap().stdout,
    )
    .unwrap();

    let _ = inspect(p.to_str().unwrap()).unwrap();

    let head_after = String::from_utf8(
        Command::new("git").args(["rev-parse", "HEAD"]).current_dir(p).output().unwrap().stdout,
    )
    .unwrap();
    let status_after = String::from_utf8(
        Command::new("git").args(["status", "--porcelain"]).current_dir(p).output().unwrap().stdout,
    )
    .unwrap();

    assert_eq!(head_before, head_after);
    assert_eq!(status_before, status_after);
}
