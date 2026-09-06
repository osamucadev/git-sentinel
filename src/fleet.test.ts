import { describe, expect, it } from "vitest";
import {
  AGING_MS,
  deriveStatus,
  filterCount,
  matchesFilter,
  summarize,
  type FleetInput,
} from "./fleet";
import type { RepositoryState } from "./types";

function state(over: Partial<RepositoryState> = {}): RepositoryState {
  return {
    path: "/repo",
    name: "repo",
    currentBranch: "main",
    detachedHead: false,
    workingTree: { clean: true, staged: 0, modified: 0, deleted: 0, untracked: 0, conflicted: 0 },
    latestCommit: { hash: "abc1234", subject: "init", date: "2026-01-01T00:00:00Z" },
    localBranches: { count: 1, names: ["main"], baseBranch: null },
    localDivergence: null,
    remotes: [{ name: "origin", url: "git@x:/r.git" }],
    upstream: "origin/main",
    trackingDivergence: { ahead: 0, behind: 0, baseBranch: "origin/main" },
    ...over,
  };
}

function input(over: Partial<FleetInput> = {}): FleetInput {
  return { loading: false, state: state(), ...over };
}

const NOW = Date.parse("2026-06-01T12:00:00Z");
const RECENT = new Date(NOW - 5 * 60_000).toISOString();

describe("deriveStatus — tier", () => {
  it("clean synced trunk is healthy", () => {
    const st = deriveStatus(input(), NOW);
    expect(st.tier).toBe("healthy");
    expect(st.headline).toBe("synced");
    expect(st.upstream).toEqual({
      kind: "tracking",
      ref: "origin/main",
      rel: { kind: "synced" },
      freshness: { kind: "never" },
    });
  });

  it("inspect error is blocked + unavailable", () => {
    const st = deriveStatus({ loading: false, error: "gone" }, NOW);
    expect(st.tier).toBe("blocked");
    expect(st.headline).toBe("unavailable");
    expect(st.facts).toContain("unavailable");
  });

  it("no state yet is a non-blocking loading placeholder", () => {
    const st = deriveStatus({ loading: true }, NOW);
    expect(st.headline).toBe("loading");
    expect(st.group).toBe("healthy");
  });

  it("conflicts dominate — blocked even if also ahead", () => {
    const st = deriveStatus(
      input({
        state: state({
          workingTree: { clean: false, staged: 0, modified: 0, deleted: 0, untracked: 0, conflicted: 2 },
          trackingDivergence: { ahead: 3, behind: 0, baseBranch: "origin/main" },
        }),
      }),
      NOW,
    );
    expect(st.tier).toBe("blocked");
    expect(st.headline).toBe("conflicted");
  });

  it("dirty working tree is attention", () => {
    const st = deriveStatus(
      input({
        state: state({
          workingTree: { clean: false, staged: 0, modified: 4, deleted: 0, untracked: 1, conflicted: 0 },
        }),
      }),
      NOW,
    );
    expect(st.tier).toBe("attention");
    expect(st.headline).toBe("dirty");
    expect(st.facts).toContain("dirty");
  });

  it("behind upstream is attention; diverged is attention", () => {
    const behind = deriveStatus(
      input({ state: state({ trackingDivergence: { ahead: 0, behind: 3, baseBranch: "origin/main" } }) }),
      NOW,
    );
    expect(behind.tier).toBe("attention");
    expect(behind.headline).toBe("behind");

    const diverged = deriveStatus(
      input({ state: state({ trackingDivergence: { ahead: 2, behind: 3, baseBranch: "origin/main" } }) }),
      NOW,
    );
    expect(diverged.tier).toBe("attention");
    expect(diverged.headline).toBe("diverged");
    expect(diverged.upstream).toMatchObject({ rel: { kind: "diverged", ahead: 2, behind: 3 } });
  });

  it("ahead of upstream (clean) is the ahead tier", () => {
    const st = deriveStatus(
      input({ state: state({ trackingDivergence: { ahead: 4, behind: 0, baseBranch: "origin/main" } }) }),
      NOW,
    );
    expect(st.tier).toBe("ahead");
    expect(st.headline).toBe("aheadPush");
  });

  it("feature branch ahead of local base, no upstream", () => {
    const st = deriveStatus(
      input({
        state: state({
          currentBranch: "feature/x",
          upstream: null,
          trackingDivergence: null,
          localBranches: { count: 2, names: ["main", "feature/x"], baseBranch: "main" },
          localDivergence: { ahead: 7, behind: 0, baseBranch: "main" },
        }),
      }),
      NOW,
    );
    expect(st.tier).toBe("ahead");
    expect(st.headline).toBe("aheadBase");
    expect(st.local).toEqual({ ref: "main", rel: { kind: "ahead", ahead: 7 } });
    expect(st.upstream).toEqual({ kind: "none" });
  });

  it("detached HEAD is attention and carries the hash", () => {
    const st = deriveStatus(
      input({ state: state({ detachedHead: true, currentBranch: null }) }),
      NOW,
    );
    expect(st.tier).toBe("attention");
    expect(st.headline).toBe("detached");
    expect(st.detachedAt).toBe("abc1234");
  });

  it("detached + dirty escalates to blocked", () => {
    const st = deriveStatus(
      input({
        state: state({
          detachedHead: true,
          currentBranch: null,
          workingTree: { clean: false, staged: 1, modified: 0, deleted: 0, untracked: 0, conflicted: 0 },
        }),
      }),
      NOW,
    );
    expect(st.tier).toBe("blocked");
  });

  it("configured upstream with no tracking divergence is 'gone'", () => {
    const st = deriveStatus(
      input({ state: state({ upstream: "origin/feature/x", trackingDivergence: null }) }),
      NOW,
    );
    expect(st.upstream).toEqual({ kind: "gone", ref: "origin/feature/x" });
    expect(st.tier).toBe("attention");
    expect(st.headline).toBe("upstreamGone");
  });
});

