import { describe, expect, it } from "vitest";
import { beginActivity, completeActivity, finishActivityItem, repositoryActionsDisabled, startActivityItem } from "./activity";

describe("aggregate activity", () => {
  it("tracks progress, individual failures, and completion", () => {
    let activity = beginActivity("fetchAll", 3);
    activity = startActivityItem(activity, "/one");
    activity = finishActivityItem(activity, "/one");
    activity = startActivityItem(activity, "/two");
    activity = finishActivityItem(activity, "/two", "authentication failed");
    activity = completeActivity(activity);
    expect(activity).toMatchObject({ phase: "complete", total: 3, completed: 2 });
    expect(activity.failed).toEqual([{ path: "/two", error: "authentication failed" }]);
    expect(activity.currentPath).toBeUndefined();
  });

  it("disables conflicting repository actions only while an operation runs", () => {
    const active = beginActivity("fetchAll", 2);
    expect(repositoryActionsDisabled(active)).toBe(true);
    expect(repositoryActionsDisabled(completeActivity(active))).toBe(false);
    expect(repositoryActionsDisabled(null)).toBe(false);
  });
});
