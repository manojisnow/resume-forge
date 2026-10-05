import React, { useState, useRef, useCallback, useEffect, useId } from "react";
import { ModernTemplate, ClassicTemplate, ExecutiveTemplate, TechTemplate } from "./Templates";
import { parseText, parseFile, exportPDF, improveText, tailorResume } from "./api";
import { ResumeManager } from "./ResumeManager";
import { DataControls, downloadJSON } from "./DataControls";
import { ImportReview } from "./ImportReview";
import { PRINT_CSS } from "../../shared/print.mjs";
import { validateResume, validateTailoring } from "../../shared/resume.mjs";
import { STORE_KEY, RECOVERY_KEY, loadStore, persistStore, newResume, makeId, updateResume, undoResume, applyRewrite, importBackup, validateStore } from "./resumeStore.mjs";

function loadInitialState() {
  try { return loadStore(window.localStorage); }
  catch { return loadStore({ getItem() { throw new Error("Storage unavailable"); } }); }
}

const ACCENT_COLORS = [
  { name: "Navy", value: "#1a365d" }, { name: "Slate", value: "#2d3748" },
  { name: "Forest", value: "#1a4731" }, { name: "Crimson", value: "#7b1d1d" },
  { name: "Violet", value: "#3b0764" }, { name: "Steel", value: "#1e3a5f" },
  { name: "Teal", value: "#134e4a" }, { name: "Charcoal", value: "#1c1c1e" },
];

const inputStyle = {
  width: "100%", padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 6,
  fontSize: 13, color: "#1a1a1a", background: "#fff", boxSizing: "border-box", outline: "none",
};
const labelStyle = {
  fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase",
  letterSpacing: "0.5px", display: "block", marginBottom: 4,
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function Field({ label, value, onChange, multiline, rows = 3, placeholder }) {
  const id = useId();
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label htmlFor={id} style={labelStyle}>{label}</label>}
      {multiline
        ? <textarea maxLength={20000} id={id} value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        : <input maxLength={20000} id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />}
    </div>
  );
}

