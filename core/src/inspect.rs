use std::path::Path;

use crate::git::{is_work_tree, run_git, work_tree_root};
use crate::model::*;

/// Fallback base branches, in preference order, for a feature/other branch.
const BASE_CANDIDATES: [&str; 3] = ["main", "master", "develop"];

/// Parsed result of `git status --porcelain=v2 --branch`.
#[derive(Debug, Default, PartialEq)]
pub struct StatusInfo {
    pub branch_head: Option<String>,
    pub detached: bool,
    pub upstream: Option<String>,
    pub tracking: Option<(u32, u32)>, // (ahead, behind)
    pub working_tree: WorkingTreeCounts,
}

#[derive(Debug, Default, PartialEq)]
pub struct WorkingTreeCounts {
    pub staged: u32,
    pub modified: u32,
    pub deleted: u32,
    pub untracked: u32,
    pub conflicted: u32,
}

impl WorkingTreeCounts {
    fn clean(&self) -> bool {
        self.staged == 0
            && self.modified == 0
            && self.deleted == 0
            && self.untracked == 0
            && self.conflicted == 0
    }
}

/// Parses porcelain v2 status output. Pure function: no process calls.
pub fn parse_status(output: &str) -> StatusInfo {
    let mut info = StatusInfo::default();

    for line in output.lines() {
        if let Some(rest) = line.strip_prefix("# branch.head ") {
            if rest == "(detached)" {
                info.detached = true;
            } else {
                info.branch_head = Some(rest.to_string());
            }
        } else if let Some(rest) = line.strip_prefix("# branch.upstream ") {
            info.upstream = Some(rest.to_string());
        } else if let Some(rest) = line.strip_prefix("# branch.ab ") {
            // Format: "+<ahead> -<behind>"
            let mut parts = rest.split_whitespace();
            let ahead = parts
                .next()
                .and_then(|s| s.trim_start_matches('+').parse().ok())
                .unwrap_or(0);
            let behind = parts
                .next()
                .and_then(|s| s.trim_start_matches('-').parse().ok())
                .unwrap_or(0);
            info.tracking = Some((ahead, behind));
        } else if let Some(rest) = line.strip_prefix("1 ").or_else(|| line.strip_prefix("2 ")) {
            // Changed/renamed entry. Next token is the two-char XY code.
            if let Some(xy) = rest.split_whitespace().next() {
                let mut chars = xy.chars();
                let x = chars.next().unwrap_or('.');
                let y = chars.next().unwrap_or('.');
                if x != '.' {
                    info.working_tree.staged += 1;
                }
                if y == 'M' {
                    info.working_tree.modified += 1;
                }
                if x == 'D' || y == 'D' {
                    info.working_tree.deleted += 1;
                }
            }
        } else if line.starts_with("u ") {
            // Unmerged / conflicted path.
            info.working_tree.conflicted += 1;
        } else if line.starts_with("? ") {
            info.working_tree.untracked += 1;
        }
    }

    info
}

/// Chooses a local base branch to compare the current branch against.
/// Pure function so the selection rule can be tested directly.
///
/// Rules:
/// - on `main` or `master`: no local base comparison;
/// - on `develop`: compare against local `main` if it exists, otherwise none;
/// - on any other branch: prefer local `main`, then `master`, then `develop`;
/// - if no candidate branch exists locally: none (never invented).
pub fn pick_base_branch(current: Option<&str>, branches: &[String]) -> Option<String> {
    let has = |name: &str| branches.iter().any(|b| b == name);

    match current {
        Some("main") | Some("master") => None,
        Some("develop") => has("main").then(|| "main".to_string()),
        _ => BASE_CANDIDATES
            .iter()
            .find(|c| has(c))
            .map(|c| c.to_string()),
    }
}

/// Parses `git rev-list --left-right --count A...B` output ("<left>\t<right>").
/// With `base...current`, left = behind, right = ahead.
pub fn parse_ahead_behind(output: &str) -> (u32, u32) {
    let mut parts = output.split_whitespace();
    let behind = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let ahead = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    (ahead, behind)
}

fn parse_remotes(output: &str) -> Vec<Remote> {
    let mut remotes: Vec<Remote> = Vec::new();
    for line in output.lines() {
        // Format: "<name>\t<url> (fetch|push)"
        let mut parts = line.split_whitespace();
        let (Some(name), Some(url)) = (parts.next(), parts.next()) else {
            continue;
        };
        if !remotes.iter().any(|r| r.name == name) {
            remotes.push(Remote {
                name: name.to_string(),
                url: Some(url.to_string()),
            });
        }
    }
    remotes
}

