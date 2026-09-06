import { describe, expect, it } from "vitest";
import { en } from "./i18n/en";
import { deriveStatus } from "./fleet";
import { repositoryNarrative, repositoryRowNarrative } from "./narrative";
import type { RepositoryState } from "./types";

function state(over: Partial<RepositoryState> = {}): RepositoryState {
  return {
    path: "/repo", name: "repo", currentBranch: "feature/a", detachedHead: false,
    workingTree: { clean: true, staged: 0, modified: 0, deleted: 0, untracked: 0, conflicted: 0 },
    latestCommit: null,
    localBranches: { count: 2, names: ["main", "feature/a"], baseBranch: "main" },
    localDivergence: { ahead: 3, behind: 0, baseBranch: "main" },
    referenceBranch: "origin/homolog", referenceBranches: ["origin/main", "origin/homolog"],
    referenceDivergence: { ahead: 3, behind: 0, baseBranch: "origin/homolog" },
    remotes: [{ name: "origin" }], upstream: "origin/feature/a",
    trackingDivergence: { ahead: 1, behind: 0, baseBranch: "origin/feature/a" },
    ...over,
  };
}

describe("repository narrative", () => {
  it("keeps current, upstream and reference relationships distinct", () => {
    const repo = state();
    const lines = repositoryNarrative({ state: repo, status: deriveStatus({ state: repo, loading: false }) }, en);
    expect(lines).toContain("You are working on feature/a.");
    expect(lines).toContain("Your current branch has 1 commit(s) to push to upstream origin/feature/a.");
    expect(lines).toContain("It is 3 commit(s) ahead of the project reference origin/homolog.");
  });

  it("explains each kind of local work without promoting it to attention", () => {
    const repo = state({
      workingTree: { clean: false, staged: 1, modified: 2, deleted: 3, untracked: 4, conflicted: 0 },
    });
    const status = deriveStatus({ state: repo, loading: false });
    const lines = repositoryNarrative({ state: repo, status }, en);
    expect(status.tier).toBe("working");
    expect(lines.join(" ")).toContain("1 change(s) prepared");
    expect(lines.join(" ")).toContain("2 tracked file(s) changed locally");
    expect(lines.join(" ")).toContain("4 new file(s) not yet tracked by Git");
  });

  it("keeps a clean synchronized repository brief and says when remote refs were checked", () => {
    const repo = state({ currentBranch: "main", referenceBranch: "origin/main", referenceDivergence: null, localDivergence: null, trackingDivergence: { ahead: 0, behind: 0, baseBranch: "origin/main" } });
    const lines = repositoryRowNarrative({ state: repo, status: deriveStatus({ state: repo, loading: false }), lastSuccessfulFetch: "2026-01-01T00:00:00Z" }, en);
    expect(lines).toContain("You are on main, with no local changes.");
    expect(lines).toContain("Synced with origin/feature/a.");
    expect(lines.join(" ")).toContain("Remote refs checked by Sentinel");
  });

  it("turns dirty, staged and untracked facts into one readable local-work sentence", () => {
    const repo = state({ workingTree: { clean: false, staged: 3, modified: 2, deleted: 0, untracked: 4, conflicted: 0 } });
    const lines = repositoryRowNarrative({ state: repo, status: deriveStatus({ state: repo, loading: false }) }, en);
    expect(lines.join(" ")).toContain("9 uncommitted local change(s)");
    expect(lines.join(" ")).toContain("3 prepared for commit");
    expect(lines.join(" ")).toContain("4 new and untracked");
  });

  it("puts conflicts ahead of other working-tree detail", () => {
    const repo = state({ workingTree: { clean: false, staged: 1, modified: 1, deleted: 0, untracked: 0, conflicted: 2 } });
    const lines = repositoryRowNarrative({ state: repo, status: deriveStatus({ state: repo, loading: false }) }, en);
    expect(lines).toContain("2 file(s) are conflicted and need resolution.");
  });

  it("explains ahead, behind and diverged upstream separately", () => {
    const variants = [
      [{ ahead: 2, behind: 0, baseBranch: "origin/feature/a" }, "2 local commit(s) are not yet in origin/feature/a."],
      [{ ahead: 0, behind: 3, baseBranch: "origin/feature/a" }, "3 commit(s) from origin/feature/a are not in your branch yet."],
      [{ ahead: 2, behind: 3, baseBranch: "origin/feature/a" }, "Diverged from origin/feature/a: 2 ahead and 3 behind."],
    ] as const;
    for (const [trackingDivergence, expected] of variants) {
      const repo = state({ trackingDivergence });
      expect(repositoryRowNarrative({ state: repo, status: deriveStatus({ state: repo, loading: false }) }, en)).toContain(expected);
    }
  });

  it("can be synchronized with upstream while diverged from a custom reference", () => {
    const repo = state({
      referenceBranch: "origin/homolog",
      referenceDivergence: { ahead: 10, behind: 245, baseBranch: "origin/homolog" },
      trackingDivergence: { ahead: 0, behind: 0, baseBranch: "origin/feature/a" },
    });
    const lines = repositoryRowNarrative({ state: repo, status: deriveStatus({ state: repo, loading: false }) }, en);
    expect(lines).toContain("Synced with origin/feature/a.");
    expect(lines).toContain("Compared with reference origin/homolog: 10 ahead and 245 behind.");
  });

  it("explains no upstream, unavailable tracking, no remote, and unknown freshness", () => {
    const noUpstream = state({ upstream: null, trackingDivergence: null });
    expect(repositoryRowNarrative({ state: noUpstream, status: deriveStatus({ state: noUpstream, loading: false }) }, en)).toContain("No upstream is configured for this branch.");
    const unavailable = state({ trackingDivergence: null });
    expect(repositoryRowNarrative({ state: unavailable, status: deriveStatus({ state: unavailable, loading: false }) }, en)).toContain("Tracking comparison with origin/feature/a is unavailable.");
    const noRemote = state({ remotes: [], upstream: null, trackingDivergence: null });
    expect(repositoryRowNarrative({ state: noRemote, status: deriveStatus({ state: noRemote, loading: false }) }, en)).toContain("This repository has no remote configured.");
    const fresh = state();
    expect(repositoryRowNarrative({ state: fresh, status: deriveStatus({ state: fresh, loading: false }) }, en)).toContain(en.rowNarrative.freshnessUnknown);
  });
});
