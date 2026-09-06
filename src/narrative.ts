// Deterministic, localized explanation of Git facts. This deliberately uses
// only RepositoryState plus Sentinel metadata; personalities only style it.

import { fill, relativeTime } from "./i18n";
import type { Dict } from "./i18n/en";
import type { RepoStatus } from "./fleet";
import type { RepositoryState } from "./types";

type NarrativeInput = {
  state: RepositoryState;
  status: RepoStatus;
  lastSuccessfulFetch?: string;
};

export type RowSignal = {
  dimension: "local" | "upstream" | "reference";
  state: "clean" | "working" | "conflict" | "synced" | "ahead" | "behind" | "diverged" | "unavailable" | "none";
  mark: string;
  label: string;
  detail?: string;
};

export type RepositoryRowStory = {
  signals: RowSignal[];
  summary: string;
  details: string[];
};

function relationLine(
  prefix: "upstream" | "reference",
  ref: string,
  rel: NonNullable<RepoStatus["reference"]>["rel"],
  d: Dict,
): string {
  const key = `${prefix}${rel.kind[0].toUpperCase()}${rel.kind.slice(1)}` as keyof typeof d.narrative;
  const template = d.narrative[key] as string;
  return fill(template, {
    ref,
    n: rel.kind === "ahead" ? rel.ahead : rel.kind === "behind" ? rel.behind : 0,
    ahead: rel.kind === "ahead" || rel.kind === "diverged" ? rel.ahead : 0,
    behind: rel.kind === "behind" || rel.kind === "diverged" ? rel.behind : 0,
  });
}

function workingTreeLine(state: RepositoryState, d: Dict): string | null {
  const wt = state.workingTree;
  const facts = [
    wt.staged && fill(d.narrative.staged, { n: wt.staged }),
    wt.modified && fill(d.narrative.modified, { n: wt.modified }),
    wt.deleted && fill(d.narrative.deleted, { n: wt.deleted }),
    wt.untracked && fill(d.narrative.untracked, { n: wt.untracked }),
    wt.conflicted && fill(d.narrative.conflicted, { n: wt.conflicted }),
  ].filter(Boolean).join(d.narrative.join);
  return facts ? fill(d.narrative.workingTree, { facts }) : null;
}

function compactWorkingTreeLine(state: RepositoryState, d: Dict): string | null {
  const wt = state.workingTree;
  if (wt.conflicted > 0) return null;
  const facts = [
    wt.staged && fill(d.rowNarrative.staged, { n: wt.staged }),
    wt.modified && fill(d.rowNarrative.modified, { n: wt.modified }),
    wt.deleted && fill(d.rowNarrative.deleted, { n: wt.deleted }),
    wt.untracked && fill(d.rowNarrative.untracked, { n: wt.untracked }),
  ].filter(Boolean).join(d.rowNarrative.join);
  return facts || null;
}

function rowRelation(
  ref: string,
  rel: NonNullable<RepoStatus["reference"]>["rel"],
  d: Dict,
  reference = false,
): string | null {
  if (rel.kind === "synced") return reference ? null : fill(d.rowNarrative.synced, { ref });
  const key = (reference
    ? `reference${rel.kind[0].toUpperCase()}${rel.kind.slice(1)}`
    : rel.kind) as keyof typeof d.rowNarrative;
  const template = d.rowNarrative[key] as string;
  return fill(template, {
    ref,
    n: rel.kind === "ahead" ? rel.ahead : rel.kind === "behind" ? rel.behind : 0,
    ahead: rel.kind === "ahead" || rel.kind === "diverged" ? rel.ahead : 0,
    behind: rel.kind === "behind" || rel.kind === "diverged" ? rel.behind : 0,
  });
}

function signalRelation(
  dimension: "upstream" | "reference",
  ref: string,
  rel: NonNullable<RepoStatus["reference"]>["rel"],
  d: Dict,
): RowSignal {
  const label = dimension === "upstream" ? d.rowNarrative.upstreamLabel : d.rowNarrative.referenceLabel;
  const detail = dimension === "reference" ? fill(d.rowNarrative.referenceAgainst, { ref }) : ref;
  if (rel.kind === "synced") return { dimension, state: "synced", mark: "✓", label, detail };
  if (rel.kind === "ahead") return { dimension, state: "ahead", mark: "↑", label: `↑${rel.ahead} ${label}`, detail };
  if (rel.kind === "behind") return { dimension, state: "behind", mark: "↓", label: `↓${rel.behind} ${label}`, detail };
  return { dimension, state: "diverged", mark: "↕", label: `↑${rel.ahead} ↓${rel.behind} ${label}`, detail };
}

