import { describe, expect, it } from "vitest";
import { fill, greetingPart, relativeTime } from "./index";
import { en } from "./en";
import { personaGreeting, personaStatus } from "../personality/copy";

describe("fill", () => {
  it("replaces named placeholders", () => {
    expect(fill("Remove {name}?", { name: "Portfolio" })).toBe("Remove Portfolio?");
  });
  it("leaves unknown placeholders untouched", () => {
    expect(fill("{a} {b}", { a: "x" })).toBe("x {b}");
  });
});

describe("greetingPart", () => {
  it("maps hours to morning/afternoon/evening", () => {
    expect(greetingPart(new Date("2026-01-01T08:00:00"))).toBe("morning");
    expect(greetingPart(new Date("2026-01-01T13:00:00"))).toBe("afternoon");
    expect(greetingPart(new Date("2026-01-01T21:00:00"))).toBe("evening");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("formats minutes and hours", () => {
    expect(relativeTime("2026-01-01T11:30:00Z", en, now)).toBe("30m ago");
    expect(relativeTime("2026-01-01T09:00:00Z", en, now)).toBe("3h ago");
  });
  it("uses 'just now' under a minute", () => {
    expect(relativeTime("2026-01-01T11:59:40Z", en, now)).toBe("just now");
  });
});

describe("persona copy", () => {
  const now = new Date("2026-01-01T13:00:00");
  it("technical greeting is terse and uses the name", () => {
    expect(
      personaGreeting("technical", en, { preferredName: "Samuel", formOfAddress: "", now }),
    ).toBe("Good afternoon, Samuel.");
  });
  it("jarbas prefers the form of address", () => {
    expect(
      personaGreeting("jarbas", en, { preferredName: "Samuel", formOfAddress: "Sir", now }),
    ).toBe("Good afternoon, Sir.");
  });
  it("sci-fi greeting is a fixed banner", () => {
    expect(
      personaGreeting("scifi", en, { preferredName: "Samuel", formOfAddress: "", now }),
    ).toBe("REPOSITORY CONTROL ONLINE");
  });
  it("status always carries the real numbers", () => {
    expect(personaStatus("cute", en, { total: 3, dirty: 2 })).toContain("3");
    expect(personaStatus("cute", en, { total: 3, dirty: 2 })).toContain("2");
  });
});
