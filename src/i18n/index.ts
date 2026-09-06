import { en, type Dict } from "./en";
import { ptBR } from "./pt-BR";
import { es } from "./es";
import type { Language } from "../types";

const DICTS: Record<Language, Dict> = {
  en,
  "pt-BR": ptBR,
  es,
};

export const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: "en", label: "English" },
  { id: "pt-BR", label: "Português (Brasil)" },
  { id: "es", label: "Español" },
];

export function dict(language: Language): Dict {
  return DICTS[language] ?? en;
}

/** Replaces {placeholders} in a template with values. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

type Part = "morning" | "afternoon" | "evening";

/** Local-time greeting word. Deterministic; no AI. */
export function greetingPart(now: Date): Part {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

/** Short relative time, e.g. "2h ago". */
export function relativeTime(iso: string, d: Dict, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.round((now.getTime() - then) / 60000);
  if (diffMin < 1) return d.time.justNow;
  if (diffMin < 60) return fill(d.time.minutesAgo, { n: diffMin });
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return fill(d.time.hoursAgo, { n: diffHour });
  return fill(d.time.daysAgo, { n: Math.round(diffHour / 24) });
}
