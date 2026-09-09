import { useState } from "react";
import { useApp, useDict } from "../state/AppState";
import { LANGUAGES } from "../i18n";
import { PERSONALITIES } from "../personality";
import { Toast } from "../components/Toast";
import type { Language, Personality } from "../types";

export function Settings({ onBack }: { onBack: () => void }) {
  const app = useApp();
  const d = useDict();
  const [saved, setSaved] = useState(false);

  function update<K extends keyof typeof app.config>(key: K, value: (typeof app.config)[K]) {
    void app.updateConfig({ [key]: value });
    setSaved(true);
  }

  return (
    <div className="content" style={{ maxWidth: 620 }}>
      <div className="row between" style={{ marginBottom: 18 }}>
        <button onClick={onBack}>← {d.common.back}</button>
      </div>
      <h1 style={{ marginBottom: 20 }}>{d.settings.title}</h1>

      <div className="field">
        <label>{d.settings.personality}</label>
        <div className="persona-grid">
          {PERSONALITIES.map((p) => (
            <button
              key={p}
              className={`persona-card ${app.config.personality === p ? "selected" : ""}`}
              onClick={() => update("personality", p as Personality)}
            >
              <div className="pname">{d.personalities[p].name}</div>
              <div className="pdesc">{d.personalities[p].description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>{d.settings.language}</label>
        <select
          value={app.config.language}
          onChange={(e) => update("language", e.target.value as Language)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>{d.settings.preferredName}</label>
        <input
          value={app.config.preferredName}
          onChange={(e) => update("preferredName", e.target.value)}
        />
      </div>

      <div className="field">
        <label>{d.settings.formOfAddress}</label>
        <input
          value={app.config.formOfAddress}
          onChange={(e) => update("formOfAddress", e.target.value)}
        />
      </div>

      <div className="field settings-auto-fetch">
        <label>{d.settings.automaticFetch}</label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={app.config.autoFetchEnabled}
            onChange={(e) => update("autoFetchEnabled", e.target.checked)}
          />
          <span>{d.settings.automaticFetch}</span>
        </label>
        <p className="hint">{d.settings.automaticFetchHint}</p>
        {app.config.autoFetchEnabled && (
          <label className="interval-row">
            <span>{d.settings.automaticFetchInterval}</span>
            <select
              value={app.config.autoFetchIntervalMinutes}
              onChange={(e) => update("autoFetchIntervalMinutes", Number(e.target.value) as 15 | 30 | 60)}
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
            </select>
          </label>
        )}
      </div>

      {saved && (
        <Toast message={d.settings.saved} kind="ok" onDismiss={() => setSaved(false)} />
      )}
    </div>
  );
}
