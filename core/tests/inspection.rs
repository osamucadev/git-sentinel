//! Integration tests that run real Git commands against throwaway repositories.

use std::fs;
use std::path::Path;
use std::process::Command;

use git_sentinel_core::git::{extra_watch_dirs, git_common_dir, git_dir, is_work_tree};
use git_sentinel_core::inspect::{inspect, inspect_with_reference, stash_diff};

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

fn stash_push(dir: &Path, message: Option<&str>) {
    match message {
        Some(m) => git(dir, &["stash", "push", "-q", "-m", m]),
        None => git(dir, &["stash", "push", "-q"]),
    }
}

fn read_stdout(dir: &Path, args: &[&str]) -> String {
    String::from_utf8(Command::new("git").args(args).current_dir(dir).output().unwrap().stdout).unwrap()
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
    assert_eq!(state.reference_branch.as_deref(), Some("main"));
    assert_eq!(state.reference_branches, vec!["main"]);
}

#[test]
fn linked_worktree_resolves_git_metadata_outside_its_git_file() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    let linked = repo.path().join("linked-worktree");
    git(
        repo.path(),
        &["worktree", "add", "-q", "-b", "linked", linked.to_str().unwrap()],
    );

    assert!(linked.join(".git").is_file());
    let metadata = git_dir(&linked).unwrap();
    assert!(Path::new(&metadata).is_dir());
    assert_ne!(Path::new(&metadata), linked.join(".git"));
}

#[test]
fn git_common_dir_matches_git_dir_for_a_normal_checkout() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    assert_eq!(git_dir(repo.path()).unwrap(), git_common_dir(repo.path()).unwrap());
}

#[test]
fn git_common_dir_of_a_linked_worktree_is_the_main_repository_git_dir() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    let linked = repo.path().join("linked-worktree");
    git(repo.path(), &["worktree", "add", "-q", "-b", "linked", linked.to_str().unwrap()]);

    let main_git_dir = git_dir(repo.path()).unwrap();
    let linked_git_dir = git_dir(&linked).unwrap();
    let linked_common_dir = git_common_dir(&linked).unwrap();

    // The linked worktree's own git_dir is its private administrative
    // directory, distinct from both the main repo's git_dir and its own
    // common dir...
    assert_ne!(linked_git_dir, main_git_dir);
    // ...but its common dir IS the main repository's git_dir: this is where
    // shared refs (including refs/stash) actually live.
    assert_eq!(linked_common_dir, main_git_dir);
}

#[test]
fn a_stash_pushed_from_a_linked_worktree_is_visible_from_the_main_worktree() {
    // Proves refs/stash is genuinely shared repository-wide (not per
    // worktree), which is why watching only a linked worktree's own git_dir
    // (its private administrative directory) is not enough to observe stash
    // changes made from it — the fix must watch git_common_dir too.
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    let linked = repo.path().join("linked-worktree");
    git(repo.path(), &["worktree", "add", "-q", "-b", "linked", linked.to_str().unwrap()]);

    fs::write(linked.join("a.txt"), "one\nfrom linked worktree").unwrap();
    stash_push(&linked, Some("from linked worktree"));

    let main_state = inspect(repo.path().to_str().unwrap()).unwrap();
    assert_eq!(main_state.stashes.len(), 1);
    assert!(main_state.stashes[0].message.contains("from linked worktree"));

    let linked_state = inspect(linked.to_str().unwrap()).unwrap();
    assert_eq!(linked_state.stashes.len(), 1);
    assert_eq!(linked_state.stashes[0].hash, main_state.stashes[0].hash);
}

#[test]
fn extra_watch_dirs_for_a_real_normal_checkout_is_empty() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    let root = repo.path().to_str().unwrap();
    let dirs = extra_watch_dirs(root, &git_dir(repo.path()).unwrap(), &git_common_dir(repo.path()).unwrap());
    assert!(dirs.is_empty(), "a normal checkout's Git metadata is already inside root's recursive watch");
}

