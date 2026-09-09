import { Fragment, useEffect, useMemo, useState } from "react";
import { useApp, useDict } from "../state/AppState";
import { fill, relativeTime } from "../i18n";
import { deriveStatus } from "../fleet";
import { Topology } from "../components/Topology";
import { headlineText } from "../personality/topology";
import { repositoryNarrative } from "../narrative";
import { repositoryActionsDisabled } from "../activity";
import * as api from "../api";
import type { ChangedFile, FileDiff } from "../types";
import { ReferenceHelp } from "../components/ReferenceHelp";

export function RepositoryDetails({ path, onBack }: { path: string; onBack: () => void }) {
  const app = useApp();
  const d = useDict();
  const p = app.config.personality;
  const operationActive = repositoryActionsDisabled(app.activity);
  const [filter, setFilter] = useState("");
  const [changes, setChanges] = useState<ChangedFile[] | null>(null);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const repo = app.repos.find((r) => r.path === path);
  const s = repo?.state;
  const status = useMemo(() => (repo ? deriveStatus(repo) : null), [repo]);

  useEffect(() => {
    setChanges(null);
    setChangesError(null);
    setSelectedFile(null);
    setDiff(null);
    if (!repo?.state || repo.state.workingTree.clean) return;
    void api.listRepositoryChanges(path).then(setChanges).catch((error) => setChangesError(String(error)));
  }, [path, repo?.state?.workingTree.clean, repo?.state?.workingTree.staged, repo?.state?.workingTree.modified, repo?.state?.workingTree.deleted, repo?.state?.workingTree.untracked, repo?.state?.workingTree.conflicted]);

  const branches = useMemo(() => {
    const names = s?.localBranches.names ?? [];
    const query = filter.trim().toLowerCase();
    return query ? names.filter((n) => n.toLowerCase().includes(query)) : names;
  }, [s, filter]);

  if (!repo || !status) return null;

  const wt = s?.workingTree;
  const fresh =
    repo.lastSuccessfulFetch
      ? fill(d.topo.fetchedAgo, { time: relativeTime(repo.lastSuccessfulFetch, d) })
      : d.topo.neverFetched;
  const story = s ? repositoryNarrative({ state: s, status, lastSuccessfulFetch: repo.lastSuccessfulFetch }, d) : [];

  return (
    <div className="content details">
      <div className="row between" style={{ marginBottom: 18 }}>
        <button onClick={onBack}>← {d.common.back}</button>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" title={d.card.openInTerminal} onClick={() => void api.openInTerminal(path)}>
            {">_"}
          </button>
          <button onClick={() => void api.openFolder(path)}>{d.card.openFolder}</button>
          <button onClick={() => void app.refreshOne(path)} disabled={operationActive || repo.loading}>{d.common.refresh}</button>
          <button onClick={() => void app.fetchOne(path)} disabled={repo.fetching || operationActive}>
            {repo.fetching ? <span className="spin" /> : d.common.fetch}
          </button>
          {s?.upstream && (
            <button onClick={() => void app.pushOne(path)} disabled={operationActive || repo.pushing || (s.trackingDivergence?.ahead ?? 0) === 0}>
              {repo.pushing ? <span className="spin" /> : d.common.push}
            </button>
          )}
        </div>
      </div>

      <div className="details-head">
        <h1>{s?.name ?? path.split("/").pop()}</h1>
        <span className="rr-chip" data-headline={status.headline}>
          {headlineText(p, status.headline, d)}
        </span>
      </div>
      <div className="details-path mono">{s?.path ?? path}</div>

      {!s ? (
        <p className="muted">{repo.error ? d.errors.inspectFailed : d.common.loading}</p>
      ) : (
        <>
          <section className="detail-section">
            <h3>{d.details2.checkout}</h3>
            <Topology
              status={status}
              conflicted={wt?.conflicted ?? 0}
              currentBranch={s.currentBranch}
              d={d}
              p={p}
              variant="detail"
            />
            <div className="checkout-notes">
              <div>
                <span className="k">{d.details2.referenceBranch}</span>{" "}
                {status.reference ? (
                  <span>
                    {status.reference.ref} ·{" "}
                    {fill(d.details2.aheadBehind, {
                      ahead: status.reference.rel.kind === "ahead" || status.reference.rel.kind === "diverged" ? status.reference.rel.ahead : 0,
                      behind: status.reference.rel.kind === "behind" || status.reference.rel.kind === "diverged" ? status.reference.rel.behind : 0,
                    })}
                    {s.currentBranch && (
                      <ReferenceHelp
                        branch={s.currentBranch}
                        reference={status.reference.ref}
                        ahead={status.reference.rel.kind === "ahead" || status.reference.rel.kind === "diverged" ? status.reference.rel.ahead : 0}
                        behind={status.reference.rel.kind === "behind" || status.reference.rel.kind === "diverged" ? status.reference.rel.behind : 0}
                        d={d}
                      />
                    )}
                  </span>
                ) : (
                  <span className="muted">{d.details2.noReference}</span>
                )}
              </div>
              <div>
                <span className="k">{d.details2.upstreamLabel}</span>{" "}
                {s.upstream ? (
                  <span>{s.upstream} · {fresh}</span>
                ) : (
                  <span className="muted">{d.topo.noUpstreamShort}</span>
                )}
              </div>
              {s.upstream && <p className="snapshot-note muted">{d.details2.snapshotNote}</p>}
              {repo.fetchError && (
                <div className="fetch-error">{d.errors.fetchFailed}: {repo.fetchError}</div>
              )}
            </div>
          </section>

          <section className="detail-section reference-picker">
            <h3>{d.details2.referenceBranch}</h3>
            <p className="muted">{d.details2.referenceHint}</p>
            <select
              value={repo.referenceBranch ?? s.referenceBranch ?? ""}
              disabled={operationActive}
              onChange={(e) => void app.setReferenceBranch(path, e.target.value || undefined)}
            >
              <option value="">{d.details2.noReference}</option>
              {s.referenceBranches.map((reference) => <option key={reference} value={reference}>{reference}</option>)}
            </select>
          </section>

          <section className="detail-section repository-story">
            <h3>{d.narrative.title}</h3>
            {story.map((line) => <p key={line} className="story-line">{line}</p>)}
          </section>

          <div className="detail-grid">
            <section className="detail-section">
              <h3>{d.details.workingTree}</h3>
              <div className="kv">
                <span className="k" title={d.narrative.staged}>{d.card.staged}</span><span className="v">{wt!.staged}</span>
                <span className="k" title={d.narrative.modified}>{d.card.modified}</span><span className="v">{wt!.modified}</span>
                <span className="k" title={d.narrative.deleted}>{d.card.deleted}</span><span className="v">{wt!.deleted}</span>
                <span className="k" title={d.narrative.untracked}>{d.card.untracked}</span><span className="v">{wt!.untracked}</span>
                <span className="k">{d.card.conflicts}</span>
                <span className={`v ${wt!.conflicted > 0 ? "rr-conflict" : ""}`}><b>{wt!.conflicted}</b></span>
              </div>
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
                    {new Date(s.latestCommit.date).toLocaleString()} · {relativeTime(s.latestCommit.date, d)}
                  </span>
                </div>
              </section>
            )}
          </div>

          {!wt!.clean && (
            <section className="detail-section changes-section">
              <h3>{d.details.changes}</h3>
              {changes === null && !changesError && <p className="muted">{d.details.loadingChanges}</p>}
              {changesError && <p className="fetch-error">{changesError}</p>}
              {changes?.length === 0 && <p className="muted">{d.details.noChanges}</p>}
              {changes && changes.length > 0 && (
                <div className="changes-layout">
                  <div className="change-list">
                    {changes.map((change) => (
                      <button
                        key={change.path}
                        className={selectedFile === change.path ? "selected" : ""}
                        onClick={() => {
                          setSelectedFile(change.path);
                          setDiff(null);
                          setDiffLoading(true);
                          void api.repositoryFileDiff(path, change.path)
                            .then(setDiff)
                            .catch((error) => setChangesError(String(error)))
                            .finally(() => setDiffLoading(false));
                        }}
                      >
                        <span data-change={change.status}>{change.status}</span>
                        <code>{change.path}</code>
                      </button>
                    ))}
                  </div>
                  <div className="diff-view" aria-live="polite">
                    {!selectedFile && <p className="muted">{d.details.diff}</p>}
                    {diffLoading && <p className="muted">{d.common.loading}</p>}
                    {diff?.untracked && <p className="muted">{d.details.untrackedDiff}</p>}
                    {diff && !diff.untracked && <pre>{diff.content || d.details.noChanges}</pre>}
                    {diff?.truncated && <p className="muted">{d.details.diffTruncated}</p>}
                  </div>
                </div>
              )}
            </section>
          )}

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
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
