import { useState } from "react";
import { useApp, useDict } from "../state/AppState";
import * as api from "../api";
import { personaGreeting, personaStatus } from "../personality/copy";
import { RepoCard } from "../components/RepoCard";
import { Modal } from "../components/Modal";
import { Toast } from "../components/Toast";
import { fill } from "../i18n";

export function Hq({ onOpenDetails }: { onOpenDetails: (path: string) => void }) {
  const app = useApp();
  const d = useDict();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "error" | "ok" } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const dirtyCount = app.repos.filter((r) => r.state && !r.state.workingTree.clean).length;

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
    await app.fetchAll();
    setBusy(false);
    setToast({ msg: d.settings.saved, kind: "ok" });
  }

  const removeTarget = app.repos.find((r) => r.path === confirmRemove);

  return (
    <div className="content">
      <div className="greeting-block">
        <div className="hello">
          {personaGreeting(app.config.personality, d, {
            preferredName: app.config.preferredName,
            formOfAddress: app.config.formOfAddress,
            now: new Date(),
          })}
        </div>
        <div className="status">
          {app.repos.length === 0
            ? d.hq.subtitle
            : personaStatus(app.config.personality, d, {
                total: app.repos.length,
                dirty: dirtyCount,
              })}
        </div>
      </div>

      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="primary" onClick={addRepository} disabled={busy}>
            {d.hq.addRepository}
          </button>
          {app.repos.length > 0 && (
            <>
              <button onClick={() => void app.refreshAll()} disabled={busy}>
                {d.common.refresh}
              </button>
              <button onClick={fetchAll} disabled={busy}>
                {busy ? <span className="spin" /> : d.common.fetchAll}
              </button>
            </>
          )}
        </div>
      </div>

      {app.repos.length === 0 ? (
        <div className="empty">
          <h2>{d.hq.emptyTitle}</h2>
          <p>{d.hq.emptyBody}</p>
          <button className="primary" onClick={addRepository} disabled={busy}>
            {d.hq.addRepository}
          </button>
        </div>
      ) : (
        <div className="repo-grid">
          {app.repos.map((repo) => (
            <RepoCard
              key={repo.path}
              repo={repo}
              d={d}
              onOpenDetails={() => onOpenDetails(repo.path)}
              onRefresh={() => void app.refreshOne(repo.path)}
              onFetch={async () => {
                const r = await app.fetchOne(repo.path);
                if (!r.ok) setToast({ msg: `${d.errors.fetchFailed}: ${r.error}`, kind: "error" });
              }}
              onRemove={() => setConfirmRemove(repo.path)}
            />
          ))}
        </div>
      )}

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

      {toast && (
        <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
