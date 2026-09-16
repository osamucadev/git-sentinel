import { parseDiff, type DiffRowKind } from "../diff";

const MARKERS: Record<DiffRowKind, string> = {
  add: "+",
  del: "-",
  context: " ",
  hunk: "",
  meta: "",
  note: "",
};

/** Structured, color-coded rendering of unified diff text. All colors come
 * from the active personality's own tokens (see themes.css), so every
 * personality keeps its visual identity. */
export function DiffView({ content }: { content: string }) {
  const rows = parseDiff(content);
  return (
    <div className="diff-lines">
      {rows.map((row, i) => (
        <div key={i} className={`diff-line diff-line--${row.kind}`}>
          <span className="diff-gutter">{row.oldLine ?? ""}</span>
          <span className="diff-gutter">{row.newLine ?? ""}</span>
          <span className="diff-marker">{MARKERS[row.kind]}</span>
          <span className="diff-text">{row.text}</span>
        </div>
      ))}
    </div>
  );
}
