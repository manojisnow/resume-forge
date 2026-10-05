import React, { useState, useRef, useEffect } from "react";

const COLORS = ["#1a365d", "#1a4731", "#7b1d1d", "#3b0764", "#1e3a5f", "#134e4a", "#92400e", "#1c1c1e"];

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function dotColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function ResumeManager({ resumes, activeId, onSwitch, onCreate, onDuplicate, onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const editRef = useRef();
  const active = resumes.find(r => r.id === activeId);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  const startRename = (e, r) => {
    e.stopPropagation();
    setEditingId(r.id);
    setEditName(r.name);
  };

  const commitRename = () => {
    if (editName.trim()) onRename(editingId, editName.trim());
    setEditingId(null);
  };

  const handleSwitch = (id) => {
    onSwitch(id);
    setOpen(false);
  };

  return (
    <div style={{ borderBottom: "1.5px solid #e2e8f0" }}>
      {/* Current resume + toggle */}
      <button type="button" aria-expanded={open} aria-label="Choose resume"
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", border: "none", textAlign: "left", padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: open ? "#f8fafc" : "#fff", userSelect: "none" }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? dotColor(active.id) : "#94a3b8", flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {active?.name || "Untitled"}
        </span>
        <span style={{ fontSize: 10, color: "#94a3b8" }}>{resumes.length} resume{resumes.length !== 1 ? "s" : ""}</span>
        <span style={{ fontSize: 10, color: "#94a3b8", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
      </button>

      {/* Dropdown list */}
      {open && (
        <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {resumes.map(r => (
              <div
                key={r.id}
                onClick={() => r.id !== activeId && handleSwitch(r.id)}
                style={{ padding: "9px 20px", display: "flex", alignItems: "center", gap: 10, cursor: r.id === activeId ? "default" : "pointer", background: r.id === activeId ? "#eff6ff" : "transparent", borderLeft: r.id === activeId ? "3px solid #3b82f6" : "3px solid transparent" }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor(r.id), flexShrink: 0 }} />

                {editingId === r.id ? (
                  <input
                    ref={editRef}
                    aria-label="Resume name" maxLength={200} value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); }}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, fontSize: 12, border: "1.5px solid #3b82f6", borderRadius: 4, padding: "2px 6px", outline: "none" }}
                  />
                ) : (
                  <button type="button" onClick={e => { e.stopPropagation(); handleSwitch(r.id); }} aria-current={r.id === activeId ? "true" : undefined} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: r.id === activeId ? 600 : 400, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name}
                  </button>
                )}

                <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>{relativeTime(r.updatedAt)}</span>

                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button title="Rename" onClick={e => startRename(e, r)}
                    style={{ padding: "2px 5px", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#94a3b8", borderRadius: 4 }}>✎</button>
                  <button title="Duplicate" onClick={e => { e.stopPropagation(); onDuplicate(r.id); setOpen(false); }}
                    style={{ padding: "2px 5px", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#94a3b8", borderRadius: 4 }}>⧉</button>
                  <button title="Delete" onClick={e => { e.stopPropagation(); if (resumes.length > 1) onDelete(r.id); }}
                    style={{ padding: "2px 5px", background: "none", border: "none", cursor: resumes.length > 1 ? "pointer" : "not-allowed", fontSize: 11, color: resumes.length > 1 ? "#f87171" : "#e2e8f0", borderRadius: 4 }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "8px 20px", borderTop: "1px solid #e2e8f0" }}>
            <button onClick={() => { onCreate(); setOpen(false); }}
              style={{ width: "100%", padding: "7px 0", background: "#fff", border: "1.5px dashed #cbd5e1", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748b" }}>
              + New resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