function ListEditor({ items, setItems, newItem, renderItem, label }) {
  const [expanded, setExpanded] = useState(null);
  const add = () => { if (items.length >= 200) return; const item = newItem(); setItems([...items, item]); setExpanded(item.id); };
  const remove = id => setItems(items.filter(i => i.id !== id));
  const update = (id, field, val) => setItems(items.map(i => i.id === id ? { ...i, [field]: val } : i));
  const move = (idx, dir) => {
    const arr = [...items], t = idx + dir;
    if (t < 0 || t >= arr.length) return;
    [arr[idx], arr[t]] = [arr[t], arr[idx]];
    setItems(arr);
  };
  return (
    <div>
      {items.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", background: "#f8fafc", borderRadius: 10, border: "2px dashed #e2e8f0", marginBottom: 12 }}>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>No {label.toLowerCase()} entries yet</p>
        </div>
      )}
      {items.map((item, idx) => (
        <div key={item.id} style={{ marginBottom: 8, border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
            <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 16 }}>{idx + 1}</span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
              {item.company || item.institution || item.name || item.category || `${label} ${idx + 1}`}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {[["↑", -1], ["↓", 1]].map(([lbl, d]) => (
                <button key={lbl} onClick={e => { e.stopPropagation(); move(idx, d); }} style={{ padding: "2px 6px", background: "#f1f5f9", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>{lbl}</button>
              ))}
              <button onClick={e => { e.stopPropagation(); remove(item.id); }} style={{ padding: "2px 6px", background: "#fee2e2", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, color: "#dc2626" }}>✕</button>
            </div>
          </div>
          {expanded === item.id && (
            <div style={{ padding: 12, borderTop: "1.5px solid #e2e8f0" }}>
              {renderItem(item, (field, val) => update(item.id, field, val))}
            </div>
          )}
        </div>
      ))}
      <button disabled={items.length >= 200} onClick={add} style={{ width: "100%", padding: 10, background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748b", marginTop: 4 }}>
        + Add {label}
      </button>
    </div>
  );
}

function SkillTagInput({ tags, onChange }) {
  const [input, setInput] = useState("");
  const inputRef = useRef();

  const addTags = (raw) => {
    const parts = raw.split(",").map(t => t.trim()).filter(Boolean);
    const unique = parts.filter(t => !tags.includes(t));
    if (unique.length) onChange([...tags, ...unique].slice(0, 200));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTags(input);
      setInput("");
    } else if (e.key === "Backspace" && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (input.trim()) { addTags(input); setInput(""); }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    addTags(e.clipboardData.getData("text"));
    setInput("");
  };

  return (
    <div onClick={() => inputRef.current?.focus()}
      style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "6px 8px", border: "1.5px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "text", minHeight: 38, alignItems: "center" }}>
      {tags.map((tag, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px 2px 10px", background: "#f1f5f9", borderRadius: 20, fontSize: 12, color: "#334155" }}>
          {tag}
          <button onClick={e => { e.stopPropagation(); onChange(tags.filter((_, j) => j !== i)); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 14, lineHeight: 1, padding: "0 1px" }}>×</button>
        </span>
      ))}
      <input ref={inputRef} value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onPaste={handlePaste}
        placeholder={tags.length === 0 ? "Type skill, press Enter or ," : ""}
        style={{ border: "none", outline: "none", fontSize: 12, flex: 1, minWidth: 120, background: "transparent", padding: "2px" }}
      />
    </div>
  );
}

function scoreColor(score) {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

const AI_ACTIONS = [
  { id: "improve", label: "✨ Improve", desc: "Stronger action verbs" },
  { id: "concise", label: "📏 Concise", desc: "Shorter, same meaning" },
  { id: "quantify", label: "📊 Quantify", desc: "Suggest metric placeholders to verify" },
];

function InlineAIButton({ text, action: fixedAction, actions = AI_ACTIONS, onResult, context = {} }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(null);
  const [aiError, setAiError] = useState("");
  const wrapRef = useRef();
  const generation = useRef(0);
  const [proposal, setProposal] = useState(null);
  useEffect(() => { generation.current++; setProposal(null); setLoading(null); return () => { generation.current++; }; }, [text]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const run = async (actionId) => {
    if (!text?.trim()) return;
    if (loading) return;
    const request = ++generation.current;
    const original = text;
    setProposal(null);
    setLoading(actionId);
    setAiError("");
    try {
      const result = await improveText(text, actionId, context);
      if (request !== generation.current) return;
      if (typeof result !== "string" || !result.trim()) throw new Error("AI returned an empty suggestion.");
      setProposal({ original, improved: result });
    } catch (e) {
      if (request === generation.current) setAiError(e.message);
    } finally {
      if (request === generation.current) setLoading(null);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} title="AI rewrite"
        style={{ padding: "0 7px", height: "100%", minHeight: 32, background: open ? "#ede9fe" : "#f8f5ff", border: "1.5px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 12, color: open ? "#7c3aed" : "#a78bfa", display: "flex", alignItems: "center" }}>
        ✨
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 200, minWidth: 190, overflow: "hidden" }}>
          {actions.map(a => (
            <button key={a.id} onClick={() => run(a.id)} disabled={!!loading}
              style={{ width: "100%", padding: "9px 14px", border: "none", borderBottom: "1px solid #f1f5f9", background: loading === a.id ? "#f5f3ff" : "#fff", cursor: loading ? "default" : "pointer", textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: loading === a.id ? "#7c3aed" : "#0f172a" }}>
                {loading === a.id ? "⏳ Rewriting..." : a.label}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>{a.desc}</p>
            </button>
          ))}
          {proposal && <div className="rf-utility" style={{ padding: 12, maxWidth: 300, fontSize: 12 }}>
            <p><strong>Original:</strong> {proposal.original}</p>
            <p><strong>Suggested:</strong> {proposal.improved}</p>
            <p>Verify facts and replace any metric placeholders before using this text.</p>
            <button onClick={() => { onResult(proposal.improved, proposal.original); setProposal(null); setOpen(false); }}>Apply suggestion</button>
            <button onClick={() => { setProposal(null); setOpen(false); }}>Discard</button>
          </div>}
          {aiError && <p style={{ margin: 0, padding: "8px 14px", fontSize: 11, color: "#dc2626", background: "#fef2f2" }}>⚠️ {aiError}</p>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [initial] = useState(loadInitialState);
  const [store, setStore] = useState(initial.store);
  const [saveError, setSaveError] = useState(initial.error);
  const [saveStatus, setSaveStatus] = useState("Saving…");
  const [retrySave, setRetrySave] = useState(0);
  const blocked = useRef(initial.blocked);
  const blockReason = useRef(initial.blocked ? "unreadable" : "");
  const storeRef = useRef(store); storeRef.current = store;
  const { resumes, activeId } = store;
  const active = resumes.find(r => r.id === activeId);
  const data = active.data;
  const { template, accent, keepEntriesTogether } = active.design;
  const [notice, setNotice] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const [provider, setProvider] = useState(null);
  const tailorRequest = useRef(0);
  const [previewInfo, setPreviewInfo] = useState({ pages: 1, overflow: false });

  useEffect(() => {
    if (blocked.current) return;
    try { persistStore(window.localStorage, store); setSaveError(""); setSaveStatus("Saved on this device"); }
    catch { setSaveError("Changes are not saved. Browser storage is unavailable or full. Download a backup, then retry."); }
  }, [store, retrySave]);
  useEffect(() => {
    const changed = event => {
      if (event.key === STORE_KEY && event.newValue !== JSON.stringify(storeRef.current)) {
        blocked.current = true;
        blockReason.current = "conflict";
        setSaveError("Another tab changed your resumes. Download this tab's backup, then reload to use the latest saved version.");
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { signal: AbortSignal.timeout(10000) }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(result => { if (!cancelled) setProvider(result); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const el = document.getElementById("resume-preview");
    if (!el) return;
    const measure = () => setPreviewInfo({ pages: Math.max(1, Math.ceil((el.scrollHeight - 1) / (297 * 96 / 25.4))), overflow: el.scrollWidth > el.clientWidth + 2 });
    const observer = new ResizeObserver(measure); observer.observe(el); measure();
    return () => observer.disconnect();
  }, [activeId, data, template, accent]);

  const saveDesign = changes => setStore(s => updateResume(s, activeId, s.resumes.find(r => r.id === activeId).data, "Design change", undefined, { ...active.design, ...changes }));
  const setTemplate = template => saveDesign({ template });
  const setAccent = accent => saveDesign({ accent });
  const [tab, setTab] = useState("import");
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [activeSection, setActiveSection] = useState("personal");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [importMode, setImportMode] = useState("upload");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [tailoring, setTailoring] = useState(false);
  const [tailorResult, setTailorResult] = useState(null);
  const [tailorError, setTailorError] = useState("");
  const [acceptedSuggestions, setAcceptedSuggestions] = useState(new Set());
  const fileInputRef = useRef();

  useEffect(() => {
    tailorRequest.current++;
    setTailoring(false);
    setTailorResult(null); setAcceptedSuggestions(new Set()); setTailorError("");
  }, [activeId]);

  // Capture the resume ID from this render, never whichever resume is active later.
  const save = useCallback((newData, label = "Edit", expectedData) => {
    setStore(s => updateResume(s, activeId, newData, label, expectedData));
  }, [activeId]);

  const updatePersonal = (field, val) => save({ ...data, personal: { ...data.personal, [field]: val } });

  const createResume = (blank = false) => {
    if (storeRef.current.resumes.length >= 200) { setNotice("The resume limit is 200. Download a backup, then remove unused resumes."); return; }
    const resume = newResume();
    setStore(s => ({ ...s, resumes: [...s.resumes, resume], activeId: resume.id }));
    setTab(blank ? "edit" : "import");
  };

  const duplicateResume = (id) => {
    if (storeRef.current.resumes.length >= 200) { setNotice("The resume limit is 200."); return; }
    const src = resumes.find(r => r.id === id);
    if (!src) return;
    const newId = makeId();
    setStore(s => ({ ...s, resumes: [...s.resumes, { ...src, id: newId, name: `${src.name.slice(0, 190)} (copy)`, updatedAt: Date.now(), history: [] }], activeId: newId }));
    setTab("edit");
  };

  const renameResume = (id, name) => {
    setStore(s => ({ ...s, resumes: s.resumes.map(r => r.id === id ? { ...r, name: name.slice(0, 200) } : r) }));
  };

  const deleteResume = (id) => {
    if (!window.confirm("Delete this resume? You can restore it using Restore deleted resume.")) return;
    setStore(s => {
      if (s.resumes.length <= 1) return s;
      const next = s.resumes.filter(r => r.id !== id);
      return { ...s, resumes: next, activeId: s.activeId === id ? next[0].id : s.activeId, trash: [...s.trash, s.resumes.find(r => r.id === id)].slice(-10) };
    });
  };

  const switchResume = (id) => {
    setStore(s => ({ ...s, activeId: id }));
    setTab("edit");
  };

  const handleFileUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setParseError("Files must be under 10 MB."); return; }
    const ok = file.type === "application/pdf" || file.type.includes("wordprocessingml") || file.name.endsWith(".docx");
    if (!ok) { setParseError("Please upload a PDF or DOCX file."); return; }
    setUploadedFile(file);
    setParseError("");
  };

  const handleParse = async () => {
    if (parsing) return;
    if (importMode === "paste" && !rawText.trim()) return;
    if (importMode === "upload" && !uploadedFile) return;
    setParsing(true);
    setParseError("");
    try {
      const parsed = importMode === "upload" ? await parseFile(uploadedFile) : await parseText(rawText);
      const validated = validateResume(parsed);
      setPendingImport({ data: validated, sourceId: activeId, sourceName: active.name, original: data });
    } catch (e) {
      setParseError(e.message);
    } finally {
      setParsing(false);
    }
  };

  const handleTailor = async () => {
    if (tailoring || !jobDesc.trim()) return;
    const request = ++tailorRequest.current;
    const sourceId = activeId; const original = data;
    setTailoring(true); setTailorError(""); setTailorResult(null); setAcceptedSuggestions(new Set());
    try {
      const result = await tailorResume(original, jobDesc);
      if (request !== tailorRequest.current) return;
      const current = storeRef.current.resumes.find(r => r.id === sourceId);
      if (!current || JSON.stringify(current.data) !== JSON.stringify(original)) throw new Error("The resume changed during analysis. Analyze it again to get current suggestions.");
      setTailorResult({ ...validateTailoring(result, original), sourceId });
    } catch (e) { if (request === tailorRequest.current) setTailorError(e.message); }
    finally { if (request === tailorRequest.current) setTailoring(false); }
  };

  const acceptSuggestion = (i, suggestion) => {
    const sourceId = tailorResult.sourceId;
    const current = storeRef.current.resumes.find(r => r.id === sourceId);
    const exp = current?.data.experience.find(e => e.id === suggestion.itemId);
    if (!exp || exp.bullets[suggestion.bulletIndex] !== suggestion.original) {
      setTailorError("That bullet changed. Run analysis again before applying this suggestion."); return;
    }
    setStore(s => applyRewrite(s, sourceId, suggestion, suggestion.original, suggestion.improved));
    setAcceptedSuggestions(prev => new Set([...prev, i]));
  };

  const acceptRewrite = (target, original, improved) => {
    setStore(s => applyRewrite(s, activeId, target, original, improved));
  };
  const applyImport = replace => {
    const pending = pendingImport;
    if (replace) {
      const source = storeRef.current.resumes.find(r => r.id === pending.sourceId);
      if (!source || JSON.stringify(source.data) !== JSON.stringify(pending.original)) { setNotice("Source changed. Save the import as a new resume instead."); return; }
      setStore(s => updateResume(s, pending.sourceId, pending.data, "Import", pending.original));
      setStore(s => ({ ...s, activeId: pending.sourceId }));
    } else {
      if (storeRef.current.resumes.length >= 200) { setNotice("The resume limit is 200. Keep the import open while you remove an unused resume."); return; }
      const resume = newResume(pending.data.personal.name || "Imported resume", pending.data);
      setStore(s => ({ ...s, resumes: [...s.resumes, resume], activeId: resume.id }));
    }
    setPendingImport(null); setTab("edit"); setActiveSection("personal");
  };
  const restoreBackup = raw => {
    const result = importBackup(storeRef.current, raw);
    setStore(result); setTab("edit"); setNotice("Backup restored as additional resumes. Your existing resumes were kept.");
  };
  const recover = () => {
    try {
      const raw = window.localStorage.getItem(RECOVERY_KEY);
      if (!raw) throw new Error("No recovery copy is available. Download the unreadable data before saving a new draft.");
      const recovered = validateStore(JSON.parse(raw));
      blocked.current = false; setStore(recovered); setNotice("Recovered the previous saved copy.");
    } catch (e) { setSaveError(e.message); }
  };
  const downloadUnreadable = () => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY) || window.localStorage.getItem("rf_resumes") || window.localStorage.getItem("rf_data");
      if (!raw) throw new Error("No saved data is accessible.");
      downloadJSON(raw, "resumeforge-unreadable-data.json");
    } catch (e) { setSaveError(e.message); }
  };

  const handleDownloadPDF = async () => {
    const el = document.getElementById("resume-preview");
    if (!el || exporting) return;
    const clone = el.cloneNode(true);
    clone.style.boxShadow = "none";
    clone.style.borderRadius = "0";
    setExporting(true);
    setExportError("");
    try {
      const filename = data.personal.name || "resume";
      clone.dataset.keepEntries = String(keepEntriesTogether);
      const breakIndex = active.design.breakBeforeEntry;
      if (breakIndex !== null) {
        const entry = clone.querySelectorAll("[data-resume-entry]")[breakIndex];
        if (entry) entry.dataset.breakBefore = "true";
      }
      const blob = await exportPDF(clone.outerHTML, filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const renderTemplate = () => {
    const props = { data, accent };
    if (template === "classic") return <ClassicTemplate {...props} />;
    if (template === "executive") return <ExecutiveTemplate {...props} />;
    if (template === "tech") return <TechTemplate {...props} />;
    return <ModernTemplate {...props} />;
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <style>{PRINT_CSS}</style>
      {pendingImport && <ImportReview pending={pendingImport} source={resumes.find(r => r.id === pendingImport.sourceId)} onNew={() => applyImport(false)} onReplace={() => applyImport(true)} onCancel={() => setPendingImport(null)} />}
      {/* ── SIDEBAR ── */}
      <div style={{ width: 380, flexShrink: 0, background: "#fff", borderRight: "1.5px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 12px", borderBottom: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 16 }}>⬡</span>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>ResumeForge</h1>
              <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>{provider ? `${provider.provider} · ${(provider.dataLeavesDevice || /(?:-cloud|:cloud)(?:$|[/:])/i.test(provider.model)) ? "Text sent to configured provider" : "Local AI endpoint"}` : "AI provider status unavailable"}</p>
            </div>
          </div>
        </div>

        <ResumeManager
          resumes={resumes}
          activeId={activeId}
          onSwitch={switchResume}
          onCreate={() => createResume()}
          onDuplicate={duplicateResume}
          onRename={renameResume}
          onDelete={deleteResume}
        />

        <DataControls store={store} saveStatus={saveStatus} saveError={saveError} blocked={blocked.current} blockReason={blockReason.current}
          onUndo={() => setStore(s => undoResume(s, activeId))}
          onSnapshot={id => setStore(s => { const r = s.resumes.find(r => r.id === activeId); const h = r.history.find(h => h.id === id); return h ? updateResume(s, activeId, h.data, "Restore snapshot", undefined, h.design) : s; })}
          onRestoreBackup={restoreBackup}
          onRestoreDeleted={() => setStore(s => { const r = s.trash.at(-1); const id = makeId(); return r && s.resumes.length < 200 ? { ...s, resumes: [...s.resumes, { ...r, id }], activeId: id, trash: s.trash.slice(0, -1) } : s; })}
          onRetry={() => setRetrySave(v => v + 1)} onRecover={recover} onDownloadUnreadable={downloadUnreadable}
          onNewDraft={() => { if (window.confirm("Replace the unreadable saved data with this draft? Download the unreadable data first if you need to recover it.")) { blocked.current = false; setRetrySave(v => v + 1); } }} />
        {notice && <p role="status" style={{ padding: "0 20px", fontSize: 12 }}>{notice} <button onClick={() => setNotice("")}>Dismiss</button></p>}
        {/* Tabs */}
        <div style={{ padding: "0 20px", borderBottom: "1.5px solid #e2e8f0" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {["import", "edit", "design", "tailor"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600, border: "none", background: "none", cursor: "pointer", borderBottom: tab === t ? `2.5px solid ${accent}` : "2.5px solid transparent", color: tab === t ? accent : "#94a3b8", textTransform: "capitalize", borderRadius: "4px 4px 0 0" }}>
                {t === "import" ? "📥 Import" : t === "edit" ? "✏️ Edit" : t === "design" ? "🎨 Design" : "🎯 Tailor"}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div key={activeId} style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* IMPORT TAB */}
          {tab === "import" && (
            <div>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "#475569", lineHeight: 1.6 }}>Import your CV — AI extracts all sections automatically.</p>
              <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 4, marginBottom: 16 }}>
                {["upload", "paste"].map(mode => (
                  <button key={mode} onClick={() => { setImportMode(mode); setParseError(""); }}
                    style={{ flex: 1, padding: 8, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: importMode === mode ? "#fff" : "transparent", color: importMode === mode ? accent : "#94a3b8", boxShadow: importMode === mode ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                    {mode === "upload" ? "📎 Upload PDF / DOCX" : "📋 Paste Text"}
                  </button>
                ))}
              </div>

              {importMode === "upload" && (
                <>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileUpload} style={{ display: "none" }} />
                  <div onClick={() => fileInputRef.current?.click()}
                    style={{ border: `2px dashed ${uploadedFile ? accent : "#cbd5e1"}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: uploadedFile ? `${accent}08` : "#f8fafc", marginBottom: 12 }}>
                    {uploadedFile ? (
                      <>
                        <p style={{ fontSize: 28, margin: "0 0 8px" }}>{uploadedFile.name.endsWith(".docx") ? "📝" : "📄"}</p>
                        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 13, color: accent }}>{uploadedFile.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{(uploadedFile.size / 1024).toFixed(1)} KB · Click to change</p>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 32, margin: "0 0 10px" }}>☁️</p>
                        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 13, color: "#475569" }}>Click to upload your CV</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>PDF or DOCX supported</p>
                      </>
                    )}
                  </div>
                </>
              )}

              {importMode === "paste" && (
                <textarea aria-label="Resume text" value={rawText} onChange={e => setRawText(e.target.value)}
                  placeholder={"Paste your CV content here...\n\nInclude your name, job title, work history, education, skills, and anything else."}
                  style={{ ...inputStyle, height: 240, resize: "vertical", fontFamily: "inherit", fontSize: 12, lineHeight: 1.7, marginBottom: 4 }} />
              )}

              {parseError && (
                <div style={{ margin: "8px 0", padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
                  <p style={{ margin: 0, color: "#dc2626", fontSize: 12, lineHeight: 1.5 }}>⚠️ {parseError}</p>
                </div>
              )}

              <button onClick={handleParse} disabled={parsing || (importMode === "paste" ? !rawText.trim() : !uploadedFile)}
                style={{ width: "100%", padding: 12, background: parsing ? "#94a3b8" : accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: parsing ? "default" : "pointer", marginTop: 4 }}>
                {parsing ? "⏳ Parsing with AI..." : "✨ Parse CV with AI"}
              </button>

              <div style={{ marginTop: 16, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#475569" }}>OR start from scratch</p>
                <button onClick={() => createResume(true)}
                  style={{ padding: "8px 14px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#475569", fontWeight: 600 }}>
                  Start blank resume →
                </button>
              </div>
            </div>
          )}

          {/* EDIT TAB */}
          {tab === "edit" && (
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {["personal", "experience", "education", "skills", "certifications", "projects"].map(s => (
                  <button key={s} onClick={() => setActiveSection(s)}
                    style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, borderRadius: 20, border: activeSection === s ? `1.5px solid ${accent}` : "1.5px solid #e2e8f0", background: activeSection === s ? accent : "#fff", color: activeSection === s ? "#fff" : "#64748b", cursor: "pointer", textTransform: "capitalize" }}>
                    {s}
                  </button>
                ))}
              </div>

              {activeSection === "personal" && (
                <div>
                  <Field label="Full Name" value={data.personal.name} onChange={v => updatePersonal("name", v)} placeholder="Jane Smith" />
                  <Field label="Job Title" value={data.personal.title} onChange={v => updatePersonal("title", v)} placeholder="Senior Software Engineer" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Field label="Email" value={data.personal.email} onChange={v => updatePersonal("email", v)} />
                    <Field label="Phone" value={data.personal.phone} onChange={v => updatePersonal("phone", v)} />
                  </div>
                  <Field label="Location" value={data.personal.location} onChange={v => updatePersonal("location", v)} placeholder="Dublin, Ireland" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Field label="LinkedIn" value={data.personal.linkedin} onChange={v => updatePersonal("linkedin", v)} />
                    <Field label="GitHub" value={data.personal.github} onChange={v => updatePersonal("github", v)} />
                  </div>
                  <Field label="Website" value={data.personal.website} onChange={v => updatePersonal("website", v)} />
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <label style={labelStyle}>Summary</label>
                      <InlineAIButton
                        text={data.personal.summary}
                        actions={[{ id: "improve_summary", label: "✨ Improve", desc: "More compelling & results-focused" }, { id: "concise", label: "📏 Concise", desc: "Tighter, same meaning" }]}
                        context={{ role: data.personal.title }}
                        onResult={(v, original) => acceptRewrite("summary", original, v)}
                      />
                    </div>
                    <textarea maxLength={20000} aria-label="Professional summary" value={data.personal.summary} onChange={e => updatePersonal("summary", e.target.value)} rows={5} placeholder="Write a compelling 3-4 sentence summary..." style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                  </div>
                </div>
              )}

              {activeSection === "experience" && (
                <ListEditor items={data.experience} setItems={items => save({ ...data, experience: items })} label="Experience"
                  newItem={() => ({ id: uid(), company: "", role: "", start: "", end: "", current: false, bullets: [""] })}
                  renderItem={(item, update) => (
                    <div>
                      <Field label="Company" value={item.company} onChange={v => update("company", v)} />
                      <Field label="Role / Title" value={item.role} onChange={v => update("role", v)} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Field label="Start" value={item.start} onChange={v => update("start", v)} placeholder="Jan 2022" />
                        <Field label="End" value={item.current ? "Present" : item.end} onChange={v => update("end", v)} placeholder="Present" />
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b", marginBottom: 10, cursor: "pointer" }}>
                        <input type="checkbox" checked={item.current} onChange={e => update("current", e.target.checked)} /> Current role
                      </label>
                      <label style={labelStyle}>Achievements / Bullets</label>
                      {item.bullets.map((b, i) => (
                        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "stretch" }}>
                          <input maxLength={20000} aria-label={`Achievement ${i + 1}`} value={b} onChange={e => { const nb = [...item.bullets]; nb[i] = e.target.value; update("bullets", nb); }} style={{ ...inputStyle, flex: 1 }} placeholder="Led migration of 200M records to AWS Aurora..." />
                          <InlineAIButton
                            text={b}
                            context={{ role: item.role, company: item.company }}
                            onResult={(result, original) => acceptRewrite({ itemId: item.id, bulletIndex: i }, original, result)}
                          />
                          <button onClick={() => update("bullets", item.bullets.filter((_, j) => j !== i))} style={{ padding: "0 8px", background: "#fee2e2", border: "none", borderRadius: 6, cursor: "pointer", color: "#dc2626", fontSize: 16 }}>×</button>
                        </div>
                      ))}
                      <button disabled={item.bullets.length >= 200} onClick={() => update("bullets", [...item.bullets, ""])} style={{ padding: "6px 12px", background: "#f1f5f9", border: "1.5px dashed #cbd5e1", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#64748b", width: "100%" }}>+ Add bullet</button>
                    </div>
                  )} />
              )}

              {activeSection === "education" && (
                <ListEditor items={data.education} setItems={items => save({ ...data, education: items })} label="Education"
                  newItem={() => ({ id: uid(), institution: "", degree: "", field: "", start: "", end: "", gpa: "" })}
                  renderItem={(item, update) => (
                    <div>
                      <Field label="Institution" value={item.institution} onChange={v => update("institution", v)} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Field label="Degree" value={item.degree} onChange={v => update("degree", v)} placeholder="BSc" />
                        <Field label="Field" value={item.field} onChange={v => update("field", v)} placeholder="Computer Science" />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <Field label="Start" value={item.start} onChange={v => update("start", v)} />
                        <Field label="End" value={item.end} onChange={v => update("end", v)} />
                        <Field label="GPA" value={item.gpa} onChange={v => update("gpa", v)} />
                      </div>
                    </div>
                  )} />
              )}

              {activeSection === "skills" && (
                <ListEditor items={data.skills} setItems={items => save({ ...data, skills: items })} label="Skill Group"
                  newItem={() => ({ id: uid(), category: "", items: [] })}
                  renderItem={(item, update) => (
                    <div>
                      <Field label="Category" value={item.category} onChange={v => update("category", v)} placeholder="Backend / Languages" />
                      <label style={labelStyle}>Skills</label>
                      <SkillTagInput
                        tags={Array.isArray(item.items) ? item.items : (item.items ? item.items.split(",").map(t => t.trim()).filter(Boolean) : [])}
                        onChange={tags => update("items", tags)}
                      />
                    </div>
                  )} />
              )}

              {activeSection === "certifications" && (
                <ListEditor items={data.certifications} setItems={items => save({ ...data, certifications: items })} label="Certification"
                  newItem={() => ({ id: uid(), name: "", issuer: "", year: "" })}
                  renderItem={(item, update) => (
                    <div>
                      <Field label="Name" value={item.name} onChange={v => update("name", v)} placeholder="AWS Solutions Architect" />
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                        <Field label="Issuer" value={item.issuer} onChange={v => update("issuer", v)} placeholder="Amazon Web Services" />
                        <Field label="Year" value={item.year} onChange={v => update("year", v)} placeholder="2024" />
                      </div>
                    </div>
                  )} />
              )}

              {activeSection === "projects" && (
                <ListEditor items={data.projects} setItems={items => save({ ...data, projects: items })} label="Project"
                  newItem={() => ({ id: uid(), name: "", description: "", tech: "", url: "" })}
                  renderItem={(item, update) => (
                    <div>
                      <Field label="Project Name" value={item.name} onChange={v => update("name", v)} placeholder="Laria Security Scanner" />
                      <Field label="Tech Stack" value={item.tech} onChange={v => update("tech", v)} placeholder="Go, Docker, Kubernetes" />
                      <Field label="URL / GitHub" value={item.url} onChange={v => update("url", v)} placeholder="github.com/manojisnow/laria" />
                      <Field label="Description" value={item.description} onChange={v => update("description", v)} multiline rows={3} />
                    </div>
                  )} />
              )}
            </div>
          )}

          {/* DESIGN TAB */}
          {tab === "design" && (
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 16 }}><input type="checkbox" checked={keepEntriesTogether} onChange={e => saveDesign({ keepEntriesTogether: e.target.checked })} /> Keep resume entries together across PDF pages</label>
              <label style={{ display: "block", fontSize: 12, marginBottom: 16 }}>Start a new PDF page before entry <input type="number" min="1" aria-label="Start new PDF page before entry" value={active.design.breakBeforeEntry === null ? "" : active.design.breakBeforeEntry + 1} onChange={e => saveDesign({ breakBeforeEntry: e.target.value ? Math.min(999, Math.max(0, Number(e.target.value) - 1)) : null })} placeholder="Automatic" style={{ width: 90 }} /></label>
              <p style={{ fontSize: 11, color: "#64748b", marginBottom: 16 }}>Entry numbers follow the resume preview order. Manual breaks work best with the Classic template; clear the number for automatic pagination.</p>
              <p style={labelStyle}>Template</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                {[
                  { id: "modern", label: "Modern", desc: "Two-column sidebar layout. Clean, contemporary.", emoji: "▨" },
                  { id: "classic", label: "Classic", desc: "Traditional serif. Timeless and trustworthy.", emoji: "Ⅰ" },
                  { id: "executive", label: "Executive", desc: "Premium header, structured body. Senior roles.", emoji: "◈" },
                  { id: "tech", label: "Tech / Dev", desc: "Dark terminal aesthetic. Built for engineers.", emoji: "</>" },
                ].map(t => (
                  <button key={t.id} aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}
                    style={{ padding: "14px 12px", border: template === t.id ? `2px solid ${accent}` : "2px solid #e2e8f0", borderRadius: 10, background: template === t.id ? `${accent}0d` : "#fff", cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }}>
                    <p style={{ margin: "0 0 6px", fontSize: 18, lineHeight: 1 }}>{t.emoji}</p>
                    <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 13, color: template === t.id ? accent : "#0f172a" }}>{t.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{t.desc}</p>
                  </button>
                ))}
              </div>
              <p style={labelStyle}>Accent Color</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {ACCENT_COLORS.map(c => (
                  <button key={c.value} aria-label={c.name} aria-pressed={accent === c.value} onClick={() => setAccent(c.value)} title={c.name}
                    style={{ width: 32, height: 32, borderRadius: "50%", background: c.value, border: accent === c.value ? "3px solid #1a1a1a" : "3px solid transparent", cursor: "pointer", outline: accent === c.value ? "2px solid #fff" : "none", outlineOffset: -4 }} />
                ))}
              </div>
            </div>
          )}

          {/* TAILOR TAB */}
          {tab === "tailor" && (
            <div>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                Paste a job description to get an AI keyword-match estimate and suggested rewrites. This is not an employer ATS score. Review every claim before accepting.
              </p>
              <textarea aria-label="Job description" value={jobDesc} onChange={e => setJobDesc(e.target.value)}
                placeholder={"Paste the job description here...\n\nWe'll check keyword gaps and suggest targeted bullet rewrites."}
                style={{ ...inputStyle, height: 180, resize: "vertical", fontFamily: "inherit", fontSize: 12, lineHeight: 1.7, marginBottom: 10 }} />
              {tailorError && (
                <div style={{ margin: "0 0 10px", padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
                  <p style={{ margin: 0, color: "#dc2626", fontSize: 12 }}>⚠️ {tailorError}</p>
                </div>
              )}
              <button onClick={handleTailor} disabled={tailoring || !jobDesc.trim()}
                style={{ width: "100%", padding: 12, background: tailoring || !jobDesc.trim() ? "#94a3b8" : accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: tailoring || !jobDesc.trim() ? "default" : "pointer", marginBottom: 20 }}>
                {tailoring ? "⏳ Analyzing..." : "🎯 Analyze & Tailor"}
              </button>

              {tailorResult && (
                <div>
                  {/* Score */}
                  <div style={{ marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 10, border: "1.5px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>AI keyword-match estimate</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor(tailorResult.score) }}>{tailorResult.score}%</span>
                    </div>
                    <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${tailorResult.score}%`, background: scoreColor(tailorResult.score), borderRadius: 4, transition: "width 0.6s ease" }} />
                    </div>
                  </div>

                  {/* Missing keywords */}
                  {tailorResult.missingKeywords?.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <p style={{ ...labelStyle, marginBottom: 8 }}>Missing Keywords</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {tailorResult.missingKeywords.map(kw => (
                          <span key={kw} style={{ padding: "3px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 20, fontSize: 11, color: "#dc2626", fontWeight: 500 }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {tailorResult.suggestions?.length > 0 && (
                    <div>
                      <p style={{ ...labelStyle, marginBottom: 10 }}>Suggested Rewrites</p>
                      {tailorResult.suggestions.map((s, i) => !acceptedSuggestions.has(i) && (
                        <div key={i} style={{ marginBottom: 10, padding: 12, background: "#fff", borderRadius: 8, border: "1.5px solid #e2e8f0" }}>
                          <p style={{ margin: "0 0 7px", fontSize: 11, color: "#94a3b8", lineHeight: 1.5, textDecoration: "line-through" }}>{s.original}</p>
                          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#0f172a", lineHeight: 1.6 }}>{s.improved}</p>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => acceptSuggestion(i, s)}
                              style={{ padding: "5px 12px", background: accent, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✓ Accept</button>
                            <button onClick={() => setAcceptedSuggestions(prev => new Set([...prev, i]))}
                              style={{ padding: "5px 12px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>Skip</button>
                          </div>
                        </div>
                      ))}
                      {tailorResult.suggestions.every((_, i) => acceptedSuggestions.has(i)) && (
                        <p style={{ fontSize: 12, color: "#10b981", textAlign: "center", padding: 12, fontWeight: 600 }}>✓ All suggestions reviewed!</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1.5px solid #e2e8f0" }}>
          <p style={{ fontSize: 11, color: previewInfo.overflow ? "#b91c1c" : "#64748b", margin: "0 0 8px" }}>{previewInfo.pages} estimated A4 page{previewInfo.pages === 1 ? "" : "s"} · Actual pagination can vary.{previewInfo.overflow ? " Content extends past the page width. Shorten long fields before exporting." : ""}</p>
          {exportError && (
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#dc2626", textAlign: "center" }}>⚠️ {exportError}</p>
          )}
          <button onClick={handleDownloadPDF} disabled={exporting}
            style={{ width: "100%", padding: 12, background: exporting ? "#94a3b8" : accent, color: "#fff", border: "none", borderRadius: 8, cursor: exporting ? "default" : "pointer", fontSize: 13, fontWeight: 700 }}>
            {exporting ? "⏳ Generating PDF..." : "📄 Download PDF"}
          </button>
        </div>
      </div>

      {/* ── PREVIEW ── */}
      <div style={{ flex: 1, overflow: "auto", padding: 32, background: "#e2e8f0", display: "flex", justifyContent: "center" }}>
        <div style={{ transform: "scale(0.85)", transformOrigin: "top center", marginBottom: "-15%" }}>
          <div id="resume-preview" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderRadius: 2, overflow: "hidden", width: "210mm" }}>
            {renderTemplate()}
          </div>
        </div>
      </div>
    </div>
  );
}
