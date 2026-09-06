// Presentation-state derivation. Pure, framework-free, and the single source of
// truth for how raw `RepositoryState` becomes something the UI can rank, group,
// filter and narrate. Every personality renders from the `RepoStatus` this
// produces — none of them re-derive Git facts.
//
// Design reference: GIT-SENTINEL-UX-REDESIGN.md sections 6, 7, 11.

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

export type Tier = "blocked" | "attention" | "ahead" | "healthy";

/** Visual grouping in HQ: blocked+attention collapse into one band. */
export type Group = "attention" | "ahead" | "healthy";

export type Fact =
  | "unavailable"
  | "loading"
  | "conflicted"
  | "dirty"
  | "detached"
  | "diverged-upstream"
  | "behind-upstream"
  | "ahead-upstream"
  | "upstream-gone"
  | "no-upstream"
  | "synced"
  | "ahead-base"
  | "behind-base"
  | "diverged-base"
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
  | "upstreamGone"
  | "dirty"
  | "aheadPush"
  | "aheadBase"
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

export type LocalPosition = { ref: string; rel: Relation };

export type UpstreamPosition =
  | { kind: "tracking"; ref: string; rel: Relation; freshness: Freshness }
  | { kind: "gone"; ref: string }
  | { kind: "none" };

export type RepoStatus = {
  tier: Tier;
  group: Group;
  facts: Fact[];
  headline: HeadlineKey;
  /** vs `localBranches.baseBranch`; null on the base branch or when no base exists. */
  local: LocalPosition | null;
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
  blocked: "attention",
  attention: "attention",
  ahead: "ahead",
  healthy: "healthy",
};

/** Sort weight for the default HQ ordering (lower = nearer the top). */
export const TIER_RANK: Record<Tier, number> = {
  blocked: 0,
  attention: 1,
  ahead: 2,
  healthy: 3,
};

export function deriveStatus(repo: FleetInput, now: number = Date.now()): RepoStatus {
  // --- unavailable / loading -------------------------------------------------
  if (repo.error) {
    return {
      tier: "blocked",
      group: "attention",
      facts: ["unavailable"],
      headline: "unavailable",
      local: null,
      upstream: null,
      detachedAt: null,
      aging: false,
    };
  }
  const s = repo.state;
  if (!s) {
    return {
      tier: "healthy",
      group: "healthy",
      facts: ["loading"],
      headline: "loading",
      local: null,
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

  // --- local base position -------------------------------------------------
  let local: LocalPosition | null = null;
  if (s.localDivergence && s.localBranches.baseBranch) {
    const rel = relation(s.localDivergence);
    local = { ref: s.localBranches.baseBranch, rel };
    if (rel.kind === "ahead") facts.push("ahead-base");
    else if (rel.kind === "behind") facts.push("behind-base");
    else if (rel.kind === "diverged") facts.push("diverged-base");
  }

  // --- upstream position -------------------------------------------------
  let upstream: UpstreamPosition;
  if (!s.upstream) {
    upstream = { kind: "none" };
    facts.push("no-upstream");
  } else if (!s.trackingDivergence) {
    // Upstream is configured but its ahead/behind is unknowable — the
    // remote-tracking ref is gone (e.g. branch deleted upstream).
    upstream = { kind: "gone", ref: s.upstream };
    facts.push("upstream-gone");
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
    has("upstream-gone") ||
    has("dirty") ||
    has("detached")
  ) {
    tier = "attention";
  } else if (has("ahead-upstream") || has("ahead-base")) {
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
  else if (has("upstream-gone")) headline = "upstreamGone";
  else if (has("dirty")) headline = "dirty";
  else if (has("ahead-upstream")) headline = "aheadPush";
  else if (has("ahead-base")) headline = "aheadBase";
  else if (has("synced")) headline = "synced";
  else if (has("no-upstream")) headline = "noUpstream";
  else headline = "clean";

  return {
    tier,
    group: GROUP_OF[tier],
    facts,
    headline,
    local,
    upstream,
    detachedAt: s.detachedHead ? (s.latestCommit?.hash ?? null) : null,
    aging,
  };
}

// --- fleet aggregation ------------------------------------------------------

export type FleetSummary = {
  total: number;
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
