import type { Dict } from "../i18n/en";
import { fill, relativeTime } from "../i18n";
import type { RepoView } from "../state/AppState";
import * as api from "../api";
import type { Divergence } from "../types";

function DivergenceView({ d, div }: { d: Dict; div: Divergence }) {
  return (
    <span>
      <span className="ahead">↑ {div.ahead} {d.card.ahead}</span>{"  "}
      <span className="behind">↓ {div.behind} {d.card.behind}</span>
    </span>
  );
}

export function RepoCard({
  repo,
  d,
  onOpenDetails,
  onRefresh,
  onFetch,
  onRemove,
}: {
  repo: RepoView;
  d: Dict;
  onOpenDetails: () => void;
  onRefresh: () => void;
  onFetch: () => void;
  onRemove: () => void;
}) {
  const s = repo.state;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="repo-name">{s?.name ?? repo.path.split("/").pop()}</div>
          <div className="branch">
            {repo.loading
              ? d.common.loading
              : s?.detachedHead
                ? d.card.detached
                : (s?.currentBranch ?? d.card.noBranch)}
          </div>
        </div>
        {s && !repo.loading && (
          <span
            className={`badge ${
              s.workingTree.conflicted > 0
                ? "conflicted"
                : s.detachedHead
                  ? "detached"
                  : s.workingTree.clean
                    ? "clean"
                    : "dirty"
            }`}
          >
            {s.workingTree.conflicted > 0
              ? d.card.conflicted
              : s.detachedHead
                ? d.card.detached
                : s.workingTree.clean
                  ? d.card.clean
                  : d.card.dirty}
          </span>
        )}
      </div>

      {repo.error && <div className="muted">{d.errors.inspectFailed}</div>}
      {repo.fetchError && (
        <div className="fetch-error">{d.errors.fetchFailed}: {repo.fetchError}</div>
      )}

      {s && !s.workingTree.clean && (
        <div className="counts">
          {s.workingTree.conflicted > 0 && (
            <span className="conflict-count">
              <b>{s.workingTree.conflicted}</b> {d.card.conflicts}
            </span>
          )}
          {s.workingTree.staged > 0 && <span><b>{s.workingTree.staged}</b> {d.card.staged}</span>}
          {s.workingTree.modified > 0 && <span><b>{s.workingTree.modified}</b> {d.card.modified}</span>}
          {s.workingTree.deleted > 0 && <span><b>{s.workingTree.deleted}</b> {d.card.deleted}</span>}
          {s.workingTree.untracked > 0 && <span><b>{s.workingTree.untracked}</b> {d.card.untracked}</span>}
        </div>
      )}

      {s && (
        <div className="diverge-row">
          <div>
            <span className="label">{d.card.local}</span>
            {s.localDivergence ? (
              <>
                <DivergenceView d={d} div={s.localDivergence} />
                <div className="muted">{d.card.vs} {s.localDivergence.baseBranch}</div>
              </>
            ) : (
              <span className="muted">{d.card.noBase}</span>
            )}
          </div>
          <div>
            <span className="label">{d.card.tracking}</span>
            {s.trackingDivergence && s.upstream ? (
              <>
                <DivergenceView d={d} div={s.trackingDivergence} />
                <div className="muted">
                  {d.card.vs} {s.upstream} ·{" "}
                  {repo.lastSuccessfulFetch
                    ? fill(d.card.fetchedAgo, {
                        time: relativeTime(repo.lastSuccessfulFetch, d),
                      })
                    : d.card.fetchedNever}
                </div>
              </>
            ) : (
              <span className="muted">{d.card.noUpstream}</span>
            )}
          </div>
        </div>
      )}

      {s?.latestCommit && (
        <div className="commit-line">
          <span className="hash">{s.latestCommit.hash}</span> · {s.latestCommit.subject} ·{" "}
          {relativeTime(s.latestCommit.date, d)}
        </div>
      )}

      <div className="card-actions">
        <button onClick={onOpenDetails}>{d.card.details}</button>
        <button onClick={onRefresh} disabled={repo.loading}>{d.common.refresh}</button>
        <button onClick={onFetch} disabled={repo.fetching}>
          {repo.fetching ? <span className="spin" /> : d.common.fetch}
        </button>
        <button className="ghost" onClick={() => void api.openInTerminal(repo.path)}>
          {d.card.openInTerminal}
        </button>
        <button className="ghost" onClick={() => void api.openFolder(repo.path)}>
          {d.card.openFolder}
        </button>
        <button className="ghost danger" onClick={onRemove}>{d.card.removeFromSentinel}</button>
      </div>
    </div>
  );
}
