// Personality-flavored copy. Every string here is still translated (it takes
// the active dictionary); personality only chooses tone and wording.
// Git facts are never produced here — they come from RepositoryState.

import type { Dict } from "../i18n/en";
import { fill, greetingPart } from "../i18n";
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
      return name ? `${word}, ${name}! ✨` : `${word}! ✨`;
    case "scifi":
      return "REPOSITORY CONTROL ONLINE";
    case "jarbas": {
      const who = address || name;
      return who ? `${word}, ${who}.` : `${word}.`;
    }
  }
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
  }
}
