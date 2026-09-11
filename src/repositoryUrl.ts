/**
 * Converts a GitHub remote into the canonical repository page URL. This is
 * deliberately host-specific: a browser action must not guess how a local or
 * unsupported remote maps to a web page.
 *
 * Future provider support belongs here: GitLab, Bitbucket and Azure DevOps
 * have different remote URL layouts and should receive explicit parsers.
 */
export function githubRepositoryUrl(remoteUrl?: string): string | null {
  if (!remoteUrl) return null;
  const remote = remoteUrl.trim();
  const match = remote.match(
    /^(?:git@github\.com:|ssh:\/\/git@github\.com(?:\:\d+)?\/|https?:\/\/github\.com\/|git:\/\/github\.com\/)([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i,
  );
  if (!match) return null;
  const [, owner, repository] = match;
  if (!owner || !repository) return null;
  return `https://github.com/${owner}/${repository}`;
}

/** Prefers origin, then any supported remote, without inferring a URL. */
export function repositoryBrowserUrl(remotes: Array<{ name: string; url?: string }>): string | null {
  const ordered = [...remotes].sort((a, b) => Number(b.name === "origin") - Number(a.name === "origin"));
  return ordered.map((remote) => githubRepositoryUrl(remote.url)).find((url): url is string => Boolean(url)) ?? null;
}
