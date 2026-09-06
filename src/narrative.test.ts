import { describe, expect, it } from "vitest";
import { en } from "./i18n/en";
import { deriveStatus } from "./fleet";
import { repositoryNarrative } from "./narrative";
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
});
