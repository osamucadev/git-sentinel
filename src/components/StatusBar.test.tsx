import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { beginActivity } from "../activity";
import { en } from "../i18n/en";
import type { Insight } from "../insights";
import { PERSONALITIES } from "../personality";
import { StatusBarView } from "./StatusBar";

const repoInsight: Insight = { id: "pushPending", kind: "pushPending", commits: 2, repos: 1, path: "/repos/a", name: "a" };
const fleetInsight: Insight = { id: "fleet", kind: "fleet", repos: 3, branches: 5, stashes: 0 };
const noop = () => {};

function render(over: Partial<Parameters<typeof StatusBarView>[0]> = {}) {
  return renderToStaticMarkup(
    <StatusBarView
      d={en}
      p="technical"
      activity={null}
      insight={repoInsight}
      position={{ index: 0, total: 2 }}
      autoFetch={{ enabled: true, minutes: 30 }}
      onPrevious={noop}
      onNext={noop}
      onOpenRepository={noop}
      {...over}
    />,
  );
}

describe("StatusBarView", () => {
  it("shows the current insight, its position and the auto fetch state", () => {
    const html = render();
    expect(html).toContain("2 commit(s) waiting to be pushed in a");
    expect(html).toContain("1/2");
    expect(html).toContain("Auto fetch every 30 min");
  });

  it("makes insights about one repository clickable, and general ones plain text", () => {
    expect(render()).toContain('<button type="button" class="status-insight-text"');
    const fleet = render({ insight: fleetInsight });
    expect(fleet).toContain('<span class="status-insight-text">');
    expect(fleet).toContain("3 repositories · 5 local branches");
  });

  it("hides navigation when there is a single insight", () => {
    const html = render({ position: { index: 0, total: 1 } });
    expect(html).not.toContain(en.statusBar.next);
    expect(html).not.toContain("1/1");
  });

  it("replaces the insight with operation progress while one runs", () => {
    const html = render({ activity: { ...beginActivity("fetchAll", 4), completed: 1, currentPath: "/repos/mayalms" } });
    expect(html).toContain(en.activity.fetchAll);
    expect(html).toContain("1 of 4");
    expect(html).not.toContain("waiting to be pushed");
  });

  it("keeps the activity detail slot even before any repository has started", () => {
    // The slot is what keeps the bar from changing shape mid-operation.
    const html = render({ activity: beginActivity("fetchAll", 4) });
    expect(html).toContain('class="status-activity-detail"');
  });

  it("states when auto fetch is off", () => {
    expect(render({ autoFetch: { enabled: false, minutes: 30 } })).toContain(en.statusBar.autoFetchOff);
  });

  it("renders the same structure in every personality", () => {
    const shapes = PERSONALITIES.map((p) => render({ p }).replace(/>[^<]*</g, "><"));
    expect(new Set(shapes).size).toBe(1);
  });
});
