import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DiffView } from "./DiffView";

const SAMPLE = [
  "diff --git a/f.txt b/f.txt",
  "index 1234567..89abcde 100644",
  "--- a/f.txt",
  "+++ b/f.txt",
  "@@ -1,2 +1,2 @@",
  " keep",
  "-gone",
  "+here",
].join("\n");

describe("DiffView", () => {
  it("renders typed rows with markers and line-number gutters", () => {
    const html = renderToStaticMarkup(<DiffView content={SAMPLE} />);
    expect(html).toContain("diff-lines");
    expect(html).toContain("diff-line--meta");
    expect(html).toContain("diff-line--hunk");
    expect(html).toContain("diff-line--context");
    expect(html).toContain("diff-line--del");
    expect(html).toContain("diff-line--add");
    // content without the leading +/- marker
    expect(html).toContain("gone");
    expect(html).toContain("here");
    // gutters carry the old/new line numbers
    expect(html).toMatch(/diff-gutter">1<\//);
    expect(html).toMatch(/diff-gutter">2<\//);
  });

  it("renders nothing but the container for empty content", () => {
    const html = renderToStaticMarkup(<DiffView content="" />);
    expect(html).toBe('<div class="diff-lines"></div>');
  });
});
