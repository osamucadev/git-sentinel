import { fill } from "../i18n";
import type { Dict } from "../i18n/en";
import type { BootState } from "../state/AppState";

export function BootSplash({ boot, d }: { boot: BootState; d: Dict }) {
  const current = boot.currentPath?.split("/").filter(Boolean).pop();
  const title = boot.phase === "restoring"
    ? d.common.loading
    : boot.phase === "inspecting"
      ? d.activity.startup
      : "Git Sentinel";
  const detail = boot.phase === "inspecting"
    ? current
      ? fill(d.activity.current, { name: current })
      : fill(d.activity.progress, { done: boot.completed, total: boot.total })
    : d.hq.loadingFleet;
  const percent = boot.total ? Math.round((boot.completed / boot.total) * 100) : 12;
  return (
    <main className="boot-splash" aria-live="polite" aria-busy="true">
      <div className="boot-mark" aria-hidden="true">◆</div>
      <p className="boot-kicker">Git Sentinel</p>
      <h1>{title}</h1>
      <p>{detail}</p>
      <div className="boot-progress" aria-label={detail}><i style={{ width: `${percent}%` }} /></div>
      {boot.total > 0 && <small>{fill(d.activity.progress, { done: boot.completed, total: boot.total })}</small>}
    </main>
  );
}
