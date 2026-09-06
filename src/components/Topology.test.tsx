import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { deriveStatus, type FleetInput } from "../fleet";
import type { RepositoryState } from "../types";
import { Topology } from "./Topology";

function state(over: Partial<RepositoryState> = {}): RepositoryState {
  return {
    path: "/repo",
    name: "repo",
    currentBranch: "feature/checkout-label",
    detachedHead: false,
    workingTree: { clean: true, staged: 0, modified: 0, deleted: 0, untracked: 0, conflicted: 0 },
    latestCommit: { hash: "abc1234", subject: "init", date: "2026-01-01T00:00:00Z" },
    localBranches: { count: 2, names: ["main", "feature/checkout-label"], baseBranch: "main" },
    localDivergence: { ahead: 2, behind: 0, baseBranch: "main" },
    remotes: [{ name: "origin" }],
    upstream: "origin/feature/checkout-label",
    trackingDivergence: { ahead: 1, behind: 0, baseBranch: "origin/feature/checkout-label" },
    ...over,
  };
}

function render(input: FleetInput, conflicted = 0, variant: "row" | "detail" = "detail"): string {
  const repo = input.state!;
  return renderToStaticMarkup(
    <Topology
      status={deriveStatus(input, Date.parse("2026-06-01T12:00:00Z"))}
      conflicted={conflicted}
      currentBranch={repo.currentBranch}
      d={en}
      p="technical"
      variant={variant}
    />,
  );
}

describe("Topology", () => {
  it("shows the attached branch once at the shared HEAD pivot with local and tracking rails", () => {
    const html = render({ loading: false, state: state() });
    expect(html).toContain("feature/checkout-label");
    expect(html.match(/data-testid="topology-pivot"/g)).toHaveLength(1);
    expect(html).toContain("main");
    expect(html).toContain("origin/feature/checkout-label");
    expect(render({ loading: false, state: state() }, 0, "row")).toContain("feature/checkout-label");
  });

  it("keeps the branch visible for each attached relationship", () => {
    const cases = [
      state({ localDivergence: null, localBranches: { count: 1, names: ["feature/checkout-label"], baseBranch: null }, trackingDivergence: { ahead: 0, behind: 0, baseBranch: "origin/feature/checkout-label" } }),
      state({ trackingDivergence: { ahead: 0, behind: 2, baseBranch: "origin/feature/checkout-label" } }),
      state({ upstream: null, trackingDivergence: null }),
      state({ upstream: "origin/feature/checkout-label", trackingDivergence: null }),
    ];
    for (const repo of cases) {
      const html = render({ loading: false, state: repo });
      expect(html).toContain("feature/checkout-label");
      expect(html.match(/data-testid="topology-pivot"/g)).toHaveLength(1);
    }
  });

  it("uses one fork representation for a diverged rail", () => {
    const html = render({
      loading: false,
      state: state({ trackingDivergence: { ahead: 2, behind: 3, baseBranch: "origin/feature/checkout-label" } }),
    });
    expect(html.match(/data-testid="diverged-track"/g)).toHaveLength(1);
    expect(html.match(/topo-node-fork/g)).toHaveLength(1);
  });

  it("renders a conflict instead of detached topology when both facts exist", () => {
    const repo = state({
      currentBranch: null,
      detachedHead: true,
      workingTree: { clean: false, staged: 0, modified: 0, deleted: 0, untracked: 0, conflicted: 2 },
    });
    const html = render({ loading: false, state: repo }, 2);
    expect(html).toContain('data-testid="topology-conflict"');
    expect(html).not.toContain("detached at");
  });
});
