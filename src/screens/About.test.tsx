import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { ptBR } from "../i18n/pt-BR";
import { es } from "../i18n/es";
import { AboutContent, PROJECT_URLS, readInstalledVersion } from "./About";

describe("About", () => {
  it("uses localized navigation labels for all supported languages", () => {
    expect(en.common.hq).toBe("Headquarters");
    expect(ptBR.common.hq).toBe("Quartel-general");
    expect(es.common.hq).toBe("Cuartel general");
    expect(en.common.about).toBe("About");
    expect(ptBR.common.about).toBe("Sobre");
    expect(es.common.about).toBe("Acerca de");
    expect(en.common.settings).toBe("Settings");
    expect(ptBR.common.settings).toBe("Configurações");
    expect(es.common.settings).toBe("Configuración");
  });

  it("shows ownership, installed version, acknowledgements, and all project links", () => {
    const html = renderToStaticMarkup(
      <AboutContent d={en} version="0.1.0" onOpenExternal={() => {}} />,
    );

    expect(html).toContain("Git Sentinel");
    expect(html).toContain("v0.1.0");
    expect(html).toContain("Samuel Caetité");
    expect(html).toContain("@osamucadev");
    expect(html).toContain(en.about.specialThanks);
    expect(html).toContain("Claude Code");
    expect(html).toContain("ChatGPT Web");
    expect(html).toContain("Codex Desktop");
    for (const url of Object.values(PROJECT_URLS)) expect(html).toContain(url);
  });

  it("reads the version through Tauri metadata and degrades safely outside Tauri", async () => {
    await expect(readInstalledVersion(async () => "0.1.0")).resolves.toBe("0.1.0");
    await expect(readInstalledVersion(async () => { throw new Error("not in Tauri"); })).resolves.toBeNull();
  });
});
