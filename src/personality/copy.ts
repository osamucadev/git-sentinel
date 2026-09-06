// Personality-flavored copy. Every string here is still translated (it takes
// the active dictionary); personality only chooses tone and wording.
// Git facts are never produced here — they come from RepositoryState.

import type { Dict } from "../i18n/en";
import { fill, greetingPart } from "../i18n";
import type { FleetSummary, HeadlineKey } from "../fleet";
import type { Personality } from "../types";

export type GreetingOpts = {
  preferredName: string;
  formOfAddress: string;
  now: Date;
};

export type StatusOpts = {
  total: number;
  dirty: number;
};

function greetWord(d: Dict, now: Date): string {
  return d.greeting[greetingPart(now)];
}

/** The salutation line shown at the top of the HQ. */
export function personaGreeting(p: Personality, d: Dict, o: GreetingOpts): string {
  const word = greetWord(d, o.now);
  const name = o.preferredName.trim();
  const address = o.formOfAddress.trim();

  switch (p) {
    case "technical":
      return name ? `${word}, ${name}.` : `${word}.`;
    case "cute":
      return name ? `${word}, ${name}-san! ✨` : `${word}, senpai! ✨`;
    case "scifi":
      return "REPOSITORY CONTROL ONLINE";
    case "jarbas": {
      const who = address || name;
      return who ? `${word}, ${who}.` : `${word}.`;
    }
    case "retro":
    case "lineart":
    case "pixel":
    case "glass":
      return name ? `${word}, ${name}.` : `${word}.`;
  }
}

export type FleetOpts = {
  summary: FleetSummary;
  /** Up to a handful of the repositories that need attention, most severe first. */
  attentionRepos: Array<{ name: string; headline: HeadlineKey }>;
};

/** The interpretation line(s) at the top of HQ. `line` is always present;
 * `detail` is an optional second sentence some personalities add. */
export function personaFleet(p: Personality, d: Dict, o: FleetOpts): { line: string; detail?: string } {
  const n = o.summary.attention;
  const base =
    n === 0 ? d.hq.allClear : n === 1 ? d.hq.attentionOne : fill(d.hq.attentionMany, { n });

  switch (p) {
    case "technical":
      return { line: base };
    case "cute":
      return {
        line: n === 0 ? `${d.hq.cuteAllClear} だいじょうぶ。` : base,
        detail:
          o.summary.modified > 0
            ? fill(d.hq.modifiedNote, { n: o.summary.modified })
            : undefined,
      };
    case "scifi":
      return { line: base.toUpperCase() };
    case "jarbas": {
      const named = o.attentionRepos.slice(0, 2).map((r) =>
        fill("{name} — {what}", { name: r.name, what: d.status[r.headline].toLowerCase() }),
      );
      return {
        line: n === 0 ? d.hq.jarbasAllClear : base,
        detail: named.length > 0 ? `${named.join(". ")}.` : undefined,
      };
    }
    case "retro":
    case "lineart":
    case "pixel":
    case "glass":
      return { line: n === 0 ? d.hq.allClear : base };
  }
}

/** A compact, factual one-line summary of the whole fleet. */
export function fleetSummaryLine(d: Dict, s: FleetSummary): string {
  const parts: string[] = [`${s.total} ${d.hq.repositories}`];
  if (s.healthy > 0) parts.push(`${s.healthy} ${d.fleetSummary.healthy}`);
  if (s.modified > 0) parts.push(`${s.modified} ${d.fleetSummary.modified}`);
  if (s.diverged > 0) parts.push(`${s.diverged} ${d.fleetSummary.diverged}`);
  if (s.behind > 0) parts.push(`${s.behind} ${d.fleetSummary.behind}`);
  if (s.ahead > 0) parts.push(`${s.ahead} ${d.fleetSummary.ahead}`);
  if (s.unavailable > 0) parts.push(`${s.unavailable} ${d.fleetSummary.unavailable}`);
  if (s.stale > 0) parts.push(`${s.stale} ${d.fleetSummary.neverFetched}`);
  return parts.join(" · ");
}

/** A short, personality-flavored summary of the repository set. Numbers are facts. */
export function personaStatus(p: Personality, d: Dict, o: StatusOpts): string {
  const repos = `${o.total} ${d.hq.repositories}`;
  const dirty = fill("{n} {label}", { n: o.dirty, label: d.card.dirty.toLowerCase() });

  switch (p) {
    case "technical":
      return o.dirty > 0 ? `${repos} · ${dirty}` : repos;
    case "cute":
      return o.dirty > 0
        ? `${repos} · ${dirty} 🧺`
        : `${repos} · ${d.card.clean.toLowerCase()} 🌷`;
    case "scifi":
      return `${repos.toUpperCase()} · ${dirty.toUpperCase()}`;
    case "jarbas":
      return o.dirty > 0
        ? `${repos}, ${dirty}.`
        : `${repos}, ${d.card.clean.toLowerCase()}.`;
    case "retro":
    case "lineart":
    case "pixel":
    case "glass":
      return o.dirty > 0 ? `${repos} · ${dirty}` : repos;
  }
}
