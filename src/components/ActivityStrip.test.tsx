import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { beginActivity, completeActivity } from "../activity";
import { en } from "../i18n/en";
import { es } from "../i18n/es";
import { ptBR } from "../i18n/pt-BR";
import { ActivityStrip } from "./ActivityStrip";

describe("ActivityStrip", () => {
  it("renders localized aggregate progress in English, Portuguese and Spanish", () => {
    for (const d of [en, ptBR, es]) {
      const html = renderToStaticMarkup(<ActivityStrip activity={{ ...beginActivity("fetchAll", 8), completed: 3, currentPath: "/repos/mayalms" }} d={d} p="technical" />);
      expect(html).toContain(d.activity.fetchAll);
      expect(html).toContain(d.activity.progress.replace("{done}", "3").replace("{total}", "8"));
    }
  });

  it("shows the completed state without keeping an active operation", () => {
    const html = renderToStaticMarkup(<ActivityStrip activity={completeActivity({ ...beginActivity("fetch", 1), completed: 1 })} d={en} p="jarbas" />);
    expect(html).toContain(en.activity.completed.replace("{done}", "1"));
    expect(html).toContain('data-phase="complete"');
  });
});
