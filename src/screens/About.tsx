import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";
import * as api from "../api";
import type { Dict } from "../i18n/en";
import { useDict } from "../state/AppState";

export const PROJECT_URLS = {
  creatorGitHub: "https://github.com/osamucadev",
  website: "https://samuelcaetite.dev",
  email: "mailto:srcaetite@gmail.com",
  source: "https://github.com/osamucadev/git-sentinel",
  changelog: "https://github.com/osamucadev/git-sentinel/blob/main/CHANGELOG.md",
  license: "https://github.com/osamucadev/git-sentinel/blob/main/LICENSE",
} as const;

type AboutContentProps = {
  d: Dict;
  version: string | null;
  onOpenExternal: (url: string) => void;
};

export async function readInstalledVersion(loadVersion: () => Promise<string> = getVersion): Promise<string | null> {
  try {
    return await loadVersion();
  } catch {
    return null;
  }
}

function ExternalLink({ href, children, onOpenExternal }: {
  href: string;
  children: ReactNode;
  onOpenExternal: (url: string) => void;
}) {
  function openInSystemBrowser(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onOpenExternal(href);
  }

  return (
    <a className="external-link" href={href} onClick={openInSystemBrowser}>
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}

/** Shared About information; personalities style this semantic structure via tokens. */
export function AboutContent({ d, version, onOpenExternal }: AboutContentProps) {
  return (
    <div className="content about">
      <header className="about-intro">
        <p className="about-kicker">{d.about.productLabel}</p>
        <div className="about-title-line">
          <h1>Git Sentinel</h1>
          <span className="about-version" data-testid="app-version">v{version ?? d.common.loading}</span>
        </div>
        <p className="about-description">{d.about.description}</p>
      </header>

      <section className="about-section" aria-labelledby="about-created-by">
        <h2 id="about-created-by">{d.about.createdBy}</h2>
        <p className="about-author">Samuel Caetité</p>
        <ExternalLink href={PROJECT_URLS.creatorGitHub} onOpenExternal={onOpenExternal}>@osamucadev</ExternalLink>
        <div className="about-contact-links" aria-label={d.about.contact}>
          <ExternalLink href={PROJECT_URLS.creatorGitHub} onOpenExternal={onOpenExternal}>{d.about.github}</ExternalLink>
          <ExternalLink href={PROJECT_URLS.website} onOpenExternal={onOpenExternal}>{d.about.website}</ExternalLink>
          <ExternalLink href={PROJECT_URLS.email} onOpenExternal={onOpenExternal}>{d.about.email}</ExternalLink>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-project">
        <h2 id="about-project">{d.about.project}</h2>
        <dl className="about-project-links">
          <div>
            <dt>{d.about.sourceCode}</dt>
            <dd><ExternalLink href={PROJECT_URLS.source} onOpenExternal={onOpenExternal}>{d.about.openOnGitHub}</ExternalLink></dd>
          </div>
          <div>
            <dt>{d.about.changelog}</dt>
            <dd><ExternalLink href={PROJECT_URLS.changelog} onOpenExternal={onOpenExternal}>{d.about.viewReleaseHistory}</ExternalLink></dd>
          </div>
          <div>
            <dt>{d.about.license}</dt>
            <dd><ExternalLink href={PROJECT_URLS.license} onOpenExternal={onOpenExternal}>{d.about.viewLicense}</ExternalLink></dd>
          </div>
        </dl>
      </section>

      <section className="about-section about-thanks" aria-labelledby="about-thanks">
        <h2 id="about-thanks">{d.about.specialThanks}</h2>
        <p>{d.about.thanksBody}</p>
        <ul>
          {d.about.thanksTools.map((tool) => <li key={tool}>{tool}</li>)}
        </ul>
      </section>
    </div>
  );
}

export function About() {
  const d = useDict();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void readInstalledVersion().then(setVersion);
  }, []);

  return <AboutContent d={d} version={version} onOpenExternal={(url) => void api.openExternalUrl(url)} />;
}