function rowSummary(state: RepositoryState, status: RepoStatus, d: Dict): string {
  const wt = state.workingTree;
  if (wt.conflicted > 0) return fill(d.rowNarrative.conflict, { n: wt.conflicted });

  const upstream = status.upstream;
  if (upstream?.kind === "unavailable") return fill(d.rowNarrative.trackingUnavailable, { ref: upstream.ref });
  if (upstream?.kind === "none") return state.remotes.length === 0 ? d.rowNarrative.noRemote : d.rowNarrative.noUpstream;
  if (upstream?.kind === "tracking") {
    if (upstream.rel.kind === "ahead") return fill(d.rowNarrative.ahead, { n: upstream.rel.ahead, ref: upstream.ref });
    if (upstream.rel.kind === "behind") return fill(d.rowNarrative.behind, { n: upstream.rel.behind, ref: upstream.ref });
    if (upstream.rel.kind === "diverged") return fill(d.rowNarrative.diverged, { ahead: upstream.rel.ahead, behind: upstream.rel.behind, ref: upstream.ref });
  }

  if (status.reference && status.reference.rel.kind !== "synced") {
    if (upstream?.kind === "tracking" && upstream.rel.kind === "synced") {
      return fill(d.rowNarrative.syncedReferenceDiffers, { ref: status.reference.ref });
    }
    const line = rowRelation(status.reference.ref, status.reference.rel, d, true);
    if (line) return line;
  }

  if (!state.workingTree.clean) {
    return upstream?.kind === "tracking" && upstream.rel.kind === "synced"
      ? d.rowNarrative.localWorkSynced
      : d.rowNarrative.localWork;
  }
  return d.rowNarrative.allClear;
}

/** Shared semantic presentation for HQ rows. Signals are deliberately facts,
 * not a Git graph: local work, own upstream, then project reference. */
export function repositoryRowStory({ state, status, lastSuccessfulFetch }: NarrativeInput, d: Dict): RepositoryRowStory {
  const wt = state.workingTree;
  const signals: RowSignal[] = [];
  const details: string[] = [];
  const work = compactWorkingTreeLine(state, d);
  const localTotal = wt.staged + wt.modified + wt.deleted + wt.untracked;

  if (wt.conflicted > 0) {
    signals.push({ dimension: "local", state: "conflict", mark: "!", label: fill(d.rowNarrative.localConflicts, { n: wt.conflicted }) });
  } else if (wt.clean) {
    signals.push({ dimension: "local", state: "clean", mark: "✓", label: d.rowNarrative.localClean });
  } else {
    signals.push({ dimension: "local", state: "working", mark: "●", label: fill(d.rowNarrative.localChanges, { n: localTotal }) });
  }
  if (work) details.push(work);

  const upstream = status.upstream;
  if (upstream?.kind === "tracking") {
    signals.push(signalRelation("upstream", upstream.ref, upstream.rel, d));
  } else if (upstream?.kind === "unavailable") {
    signals.push({ dimension: "upstream", state: "unavailable", mark: "?", label: d.rowNarrative.trackingUnavailableLabel, detail: upstream.ref });
  } else if (upstream?.kind === "none") {
    signals.push({ dimension: "upstream", state: "none", mark: "—", label: d.rowNarrative.noUpstreamLabel });
  }

  if (status.reference && status.reference.rel.kind !== "synced") {
    signals.push(signalRelation("reference", status.reference.ref, status.reference.rel, d));
  }

  if (state.upstream) {
    details.push(lastSuccessfulFetch
      ? fill(d.rowNarrative.freshness, { time: relativeTime(lastSuccessfulFetch, d) })
      : d.rowNarrative.freshnessUnknown);
  }

  return { signals, summary: rowSummary(state, status, d), details };
}

/** Compact HQ story: plain language replaces the topology without conflating
 * current branch, its upstream, and the project's configured reference. */
export function repositoryRowNarrative({ state, status, lastSuccessfulFetch }: NarrativeInput, d: Dict): string[] {
  const story = repositoryRowStory({ state, status, lastSuccessfulFetch }, d);
  return [story.summary, ...story.details];
}

export function repositoryNarrative({ state, status, lastSuccessfulFetch }: NarrativeInput, d: Dict): string[] {
  const lines: string[] = [];
  if (state.currentBranch) lines.push(fill(d.narrative.current, { branch: state.currentBranch }));
  else lines.push(d.narrative.noBranch);

  const upstream = status.upstream;
  if (upstream?.kind === "tracking") lines.push(relationLine("upstream", upstream.ref, upstream.rel, d));
  else if (upstream?.kind === "unavailable") lines.push(fill(d.narrative.trackingUnavailable, { ref: upstream.ref }));
  else if (upstream?.kind === "none") lines.push(d.narrative.noUpstream);

  if (status.reference) lines.push(relationLine("reference", status.reference.ref, status.reference.rel, d));

  const work = workingTreeLine(state, d);
  if (work) lines.push(work);
  if (state.upstream && lastSuccessfulFetch) {
    lines.push(fill(d.narrative.snapshot, { time: relativeTime(lastSuccessfulFetch, d) }));
  }
  return lines;
}
