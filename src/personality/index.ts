import type { Personality } from "../types";
import { setPersonalityWindowIcon } from "./windowIcon";

export const PERSONALITIES: Personality[] = ["technical", "cute", "scifi", "jarbas", "retro", "lineart", "pixel", "glass"];

/** Applies a personality's design tokens by setting a root attribute.
 * All visual differences live in themes.css, keyed on [data-personality]. */
export function applyPersonality(personality: Personality): void {
  document.documentElement.dataset.personality = personality;
  void setPersonalityWindowIcon(personality);
}