/// Inspects the repository at `path` and returns its normalized state.
pub fn inspect(path: &str) -> Result<RepositoryState, String> {
    let p = Path::new(path);
    if !is_work_tree(p) {
        return Err(format!("{path} is not a Git repository"));
    }

    let root = work_tree_root(p)?;
    let root_path = Path::new(&root);
    let name = root_path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| root.clone());

    let status_out = run_git(
        root_path,
        &[
            "status",
            "--porcelain=v2",
            "--branch",
            "--untracked-files=all",
        ],
    )?;
    let status = parse_status(&status_out);

    let branches_out = run_git(
        root_path,
        &["for-each-ref", "--format=%(refname:short)", "refs/heads"],
    )?;
    let branch_names: Vec<String> = branches_out
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let latest_commit = run_git(root_path, &["log", "-1", "--format=%h%x1f%s%x1f%cI"])
        .ok()
        .and_then(|out| {
            let line = out.trim();
            let mut parts = line.split('\u{1f}');
            match (parts.next(), parts.next(), parts.next()) {
                (Some(h), Some(s), Some(d)) if !h.is_empty() => Some(LatestCommit {
                    hash: h.to_string(),
                    subject: s.to_string(),
                    date: d.to_string(),
                }),
                _ => None,
            }
        });

    let base_branch = pick_base_branch(status.branch_head.as_deref(), &branch_names);

    let local_divergence = match (&status.branch_head, &base_branch) {
        (Some(current), Some(base)) if current != base => {
            let range = format!("{base}...{current}");
            run_git(
                root_path,
                &["rev-list", "--left-right", "--count", &range],
            )
            .ok()
            .map(|out| {
                let (ahead, behind) = parse_ahead_behind(&out);
                Divergence {
                    ahead,
                    behind,
                    base_branch: base.clone(),
                }
            })
        }
        _ => None,
    };

    let remotes = run_git(root_path, &["remote", "-v"])
        .map(|out| parse_remotes(&out))
        .unwrap_or_default();

    let tracking_divergence = status.tracking.map(|(ahead, behind)| Divergence {
        ahead,
        behind,
        base_branch: status.upstream.clone().unwrap_or_default(),
    });

    Ok(RepositoryState {
        path: root.clone(),
        name,
        current_branch: status.branch_head.clone(),
        detached_head: status.detached,
        working_tree: WorkingTree {
            clean: status.working_tree.clean(),
            staged: status.working_tree.staged,
            modified: status.working_tree.modified,
            deleted: status.working_tree.deleted,
            untracked: status.working_tree.untracked,
            conflicted: status.working_tree.conflicted,
        },
        latest_commit,
        local_branches: LocalBranches {
            count: branch_names.len() as u32,
            names: branch_names,
            base_branch,
        },
        local_divergence,
        remotes,
        upstream: status.upstream,
        tracking_divergence,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_branch_and_clean_tree() {
        let out = "# branch.oid abc123\n# branch.head main\n";
        let info = parse_status(out);
        assert_eq!(info.branch_head.as_deref(), Some("main"));
        assert!(!info.detached);
        assert!(info.working_tree.clean());
    }

    #[test]
    fn parses_detached_head() {
        let info = parse_status("# branch.head (detached)\n");
        assert!(info.detached);
        assert_eq!(info.branch_head, None);
    }

    #[test]
    fn counts_staged_modified_deleted_untracked() {
        let out = "\
# branch.head work
1 M. N... 100644 100644 100644 aa bb staged.txt
1 .M N... 100644 100644 100644 aa bb modified.txt
1 .D N... 100644 100644 000000 aa bb gone.txt
? new-one.txt
? new-two.txt
";
        let info = parse_status(out);
        assert_eq!(info.working_tree.staged, 1);
        assert_eq!(info.working_tree.modified, 1);
        assert_eq!(info.working_tree.deleted, 1);
        assert_eq!(info.working_tree.untracked, 2);
        assert!(!info.working_tree.clean());
    }

    #[test]
    fn parses_upstream_and_tracking() {
        let out = "# branch.head feat\n# branch.upstream origin/feat\n# branch.ab +2 -3\n";
        let info = parse_status(out);
        assert_eq!(info.upstream.as_deref(), Some("origin/feat"));
        assert_eq!(info.tracking, Some((2, 3)));
    }

    #[test]
    fn no_upstream_means_no_tracking() {
        let info = parse_status("# branch.head feat\n");
        assert_eq!(info.upstream, None);
        assert_eq!(info.tracking, None);
    }

    #[test]
    fn base_branch_none_on_main_or_master() {
        let branches = vec!["main".to_string(), "master".to_string()];
        assert_eq!(pick_base_branch(Some("main"), &branches), None);
        assert_eq!(pick_base_branch(Some("master"), &branches), None);
    }

    #[test]
    fn base_branch_develop_compares_against_main_when_present() {
        let branches = vec!["main".to_string(), "develop".to_string()];
        assert_eq!(
            pick_base_branch(Some("develop"), &branches).as_deref(),
            Some("main")
        );
    }

    #[test]
    fn base_branch_develop_has_no_base_without_main() {
        let branches = vec!["develop".to_string(), "master".to_string()];
        assert_eq!(pick_base_branch(Some("develop"), &branches), None);
    }

    #[test]
    fn base_branch_feature_prefers_main_then_master_then_develop() {
        let branches = vec![
            "feature/x".to_string(),
            "master".to_string(),
            "develop".to_string(),
        ];
        assert_eq!(
            pick_base_branch(Some("feature/x"), &branches).as_deref(),
            Some("master")
        );
    }

    #[test]
    fn base_branch_none_when_no_candidate_exists() {
        let branches = vec!["feature/x".to_string(), "trunk".to_string()];
        assert_eq!(pick_base_branch(Some("feature/x"), &branches), None);
    }

    #[test]
    fn counts_unmerged_paths_as_conflicted() {
        let out = "\
# branch.head work
u UU N... 100644 100644 100644 100644 aa bb cc dd both.txt
";
        let info = parse_status(out);
        assert_eq!(info.working_tree.conflicted, 1);
        assert!(!info.working_tree.clean());
    }

    #[test]
    fn ahead_behind_maps_left_to_behind_right_to_ahead() {
        // base...current -> "<behind>\t<ahead>"
        assert_eq!(parse_ahead_behind("2\t7\n"), (7, 2));
    }
}

/// Explicit fetch of remote-tracking refs. Updates refs only; never touches
/// the working tree or current branch. `--no-tags` keeps it conservative.
pub fn fetch(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !is_work_tree(p) {
        return Err(format!("{path} is not a Git repository"));
    }
    run_git(p, &["fetch", "--all", "--no-tags", "--prune"])?;
    Ok(())
}
