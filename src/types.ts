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
  remotes: Array<{ name: string; url?: string }>;
  upstream: string | null;
  trackingDivergence: Divergence | null;
};

export type Personality = "technical" | "cute" | "scifi" | "jarbas";
export type Language = "en" | "pt-BR" | "es";

// Sentinel-only persisted settings. Never holds Git state.
export type SentinelConfig = {
  onboarded: boolean;
  personality: Personality;
  language: Language;
  preferredName: string;
  formOfAddress: string;
};

// One registered repository: just a path plus Sentinel-only metadata.
export type RegisteredRepo = {
  path: string;
  lastSuccessfulFetch?: string; // ISO-8601
};

export const DEFAULT_CONFIG: SentinelConfig = {
  onboarded: false,
  personality: "technical",
  language: "en",
  preferredName: "",
  formOfAddress: "",
};