#[test]
fn extra_watch_dirs_for_a_real_linked_worktree_covers_the_shared_stash_location() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    let linked = repo.path().join("linked-worktree");
    git(repo.path(), &["worktree", "add", "-q", "-b", "linked", linked.to_str().unwrap()]);

    let root = linked.to_str().unwrap();
    let dirs = extra_watch_dirs(root, &git_dir(&linked).unwrap(), &git_common_dir(&linked).unwrap());
    let common = git_common_dir(&linked).unwrap();
    assert_eq!(dirs, vec![common], "the linked worktree's watch set must include the shared common dir where refs/stash lives");
}

#[test]
fn configured_reference_is_real_persisted_ref_and_has_its_own_divergence() {
    let remote = tempfile::tempdir().unwrap();
    git(remote.path(), &["init", "-q", "--bare", "-b", "main"]);
    let seed = new_repo();
    commit_file(seed.path(), "a.txt", "one", "initial");
    git(seed.path(), &["remote", "add", "origin", remote.path().to_str().unwrap()]);
    git(seed.path(), &["push", "-q", "origin", "main"]);
    git(seed.path(), &["checkout", "-q", "-b", "homolog"]);
    commit_file(seed.path(), "h.txt", "homolog", "homolog line");
    git(seed.path(), &["push", "-q", "origin", "homolog"]);

    let local = tempfile::tempdir().unwrap();
    let local_path = local.path().join("clone");
    git(local.path(), &["clone", "-q", remote.path().to_str().unwrap(), local_path.to_str().unwrap()]);
    git(&local_path, &["checkout", "-q", "-b", "feature/x", "origin/homolog"]);
    commit_file(&local_path, "f.txt", "feature", "feature work");

    let state = inspect_with_reference(local_path.to_str().unwrap(), Some("origin/homolog")).unwrap();
    assert!(state.reference_branches.contains(&"origin/main".to_string()));
    assert!(state.reference_branches.contains(&"origin/homolog".to_string()));
    assert_eq!(state.reference_branch.as_deref(), Some("origin/homolog"));
    let divergence = state.reference_divergence.expect("reference divergence expected");
    assert_eq!(divergence.base_branch, "origin/homolog");
    assert_eq!((divergence.ahead, divergence.behind), (1, 0));
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

#[test]
fn repository_without_stash_has_an_empty_stash_list() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    let state = inspect(repo.path().to_str().unwrap()).unwrap();
    assert!(state.stashes.is_empty());
}

#[test]
fn a_single_stash_is_reported_with_its_branch_hint() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    fs::write(repo.path().join("a.txt"), "one\nchanged").unwrap();
    stash_push(repo.path(), Some("work in progress"));

    let state = inspect(repo.path().to_str().unwrap()).unwrap();
    assert_eq!(state.stashes.len(), 1);
    let entry = &state.stashes[0];
    assert_eq!(entry.reference, "stash@{0}");
    assert_eq!(entry.index, 0);
    assert!(entry.message.contains("work in progress"));
    assert_eq!(entry.branch_hint.as_deref(), Some("main"));
    assert!(!entry.hash.is_empty());
    assert!(!entry.date.is_empty());
}

#[test]
fn multiple_stashes_are_reported_most_recent_first() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    fs::write(repo.path().join("a.txt"), "one\nfirst").unwrap();
    stash_push(repo.path(), Some("first"));
    fs::write(repo.path().join("a.txt"), "one\nsecond").unwrap();
    stash_push(repo.path(), Some("second"));

    let state = inspect(repo.path().to_str().unwrap()).unwrap();
    assert_eq!(state.stashes.len(), 2);
    assert_eq!(state.stashes[0].index, 0);
    assert_eq!(state.stashes[1].index, 1);
    assert!(state.stashes[0].message.contains("second"));
    assert!(state.stashes[1].message.contains("first"));
}

#[test]
fn a_stash_created_in_detached_head_has_no_branch_hint() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    git(repo.path(), &["checkout", "-q", "--detach", "HEAD"]);
    fs::write(repo.path().join("a.txt"), "one\ndetached").unwrap();
    stash_push(repo.path(), None);

    let state = inspect(repo.path().to_str().unwrap()).unwrap();
    assert_eq!(state.stashes.len(), 1);
    assert_eq!(state.stashes[0].branch_hint, None);
}

