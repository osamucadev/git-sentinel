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
