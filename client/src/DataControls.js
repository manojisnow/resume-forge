import React, { useRef, useState } from "react";

export function downloadJSON(value, filename) {
  const url = URL.createObjectURL(new Blob([typeof value === "string" ? value : JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataControls({ store, saveStatus, saveError, blocked, blockReason, onUndo, onSnapshot, onRestoreBackup, onRestoreDeleted, onRetry, onRecover, onNewDraft, onDownloadUnreadable }) {
  const input = useRef(); const [error, setError] = useState("");
  const active = store.resumes.find(r => r.id === store.activeId);
  async function restore(event) {
    const file = event.target.files[0]; event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Backup files must be under 10 MB.");
      onRestoreBackup(await file.text()); setError("");
    } catch (e) { setError(e.message); }
  }
  return <div className="rf-utility" style={{ padding: "10px 20px", borderBottom: "1px solid #e2e8f0", fontSize: 11 }}>
    <p role="status" aria-live="polite" style={{ margin: "0 0 8px", color: saveError ? "#b91c1c" : "#475569" }}>{saveError || saveStatus}</p>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button onClick={onUndo} disabled={!active.history.length}>Undo</button>
      <button onClick={() => downloadJSON(store, `resumeforge-backup-${new Date().toISOString().slice(0, 10)}.json`)}>Download backup</button>
      <button onClick={() => input.current.click()}>Restore backup</button>
      <input ref={input} type="file" accept=".json,application/json" onChange={restore} hidden aria-label="Choose resume backup" />
      {store.trash.length > 0 && <button disabled={store.resumes.length >= 200} onClick={onRestoreDeleted}>Restore deleted resume</button>}
      {saveError && !blocked && <button onClick={onRetry}>Retry save</button>}
    </div>
    {active.history.length > 0 && <label style={{ display: "block", marginTop: 8 }}>Previous versions <select value="" onChange={e => onSnapshot(e.target.value)}>
      <option value="">Restore a snapshot…</option>
      {[...active.history].reverse().map(h => <option key={h.id} value={h.id}>{h.label} — {new Date(h.at).toLocaleTimeString()}</option>)}
    </select></label>}
    {blocked && blockReason === "conflict" && <button style={{ marginTop: 8 }} onClick={() => window.location.reload()}>Load latest saved data (download this tab's backup first)</button>}
    {blocked && blockReason !== "conflict" && <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
      <button onClick={onDownloadUnreadable}>Download unreadable data</button>
      <button onClick={onRecover}>Recover last saved copy</button>
      <button onClick={onNewDraft}>Save this draft instead</button>
    </div>}
    {error && <p role="alert">{error}</p>}
    <p style={{ margin: "7px 0 0", color: "#64748b" }}>Backups contain personal information. Restoring adds copies and keeps your current resumes.</p>
  </div>;
}
