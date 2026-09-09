import { useState } from "react";
import { fill } from "../i18n";
import type { Dict } from "../i18n/en";

/** Explains the selected comparison base without turning Git facts into a graph. */
export function ReferenceHelp({
  branch,
  reference,
  ahead,
  behind,
  d,
}: {
  branch: string;
  reference: string;
  ahead: number;
  behind: number;
  d: Dict;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="reference-help" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="reference-help-button"
        aria-label={d.referenceHelp.button}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
      >
        ?
      </button>
      {open && (
        <span className="reference-help-pop" role="tooltip">
          <span>{fill(d.referenceHelp.branchBase, { branch, reference })}</span>
          <span>{fill(d.referenceHelp.counts, { ahead, behind })}</span>
          <span>{d.referenceHelp.safe}</span>
        </span>
      )}
    </span>
  );
}
