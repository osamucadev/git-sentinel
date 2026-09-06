import { fill } from "../i18n";
import type { Dict } from "../i18n/en";
import type { Activity } from "../activity";
import type { Personality } from "../types";

function operationTitle(activity: Activity, p: Personality, d: Dict): string {
  if (p === "scifi" && activity.kind.startsWith("fetch")) return d.activity.scifiFetch;
  if (p === "cute" && activity.kind.startsWith("fetch")) return d.activity.cuteFetch;
  if (p === "jarbas" && activity.kind.startsWith("fetch")) return d.activity.jarbasFetch;
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

  return (
    <section className="activity-strip" data-kind={activity.kind} data-phase={activity.phase} aria-live="polite">
      <div className="activity-strip-main"><strong>{operationTitle(activity, p, d)}</strong><span>{summary}</span></div>
      <div className="activity-progress" aria-label={summary}><i style={{ width: `${percent}%` }} /></div>
      {detail && <div className="activity-strip-detail">{detail}</div>}
    </section>
  );
}
