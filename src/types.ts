// Mirror of the Rust `RepositoryState` (serde camelCase). Kept in sync by hand;
// the shape is small and stable.

export type Divergence = {
  ahead: number;
  behind: number;
  baseBranch: string;
};

export type RepositoryState = {
  path: string;
  name: string;
  currentBranch: string | null;
  detachedHead: boolean;
  workingTree: {
    clean: boolean;
    staged: number;
    modified: number;
    deleted: number;
    untracked: number;
    conflicted: number;
  };
  latestCommit: {
    hash: string;
    subject: string;
    date: string;
  } | null;
  localBranches: {
    count: number;
    names: string[];
    baseBranch: string | null;
  };
  localDivergence: Divergence | null;
  referenceBranch: string | null;
  referenceBranches: string[];
  referenceDivergence: Divergence | null;
  remotes: Array<{ name: string; url?: string }>;
  upstream: string | null;
  trackingDivergence: Divergence | null;
  stashes: StashEntry[];
};

// One `git stash list` entry. `branchHint` is inferred from the free-text
// reflog subject, not a resolved Git ref, and `reference` ("stash@{N}") is
// only valid for the lifetime of this snapshot: the index shifts as stashes
// change.
export type StashEntry = {
  index: number;
  reference: string;
  hash: string;
  message: string;
  branchHint: string | null;
  date: string;
};

// Identified by the stash's stable commit hash, not the reorderable
// `stash@{N}` selector: the backend re-validates the hash is still present
// in `git stash list` immediately before reading this, so a stash dropped or
// reordered between selection and this call fails clearly instead of
// silently returning a different stash's content.
export type StashDiff = {
  hash: string;
  content: string;
  truncated: boolean;
};

export type ChangedFile = {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked" | "conflicted";
};

export type FileDiff = {
  path: string;
  content: string;
  untracked: boolean;
  truncated: boolean;
};

export type Personality = "technical" | "cute" | "scifi" | "jarbas" | "retro" | "lineart" | "pixel" | "glass";
export type Language = "en" | "pt-BR" | "es";

// Sentinel-only persisted settings. Never holds Git state.
export type SentinelConfig = {
  onboarded: boolean;
  personality: Personality;
  language: Language;
  preferredName: string;
  formOfAddress: string;
  autoFetchEnabled: boolean;
  autoFetchIntervalMinutes: 15 | 30 | 60;
};

// One registered repository: just a path plus Sentinel-only metadata.
export type RegisteredRepo = {
  path: string;
  lastSuccessfulFetch?: string; // ISO-8601
  referenceBranch?: string;
};

export const DEFAULT_CONFIG: SentinelConfig = {
  onboarded: false,
  personality: "technical",
  language: "en",
  preferredName: "",
  formOfAddress: "",
  autoFetchEnabled: false,
  autoFetchIntervalMinutes: 30,
};
