import { useEffect, useRef, useState } from "react";
import * as api from "./api";
import { AppStateProvider, useApp, useDict } from "./state/AppState";
import { Onboarding } from "./screens/Onboarding";
import { Hq } from "./screens/Hq";
import { RepositoryDetails } from "./screens/RepositoryDetails";
import { Settings } from "./screens/Settings";
import { About } from "./screens/About";
import { BootSplash } from "./components/BootSplash";
import "./personality/themes.css";

type BaseView = { name: "hq" } | { name: "details"; path: string };
type View = BaseView | { name: "about"; returnTo: BaseView } | { name: "settings"; returnTo: BaseView };

function Shell() {
  const app = useApp();
  const d = useDict();
  const [view, setView] = useState<View>({ name: "hq" });
  const startupFinished = useRef(false);

  useEffect(() => {
    if (!app.ready || app.boot.phase !== "complete" || startupFinished.current) return;
    startupFinished.current = true;
    void api.finishStartup().catch(() => {
      // Browser tests and desktop environments without a splash keep working.
    });
  }, [app.boot.phase, app.ready]);

  const currentBaseView = (): BaseView => view.name === "details" ? view : { name: "hq" };

  if (!app.ready || app.boot.phase !== "complete") {
    return <BootSplash boot={app.boot} d={d} />;
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
          <span className="brand-mark" aria-hidden="true">◆</span>
          <h1>Git Sentinel</h1>
          <span className="sub">{d.common.hq}</span>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => setView({ name: "hq" })}>
            {d.common.hq}
          </button>
          <button className="ghost" onClick={() => setView({ name: "settings", returnTo: currentBaseView() })}>
            {d.common.settings}
          </button>
          <button className="ghost" onClick={() => setView({ name: "about", returnTo: currentBaseView() })}>
            {d.common.about}
          </button>
        </div>
      </header>

      <div hidden={view.name !== "hq"}>
        <Hq onOpenDetails={(path) => setView({ name: "details", path })} />
      </div>
      {view.name === "details" && (
        <RepositoryDetails path={view.path} onBack={() => setView({ name: "hq" })} />
      )}
      {view.name === "about" && <About onBack={() => setView(view.returnTo)} />}
      {view.name === "settings" && <Settings onBack={() => setView(view.returnTo)} />}
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
