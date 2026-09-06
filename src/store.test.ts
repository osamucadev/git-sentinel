import { describe, expect, it } from "vitest";
import { serializeRepos } from "./store";

describe("repository persistence", () => {
  it("keeps the selected reference branch with Sentinel metadata", () => {
    expect(serializeRepos([{ path: "/repo", referenceBranch: "origin/homolog" }])).toEqual([
      { path: "/repo", lastSuccessfulFetch: undefined, referenceBranch: "origin/homolog" },
    ]);
  });
});
