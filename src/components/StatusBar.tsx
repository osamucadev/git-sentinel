import { useEffect, useMemo, useRef, useState } from "react";
import type { Activity } from "../activity";
import { fill } from "../i18n";
import type { Dict } from "../i18n/en";
import { deriveInsights, insightPath, insightText, type Insight } from "../insights";
import { useApp, useDict } from "../state/AppState";
import type { Personality } from "../types";
import { ActivityStrip } from "./ActivityStrip";

/** How long each insight stays before the next one, unless the pointer or
 * keyboard focus is on the bar. Slow on purpose: it sits in peripheral view. */
export const INSIGHT_ROTATION_MS = 25_000;

type ViewProps = {
  d: Dict;
  p: Personality;
  activity: Activity | null;
  insight: Insight | null;
  position: { index: number; total: number };
  autoFetch: { enabled: boolean; minutes: number };
  now?: Date;
  onPrevious: () => void;
  onNext: () => void;
  onOpenRepository: (path: string) => void;
};

/** Always-present, fixed-height bar at the bottom of the window. Operation
 * progress replaces the insight while it runs; nothing here ever enters or
 * leaves the page flow, so the content above never shifts. */
export function StatusBarView({ d, p, activity, insight, position, autoFetch, now, onPrevious, onNext, onOpenRepository }: ViewProps) {
  const path = insight ? insightPath(insight) : undefined;
  const text = insight ? insightText(insight, d, now) : "";
  const many = position.total > 1;

  return (
    <footer className="status-bar" aria-label={d.statusBar.label}>
      <div className="status-main">
        {activity ? (
          <ActivityStrip activity={activity} d={d} p={p} />
        ) : insight ? (
          <div className="status-insight" data-kind={insight.kind}>
            {many && <button type="button" className="status-nav" onClick={onPrevious} aria-label={d.statusBar.previous} title={d.statusBar.previous}>‹</button>}
            {path ? (
              <button
                type="button"
                className="status-insight-text"
                onClick={() => onOpenRepository(path)}
                title={fill(d.statusBar.openRepository, { name: "name" in insight ? insight.name ?? "" : "" })}
              >
                {text}
              </button>
            ) : (
              <span className="status-insight-text">{text}</span>
            )}
            {many && <button type="button" className="status-nav" onClick={onNext} aria-label={d.statusBar.next} title={d.statusBar.next}>›</button>}
            {many && <span className="status-count">{position.index + 1}/{position.total}</span>}
          </div>
        ) : null}
      </div>
      <div className="status-side">
        {autoFetch.enabled ? fill(d.statusBar.autoFetchOn, { n: autoFetch.minutes }) : d.statusBar.autoFetchOff}
      </div>
    </footer>
  );
}

export function StatusBar({ onOpenRepository }: { onOpenRepository: (path: string) => void }) {
  const app = useApp();
  const d = useDict();
  const [now, setNow] = useState(() => Date.now());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  // Relative times ("3d ago") stay current without re-deriving on every render.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const insights = useMemo(() => deriveInsights(app.repos, now), [app.repos, now]);
  // Keep showing the same insight across refreshes when it still exists.
  const found = insights.findIndex((i) => i.id === currentId);
  const index = found === -1 ? 0 : found;
  const insight = insights[index] ?? null;
  // Read through a ref so a repository refresh (which yields a new list) does
  // not restart the rotation timer; otherwise frequent local changes would
  // keep the bar on the same insight forever.
  const insightsRef = useRef(insights);
  insightsRef.current = insights;
  const canRotate = !paused && !app.activity && insights.length > 1;

  const step = (delta: number) => {
    if (insights.length === 0) return;
    setCurrentId(insights[(index + delta + insights.length) % insights.length].id);
  };

  useEffect(() => {
    if (!canRotate) return;
    const id = setInterval(() => {
      const list = insightsRef.current;
      if (list.length === 0) return;
      setCurrentId((current) => {
        const at = list.findIndex((i) => i.id === current);
        return list[((at === -1 ? 0 : at) + 1) % list.length].id;
      });
    }, INSIGHT_ROTATION_MS);
    return () => clearInterval(id);
  }, [canRotate]);

  return (
    <div
      className="status-bar-host"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <StatusBarView
        d={d}
        p={app.config.personality}
        activity={app.activity}
        insight={insight}
        position={{ index, total: insights.length }}
        autoFetch={{ enabled: app.config.autoFetchEnabled, minutes: app.config.autoFetchIntervalMinutes }}
        onPrevious={() => step(-1)}
        onNext={() => step(1)}
        onOpenRepository={onOpenRepository}
      />
    </div>
  );
}
