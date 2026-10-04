// Fleet insights for the status bar. Pure and framework-free: every insight is
// a fact read from RepositoryState plus Sentinel metadata, never a judgement.
// They are ranked (things you can act on first, then context, then general
// statistics) but no insight changes a repository's tier, and none claims
// something the data cannot prove (e.g. who authored a commit).

import { fill, relativeTime } from "./i18n";
import type { Dict } from "./i18n/en";
import type { RepositoryState } from "./types";

/** The slice of a registered repository this module needs. `RepoView` from
 * AppState satisfies it structurally. */
export type InsightRepo = {
  path: string;
  state?: RepositoryState;
  error?: string;
  loading: boolean;
  lastSuccessfulFetch?: string;
};

type About = { path: string; name: string };

export type Insight =
  | ({ id: string; kind: "unavailable" } & About)
  | ({ id: string; kind: "behind"; n: number; ref: string } & About)
  | ({ id: string; kind: "pushPending"; commits: number; repos: number } & Partial<About>)
  | ({ id: string; kind: "neverFetched"; repos: number } & Partial<About>)
  | ({ id: string; kind: "oldestFetch"; at: string } & About)
  | ({ id: string; kind: "localChanges"; changes: number; repos: number } & Partial<About>)
  | ({ id: string; kind: "stashes"; count: number; repos: number; at: string } & About)
  | ({ id: string; kind: "latestCommit"; at: string } & About)
  | ({ id: string; kind: "quietestRepo"; at: string } & About)
  | { id: string; kind: "fleet"; repos: number; branches: number; stashes: number };

/** Behind-upstream insights shown at most, largest gap first. */
export const MAX_BEHIND_INSIGHTS = 3;

/** A Sentinel fetch younger than this is not worth a status-bar line. This
 * only filters noise; it never marks a repository as stale anywhere else. */
export const OLDEST_FETCH_MIN_AGE_MS = 24 * 60 * 60 * 1000;

function nameOf(repo: InsightRepo): string {
  return repo.state?.name ?? repo.path.split("/").filter(Boolean).pop() ?? repo.path;
}

function time(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? NaN : t;
}

/** Only one repository involved: name it so the insight can open it. */
function single(repos: InsightRepo[]): Partial<About> {
  return repos.length === 1 ? { path: repos[0].path, name: nameOf(repos[0]) } : {};
}

export function deriveInsights(repos: InsightRepo[], now: number): Insight[] {
  const insights: Insight[] = [];
  const inspected = repos.filter((r): r is InsightRepo & { state: RepositoryState } => !r.error && !!r.state);

  // --- things you can act on ------------------------------------------------
  for (const repo of repos.filter((r) => r.error)) {
    insights.push({ id: `unavailable:${repo.path}`, kind: "unavailable", path: repo.path, name: nameOf(repo) });
  }

  inspected
    .filter((r) => r.state.upstream && (r.state.trackingDivergence?.behind ?? 0) > 0)
    .sort((a, b) => b.state.trackingDivergence!.behind - a.state.trackingDivergence!.behind)
    .slice(0, MAX_BEHIND_INSIGHTS)
    .forEach((r) => insights.push({
      id: `behind:${r.path}`,
      kind: "behind",
      path: r.path,
      name: nameOf(r),
      n: r.state.trackingDivergence!.behind,
      ref: r.state.upstream!,
    }));

  const pushable = inspected.filter((r) => r.state.upstream && (r.state.trackingDivergence?.ahead ?? 0) > 0);
  if (pushable.length > 0) {
    insights.push({
      id: "pushPending",
      kind: "pushPending",
      commits: pushable.reduce((sum, r) => sum + r.state.trackingDivergence!.ahead, 0),
      repos: pushable.length,
      ...single(pushable),
    });
  }

  const tracked = inspected.filter((r) => r.state.upstream);
  const neverFetched = tracked.filter((r) => !r.lastSuccessfulFetch);
  if (neverFetched.length > 0) {
    insights.push({ id: "neverFetched", kind: "neverFetched", repos: neverFetched.length, ...single(neverFetched) });
  }

  const oldestFetch = tracked
    .filter((r) => r.lastSuccessfulFetch && !Number.isNaN(time(r.lastSuccessfulFetch)))
    .sort((a, b) => time(a.lastSuccessfulFetch!) - time(b.lastSuccessfulFetch!))[0];
  if (oldestFetch && now - time(oldestFetch.lastSuccessfulFetch!) >= OLDEST_FETCH_MIN_AGE_MS) {
    insights.push({
      id: `oldestFetch:${oldestFetch.path}`,
      kind: "oldestFetch",
      path: oldestFetch.path,
      name: nameOf(oldestFetch),
      at: oldestFetch.lastSuccessfulFetch!,
    });
  }

  const changed = inspected.filter((r) => !r.state.workingTree.clean);
  if (changed.length > 0) {
    const count = (r: (typeof changed)[number]) => {
      const wt = r.state.workingTree;
      return wt.staged + wt.modified + wt.deleted + wt.untracked + wt.conflicted;
    };
    insights.push({
      id: "localChanges",
      kind: "localChanges",
      changes: changed.reduce((sum, r) => sum + count(r), 0),
      repos: changed.length,
      ...single(changed),
    });
  }

  // --- context ------------------------------------------------------------
  const stashed = inspected.filter((r) => r.state.stashes.length > 0);
  const allStashes = stashed.flatMap((r) => r.state.stashes.map((s) => ({ repo: r, at: s.date })))
    .filter((s) => !Number.isNaN(time(s.at)))
    .sort((a, b) => time(a.at) - time(b.at));
  if (allStashes.length > 0) {
    const oldest = allStashes[0];
    insights.push({
      id: "stashes",
      kind: "stashes",
      count: stashed.reduce((sum, r) => sum + r.state.stashes.length, 0),
      repos: stashed.length,
      path: oldest.repo.path,
      name: nameOf(oldest.repo),
      at: oldest.at,
    });
  }

  // The latest commit on each checkout's current branch. It may have been
  // authored by someone else, so the wording never says "you".
  const byCommit = inspected
    .filter((r) => r.state.latestCommit && !Number.isNaN(time(r.state.latestCommit.date)))
    .sort((a, b) => time(b.state.latestCommit!.date) - time(a.state.latestCommit!.date));
  if (byCommit.length > 0) {
    const latest = byCommit[0];
    insights.push({ id: "latestCommit", kind: "latestCommit", path: latest.path, name: nameOf(latest), at: latest.state.latestCommit!.date });
  }
  if (byCommit.length > 1) {
    const quietest = byCommit[byCommit.length - 1];
    insights.push({ id: "quietestRepo", kind: "quietestRepo", path: quietest.path, name: nameOf(quietest), at: quietest.state.latestCommit!.date });
  }

  // --- general statistics -------------------------------------------------
  if (inspected.length > 0) {
    insights.push({
      id: "fleet",
      kind: "fleet",
      repos: repos.length,
      branches: inspected.reduce((sum, r) => sum + r.state.localBranches.count, 0),
      stashes: inspected.reduce((sum, r) => sum + r.state.stashes.length, 0),
    });
  }

  return insights;
}

