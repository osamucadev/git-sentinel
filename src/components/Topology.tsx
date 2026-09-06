// The semantic Git topology: a small, deterministic diagram derived from an
// already-computed `RepoStatus`. It is NOT a commit graph — it shows where the
// current checkout (YOU) sits relative to its local base branch and its
// upstream, as two aligned rails sharing one pivot node.
//
// Design reference: GIT-SENTINEL-UX-REDESIGN.md sections 5 and 6.

import { fill, relativeTime } from "../i18n";
import type { Dict } from "../i18n/en";
import type { Relation, RepoStatus, UpstreamPosition } from "../fleet";
import type { Personality } from "../types";
import { glyphs, railVerdict, tone, type Glyphs } from "../personality/topology";

type Variant = "row" | "detail";

type Props = {
  status: RepoStatus;
  /** Conflict count etc. — only fields the diagram itself needs. */
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

function Track({ rel, g }: { rel: Relation; g: Glyphs }) {
  switch (rel.kind) {
    case "synced":
      return (
        <span className="topo-track">
          <Node kind="you" g={g} />
        </span>
      );
    case "ahead":
      return (
        <span className="topo-track">
          <Node kind="ref" g={g} />
          <span className="topo-seg" />
          <Node kind="you" g={g} />
        </span>
      );
    case "behind":
      return (
        <span className="topo-track">
          <Node kind="you" g={g} />
          <span className="topo-seg" />
          <Node kind="ref" g={g} />
        </span>
      );
    case "diverged":
      return (
        <span className="topo-track topo-track-diverged">
          <span className="topo-arm">
            <Node kind="fork" g={g} />
            <span className="topo-seg" />
            <Node kind="you" g={g} />
          </span>
          <span className="topo-arm">
            <Node kind="fork" g={g} />
            <span className="topo-seg" />
            <Node kind="ref" g={g} />
          </span>
        </span>
      );
  }
}

function Rail({
  kind,
  label,
  rel,
  verdict,
  aging,
  fresh,
  g,
}: {
  kind: "base" | "upstream";
  label: string;
  rel: Relation;
  verdict: string;
  aging: boolean;
  fresh?: string;
  g: Glyphs;
}) {
  return (
    <div className={`topo-rail topo-rail-${kind}`} data-aging={aging || undefined}>
      <span className="topo-rail-label">{label}</span>
      <Track rel={rel} g={g} />
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

export function Topology({ status, conflicted, currentBranch, d, p, variant }: Props) {
  const g = glyphs(p);
  const cls = `topo topo-${variant}`;

  if (status.headline === "unavailable") {
    return <div className={`${cls} topo-bad`}>{g.unavailable} {d.topo.folderNotFound}</div>;
  }
  if (status.headline === "loading") {
    return <div className={`${cls} topo-dim`}>{d.common.loading}</div>;
  }
  if (status.detachedAt) {
    return (
      <div className={`${cls} topo-detached`}>
        <span className="topo-node topo-node-detached">{g.detached}</span>{" "}
        {fill(d.topo.detachedAt, { hash: status.detachedAt })} · {d.topo.notOnBranch}
      </div>
    );
  }
  if (status.headline === "conflicted") {
    return (
      <div className={`${cls} topo-conflict`}>
        {g.conflict} {fill(d.topo.mergeInProgress, { n: conflicted })}
      </div>
    );
  }

  const branch = currentBranch ?? d.card.noBranch;
  const u = status.upstream;

  return (
    <div className={cls}>
      {status.local && (
        <Rail
          kind="base"
          label={status.local.ref}
          rel={status.local.rel}
          verdict={railVerdict(p, d, status.local.rel, "base", status.local.ref, false)}
          aging={false}
          g={g}
        />
      )}

      {u?.kind === "tracking" && (
        <Rail
          kind="upstream"
          label={u.ref}
          rel={u.rel}
          verdict={railVerdict(p, d, u.rel, "upstream", u.ref, status.aging)}
          aging={status.aging}
          fresh={upstreamFresh(u, d)}
          g={g}
        />
      )}

      {u?.kind === "none" && (
        <div className="topo-rail topo-rail-note">
          <span className="topo-node topo-node-you">{g.you}</span> {branch} ·{" "}
          {tone(p, variant === "row" ? d.topo.noUpstreamShort : d.topo.noUpstream)}
        </div>
      )}

      {u?.kind === "gone" && (
        <div className="topo-rail topo-rail-note topo-rail-gone">
          {g.ref} {u.ref} · {tone(p, d.topo.upstreamGone)}
        </div>
      )}
    </div>
  );
}
