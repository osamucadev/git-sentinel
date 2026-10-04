import { fill } from "../i18n";
import type { Dict } from "../i18n/en";
import type { Activity } from "../activity";
import type { Personality } from "../types";

function operationTitle(activity: Activity, p: Personality, d: Dict): string {
  if (p === "scifi" && (activity.kind === "fetch" || activity.kind === "fetchAll" || activity.kind === "autoFetch")) return d.activity.scifiFetch;
  if (p === "cute" && (activity.kind === "fetch" || activity.kind === "fetchAll" || activity.kind === "autoFetch")) return d.activity.cuteFetch;
  if (p === "jarbas" && (activity.kind === "fetch" || activity.kind === "fetchAll" || activity.kind === "autoFetch")) return d.activity.jarbasFetch;
  return d.activity[activity.kind];
}

export function ActivityStrip({ activity, d, p }: { activity: Activity; d: Dict; p: Personality }) {
  const failed = activity.failed.length;
  const complete = activity.phase === "complete";
  const name = activity.currentPath?.split("/").filter(Boolean).pop();
  const summary = complete
    ? failed
      ? fill(d.activity.completedFailed, { done: activity.completed - failed, failed })
      : fill(d.activity.completed, { done: activity.completed })
    : fill(d.activity.progress, { done: activity.completed, total: activity.total });
  const detail = complete && failed
    ? `${activity.failed[0].path.split("/").filter(Boolean).pop()} — ${activity.failed[0].error}`
    : name ? fill(d.activity.current, { name }) : undefined;
  const percent = activity.total ? Math.round((activity.completed / activity.total) * 100) : 0;

  // One fixed-height line inside the status bar: the detail always has a slot,
  // so neither it appearing nor disappearing ever changes the layout.
  return (
    <div className="status-activity" data-kind={activity.kind} data-phase={activity.phase} aria-live="polite">
      <strong>{operationTitle(activity, p, d)}</strong>
      <div className="activity-progress" aria-label={summary}><i style={{ width: `${percent}%` }} /></div>
      <span className="status-activity-summary">{summary}</span>
      <span className="status-activity-detail" title={detail}>{detail}</span>
    </div>
  );
}
