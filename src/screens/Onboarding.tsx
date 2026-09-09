import { useState } from "react";
import { useApp } from "../state/AppState";
import { dict, LANGUAGES } from "../i18n";
import { applyPersonality, PERSONALITIES } from "../personality";
import { personaGreeting, personaStatus } from "../personality/copy";
import type { Language, Personality, SentinelConfig } from "../types";

export function Onboarding() {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const [personality, setPersonality] = useState<Personality>("technical");
  const [language, setLanguage] = useState<Language>("en");
  const [preferredName, setPreferredName] = useState("");
  const [formOfAddress, setFormOfAddress] = useState("");

  const d = dict(language);

  function choosePersonality(p: Personality) {
    setPersonality(p);
    applyPersonality(p); // live preview across the whole screen
  }

  function finish() {
    const config: SentinelConfig = {
      onboarded: true,
      personality,
      language,
      preferredName: preferredName.trim(),
      formOfAddress: formOfAddress.trim(),
      autoFetchEnabled: false,
      autoFetchIntervalMinutes: 30,
    };
    void completeOnboarding(config);
  }

  return (
    <div className="onboard">
      <div className="steps">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`dot ${i <= step ? "on" : ""}`} />
        ))}
      </div>

      {step === 0 && (
        <>
          <h2>{d.onboarding.chooserPersonality}</h2>
          <div className="persona-grid">
            {PERSONALITIES.map((p) => (
              <button
                key={p}
                className={`persona-card ${personality === p ? "selected" : ""}`}
                onClick={() => choosePersonality(p)}
              >
                <div className="pname">{d.personalities[p].name}</div>
                <div className="pdesc">{d.personalities[p].description}</div>
              </button>
            ))}
          </div>

          <div className="persona-preview">
            <div className="hello">
              {personaGreeting(personality, d, {
                preferredName: preferredName || "Samuel",
                formOfAddress: formOfAddress || "",
                now: new Date(),
              })}
            </div>
            <div className="status">
              {personaStatus(personality, d, { total: 3, dirty: 1 })}
            </div>
          </div>

          <div className="wrap-actions">
            <button className="primary" onClick={() => setStep(1)}>
              {d.onboarding.continue}
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h2>{d.onboarding.chooseLanguage}</h2>
          <div className="persona-grid">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                className={`persona-card ${language === l.id ? "selected" : ""}`}
                onClick={() => setLanguage(l.id)}
              >
                <div className="pname">{l.label}</div>
              </button>
            ))}
          </div>
          <div className="wrap-actions">
            <button onClick={() => setStep(0)}>{d.common.back}</button>
            <button className="primary" onClick={() => setStep(2)}>
              {d.onboarding.continue}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2>{d.onboarding.aboutYouStep}</h2>
          <div className="field">
            <label>{d.onboarding.nameQuestion}</label>
            <input
              autoFocus
              value={preferredName}
              placeholder={d.onboarding.namePlaceholder}
              onChange={(e) => setPreferredName(e.target.value)}
            />
          </div>
          <div className="field">
            <label>{d.onboarding.addressQuestion}</label>
            <input
              value={formOfAddress}
              placeholder={d.onboarding.addressPlaceholder}
              onChange={(e) => setFormOfAddress(e.target.value)}
            />
            <div className="hint">{d.onboarding.addressHint}</div>
          </div>
          <div className="wrap-actions">
            <button onClick={() => setStep(1)}>{d.common.back}</button>
            <button className="primary" onClick={finish}>
              {d.onboarding.finish}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
