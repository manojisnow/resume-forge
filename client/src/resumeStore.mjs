import { blankResume, validateResume } from "../../shared/resume.mjs";

export const STORE_KEY = "rf_store_v1";
export const RECOVERY_KEY = "rf_store_last_good";
export const DEFAULT_DESIGN = { template: "modern", accent: "#1a365d", keepEntriesTogether: true, breakBeforeEntry: null };
export const makeId = () => globalThis.crypto.randomUUID();
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function validateDesign(design = {}) {
  if (!design || typeof design !== "object" || Array.isArray(design)) throw new Error("Invalid resume design.");
  const result = { ...DEFAULT_DESIGN, ...design };
  if (!["modern", "classic", "executive", "tech"].includes(result.template)
      || !/^#[0-9a-f]{6}$/i.test(result.accent) || typeof result.keepEntriesTogether !== "boolean"
      || (result.breakBeforeEntry !== null && (!Number.isInteger(result.breakBeforeEntry) || result.breakBeforeEntry < 0 || result.breakBeforeEntry > 999))) throw new Error("Invalid resume design.");
  return { template: result.template, accent: result.accent, keepEntriesTogether: result.keepEntriesTogether, breakBeforeEntry: result.breakBeforeEntry };
}
export function newResume(name = "New Resume", data = blankResume(), design = DEFAULT_DESIGN) {
  return { id: makeId(), name: name.slice(0, 200), updatedAt: Date.now(), data: validateResume(data), design: validateDesign(design), history: [] };
}
export function emptyStore() {
  const resume = newResume("My Resume");
  return { version: 1, resumes: [resume], activeId: resume.id, trash: [] };
}
function validateRecord(record) {
  if (!record || typeof record.id !== "string" || !record.id || typeof record.name !== "string"
      || record.name.length > 200 || !Number.isFinite(record.updatedAt)) throw new Error("Invalid saved resume.");
  if (!Array.isArray(record.history ?? []) || (record.history ?? []).length > 12) throw new Error("Invalid resume history.");
  return { id: record.id, name: record.name, updatedAt: record.updatedAt, data: validateResume(record.data), design: validateDesign(record.design),
    history: (record.history ?? []).map(h => {
      if (!h || typeof h.id !== "string" || typeof h.label !== "string" || !Number.isFinite(h.at)) throw new Error("Invalid saved snapshot.");
      return { id: h.id, label: h.label, at: h.at, data: validateResume(h.data), design: validateDesign(h.design) };
    }) };
}
export function validateStore(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.resumes) || value.resumes.length < 1 || value.resumes.length > 200) throw new Error("Unsupported or invalid backup.");
  const resumes = value.resumes.map(validateRecord);
  if (new Set(resumes.map(r => r.id)).size !== resumes.length) throw new Error("Duplicate resume IDs in backup.");
  if (!Array.isArray(value.trash ?? []) || (value.trash ?? []).length > 10) throw new Error("Invalid deleted-resume history.");
  return { version: 1, resumes, activeId: resumes.some(r => r.id === value.activeId) ? value.activeId : resumes[0].id,
    trash: (value.trash ?? []).map(validateRecord) };
}
export function loadStore(storage) {
  try {
    const raw = storage.getItem(STORE_KEY);
    if (raw) return { store: validateStore(JSON.parse(raw)), error: "", blocked: false };
    const legacy = storage.getItem("rf_resumes");
    const old = storage.getItem("rf_data");
    if (legacy) return { store: validateStore({ version: 1, resumes: JSON.parse(legacy), activeId: storage.getItem("rf_active_id") }), error: "", blocked: false };
    if (old) {
      const resume = newResume("My Resume", JSON.parse(old));
      return { store: { version: 1, resumes: [resume], activeId: resume.id, trash: [] }, error: "", blocked: false };
    }
    return { store: emptyStore(), error: "", blocked: false };
  } catch {
    return { store: emptyStore(), error: "Saved data could not be read. Automatic saving is paused to preserve it. Download it before starting a new draft, or recover the last saved copy.", blocked: true };
  }
}
export function persistStore(storage, store) {
  const value = JSON.stringify(store);
  const previous = storage.getItem(STORE_KEY);
  if (previous === value) return;
  if (previous) {
    let valid = false;
    try { validateStore(JSON.parse(previous)); valid = true; } catch { /* Keep unreadable data intact until the user chooses recovery. */ }
    if (valid) storage.setItem(RECOVERY_KEY, previous);
  }
  storage.setItem(STORE_KEY, value);
}

export function updateResume(store, id, data, label = "Edit", expectedData, design) {
  const current = store.resumes.find(r => r.id === id);
  if (!current || (expectedData && !same(current.data, expectedData))) return store;
  const nextData = validateResume(data); const nextDesign = validateDesign(design ?? current.design);
  if (same(current.data, nextData) && same(current.design, nextDesign)) return store;
  const last = current.history.at(-1);
  const coalesce = label === "Edit" && last?.label === "Edit" && Date.now() - last.at < 15000;
  const history = coalesce ? current.history : [...current.history, { id: makeId(), label, at: Date.now(), data: clone(current.data), design: clone(current.design) }].slice(-12);
  return { ...store, resumes: store.resumes.map(r => r.id === id ? { ...r, data: nextData, design: nextDesign, history, updatedAt: Date.now() } : r) };
}
export function undoResume(store, id) {
  const current = store.resumes.find(r => r.id === id); const previous = current?.history.at(-1);
  if (!previous) return store;
  return { ...store, resumes: store.resumes.map(r => r.id === id ? { ...r, data: clone(previous.data), design: clone(previous.design), history: r.history.slice(0, -1), updatedAt: Date.now() } : r) };
}
export function applyRewrite(store, id, target, original, improved) {
  const current = store.resumes.find(r => r.id === id);
  if (!current) return store;
  const data = clone(current.data);
  if (target === "summary") {
    if (data.personal.summary !== original) return store;
    data.personal.summary = improved;
  } else {
    const item = data.experience.find(e => e.id === target.itemId);
    if (!item || item.bullets[target.bulletIndex] !== original) return store;
    item.bullets[target.bulletIndex] = improved;
  }
  return updateResume(store, id, data, "AI rewrite");
}
export function importBackup(store, raw) {
  const incoming = validateStore(JSON.parse(raw));
  if (store.resumes.length + incoming.resumes.length > 200) throw new Error("A maximum of 200 resumes can be restored at once.");
  const restored = incoming.resumes.map(r => ({ ...r, id: makeId(), name: r.name.slice(0, 185) + " (restored)", updatedAt: Date.now() }));
  return { ...store, resumes: [...store.resumes, ...restored], activeId: restored[0].id };
}