describe("deriveStatus — freshness is context, never a tier input", () => {
  it("an old fetch on an otherwise healthy repo stays healthy", () => {
    const old = new Date(NOW - AGING_MS - 60_000).toISOString();
    const st = deriveStatus(input({ lastSuccessfulFetch: old }), NOW);
    expect(st.tier).toBe("healthy");
    expect(st.aging).toBe(true);
    expect(st.facts).toContain("aging");
    expect(st.upstream).toMatchObject({ freshness: { aging: true } });
  });

  it("never fetched stays healthy but is flagged", () => {
    const st = deriveStatus(input({ lastSuccessfulFetch: undefined }), NOW);
    expect(st.tier).toBe("healthy");
    expect(st.aging).toBe(true);
    expect(st.facts).toContain("never-fetched");
  });

  it("a recent fetch is not aging", () => {
    const recent = new Date(NOW - 5 * 60_000).toISOString();
    const st = deriveStatus(input({ lastSuccessfulFetch: recent }), NOW);
    expect(st.aging).toBe(false);
    expect(st.upstream).toMatchObject({ freshness: { kind: "fetched", aging: false } });
  });
});

describe("summarize", () => {
  it("counts tiers and facts without double-driving attention from staleness", () => {
    const statuses = [
      deriveStatus(input(), NOW), // healthy synced (never fetched -> stale context)
      deriveStatus(
        input({
          lastSuccessfulFetch: RECENT,
          state: state({
            workingTree: { clean: false, staged: 0, modified: 2, deleted: 0, untracked: 0, conflicted: 0 },
          }),
        }),
        NOW,
      ), // modified
      deriveStatus(
        input({
          lastSuccessfulFetch: RECENT,
          state: state({ trackingDivergence: { ahead: 1, behind: 2, baseBranch: "origin/main" } }),
        }),
        NOW,
      ), // diverged
      deriveStatus({ loading: false, error: "x" }, NOW), // unavailable
    ];
    const sum = summarize(statuses);
    expect(sum.total).toBe(4);
    expect(sum.healthy).toBe(1);
    expect(sum.attention).toBe(3); // modified + diverged + unavailable
    expect(sum.modified).toBe(1);
    expect(sum.diverged).toBe(1);
    expect(sum.unavailable).toBe(1);
    expect(sum.stale).toBe(1); // only the healthy never-fetched one
  });
});

describe("matchesFilter / filterCount", () => {
  const healthy = deriveStatus(
    input({ lastSuccessfulFetch: new Date(NOW - 60_000).toISOString() }),
    NOW,
  );
  const modified = deriveStatus(
    input({
      lastSuccessfulFetch: RECENT,
      state: state({
        workingTree: { clean: false, staged: 0, modified: 1, deleted: 0, untracked: 0, conflicted: 0 },
      }),
    }),
    NOW,
  );
  const stale = deriveStatus(input({ lastSuccessfulFetch: undefined }), NOW);

  it("routes repos to the right chips", () => {
    expect(matchesFilter(healthy, "healthy")).toBe(true);
    expect(matchesFilter(modified, "attention")).toBe(true);
    expect(matchesFilter(modified, "modified")).toBe(true);
    expect(matchesFilter(stale, "stale")).toBe(true);
    expect(matchesFilter(stale, "healthy")).toBe(true);
    expect(matchesFilter(healthy, "stale")).toBe(false);
  });

  it("filterCount tallies a set", () => {
    const all = [healthy, modified, stale];
    expect(filterCount(all, "all")).toBe(3);
    expect(filterCount(all, "attention")).toBe(1);
    expect(filterCount(all, "stale")).toBe(1);
  });
});
