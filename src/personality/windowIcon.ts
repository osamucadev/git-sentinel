import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Personality } from "../types";

import defaultIcon from "../assets/window-icons/default/256x256.png";
import technicalIcon from "../assets/window-icons/technical/256x256.png";
import cuteIcon from "../assets/window-icons/cute/256x256.png";
import scifiIcon from "../assets/window-icons/scifi/256x256.png";
import jarbasIcon from "../assets/window-icons/jarbas/256x256.png";
import retroIcon from "../assets/window-icons/retro/256x256.png";
import lineArtIcon from "../assets/window-icons/line-art/256x256.png";
import pixelArtIcon from "../assets/window-icons/pixel-art/256x256.png";
import modernGlassIcon from "../assets/window-icons/modern-glass/256x256.png";

/** Runtime-only assets. The neutral icon configured in tauri.conf.json remains
 * the launcher, package, AppImage and .desktop icon. */
export const WINDOW_ICON_ASSET: Record<Personality, string> = {
  technical: technicalIcon,
  cute: cuteIcon,
  scifi: scifiIcon,
  jarbas: jarbasIcon,
  retro: retroIcon,
  lineart: lineArtIcon,
  pixel: pixelArtIcon,
  glass: modernGlassIcon,
};

export const DEFAULT_WINDOW_ICON_ASSET = defaultIcon;

type IconSetter = (icon: Uint8Array) => Promise<void>;
type IconLoader = (asset: string) => Promise<Uint8Array>;

async function loadIcon(asset: string): Promise<Uint8Array> {
  const response = await fetch(asset);
  if (!response.ok) throw new Error(`Unable to load window icon: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function inTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Uses Tauri's Window.setIcon API as a best-effort presentation enhancement.
 * Some Linux desktop shells keep the packaged icon in their launcher or task
 * switcher, so errors and unsupported runtimes deliberately stay silent.
 */
export async function setPersonalityWindowIcon(
  personality: Personality,
  setIcon?: IconSetter,
  load: IconLoader = loadIcon,
): Promise<"applied" | "fallback" | "unavailable"> {
  if (!setIcon && !inTauriRuntime()) return "unavailable";
  const apply = setIcon ?? ((icon: Uint8Array) => getCurrentWindow().setIcon(icon));
  const asset = WINDOW_ICON_ASSET[personality] ?? DEFAULT_WINDOW_ICON_ASSET;

  try {
    await apply(await load(asset));
    return "applied";
  } catch {
    try {
      await apply(await load(DEFAULT_WINDOW_ICON_ASSET));
      return "fallback";
    } catch {
      return "unavailable";
    }
  }
}
