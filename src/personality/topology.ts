// Presentation-only helpers for the semantic Git topology. These format an
// already-derived `RepoStatus` (see ../fleet.ts) into glyphs and short phrases.
// No Git facts are computed here; personality only chooses symbols and tone.

import type { Dict } from "../i18n/en";
import { fill } from "../i18n";
import type { HeadlineKey, Relation } from "../fleet";
import type { Personality } from "../types";

export type Glyphs = {
  you: string;
  ref: string;
  fork: string;
  detached: string;
  unavailable: string;
  synced: string;
  dirty: string;
  conflict: string;
  ahead: string;
  behind: string;
};

const GLYPHS: Record<Personality, Glyphs> = {
  technical: {
    you: "◉", ref: "●", fork: "○", detached: "◌", unavailable: "⨯",
    synced: "✓", dirty: "✎", conflict: "⚠", ahead: "↑", behind: "↓",
  },
  cute: {
    you: "◍", ref: "●", fork: "○", detached: "◌", unavailable: "✕",
    synced: "✓", dirty: "✎", conflict: "✷", ahead: "↑", behind: "↓",
  },
  scifi: {
    you: "◉", ref: "●", fork: "◇", detached: "◌", unavailable: "✕",
    synced: "=", dirty: "~", conflict: "!", ahead: "+", behind: "−",
  },
  jarbas: {
    you: "◆", ref: "•", fork: "◦", detached: "◦", unavailable: "—",
    synced: "✓", dirty: "·", conflict: "!", ahead: "↑", behind: "↓",
  },
};

export function glyphs(p: Personality): Glyphs {
  return GLYPHS[p];
}

/** Sci-Fi speaks in uppercase status codes; the others keep sentence tone. */
export function tone(p: Personality, s: string): string {
  return p === "scifi" ? s.toUpperCase() : s;
}

export function headlineText(p: Personality, key: HeadlineKey, d: Dict): string {
  return tone(p, d.status[key]);
}

/** Short verdict for one rail: e.g. "↑7 of main", "↑2 to push", "↑3 ↓2 diverged". */
export function railVerdict(
  p: Personality,
  d: Dict,
  rel: Relation,
  kind: "reference" | "upstream",
  ref: string,
  aging: boolean,
): string {
  const g = glyphs(p);
  const q = aging && kind === "upstream" ? "?" : "";
  const suffix =
    kind === "reference"
      ? fill(d.topo.ofReference, { ref })
      : rel.kind === "behind"
        ? tone(p, d.topo.toPull)
        : tone(p, d.topo.toPush);

  switch (rel.kind) {
    case "synced":
      if (p === "cute") return `${g.synced} ${tone(p, d.topo.cuteSynced)}`;
      return `${g.synced} ${tone(p, fill(d.topo.syncedWith, { ref }))}`;
    case "ahead":
      return `${g.ahead}${rel.ahead}${q} ${suffix}`;
    case "behind":
      return `${g.behind}${rel.behind}${q} ${suffix}`;
    case "diverged":
      return `${g.ahead}${rel.ahead}${q} ${g.behind}${rel.behind}${q} ${tone(p, d.topo.diverged)}`;
  }
}

/** Freshness line shown under the upstream rail. `time` is a pre-formatted
 * relative string ("6d ago") or null when never fetched. */
export function freshnessText(d: Dict, time: string | null): string {
  return time ? fill(d.topo.fetchedAgo, { time }) : d.topo.neverFetched;
}
