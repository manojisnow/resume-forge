import React, { useEffect, useRef } from "react";
import { SECTIONS } from "../../shared/resume.mjs";

export function ImportReview({ pending, source, onNew, onReplace, onCancel }) {
  const dialog = useRef();
  useEffect(() => { dialog.current.showModal(); }, []);
  const unchanged = source && JSON.stringify(source.data) === JSON.stringify(pending.original);
  return <dialog className="rf-utility" ref={dialog} onCancel={onCancel} aria-labelledby="import-review-title" style={{ width: "min(680px, 90vw)", maxHeight: "85vh", padding: 24, border: "1px solid #cbd5e1", borderRadius: 12 }}>
    <h2 id="import-review-title">Review imported resume</h2>
    <p>Check the extracted details before saving. This import started from <strong>{pending.sourceName}</strong>.</p>
    <p>{pending.data.personal.name || "Name not found"} · {pending.data.personal.title || "Title not found"}</p>
    <ul>{SECTIONS.map(s => <li key={s}>{s}: {pending.data[s].length} entries</li>)}</ul>
    <details><summary>Compare current and imported details</summary>
      <h3>Original</h3><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>{JSON.stringify(pending.original, null, 2)}</pre>
      <h3>Imported</h3><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>{JSON.stringify(pending.data, null, 2)}</pre>
    </details>
    {!unchanged && <p role="status">The source resume changed or was deleted while importing. Save this import as a new resume.</p>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
      <button autoFocus onClick={onNew}>Save as new resume</button>
      <button disabled={!unchanged} onClick={onReplace}>Replace {pending.sourceName} (undo available)</button>
      <button onClick={onCancel}>Discard import</button>
    </div>
  </dialog>;
}
