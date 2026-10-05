import { test } from "node:test";
import assert from "node:assert/strict";
import { blankResume, validateResume, parseAIJSON, validateTailoring } from "../../shared/resume.mjs";
import { STORE_KEY, RECOVERY_KEY, emptyStore, newResume, updateResume, undoResume, applyRewrite, loadStore, persistStore, importBackup, validateStore } from "../src/resumeStore.mjs";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}
const changeName = (data, name) => ({ ...data, personal: { ...data.personal, name } });

test("normalizes legacy comma-separated skills and supplies missing optional sections", () => {
  const data = validateResume({ personal: { name: "Synthetic Person" }, skills: [{ category: "Languages", items: "JS, Python" }] });
  assert.deepEqual(data.skills[0].items, ["JS", "Python"]);
  assert.deepEqual(data.experience, []);
  assert.equal(data.personal.summary, "");
});
test("rejects malformed AI data before it can reach the editor", () => {
  for (const value of [null, {}, { personal: [] }, { personal: { name: {} } }, { personal: {}, experience: "wrong" }, { personal: {}, experience: [{ current: "yes" }] }, { personal: {}, skills: [{ items: [42] }] }, { personal: {}, projects: [{ id: "a" }, { id: "a" }] }]) {
    assert.throws(() => validateResume(value));
  }
  assert.throws(() => parseAIJSON("```json\n{unfinished\n```"));
  assert.deepEqual(parseAIJSON('Here is the result: ```json\n{"personal": {}}\n```'), { personal: {} });
});
test("rejects fabricated references and invalid scores in tailoring", () => {
  const data = validateResume({ personal: {}, experience: [{ id: "job", bullets: ["Original fact"] }] });
  const suggestion = { itemId: "job", bulletIndex: 0, original: "Original fact", improved: "Clearer fact" };
  assert.equal(validateTailoring({ score: 50, missingKeywords: [], suggestions: [suggestion] }, data).suggestions.length, 1);
  for (const s of [{ ...suggestion, original: "Invented fact" }, { ...suggestion, itemId: "missing" }, { ...suggestion, bulletIndex: 99 }]) {
    assert.throws(() => validateTailoring({ score: 50, missingKeywords: [], suggestions: [s] }, data));
  }
  assert.throws(() => validateTailoring({ score: 101, missingKeywords: [], suggestions: [] }, data));
});
test("updates the originating resume after the user switches resumes", () => {
  let store = emptyStore(); const source = store.resumes[0]; const other = newResume("Other");
  store = { ...store, resumes: [source, other], activeId: other.id };
  const next = updateResume(store, source.id, changeName(source.data, "Imported"), "Import", source.data);
  assert.equal(next.resumes[0].data.personal.name, "Imported");
  assert.equal(next.resumes[1].data.personal.name, "");
  assert.equal(next.activeId, other.id);
});
test("discards results for deleted or edited source resumes", () => {
  const store = emptyStore(); const source = store.resumes[0];
  const edited = updateResume(store, source.id, changeName(source.data, "Manual edit"));
  assert.equal(updateResume(edited, source.id, changeName(source.data, "Late result"), "Import", source.data), edited);
  const deleted = { ...store, resumes: [newResume()] };
  assert.equal(updateResume(deleted, source.id, source.data), deleted);
});
test("AI rewrites preserve unrelated edits and reject a changed source bullet", () => {
  let store = emptyStore(); const id = store.activeId;
  const data = validateResume({ personal: {}, experience: [{ id: "job", bullets: ["Original"] }] });
  store = updateResume(store, id, data);
  store = updateResume(store, id, changeName(data, "New name"));
  const target = { itemId: "job", bulletIndex: 0 };
  const rewritten = applyRewrite(store, id, target, "Original", "Improved");
  assert.equal(rewritten.resumes[0].data.personal.name, "New name");
  assert.equal(rewritten.resumes[0].data.experience[0].bullets[0], "Improved");
  assert.equal(applyRewrite(rewritten, id, target, "Original", "Late result"), rewritten);
});
test("undo restores the pre-import data and design", () => {
  const store = emptyStore(); const source = store.resumes[0];
  const changed = updateResume(store, source.id, changeName(source.data, "Imported"), "Import", source.data, { ...source.design, template: "classic" });
  const undone = undoResume(changed, source.id);
  assert.deepEqual(undone.resumes[0].data, source.data);
  assert.deepEqual(undone.resumes[0].design, source.design);
});
test("typing is grouped into recoverable edits and snapshots are bounded", () => {
  let store = emptyStore(); const id = store.activeId;
  store = updateResume(store, id, changeName(store.resumes[0].data, "A"));
  store = updateResume(store, id, changeName(store.resumes[0].data, "AB"));
  assert.equal(store.resumes[0].history.length, 1);
  assert.equal(undoResume(store, id).resumes[0].data.personal.name, "");
  for (let i = 0; i < 20; i++) store = updateResume(store, id, changeName(store.resumes[0].data, String(i)), "Import");
  assert.equal(store.resumes[0].history.length, 12);
});
test("migrates existing saves without deleting the legacy data", () => {
  const record = newResume("Legacy"); delete record.design; delete record.history;
  const storage = memoryStorage({ rf_resumes: JSON.stringify([record]), rf_active_id: record.id });
  const loaded = loadStore(storage);
  assert.equal(loaded.blocked, false);
  assert.equal(loaded.store.activeId, record.id);
  persistStore(storage, loaded.store);
  assert.ok(storage.getItem("rf_resumes"));
  assert.equal(loadStore(storage).store.resumes[0].design.template, "modern");
});
test("unreadable saves are left intact and automatic saving is blocked", () => {
  const storage = memoryStorage({ [STORE_KEY]: "broken saved JSON" });
  const loaded = loadStore(storage);
  assert.equal(loaded.blocked, true);
  assert.match(loaded.error, /paused/);
  assert.equal(storage.getItem(STORE_KEY), "broken saved JSON");
});
test("saves atomically in one key and retains the previous valid store", () => {
  const store = emptyStore(); const storage = memoryStorage(); persistStore(storage, store);
  const next = updateResume(store, store.activeId, changeName(store.resumes[0].data, "Updated"));
  persistStore(storage, next);
  assert.deepEqual(validateStore(JSON.parse(storage.getItem(RECOVERY_KEY))), store);
  assert.deepEqual(loadStore(storage).store, next);
});
test("storage failures propagate so the UI can warn and previous data stays available", () => {
  const store = emptyStore(); const original = JSON.stringify(store);
  const storage = memoryStorage({ [STORE_KEY]: original });
  storage.setItem = () => { throw new Error("Quota exceeded"); };
  const next = updateResume(store, store.activeId, changeName(store.resumes[0].data, "Unsaved"));
  assert.throws(() => persistStore(storage, next), /Quota/);
  assert.equal(storage.getItem(STORE_KEY), original);
});
test("backup restore adds validated copies without replacing existing resumes", () => {
  const store = emptyStore(); const merged = importBackup(store, JSON.stringify(store));
  assert.equal(merged.resumes.length, 2);
  assert.notEqual(merged.resumes[0].id, merged.resumes[1].id);
  assert.deepEqual(merged.resumes[0], store.resumes[0]);
  assert.throws(() => importBackup(store, '{"version":99}'));
  assert.deepEqual(validateStore(JSON.parse(JSON.stringify(merged))), merged);
});
