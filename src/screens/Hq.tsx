import { useMemo, useState } from "react";
import { useApp, useDict } from "../state/AppState";
import * as api from "../api";
import {
  deriveStatus,
  FILTER_IDS,
  filterCount,
  matchesFilter,
  summarize,
  TIER_RANK,
  type FilterId,
  type Group,
  type RepoStatus,
} from "../fleet";
import { fill } from "../i18n";
import { personaGreeting, personaFleet, fleetSummaryLine } from "../personality/copy";
import type { RepoView } from "../state/AppState";
import { RepoRow } from "../components/RepoRow";
import { Modal } from "../components/Modal";
import { Toast } from "../components/Toast";

type Entry = { repo: RepoView; status: RepoStatus };

const GROUP_ORDER: Group[] = ["loading", "attention", "ahead", "healthy"];
const HEALTHY_CAP = 25;

function commitTime(e: Entry): number {
  return e.repo.state?.latestCommit ? new Date(e.repo.state.latestCommit.date).getTime() : 0;
}

function bySeverityThenRecent(a: Entry, b: Entry): number {
  const t = TIER_RANK[a.status.tier] - TIER_RANK[b.status.tier];
  return t !== 0 ? t : commitTime(b) - commitTime(a);
}

export function Hq({ onOpenDetails }: { onOpenDetails: (path: string) => void }) {
  const app = useApp();
  const d = useDict();
  const p = app.config.personality;
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "error" | "ok" } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [showAllHealthy, setShowAllHealthy] = useState(false);

  const entries = useMemo<Entry[]>(() => {
    const now = Date.now();
    return app.repos.map((repo) => ({ repo, status: deriveStatus(repo, now) }));
  }, [app.repos]);

  const summary = useMemo(() => summarize(entries.map((e) => e.status)), [entries]);

  const attentionRepos = useMemo(
    () =>
      entries
        .filter((e) => e.status.group === "attention")
        .sort(bySeverityThenRecent)
        .map((e) => ({
          name: e.repo.state?.name ?? e.repo.path.split("/").pop() ?? e.repo.path,
          headline: e.status.headline,
        })),
    [entries],
  );

  const q = query.trim().toLowerCase();
  const visible = entries
    .filter((e) => matchesFilter(e.status, filter))
    .filter(
      (e) =>
        !q ||
        (e.repo.state?.name ?? "").toLowerCase().includes(q) ||
        e.repo.path.toLowerCase().includes(q),
    )
    .sort(bySeverityThenRecent);

  const grouped: Record<Group, Entry[]> = { loading: [], attention: [], ahead: [], healthy: [] };
  for (const e of visible) grouped[e.status.group].push(e);

  async function addRepository() {
    const folder = await api.pickFolder();
    if (!folder) return;
    setBusy(true);
    const result = await app.addRepo(folder);
    setBusy(false);
    if (!result.ok) {
      setToast({ msg: d.errors[result.error as "notAGitRepo"], kind: "error" });
    }
  }

  async function fetchAll() {
    setBusy(true);
    const s = await app.fetchAll();
    setBusy(false);
    const ok = fill(d.hq.fetchedOk, { n: s.succeeded });
    setToast(
      s.failed.length === 0
        ? { msg: ok, kind: "ok" }
        : { msg: `${ok} · ${fill(d.hq.fetchedFailed, { n: s.failed.length })}`, kind: "error" },
    );
  }

  const removeTarget = app.repos.find((r) => r.path === confirmRemove);
  const fleet = summary.loading > 0
    ? { line: d.hq.loadingFleet }
    : personaFleet(p, d, { summary, attentionRepos });

  if (app.repos.length === 0) {
    return (
      <div className="content">
        <div className="greeting-block">
          <div className="hello">
            {personaGreeting(p, d, {
              preferredName: app.config.preferredName,
              formOfAddress: app.config.formOfAddress,
              now: new Date(),
            })}
          </div>
          <div className="status">{d.hq.subtitle}</div>
        </div>
        <div className="empty">
          <h2>{d.hq.emptyTitle}</h2>
          <p>{d.hq.emptyBody}</p>
          <button className="primary" onClick={addRepository} disabled={busy}>
            {d.hq.addRepository}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="content hq">
      <header className="hq-head">
        <div className="hello">
          {personaGreeting(p, d, {
            preferredName: app.config.preferredName,
            formOfAddress: app.config.formOfAddress,
            now: new Date(),
          })}
        </div>
        <div className="hq-interpretation">{fleet.line}</div>
        {fleet.detail && <div className="hq-interpretation-detail">{fleet.detail}</div>}

        <div className="hq-summary">{fleetSummaryLine(d, summary)}</div>

        <div className="hq-filters">
          {FILTER_IDS.map((id) => {
            const c = filterCount(entries.map((e) => e.status), id);
            if (id !== "all" && c === 0) return null;
            return (
              <button
                key={id}
                className={`chip-filter ${filter === id ? "on" : ""}`}
                onClick={() => setFilter(id)}
              >
                {d.filters[id]} <span className="chip-n">{c}</span>
              </button>
            );
          })}
        </div>

        <div className="hq-tools">
          <input
            className="hq-search"
            placeholder={d.hq.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="hq-tools-right">
            <button className="primary" onClick={addRepository} disabled={busy}>
              {d.hq.addRepository}
            </button>
            <button onClick={fetchAll} disabled={busy}>
              {busy ? <span className="spin" /> : fill("{a} ({n})", { a: d.common.fetchAll, n: app.repos.length })}
            </button>
          </div>
        </div>
      </header>

      {visible.length === 0 && <p className="muted hq-none">{d.hq.subtitle}</p>}

      {GROUP_ORDER.map((g) => {
        const items = grouped[g];
        if (items.length === 0) return null;
        const capped = g === "healthy" && !showAllHealthy && items.length > HEALTHY_CAP;
        const shown = capped ? items.slice(0, HEALTHY_CAP) : items;
        return (
          <section key={g} className="repo-group" data-group={g}>
            <div className="group-head">
              <span className="group-title">{d.groups[g]}</span>
              <span className="group-count">{items.length}</span>
            </div>
            <div className="repo-list">
              {shown.map((e) => (
                <RepoRow
                  key={e.repo.path}
                  repo={e.repo}
                  status={e.status}
                  d={d}
                  p={p}
                  onOpenDetails={() => onOpenDetails(e.repo.path)}
                  onRefresh={() => void app.refreshOne(e.repo.path)}
                  onFetch={async () => {
                    const r = await app.fetchOne(e.repo.path);
                    if (!r.ok) setToast({ msg: `${d.errors.fetchFailed}: ${r.error}`, kind: "error" });
                  }}
                  onRemove={() => setConfirmRemove(e.repo.path)}
                />
              ))}
            </div>
            {capped && (
              <button className="group-more" onClick={() => setShowAllHealthy(true)}>
                {fill(d.groups.more, { n: items.length - HEALTHY_CAP })}
              </button>
            )}
          </section>
        );
      })}

      {confirmRemove && removeTarget && (
        <Modal
          title={fill(d.removeDialog.title, {
            name: removeTarget.state?.name ?? removeTarget.path.split("/").pop() ?? "",
          })}
          onClose={() => setConfirmRemove(null)}
          actions={
            <>
              <button onClick={() => setConfirmRemove(null)}>{d.common.cancel}</button>
              <button
                className="danger"
                onClick={() => {
                  void app.removeRepo(confirmRemove);
                  setConfirmRemove(null);
                }}
              >
                {d.removeDialog.confirm}
              </button>
            </>
          }
        >
          <p>{d.removeDialog.body}</p>
        </Modal>
      )}

      {toast && <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />}
    </div>
  );
}
