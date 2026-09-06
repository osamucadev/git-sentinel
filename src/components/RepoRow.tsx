import { useEffect, useRef, useState } from "react";
import type { Dict } from "../i18n/en";
import { relativeTime } from "../i18n";
import type { RepoStatus } from "../fleet";
import type { RepoView } from "../state/AppState";
import type { Personality } from "../types";
import * as api from "../api";
import { Topology } from "./Topology";
import { headlineText } from "../personality/topology";

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

  const wt = s?.workingTree;
  const showCounts = wt && !wt.clean;

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
        <div className="rr-path" title={repo.path}>{repo.path}</div>
      </div>

      <div className="rr-state">
        <span className="rr-chip" data-headline={status.headline}>
          {headlineText(p, status.headline, d)}
        </span>
        {showCounts && (
          <div className="rr-counts">
            {wt.conflicted > 0 && <span className="rr-conflict"><b>{wt.conflicted}</b> {d.card.conflicts}</span>}
            {wt.staged > 0 && <span><b>{wt.staged}</b> {d.card.staged}</span>}
            {wt.modified > 0 && <span><b>{wt.modified}</b> {d.card.modified}</span>}
            {wt.deleted > 0 && <span><b>{wt.deleted}</b> {d.card.deleted}</span>}
            {wt.untracked > 0 && <span><b>{wt.untracked}</b> {d.card.untracked}</span>}
          </div>
        )}
      </div>

      <div className="rr-topo">
        <Topology
          status={status}
          conflicted={wt?.conflicted ?? 0}
          currentBranch={s?.currentBranch ?? null}
          d={d}
          p={p}
          variant="row"
        />
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