#[test]
fn inspecting_a_repository_with_a_stash_never_touches_the_stash_or_working_tree() {
    let repo = new_repo();
    let p = repo.path();
    commit_file(p, "a.txt", "one", "initial");
    fs::write(p.join("a.txt"), "one\nchanged").unwrap();
    stash_push(p, Some("do not touch me"));

    let stash_before = read_stdout(p, &["stash", "list"]);
    let status_before = read_stdout(p, &["status", "--porcelain"]);

    let _ = inspect(p.to_str().unwrap()).unwrap();

    assert_eq!(stash_before, read_stdout(p, &["stash", "list"]));
    assert_eq!(status_before, read_stdout(p, &["status", "--porcelain"]));
}

#[test]
fn stash_diff_returns_the_patch_without_mutating_the_stash() {
    let repo = new_repo();
    let p = repo.path();
    commit_file(p, "a.txt", "one", "initial");
    fs::write(p.join("a.txt"), "one\nchanged").unwrap();
    stash_push(p, Some("work"));
    let hash = read_stdout(p, &["rev-parse", "refs/stash"]).trim().to_string();

    let stash_before = read_stdout(p, &["stash", "list"]);

    let diff = stash_diff(p.to_str().unwrap(), &hash).unwrap();
    assert_eq!(diff.hash, hash);
    assert!(diff.content.contains("changed"));
    assert!(!diff.truncated);

    assert_eq!(stash_before, read_stdout(p, &["stash", "list"]), "reading a stash diff must never mutate the stash list");
}

#[test]
fn stash_diff_rejects_a_hash_that_is_not_well_formed() {
    let repo = new_repo();
    commit_file(repo.path(), "a.txt", "one", "initial");
    assert!(stash_diff(repo.path().to_str().unwrap(), "--upload-pack=evil").is_err());
    assert!(stash_diff(repo.path().to_str().unwrap(), "../etc/passwd").is_err());
    assert!(stash_diff(repo.path().to_str().unwrap(), "stash@{0}").is_err());
}

#[test]
fn stash_diff_returns_a_clear_error_when_the_stash_was_dropped_after_selection() {
    // Reproduces the exact race a caller can hit: it selects a stash (learns
    // its hash), the stash is dropped by someone else, and only then does it
    // ask for the diff. This must fail loudly, never fall back to showing an
    // unrelated stash or a dangling commit silently.
    let repo = new_repo();
    let p = repo.path();
    commit_file(p, "a.txt", "one", "initial");
    fs::write(p.join("a.txt"), "one\nchanged").unwrap();
    stash_push(p, Some("about to be dropped"));
    let hash = read_stdout(p, &["rev-parse", "refs/stash"]).trim().to_string();

    git(p, &["stash", "drop", "-q"]);

    let result = stash_diff(p.to_str().unwrap(), &hash);
    assert!(result.is_err(), "expected an error once the stash no longer exists");
}

#[test]
fn stash_diff_still_resolves_the_requested_stash_after_the_list_reorders() {
    // A second, unrelated stash pushed after selection shifts every earlier
    // entry's stash@{N} index. Identity by hash must be unaffected.
    let repo = new_repo();
    let p = repo.path();
    commit_file(p, "a.txt", "one", "initial");
    fs::write(p.join("a.txt"), "one\nfirst").unwrap();
    stash_push(p, Some("first"));
    let first_hash = read_stdout(p, &["rev-parse", "refs/stash"]).trim().to_string();

    fs::write(p.join("a.txt"), "one\nsecond").unwrap();
    stash_push(p, Some("second"));
    // "first" is now stash@{1}, not stash@{0} anymore.

    let diff = stash_diff(p.to_str().unwrap(), &first_hash).unwrap();
    assert!(diff.content.contains("first"));
    assert!(!diff.content.contains("second"));
}
