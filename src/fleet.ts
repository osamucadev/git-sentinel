// Presentation-state derivation. Pure, framework-free, and the single source of
// truth for how raw `RepositoryState` becomes something the UI can rank, group,
// filter and narrate. Every personality renders from the `RepoStatus` this
// produces — none of them re-derive Git facts.
//
import type { Divergence, RepositoryState } from "./types";

/** Upstream refs older than this are drawn with reduced visual authority
 * (dashed rail, `?` on counts). This NEVER changes a repository's tier — an old
 * Sentinel fetch is context, not an alert (approved adjustment 2). */
export const AGING_MS = 72 * 60 * 60 * 1000;

/** The minimal slice of a registered repository this module needs. `RepoView`
 * from AppState satisfies it structurally. */
export type FleetInput = {
  state?: RepositoryState;
  error?: string;
  loading: boolean;
  lastSuccessfulFetch?: string;
};

export type Tier = "loading" | "blocked" | "attention" | "working" | "ahead" | "healthy";

/** Visual grouping in HQ: blocked+attention collapse into one band. */
export type Group = "loading" | "attention" | "working" | "ahead" | "healthy";

export type Fact =
  | "unavailable"
  | "loading"
  | "conflicted"
  | "dirty"
  | "detached"
  | "diverged-upstream"
  | "behind-upstream"
  | "ahead-upstream"
  | "tracking-unavailable"
  | "no-upstream"
  | "synced"
  | "ahead-reference"
  | "behind-reference"
  | "diverged-reference"
  | "aging"
  | "never-fetched";

/** One verdict key. Personalities choose the words; the key is fixed. */
export type HeadlineKey =
  | "unavailable"
  | "loading"
  | "conflicted"
  | "detached"
  | "diverged"
  | "behind"
  | "trackingUnavailable"
  | "dirty"
  | "aheadPush"
  | "aheadReference"
  | "synced"
  | "noUpstream"
  | "clean";

/** Relation of the current checkout to one reference (base branch or upstream). */
export type Relation =
  | { kind: "synced" }
  | { kind: "ahead"; ahead: number }
  | { kind: "behind"; behind: number }
  | { kind: "diverged"; ahead: number; behind: number };

export type Freshness =
  | { kind: "never" }
  | { kind: "fetched"; iso: string; ageMs: number; aging: boolean };

export type ReferencePosition = { ref: string; rel: Relation };

export type UpstreamPosition =
  | { kind: "tracking"; ref: string; rel: Relation; freshness: Freshness }
  | { kind: "unavailable"; ref: string }
  | { kind: "none" };

export type RepoStatus = {
  tier: Tier;
  group: Group;
  facts: Fact[];
  headline: HeadlineKey;
  /** vs the configured project reference; falls back to a local branch only when needed. */
  reference: ReferencePosition | null;
  /** vs `upstream`; null only while still loading with no state. */
  upstream: UpstreamPosition | null;
  /** Short hash when HEAD is detached, else null. */
  detachedAt: string | null;
  /** Convenience flags for filtering / summary. */
  aging: boolean;
};

function relation(d: Divergence): Relation {
  if (d.ahead > 0 && d.behind > 0) {
    return { kind: "diverged", ahead: d.ahead, behind: d.behind };
  }
  if (d.ahead > 0) return { kind: "ahead", ahead: d.ahead };
  if (d.behind > 0) return { kind: "behind", behind: d.behind };
  return { kind: "synced" };
}

function freshness(iso: string | undefined, now: number): Freshness {
  if (!iso) return { kind: "never" };
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { kind: "never" };
  const ageMs = Math.max(0, now - t);
  return { kind: "fetched", iso, ageMs, aging: ageMs > AGING_MS };
}

const GROUP_OF: Record<Tier, Group> = {
  loading: "loading",
  blocked: "attention",
  attention: "attention",
  working: "working",
  ahead: "ahead",
  healthy: "healthy",
};

/** Sort weight for the default HQ ordering (lower = nearer the top). */
export const TIER_RANK: Record<Tier, number> = {
  loading: 0,
  blocked: 1,
  attention: 2,
  working: 3,
  ahead: 4,
  healthy: 5,
};

