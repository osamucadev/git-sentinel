import { Fragment, useMemo, useState } from "react";
import { useApp, useDict } from "../state/AppState";
import { relativeTime } from "../i18n";
import type { Divergence } from "../types";

function Diverge({ div, label }: { div: Divergence | null; label: string }) {
  const d = useDict();
  return (
    <div className="kv">
      <span className="k">{label}</span>
      <span className="v">
        {div ? (
          <>
            <span className="ahead">↑ {div.ahead}</span>{" "}
            <span className="behind">↓ {div.behind}</span>{" "}
            <span className="muted">{d.card.vs} {div.baseBranch}</span>
          </>
        ) : (
          <span className="muted">{d.details.none}</span>
        )}
      </span>
    </div>
  );
}

export function RepositoryDetails({ path, onBack }: { path: string; onBack: () => void }) {
  const app = useApp();
  const d = useDict();
  const [filter, setFilter] = useState("");

  const repo = app.repos.find((r) => r.path === path);
  const s = repo?.state;

  const branches = useMemo(() => {
    const names = s?.localBranches.names ?? [];
    const q = filter.trim().toLowerCase();
    return q ? names.filter((n) => n.toLowerCase().includes(q)) : names;
  }, [s, filter]);

  if (!repo) return null;

  return (
    <div className="content">
      <div className="row between" style={{ marginBottom: 18 }}>
        <button onClick={onBack}>← {d.common.back}</button>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => void app.refreshOne(path)}>{d.common.refresh}</button>
          <button onClick={() => void app.fetchOne(path)} disabled={repo.fetching}>
            {repo.fetching ? <span className="spin" /> : d.common.fetch}
          </button>
        </div>
      </div>

      <h1 style={{ marginBottom: 16 }}>{s?.name ?? path.split("/").pop()}</h1>

      {!s ? (
        <p className="muted">{repo.error ? d.errors.inspectFailed : d.common.loading}</p>
      ) : (
        <>
          <section className="detail-section">
            <h3>{d.details.overview}</h3>
            <div className="kv">
              <span className="k">{d.details.path}</span>
              <span className="v mono">{s.path}</span>
              <span className="k">{d.details.currentBranch}</span>
              <span className="v mono">
                {s.detachedHead ? d.card.detached : (s.currentBranch ?? d.card.noBranch)}
              </span>
              <span className="k">{d.card.clean} / {d.card.dirty}</span>
              <span className="v">{s.workingTree.clean ? d.card.clean : d.card.dirty}</span>
              <span className="k">{d.details.baseBranch}</span>
              <span className="v mono">{s.localBranches.baseBranch ?? d.details.none}</span>
            </div>
          </section>

          <section className="detail-section">
            <h3>{d.details.workingTree}</h3>
            <div className="kv">
              <span className="k">{d.card.staged}</span><span className="v">{s.workingTree.staged}</span>
              <span className="k">{d.card.modified}</span><span className="v">{s.workingTree.modified}</span>
              <span className="k">{d.card.deleted}</span><span className="v">{s.workingTree.deleted}</span>
              <span className="k">{d.card.untracked}</span><span className="v">{s.workingTree.untracked}</span>
            </div>
          </section>

          <section className="detail-section">
            <h3>{d.details.branches} · {s.localBranches.count}</h3>
            <input
              placeholder={d.details.searchBranches}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <ul className="branch-list">
              {branches.map((b) => (
                <li key={b} className={b === s.currentBranch ? "current" : ""}>{b}</li>
              ))}
            </ul>
            <Diverge div={s.localDivergence} label={d.details.localDivergence} />
          </section>

          <section className="detail-section">
            <h3>{d.details.remote}</h3>
            {s.remotes.length === 0 ? (
              <p className="muted">{d.details.noRemotes}</p>
            ) : (
              <div className="kv">
                {s.remotes.map((r) => (
                  <Fragment key={r.name}>
                    <span className="k">{r.name}</span>
                    <span className="v mono">{r.url ?? ""}</span>
                  </Fragment>
                ))}
                <span className="k">{d.details.upstream}</span>
                <span className="v mono">{s.upstream ?? d.details.none}</span>
              </div>
            )}
            <Diverge div={s.trackingDivergence} label={d.details.trackingDivergence} />
            {s.upstream && (
              <p className="hint muted">
                {repo.lastSuccessfulFetch
                  ? `${d.hq.lastFetch}: ${relativeTime(repo.lastSuccessfulFetch, d)}`
                  : d.card.fetchedNever}
              </p>
            )}
          </section>

          {s.latestCommit && (
            <section className="detail-section">
              <h3>{d.details.latestCommit}</h3>
              <div className="kv">
                <span className="k">hash</span>
                <span className="v mono">{s.latestCommit.hash}</span>
                <span className="k">subject</span>
                <span className="v">{s.latestCommit.subject}</span>
                <span className="k">date</span>
                <span className="v">
                  {new Date(s.latestCommit.date).toLocaleString()} ·{" "}
                  {relativeTime(s.latestCommit.date, d)}
                </span>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
