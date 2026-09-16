// Parser for unified Git diff text into display rows. Pure functions, no I/O:
// the same parsed shape drives rendering and tests.

export type DiffRowKind = "meta" | "hunk" | "add" | "del" | "context" | "note";

export type DiffRow = {
  kind: DiffRowKind;
  /** Display text. For add/del/context the leading +/-/space marker is
   * stripped (it is shown in its own column); other kinds keep the full line. */
  text: string;
  /** 1-based line number on the old side, or null when the row does not
   * exist there (additions, headers, notes). */
  oldLine: number | null;
  /** 1-based line number on the new side, or null for deletions, headers,
   * and notes. */
  newLine: number | null;
};

/** Header lines that only appear before a file's first hunk. Checked only
 * when we are between files, so a deleted line whose content starts with
 * "--" (rendered as "--- ...") is never mistaken for the "--- a/file"
 * header. */
const META_PREFIXES = [
  "diff --git ",
  "index ",
  "--- ",
  "+++ ",
  "new file mode",
  "deleted file mode",
  "old mode ",
  "new mode ",
  "similarity index ",
  "dissimilarity index ",
  "rename from ",
  "rename to ",
  "copy from ",
  "copy to ",
  "Binary files ",
  "GIT binary patch",
];

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseDiff(content: string): DiffRow[] {
  if (!content.trim()) return [];
  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of content.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inHunk = false;
      rows.push({ kind: "meta", text: line, oldLine: null, newLine: null });
      continue;
    }
    if (!inHunk && META_PREFIXES.some((p) => line.startsWith(p))) {
      rows.push({ kind: "meta", text: line, oldLine: null, newLine: null });
      continue;
    }
    if (line.startsWith("@@")) {
      const m = HUNK_RE.exec(line);
      if (m) {
        oldLine = Number.parseInt(m[1], 10);
        newLine = Number.parseInt(m[2], 10);
        inHunk = true;
      }
      rows.push({ kind: "hunk", text: line, oldLine: null, newLine: null });
      continue;
    }
    if (!inHunk) {
      // Stray text outside any file section: show it dimmed rather than drop it.
      rows.push({ kind: "meta", text: line, oldLine: null, newLine: null });
      continue;
    }

    const marker = line[0];
    if (marker === "+") {
      rows.push({ kind: "add", text: line.slice(1), oldLine: null, newLine: newLine++ });
    } else if (marker === "-") {
      rows.push({ kind: "del", text: line.slice(1), oldLine: oldLine++, newLine: null });
    } else if (marker === " " || line === "") {
      // Git pads context lines with a leading space; a completely empty line
      // inside a hunk is still context (some tools strip trailing spaces).
      rows.push({ kind: "context", text: line === "" ? "" : line.slice(1), oldLine: oldLine++, newLine: newLine++ });
    } else {
      // "\ No newline at end of file", and our own trailing truncation notice.
      rows.push({ kind: "note", text: line, oldLine: null, newLine: null });
    }
  }
  return rows;
}
