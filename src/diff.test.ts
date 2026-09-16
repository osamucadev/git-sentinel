import { describe, expect, it } from "vitest";
import { parseDiff } from "./diff";

describe("parseDiff", () => {
  it("returns no rows for empty content", () => {
    expect(parseDiff("")).toEqual([]);
  });

  it("classifies file headers as meta before the first hunk", () => {
    const rows = parseDiff([
      "diff --git a/f.txt b/f.txt",
      "index 1234567..89abcde 100644",
      "--- a/f.txt",
      "+++ b/f.txt",
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ].join("\n"));
    expect(rows.slice(0, 4).map((r) => r.kind)).toEqual(["meta", "meta", "meta", "meta"]);
    expect(rows[4].kind).toBe("hunk");
  });

  it("numbers old and new lines across a hunk", () => {
    const rows = parseDiff([
      "@@ -10,3 +10,3 @@",
      " ctx",
      "-removed",
      "+added",
    ].join("\n"));
    expect(rows[1]).toMatchObject({ kind: "context", text: "ctx", oldLine: 10, newLine: 10 });
    expect(rows[2]).toMatchObject({ kind: "del", text: "removed", oldLine: 11, newLine: null });
    expect(rows[3]).toMatchObject({ kind: "add", text: "added", oldLine: null, newLine: 11 });
  });

  it("accepts hunk headers without explicit line counts", () => {
    const rows = parseDiff("@@ -1 +1 @@\n-a\n+b");
    expect(rows[1]).toMatchObject({ oldLine: 1, newLine: null });
    expect(rows[2]).toMatchObject({ oldLine: null, newLine: 1 });
  });

  it("continues numbering across consecutive hunks", () => {
    const rows = parseDiff([
      "@@ -1 +1 @@",
      "+a",
      "@@ -5 +5 @@",
      "+b",
    ].join("\n"));
    expect(rows[1]).toMatchObject({ newLine: 1 });
    expect(rows[3]).toMatchObject({ newLine: 5 });
  });

  it("treats --- and +++ inside a hunk as content lines, not headers", () => {
    // Deleting a line whose content starts with "--" produces "--- ...";
    // adding one whose content starts with "++" produces "+++ ...".
    const rows = parseDiff("@@ -1 +1 @@\n--- a comment\n+++ a comment");
    expect(rows[1]).toMatchObject({ kind: "del", text: "-- a comment", oldLine: 1 });
    expect(rows[2]).toMatchObject({ kind: "add", text: "++ a comment", newLine: 1 });
  });

  it("resets hunk state on the next file so its headers are meta again", () => {
    const rows = parseDiff([
      "@@ -1 +1 @@",
      "-a",
      "+b",
      "diff --git a/g.txt b/g.txt",
      "--- a/g.txt",
      "+++ b/g.txt",
      "@@ -2 +2 @@",
      "-c",
      "+d",
    ].join("\n"));
    expect(rows[3].kind).toBe("meta");
    expect(rows[4].kind).toBe("meta");
    expect(rows[5].kind).toBe("meta");
    expect(rows[7]).toMatchObject({ kind: "del", oldLine: 2 });
    expect(rows[8]).toMatchObject({ kind: "add", newLine: 2 });
  });

  it("classifies the no-newline marker and the truncation notice as notes", () => {
    const rows = parseDiff("@@ -1 +1 @@\n-a\n+b\n\\ No newline at end of file\n\n… diff truncated by Git Sentinel …\n");
    expect(rows[3]).toMatchObject({ kind: "note", text: "\\ No newline at end of file" });
    expect(rows[5]).toMatchObject({ kind: "note", text: "… diff truncated by Git Sentinel …" });
  });

  it("treats a completely empty line inside a hunk as context", () => {
    const rows = parseDiff("@@ -1,2 +1,2 @@\n\n end");
    expect(rows[1]).toMatchObject({ kind: "context", text: "", oldLine: 1, newLine: 1 });
    expect(rows[2]).toMatchObject({ kind: "context", text: "end", oldLine: 2, newLine: 2 });
  });

  it("keeps new-file and deleted-file mode lines as meta", () => {
    const rows = parseDiff("diff --git a/n.txt b/n.txt\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/n.txt\n@@ -0,0 +1 @@\n+hi");
    expect(rows.map((r) => r.kind)).toEqual(["meta", "meta", "meta", "meta", "meta", "hunk", "add"]);
    expect(rows[6]).toMatchObject({ newLine: 1 });
  });
});