export function insightText(insight: Insight, d: Dict, now: Date = new Date()): string {
  const t = d.statusBar;
  const ago = (iso: string) => relativeTime(iso, d, now);
  switch (insight.kind) {
    case "unavailable":
      return fill(t.unavailable, { name: insight.name });
    case "behind":
      return fill(t.behind, { name: insight.name, n: insight.n, ref: insight.ref });
    case "pushPending":
      return insight.name
        ? fill(t.pushPendingOne, { n: insight.commits, name: insight.name })
        : fill(t.pushPendingMany, { n: insight.commits, repos: insight.repos });
    case "neverFetched":
      return insight.name
        ? fill(t.neverFetchedOne, { name: insight.name })
        : fill(t.neverFetchedMany, { n: insight.repos });
    case "oldestFetch":
      return fill(t.oldestFetch, { name: insight.name, time: ago(insight.at) });
    case "localChanges":
      return insight.name
        ? fill(t.localChangesOne, { n: insight.changes, name: insight.name })
        : fill(t.localChangesMany, { n: insight.changes, repos: insight.repos });
    case "stashes":
      if (insight.count === 1) return fill(t.stashesOne, { name: insight.name, time: ago(insight.at) });
      return insight.repos === 1
        ? fill(t.stashesInOne, { n: insight.count, name: insight.name, time: ago(insight.at) })
        : fill(t.stashesMany, { n: insight.count, repos: insight.repos, name: insight.name, time: ago(insight.at) });
    case "latestCommit":
      return fill(t.latestCommit, { name: insight.name, time: ago(insight.at) });
    case "quietestRepo":
      return fill(t.quietestRepo, { name: insight.name, time: ago(insight.at) });
    case "fleet": {
      const count = (n: number, one: string, many: string) => (n === 1 ? one : fill(many, { n }));
      return [
        count(insight.repos, t.fleetRepositoriesOne, t.fleetRepositoriesMany),
        count(insight.branches, t.fleetBranchesOne, t.fleetBranchesMany),
        // Zero stashes is the common case and not worth the space.
        insight.stashes > 0 ? count(insight.stashes, t.fleetStashesOne, t.fleetStashesMany) : null,
      ].filter(Boolean).join(" · ");
    }
  }
}

/** The repository an insight is about, when it names exactly one. */
export function insightPath(insight: Insight): string | undefined {
  return "path" in insight ? insight.path : undefined;
}
