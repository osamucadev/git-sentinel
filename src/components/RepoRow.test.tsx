import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { deriveStatus } from "../fleet";
import type { RepoView } from "../state/AppState";
import { RepoRow } from "./RepoRow";

const repo: RepoView = {
  path: "/repos/example", loading: false, fetching: false,
  state: {
    path: "/repos/example", name: "example", currentBranch: "feature/a", detachedHead: false,
    workingTree: { clean: true, staged: 0, modified: 0, deleted: 0, untracked: 0, conflicted: 0 }, latestCommit: null,
    localBranches: { count: 2, names: ["main", "feature/a"], baseBranch: "main" }, localDivergence: null,
    referenceBranch: "origin/main", referenceBranches: ["origin/main"], referenceDivergence: { ahead: 1, behind: 0, baseBranch: "origin/main" },
    remotes: [{ name: "origin" }], upstream: "origin/feature/a", trackingDivergence: { ahead: 0, behind: 0, baseBranch: "origin/feature/a" },
  },
};

describe("RepoRow", () => {
  it("uses semantic signals plus a single interpretation in HQ, not a topology", () => {
    const html = renderToStaticMarkup(<RepoRow repo={repo} status={deriveStatus(repo)} d={en} p="technical" operationsBusy={false} onOpenDetails={() => {}} onRefresh={() => {}} onFetch={() => {}} onRemove={() => {}} />);
    expect(html).toContain("rr-signals");
    expect(html).toContain("Local clean");
    expect(html).toContain("upstream");
    expect(html).toContain("Synced with upstream, but differs from reference origin/main.");
    expect(html).not.toContain("topo-");
  });
});
