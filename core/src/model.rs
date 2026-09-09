use serde::{Deserialize, Serialize};

/// Normalized, personality-independent snapshot of a Git repository.
/// Every presentation personality in the UI renders from this exact shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryState {
    pub path: String,
    pub name: String,

    pub current_branch: Option<String>,
    pub detached_head: bool,

    pub working_tree: WorkingTree,
    pub latest_commit: Option<LatestCommit>,
    pub local_branches: LocalBranches,
    pub local_divergence: Option<Divergence>,

    /// The project line selected by the user or resolved from existing refs.
    pub reference_branch: Option<String>,
    /// Existing refs that may be selected as the repository reference.
    pub reference_branches: Vec<String>,
    /// Current checkout compared with `reference_branch`.
    pub reference_divergence: Option<Divergence>,

    pub remotes: Vec<Remote>,
    pub upstream: Option<String>,
    pub tracking_divergence: Option<Divergence>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkingTree {
    pub clean: bool,
    pub staged: u32,
    pub modified: u32,
    pub deleted: u32,
    pub untracked: u32,
    /// Paths with unresolved merge conflicts (porcelain v2 `u` records).
    pub conflicted: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestCommit {
    pub hash: String,
    pub subject: String,
    /// ISO-8601 committer date.
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBranches {
    pub count: u32,
    pub names: Vec<String>,
    pub base_branch: Option<String>,
}

/// Ahead/behind counts. Reused for both local (vs base branch) and
/// remote-tracking (vs upstream) comparisons; the caller labels which.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Divergence {
    pub ahead: u32,
    pub behind: u32,
    pub base_branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Remote {
    pub name: String,
    pub url: Option<String>,
}

/// A changed path reported by Git. This is intentionally a read-only view of
/// the working tree, suitable for the UI's file list and diff viewer.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    pub path: String,
    pub status: String,
}

/// Content returned for a single read-only diff request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub content: String,
    pub untracked: bool,
    pub truncated: bool,
}
