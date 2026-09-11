import { useEffect, useRef, useState } from "react";
import type { Dict } from "../i18n/en";
import { relativeTime } from "../i18n";
import type { RepoStatus } from "../fleet";
import type { RepoView } from "../state/AppState";
import type { Personality } from "../types";
import * as api from "../api";
import { headlineText } from "../personality/topology";
import { repositoryRowStory } from "../narrative";
import { ReferenceHelp } from "./ReferenceHelp";
import { repositoryBrowserUrl } from "../repositoryUrl";

function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

export function RepoRow({
  repo,
  status,
  d,
  p,
  onOpenDetails,
  onRefresh,
  onFetch,
  onPush,
  onRemove,
  operationsBusy,
}: {
  repo: RepoView;
  status: RepoStatus;
  d: Dict;
  p: Personality;
  onOpenDetails: () => void;
  onRefresh: () => void;
  onFetch: () => void;
  onPush?: () => void;
  onRemove: () => void;
  operationsBusy: boolean;
}) {
  const s = repo.state;
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const story = s ? repositoryRowStory({ state: s, status, lastSuccessfulFetch: repo.lastSuccessfulFetch }, d) : null;
  const browserUrl = repositoryBrowserUrl(s?.remotes ?? []);

  return (
    <div
      className="repo-row"
      data-tier={status.tier}
      role="button"
      tabIndex={0}
      onClick={onOpenDetails}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpenDetails();
      }}
    >
      <div className="rr-identity">
        <div className="rr-name">{s?.name ?? repo.path.split("/").pop()}</div>
        {s?.currentBranch && <div className="rr-branch mono">{s.currentBranch}</div>}
        <div className="rr-path" title={repo.path}>{repo.path}</div>
      </div>

      <div className="rr-story">
        <span className="rr-chip" data-headline={status.headline}>
          {headlineText(p, status.headline, d)}
        </span>
        {story && (
          <>
            <div className="rr-signals" aria-label="Repository state signals">
              {story.signals.map((signal) => (
                <span
                  className="rr-signal"
                  data-dimension={signal.dimension}
                  data-state={signal.state}
                  key={`${signal.dimension}-${signal.label}`}
                >
                  <b aria-hidden="true">{signal.mark}</b>
                  <span>{signal.label}</span>
                  {signal.detail && <small>{signal.detail}</small>}
                  {signal.dimension === "reference" && signal.reference && s?.currentBranch && (
                    <ReferenceHelp branch={s.currentBranch} reference={signal.reference} ahead={signal.ahead ?? 0} behind={signal.behind ?? 0} d={d} />
                  )}
                </span>
              ))}
            </div>
            <p className="rr-story-summary">{story.summary}</p>
            {story.details.length > 0 && (
              <div className="rr-story-detail">
                {story.details.map((detail) => <span key={detail}>{detail}</span>)}
              </div>
            )}
          </>
        )}
        {repo.fetchError && <div className="rr-fetch-error">{d.errors.fetchFailed}: {repo.fetchError}</div>}
      </div>

      <div className="rr-activity">
        {s?.latestCommit && (
          <>
            <span className="rr-hash">{s.latestCommit.hash}</span>
            <span className="rr-subject">{s.latestCommit.subject}</span>
            <span className="rr-time">{relativeTime(s.latestCommit.date, d)}</span>
          </>
        )}
      </div>

      <div className="rr-actions" onClick={stop}>
        {s?.upstream && (
          <button
            className="push-btn"
            title={d.common.push}
            disabled={operationsBusy || repo.pushing || (s.trackingDivergence?.ahead ?? 0) === 0}
            onClick={onPush}
          >
            {repo.pushing ? <span className="spin" /> : d.common.push}
          </button>
        )}
        <button
          className="icon-btn"
          title={d.card.openInTerminal}
          onClick={() => void api.openInTerminal(repo.path)}
        >
          {">_"}
        </button>
        <div className="rr-menu" ref={menuRef}>
          <button className="icon-btn" title={d.common.settings} onClick={() => setMenu((v) => !v)}>
            ⋯
          </button>
          {menu && (
            <div className="menu-pop">
              <button onClick={() => { setMenu(false); void api.openFolder(repo.path); }}>
                {d.card.openFolder}
              </button>
              {browserUrl && (
                <button onClick={() => { setMenu(false); void api.openExternalUrl(browserUrl); }}>
                  {d.card.openInBrowser}
                </button>
              )}
              <button
                disabled={repo.fetching || operationsBusy}
                onClick={() => { setMenu(false); onFetch(); }}
              >
                {d.common.fetch}
              </button>
              <button
                disabled={repo.loading || operationsBusy}
                onClick={() => { setMenu(false); onRefresh(); }}
              >
                {d.common.refresh}
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  void navigator.clipboard?.writeText(repo.path).catch(() => {});
                }}
              >
                {d.details2.copyPath}
              </button>
              <div className="menu-sep" />
              <button className="danger" onClick={() => { setMenu(false); onRemove(); }}>
                {d.card.removeFromSentinel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
