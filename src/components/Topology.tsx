// A compact semantic topology, not a commit DAG. The one shared pivot is HEAD;
// each rail communicates one independently-derived relationship to that pivot.

import { fill, relativeTime } from "../i18n";
import type { Dict } from "../i18n/en";
import type { Relation, RepoStatus, UpstreamPosition } from "../fleet";
import type { Personality } from "../types";
import { glyphs, railVerdict, tone, type Glyphs } from "../personality/topology";

type Variant = "row" | "detail";

type Props = {
  status: RepoStatus;
  conflicted: number;
  currentBranch: string | null;
  d: Dict;
  p: Personality;
  variant: Variant;
};

function Node({ kind, g }: { kind: "you" | "ref" | "fork"; g: Glyphs }) {
  const ch = kind === "you" ? g.you : kind === "fork" ? g.fork : g.ref;
  return <span className={`topo-node topo-node-${kind}`}>{ch}</span>;
}

/** A rail leaves the middle slot empty: the single pivot is rendered once by Spine. */
function RelationTrack({ rel, g }: { rel: Relation; g: Glyphs }) {
  if (rel.kind === "synced") {
    return <span className="topo-track topo-track-synced"><Node kind="ref" g={g} /></span>;
  }
  if (rel.kind === "ahead") {
    return <span className="topo-track topo-track-ahead"><Node kind="ref" g={g} /><span className="topo-seg" /></span>;
  }
  if (rel.kind === "behind") {
    return <span className="topo-track topo-track-behind"><span className="topo-seg" /><Node kind="ref" g={g} /></span>;
  }
  return (
    <span className="topo-track topo-track-diverged" data-testid="diverged-track">
      <span className="topo-diverged-you"><Node kind="fork" g={g} /><span className="topo-seg" /></span>
      <span className="topo-diverged-ref"><span className="topo-seg" /><Node kind="ref" g={g} /></span>
    </span>
  );
}

function Rail({ kind, label, rel, verdict, aging, fresh, g, d }: {
  kind: "reference" | "upstream";
  label: string;
  rel: Relation;
  verdict: string;
  aging: boolean;
  fresh?: string;
  g: Glyphs;
  d: Dict;
}) {
  return (
    <div className={`topo-rail topo-rail-${kind}`} data-aging={aging || undefined}>
      <span className="topo-rail-label"><span className="topo-rail-kind">{kind === "reference" ? d.topo.reference : d.topo.tracking}</span>{label}</span>
      <RelationTrack rel={rel} g={g} />
      <span className="topo-rail-verdict">{verdict}</span>
      {fresh && <span className="topo-rail-fresh">{fresh}</span>}
    </div>
  );
}

function upstreamFresh(u: UpstreamPosition, d: Dict): string | undefined {
  if (u.kind !== "tracking") return undefined;
  if (u.freshness.kind === "never") return d.topo.neverFetched;
  return fill(d.topo.fetchedAgo, { time: relativeTime(u.freshness.iso, d) });
}

function Spine({ branch, status, d, p, variant, g }: {
  branch: string;
  status: RepoStatus;
  d: Dict;
  p: Personality;
  variant: Variant;
  g: Glyphs;
}) {
  const u = status.upstream;
  return (
    <div className="topo-spine">
      <div className="topo-pivot" data-testid="topology-pivot">
        <Node kind="you" g={g} /> <span className="topo-branch">{branch}</span>
      </div>
      {status.reference && <Rail kind="reference" label={status.reference.ref} rel={status.reference.rel} verdict={railVerdict(p, d, status.reference.rel, "reference", status.reference.ref, false)} aging={false} g={g} d={d} />}
      {u?.kind === "tracking" && <Rail kind="upstream" label={u.ref} rel={u.rel} verdict={railVerdict(p, d, u.rel, "upstream", u.ref, status.aging)} aging={status.aging} fresh={upstreamFresh(u, d)} g={g} d={d} />}
      {u?.kind === "none" && <div className="topo-rail topo-rail-note">{tone(p, variant === "row" ? d.topo.noUpstreamShort : d.topo.noUpstream)}</div>}
      {u?.kind === "unavailable" && <div className="topo-rail topo-rail-note topo-rail-unavailable">{g.ref} {u.ref} · {tone(p, d.topo.trackingUnavailable)}</div>}
    </div>
  );
}

export function Topology({ status, conflicted, currentBranch, d, p, variant }: Props) {
  const g = glyphs(p);
  const cls = `topo topo-${variant}`;
  const branch = currentBranch ?? d.card.noBranch;

  if (status.headline === "unavailable") return <div className={`${cls} topo-bad`}>{g.unavailable} {d.topo.folderNotFound}</div>;
  if (status.headline === "loading") return <div className={`${cls} topo-dim`}>{d.common.loading}</div>;
  // Conflict is actionable even if the merge was started from detached HEAD.
  if (status.headline === "conflicted") return <div className={`${cls} topo-conflict`} data-testid="topology-conflict">{g.conflict} {fill(d.topo.mergeInProgress, { n: conflicted })} · {branch}</div>;
  if (status.detachedAt) return <div className={`${cls} topo-detached`}><span className="topo-node topo-node-detached">{g.detached}</span>{" "}{fill(d.topo.detachedAt, { hash: status.detachedAt })} · {d.topo.notOnBranch}</div>;

  return <div className={cls} data-testid="topology-attached"><Spine branch={branch} status={status} d={d} p={p} variant={variant} g={g} /></div>;
}
