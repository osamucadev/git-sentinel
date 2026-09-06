import { useState } from "react";
import { AppStateProvider, useApp, useDict } from "./state/AppState";
import { Onboarding } from "./screens/Onboarding";
import { Hq } from "./screens/Hq";
import { RepositoryDetails } from "./screens/RepositoryDetails";
import { Settings } from "./screens/Settings";
import "./personality/themes.css";

type View = { name: "hq" } | { name: "details"; path: string } | { name: "settings" };

function Shell() {
  const app = useApp();
  const d = useDict();
  const [view, setView] = useState<View>({ name: "hq" });

  if (!app.ready) {
    return <div className="content">{d.common.loading}</div>;
  }

  if (!app.config.onboarded) {
    return (
      <div className="app-shell">
        <Onboarding />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => setView({ name: "hq" })} style={{ cursor: "pointer" }}>
          <h1>Git Sentinel</h1>
          <span className="sub">{d.common.hq}</span>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => setView({ name: "hq" })}>
            {d.common.hq}
          </button>
          <button className="ghost" onClick={() => setView({ name: "settings" })}>
            {d.common.settings}
          </button>
        </div>
      </header>

      {view.name === "hq" && (
        <Hq onOpenDetails={(path) => setView({ name: "details", path })} />
      )}
      {view.name === "details" && (
        <RepositoryDetails path={view.path} onBack={() => setView({ name: "hq" })} />
      )}
      {view.name === "settings" && <Settings onBack={() => setView({ name: "hq" })} />}
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}
