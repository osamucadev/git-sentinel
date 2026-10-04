import { describe, expect, it } from "vitest";
import { en } from "./i18n/en";
import { es } from "./i18n/es";
import { ptBR } from "./i18n/pt-BR";
import { deriveInsights, insightPath, insightText, MAX_BEHIND_INSIGHTS, type Insight, type InsightRepo } from "./insights";
import type { RepositoryState, StashEntry } from "./types";

const NOW = Date.parse("2026-06-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

function state(over: Partial<RepositoryState> = {}): RepositoryState {
  return {
    path: "/repo", name: "repo", currentBranch: "main", detachedHead: false,
    workingTree: { clean: true, staged: 0, modified: 0, deleted: 0, untracked: 0, conflicted: 0 },
    latestCommit: { hash: "abc1234", subject: "init", date: daysAgo(1) },
    localBranches: { count: 1, names: ["main"], baseBranch: null },
    localDivergence: null,
    referenceBranch: "origin/main", referenceBranches: ["origin/main"], referenceDivergence: null,
    remotes: [{ name: "origin" }], upstream: "origin/main",
    trackingDivergence: { ahead: 0, behind: 0, baseBranch: "origin/main" },
    stashes: [],
    ...over,
  };
}

function repo(name: string, over: Partial<RepositoryState> = {}, meta: Partial<InsightRepo> = {}): InsightRepo {
  return { path: `/repos/${name}`, loading: false, lastSuccessfulFetch: daysAgo(0), state: state({ path: `/repos/${name}`, name, ...over }), ...meta };
}

function stash(date: string): StashEntry {
  return { index: 0, reference: "stash@{0}", hash: "a".repeat(40), message: "On main: wip", branchHint: "main", date };
}

const kinds = (list: Insight[]) => list.map((i) => i.kind);

describe("deriveInsights", () => {
  it("yields nothing for an empty fleet", () => {
    expect(deriveInsights([], NOW)).toEqual([]);
  });

  it("a quiet, fully synchronized fleet still gets context and statistics, never alerts", () => {
    const list = deriveInsights([repo("a"), repo("b", { latestCommit: { hash: "h", subject: "s", date: daysAgo(40) } })], NOW);
    expect(kinds(list)).toEqual(["latestCommit", "quietestRepo", "fleet"]);
  });

  it("orders actionable facts first, then context, then statistics", () => {
    const list = deriveInsights([
      repo("broken", {}, { state: undefined, error: "not found" }),
      repo("late", { trackingDivergence: { ahead: 0, behind: 3, baseBranch: "origin/main" } }),
      repo("eager", { trackingDivergence: { ahead: 2, behind: 0, baseBranch: "origin/main" } }),
      repo("new", {}, { lastSuccessfulFetch: undefined }),
      repo("old", {}, { lastSuccessfulFetch: daysAgo(9) }),
      repo("dirty", { workingTree: { clean: false, staged: 1, modified: 2, deleted: 0, untracked: 0, conflicted: 0 } }),
      repo("stashed", { stashes: [stash(daysAgo(5))] }),
    ], NOW);
    expect(kinds(list)).toEqual([
      "unavailable", "behind", "pushPending", "neverFetched", "oldestFetch", "localChanges",
      "stashes", "latestCommit", "quietestRepo", "fleet",
    ]);
  });

  it("names the single repository involved, so the insight can open it", () => {
    const [push] = deriveInsights([repo("eager", { trackingDivergence: { ahead: 2, behind: 0, baseBranch: "origin/main" } })], NOW);
    expect(push).toMatchObject({ kind: "pushPending", commits: 2, repos: 1, path: "/repos/eager", name: "eager" });
    expect(insightText(push, en)).toBe("2 commit(s) waiting to be pushed in eager");
  });

  it("aggregates across repositories without naming one", () => {
    const list = deriveInsights([
      repo("a", { trackingDivergence: { ahead: 2, behind: 0, baseBranch: "origin/main" } }),
      repo("b", { trackingDivergence: { ahead: 3, behind: 0, baseBranch: "origin/main" } }),
    ], NOW);
    const push = list.find((i) => i.kind === "pushPending")!;
    expect(push).toMatchObject({ commits: 5, repos: 2 });
    expect(insightPath(push)).toBeUndefined();
    expect(insightText(push, en)).toBe("5 commits waiting to be pushed across 2 repositories");
  });

  it("shows the largest behind-upstream gaps first, capped", () => {
    const list = deriveInsights(
      [1, 7, 3, 5, 2].map((behind, i) => repo(`r${i}`, { trackingDivergence: { ahead: 0, behind, baseBranch: "origin/main" } })),
      NOW,
    );
    const behind = list.filter((i) => i.kind === "behind");
    expect(behind).toHaveLength(MAX_BEHIND_INSIGHTS);
    expect(behind.map((i) => (i.kind === "behind" ? i.n : 0))).toEqual([7, 5, 3]);
    expect(insightText(behind[0], en)).toBe("r1 is 7 commit(s) behind origin/main");
  });

  it("ignores upstream facts for repositories without an upstream", () => {
    const list = deriveInsights([repo("local", { upstream: null, trackingDivergence: null }, { lastSuccessfulFetch: undefined })], NOW);
    expect(kinds(list)).not.toContain("neverFetched");
    expect(kinds(list)).not.toContain("pushPending");
  });

  it("reports the oldest Sentinel fetch only once it is at least a day old", () => {
    expect(kinds(deriveInsights([repo("a", {}, { lastSuccessfulFetch: daysAgo(0.5) })], NOW))).not.toContain("oldestFetch");
    const list = deriveInsights([repo("a", {}, { lastSuccessfulFetch: daysAgo(2) }), repo("b", {}, { lastSuccessfulFetch: daysAgo(9) })], NOW);
    const oldest = list.find((i) => i.kind === "oldestFetch")!;
    expect(oldest).toMatchObject({ name: "b", path: "/repos/b" });
    expect(insightText(oldest, en, new Date(NOW))).toBe("Oldest fetch through Sentinel: b, 9d ago");
  });

  it("counts every kind of uncommitted change, including conflicts", () => {
    const list = deriveInsights([repo("a", { workingTree: { clean: false, staged: 1, modified: 2, deleted: 3, untracked: 4, conflicted: 5 } })], NOW);
    expect(list.find((i) => i.kind === "localChanges")).toMatchObject({ changes: 15, repos: 1, name: "a" });
  });

  it("names where the oldest stash is, across the fleet", () => {
    const list = deriveInsights([
      repo("a", { stashes: [stash(daysAgo(2)), stash(daysAgo(3))] }),
      repo("b", { stashes: [stash(daysAgo(26))] }),
    ], NOW);
    const stashes = list.find((i) => i.kind === "stashes")!;
    expect(stashes).toMatchObject({ count: 3, repos: 2, name: "b", path: "/repos/b" });
    expect(insightText(stashes, en, new Date(NOW))).toBe("3 stashes across 2 repositories; the oldest is in b, 26d ago");
  });

  it("never claims authorship: the latest commit is described per repository, not as yours", () => {
    const list = deriveInsights([repo("a"), repo("b", { latestCommit: { hash: "h", subject: "s", date: daysAgo(47) } })], NOW);
    const latest = list.find((i) => i.kind === "latestCommit")!;
    const quietest = list.find((i) => i.kind === "quietestRepo")!;
    expect(latest).toMatchObject({ name: "a" });
    expect(quietest).toMatchObject({ name: "b" });
    for (const d of [en, ptBR, es]) {
      expect(insightText(latest, d, new Date(NOW)).toLowerCase()).not.toMatch(/\byou\b|\bvocê\b|\btú\b|\busted\b/);
    }
    expect(insightText(quietest, en, new Date(NOW))).toBe("Quietest repository: b, last commit 47d ago");
  });

  it("does not offer a quietest repository when there is only one", () => {
    expect(kinds(deriveInsights([repo("a")], NOW))).not.toContain("quietestRepo");
  });

  it("skips loading repositories and reports unavailable ones", () => {
    const list = deriveInsights([repo("loading", {}, { state: undefined, loading: true }), repo("gone", {}, { state: undefined, error: "x" })], NOW);
    expect(kinds(list)).toEqual(["unavailable"]);
  });

  it("fleet statistics sum branches and stashes over every inspected repository", () => {
    const list = deriveInsights([
      repo("a", { localBranches: { count: 4, names: [], baseBranch: null }, stashes: [stash(daysAgo(1))] }),
      repo("b", { localBranches: { count: 2, names: [], baseBranch: null } }),
    ], NOW);
    const fleet = list.find((i) => i.kind === "fleet")!;
    expect(insightText(fleet, en)).toBe("2 repositories · 6 local branches · 1 stash");
  });

  it("uses singular forms and omits zero stashes in fleet statistics", () => {
    const fleet = deriveInsights([repo("solo")], NOW).find((i) => i.kind === "fleet")!;
    expect(insightText(fleet, en)).toBe("1 repository · 1 local branch");
    expect(insightText(fleet, ptBR)).toBe("1 repositório · 1 branch local");
    expect(insightText(fleet, es)).toBe("1 repositorio · 1 rama local");
  });

  it("does not say 'across 1 repositories' when every stash is in the same one", () => {
    const stashes = deriveInsights([repo("a", { stashes: [stash(daysAgo(2)), stash(daysAgo(6))] })], NOW).find((i) => i.kind === "stashes")!;
    expect(insightText(stashes, en, new Date(NOW))).toBe("2 stashes in a; the oldest 6d ago");
  });

  it("gives every insight a stable id, unique within the list", () => {
    const list = deriveInsights([
      repo("a", { trackingDivergence: { ahead: 1, behind: 2, baseBranch: "origin/main" } }),
      repo("b", { trackingDivergence: { ahead: 0, behind: 4, baseBranch: "origin/main" } }),
    ], NOW);
    const ids = list.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(deriveInsights([repo("a", { trackingDivergence: { ahead: 1, behind: 2, baseBranch: "origin/main" } }), repo("b", { trackingDivergence: { ahead: 0, behind: 4, baseBranch: "origin/main" } })], NOW + 60_000).map((i) => i.id)).toEqual(ids);
  });

  it("renders every insight kind in English, Portuguese and Spanish without leftover placeholders", () => {
    const list = deriveInsights([
      repo("broken", {}, { state: undefined, error: "x" }),
      repo("late", { trackingDivergence: { ahead: 1, behind: 3, baseBranch: "origin/main" } }),
      repo("new", {}, { lastSuccessfulFetch: undefined }),
      repo("old", { workingTree: { clean: false, staged: 1, modified: 0, deleted: 0, untracked: 0, conflicted: 0 }, stashes: [stash(daysAgo(4))] }, { lastSuccessfulFetch: daysAgo(9) }),
    ], NOW);
    expect(new Set(kinds(list)).size).toBe(10);
    for (const d of [en, ptBR, es]) {
      for (const insight of list) {
        const text = insightText(insight, d, new Date(NOW));
        expect(text).not.toMatch(/[{}]/);
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });
});
