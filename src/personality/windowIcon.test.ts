import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WINDOW_ICON_ASSET,
  WINDOW_ICON_ASSET,
  setPersonalityWindowIcon,
} from "./windowIcon";

describe("personality window icons", () => {
  it("maps every personality to a distinct runtime asset", () => {
    expect(Object.keys(WINDOW_ICON_ASSET)).toHaveLength(8);
    expect(new Set(Object.values(WINDOW_ICON_ASSET)).size).toBe(8);
    expect(DEFAULT_WINDOW_ICON_ASSET).toContain("default");
  });

  it("falls back to the neutral icon when a personality icon cannot load", async () => {
    const setIcon = vi.fn(async () => {});
    const load = vi.fn(async (asset: string) => {
      if (asset === WINDOW_ICON_ASSET.scifi) throw new Error("missing");
      return new Uint8Array([1, 2, 3]);
    });

    await expect(setPersonalityWindowIcon("scifi", setIcon, load)).resolves.toBe("fallback");
    expect(load).toHaveBeenLastCalledWith(DEFAULT_WINDOW_ICON_ASSET);
    expect(setIcon).toHaveBeenCalledTimes(1);
  });

  it("reports an unavailable runtime only after both variant and fallback fail", async () => {
    const setIcon = vi.fn(async () => { throw new Error("unsupported"); });
    const load = vi.fn(async () => new Uint8Array([1]));

    await expect(setPersonalityWindowIcon("cute", setIcon, load)).resolves.toBe("unavailable");
    expect(setIcon).toHaveBeenCalledTimes(2);
  });
});