export function deriveStatus(repo: FleetInput, now: number = Date.now()): RepoStatus {
  // --- unavailable / loading -------------------------------------------------
  if (repo.error) {
    return {
      tier: "blocked",
      group: "attention",
      facts: ["unavailable"],
      headline: "unavailable",
      reference: null,
      upstream: null,
      detachedAt: null,
      aging: false,
    };
  }
  const s = repo.state;
  if (!s) {
    return {
      tier: "loading",
      group: "loading",
      facts: ["loading"],
      headline: "loading",
      reference: null,
      upstream: null,
      detachedAt: null,
      aging: false,
    };
  }

  const facts: Fact[] = [];
  const wt = s.workingTree;
  const nonConflictChanges = wt.staged + wt.modified + wt.deleted + wt.untracked;

  if (wt.conflicted > 0) facts.push("conflicted");
  if (nonConflictChanges > 0) facts.push("dirty");
  if (s.detachedHead) facts.push("detached");

  // --- project reference position -----------------------------------------
  let reference: ReferencePosition | null = null;
  const referenceDivergence = s.referenceDivergence ?? s.localDivergence;
  const referenceBranch = s.referenceBranch ?? s.localBranches.baseBranch;
  if (referenceDivergence && referenceBranch) {
    const rel = relation(referenceDivergence);
    reference = { ref: referenceBranch, rel };
    if (rel.kind === "ahead") facts.push("ahead-reference");
    else if (rel.kind === "behind") facts.push("behind-reference");
    else if (rel.kind === "diverged") facts.push("diverged-reference");
  }

  // --- upstream position -------------------------------------------------
  let upstream: UpstreamPosition;
  if (!s.upstream) {
    upstream = { kind: "none" };
    facts.push("no-upstream");
  } else if (!s.trackingDivergence) {
    // `git status` could not provide a comparable tracking position. This is
    // deliberately not called "gone": the normalized state does not prove why
    // the comparison is unavailable.
    upstream = { kind: "unavailable", ref: s.upstream };
    facts.push("tracking-unavailable");
  } else {
    const rel = relation(s.trackingDivergence);
    const fresh = freshness(repo.lastSuccessfulFetch, now);
    upstream = { kind: "tracking", ref: s.upstream, rel, freshness: fresh };
    if (rel.kind === "ahead") facts.push("ahead-upstream");
    else if (rel.kind === "behind") facts.push("behind-upstream");
    else if (rel.kind === "diverged") facts.push("diverged-upstream");
    else facts.push("synced");
    if (fresh.kind === "never") facts.push("never-fetched");
    else if (fresh.aging) facts.push("aging");
  }

  const has = (f: Fact) => facts.includes(f);
  const aging = has("aging") || has("never-fetched");

  // --- tier (freshness is deliberately NOT an input) -----------------------
  let tier: Tier;
  if (has("conflicted") || (has("detached") && has("dirty"))) {
    tier = "blocked";
  } else if (
    has("diverged-upstream") ||
    has("behind-upstream") ||
    has("tracking-unavailable") ||
    has("detached")
  ) {
    tier = "attention";
  } else if (has("dirty")) {
    // Local edits are work in progress. They stay visible in the Modified
    // filter and summary, but are not an operational alert on their own.
    tier = "working";
  } else if (has("ahead-upstream") || has("ahead-reference")) {
    tier = "ahead";
  } else {
    tier = "healthy";
  }

  // --- headline: one verdict, priority order ------------------------------
  let headline: HeadlineKey;
  if (has("conflicted")) headline = "conflicted";
  else if (has("detached")) headline = "detached";
  else if (has("diverged-upstream")) headline = "diverged";
  else if (has("behind-upstream")) headline = "behind";
  else if (has("tracking-unavailable")) headline = "trackingUnavailable";
  else if (has("dirty")) headline = "dirty";
  else if (has("ahead-upstream")) headline = "aheadPush";
  else if (has("ahead-reference")) headline = "aheadReference";
  else if (has("synced")) headline = "synced";
  else if (has("no-upstream")) headline = "noUpstream";
  else headline = "clean";

  return {
    tier,
    group: GROUP_OF[tier],
    facts,
    headline,
    reference,
    upstream,
    detachedAt: s.detachedHead ? (s.latestCommit?.hash ?? null) : null,
    aging,
  };
}

// --- fleet aggregation ------------------------------------------------------

export type FleetSummary = {
  total: number;
  loading: number;
  healthy: number;
  /** blocked + attention tiers. */
  attention: number;
  ahead: number;
  /** dirty or conflicted working tree. */
  modified: number;
  conflicted: number;
  diverged: number;
  behind: number;
  unavailable: number;
  /** aging or never-fetched — shown as neutral context only. */
  stale: number;
};

export function summarize(statuses: RepoStatus[]): FleetSummary {
  const count = (pred: (st: RepoStatus) => boolean) => statuses.filter(pred).length;
  const fact = (f: Fact) => count((st) => st.facts.includes(f));
  return {
    total: statuses.length,
    loading: count((st) => st.tier === "loading"),
    healthy: count((st) => st.tier === "healthy"),
    attention: count((st) => st.tier === "blocked" || st.tier === "attention"),
    ahead: count((st) => st.tier === "ahead"),
    modified: count((st) => st.facts.includes("dirty") || st.facts.includes("conflicted")),
    conflicted: fact("conflicted"),
    diverged: fact("diverged-upstream"),
    behind: fact("behind-upstream"),
    unavailable: fact("unavailable"),
    stale: count((st) => st.aging),
  };
}

// --- filtering ------------------------------------------------------------

export type FilterId = "all" | "attention" | "ahead" | "modified" | "stale" | "healthy";

export const FILTER_IDS: FilterId[] = ["all", "attention", "ahead", "modified", "stale", "healthy"];

export function matchesFilter(status: RepoStatus, filter: FilterId): boolean {
  switch (filter) {
    case "all":
      return true;
    case "attention":
      return status.tier === "blocked" || status.tier === "attention";
    case "ahead":
      return status.tier === "ahead";
    case "modified":
      return status.facts.includes("dirty") || status.facts.includes("conflicted");
    case "stale":
      return status.aging;
    case "healthy":
      return status.tier === "healthy";
  }
}

export function filterCount(statuses: RepoStatus[], filter: FilterId): number {
  return statuses.filter((st) => matchesFilter(st, filter)).length;
}
