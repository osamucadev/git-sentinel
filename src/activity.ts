export type ActivityKind = "fetch" | "fetchAll" | "autoFetch" | "push" | "refresh" | "startup";
export type ActivityPhase = "running" | "complete";

export type Activity = {
  kind: ActivityKind;
  phase: ActivityPhase;
  total: number;
  completed: number;
  failed: Array<{ path: string; error: string }>;
  currentPath?: string;
};

export function beginActivity(kind: ActivityKind, total: number): Activity {
  return { kind, phase: "running", total, completed: 0, failed: [] };
}

export function startActivityItem(activity: Activity, path: string): Activity {
  return { ...activity, currentPath: path };
}

export function finishActivityItem(activity: Activity, path: string, error?: string): Activity {
  return {
    ...activity,
    completed: activity.completed + 1,
    currentPath: activity.currentPath === path ? undefined : activity.currentPath,
    failed: error ? [...activity.failed, { path, error }] : activity.failed,
  };
}

export function completeActivity(activity: Activity): Activity {
  return { ...activity, phase: "complete", currentPath: undefined };
}

/** Navigation stays available; only incompatible repository actions pause. */
export function repositoryActionsDisabled(activity: Activity | null): boolean {
  return activity?.phase === "running";
}
