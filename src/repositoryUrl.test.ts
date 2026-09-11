import { describe, expect, it } from "vitest";
import { githubRepositoryUrl, repositoryBrowserUrl } from "./repositoryUrl";

describe("GitHub repository browser URLs", () => {
  it("normalizes supported GitHub SSH and HTTPS remotes", () => {
    expect(githubRepositoryUrl("git@github.com:osamucadev/git-sentinel.git")).toBe("https://github.com/osamucadev/git-sentinel");
    expect(githubRepositoryUrl("ssh://git@github.com/osamucadev/git-sentinel.git")).toBe("https://github.com/osamucadev/git-sentinel");
    expect(githubRepositoryUrl("https://github.com/osamucadev/git-sentinel.git")).toBe("https://github.com/osamucadev/git-sentinel");
  });

  it("does not invent browser URLs for unsupported or local remotes", () => {
    expect(githubRepositoryUrl("/srv/git/sentinel.git")).toBeNull();
    expect(githubRepositoryUrl("git@gitlab.com:team/sentinel.git")).toBeNull();
  });

  it("prefers origin and otherwise finds a supported remote", () => {
    expect(repositoryBrowserUrl([
      { name: "upstream", url: "https://github.com/openai/example.git" },
      { name: "origin", url: "git@github.com:osamucadev/git-sentinel.git" },
    ])).toBe("https://github.com/osamucadev/git-sentinel");
  });
});
