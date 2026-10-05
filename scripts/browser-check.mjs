import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(new URL("../server/package.json", import.meta.url));
const { default: puppeteer } = await import(require.resolve("puppeteer"));
const pdfParse = require("pdf-parse");
import { blankResume, validateResume } from "../shared/resume.mjs";
import { emptyStore, newResume } from "../client/src/resumeStore.mjs";

// Run against npm start. Chromium uses an isolated profile and synthetic data.
// Mock AI responses so this verification never calls the user's AI provider.
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.setViewport({ width: 1440, height: 1100 });
await page.setRequestInterception(true);
let mockImport = validateResume({ personal: { name: "Imported Synthetic" }, experience: [{ id: "job", role: "Engineer", bullets: ["Original synthetic achievement"] }] });
page.on("request", request => {
  if (/\/api\/parse\//.test(request.url())) {
    setTimeout(() => request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(mockImport) }), 400);
  } else if (/\/api\/ai\/improve/.test(request.url())) {
    request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ result: "Reviewed synthetic suggestion" }) });
  } else if (/\/api\/ai\//.test(request.url())) request.abort();
  else request.continue();
});
async function click(text) {
  await page.waitForFunction(text => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === text || b.querySelector("p")?.textContent.trim() === text), {}, text);
  const found = await page.evaluate(text => {
    const element = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === text || b.querySelector("p")?.textContent.trim() === text);
    if (!element) return false;
    element.click(); return true;
  }, text);
  assert.ok(found, `Button not found: ${text}`);
}
async function seed(store) {
  await page.evaluate(store => { localStorage.clear(); localStorage.setItem("rf_store_v1", JSON.stringify(store)); }, store);
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.body.textContent.includes("Saved on this device"));
}
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("rf_store_v1")));
try {
  await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  const base = emptyStore(); base.resumes[0].name = "Original resume";
  base.resumes[0].data.personal.name = "Original Person";
  await seed(base);
  await click("📋 Paste Text");
  await page.type('[aria-label="Resume text"]', "Synthetic import");
  await click("✨ Parse CV with AI");
  await click("Start blank resume →");
  await page.waitForSelector("dialog[open]");
  let store = await saved();
  assert.equal(store.resumes.length, 2);
  assert.equal(store.resumes[0].data.personal.name, "Original Person");
  assert.equal(store.resumes[1].data.personal.name, "");
  await click("Replace Original resume (undo available)");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rf_store_v1")).resumes[0].data.personal.name === "Imported Synthetic");
  await click("Undo");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rf_store_v1")).resumes[0].data.personal.name === "Original Person");
  console.log("Passed: delayed import cannot overwrite another resume; import review and undo.");

  await click("🎨 Design");
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Traditional serif"))?.click());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rf_store_v1")).resumes[0].design.template === "classic");
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal((await saved()).resumes[0].design.template, "classic");
  console.log("Passed: design persists across reload.");

  await seed({ ...base, resumes: [{ ...base.resumes[0], data: { ...blankResume(), personal: { ...blankResume().personal, summary: "Original summary" } } }] });
  await click("✏️ Edit"); await click("✨"); await click("✨ Improve");
  await page.waitForFunction(() => document.body.textContent.includes("Apply suggestion"));
  assert.equal((await saved()).resumes[0].data.personal.summary, "Original summary");
  await click("Apply suggestion");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rf_store_v1")).resumes[0].data.personal.summary === "Reviewed synthetic suggestion");
  console.log("Passed: AI rewrites require explicit review.");

  await page.evaluate(() => localStorage.setItem("rf_store_v1", "invalid JSON"));
  await page.reload({ waitUntil: "networkidle0" });
  assert.ok(await page.evaluate(() => document.body.textContent.includes("Automatic saving is paused")));
  assert.equal(await page.evaluate(() => localStorage.getItem("rf_store_v1")), "invalid JSON");
  console.log("Passed: unreadable storage is preserved.");

  await seed(base);
  const backupDirectory = await mkdtemp(path.join(tmpdir(), "resumeforge-browser-check-"));
  const backupFile = path.join(backupDirectory, "synthetic-backup.json");
  await writeFile(backupFile, JSON.stringify(base));
  await (await page.$('[aria-label="Choose resume backup"]')).uploadFile(backupFile);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rf_store_v1")).resumes.length === 2);
  assert.equal((await saved()).resumes[0].data.personal.name, "Original Person");
  console.log("Passed: backup restore adds copies without replacing existing resumes.");

  await seed(base);
  const second = await browser.newPage();
  await second.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  await second.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("rf_store_v1")); store.resumes[0].data.personal.name = "Another tab";
    localStorage.setItem("rf_store_v1", JSON.stringify(store));
  });
  await page.waitForFunction(() => document.body.textContent.includes("Another tab changed"));
  assert.equal((await saved()).resumes[0].data.personal.name, "Another tab");
  await second.close();
  console.log("Passed: another tab's data is not overwritten.");

  const manualData = validateResume({ personal: { name: "Synthetic Manual PDF" }, experience: [
    { id: "first", role: "First unique role", bullets: ["First unique achievement"] },
    { id: "second", role: "Second unique role", bullets: ["Second unique achievement"] },
  ] });
  const manualResume = newResume("Manual page test", manualData, { template: "classic", accent: "#1a365d", keepEntriesTogether: true, breakBeforeEntry: 1 });
  await seed({ version: 1, resumes: [manualResume], activeId: manualResume.id, trash: [] });
  const session = await browser.target().createCDPSession();
  await session.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: backupDirectory });
  await click("📄 Download PDF");
  let pdfFile;
  for (let i = 0; i < 100; i++) {
    pdfFile = (await readdir(backupDirectory)).find(file => file.endsWith(".pdf"));
    if (pdfFile) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(pdfFile, "PDF download did not complete");
  const pageTexts = [];
  const manualPDF = await pdfParse(await readFile(path.join(backupDirectory, pdfFile)), { pagerender: async pageData => {
    const content = await pageData.getTextContent(); const text = content.items.map(item => item.str).join(" "); pageTexts.push(text); return text;
  } });
  assert.equal(manualPDF.numpages, 2);
  assert.ok(pageTexts[0].includes("First unique achievement"));
  assert.ok(!pageTexts[0].includes("Second unique achievement"));
  assert.ok(pageTexts[1].includes("Second unique achievement"));
  console.log("Passed: actual Download PDF action respects the persisted manual page break.");

  const long = validateResume({ personal: { name: "Synthetic PDF Person", summary: "A synthetic test resume." },
    experience: Array.from({ length: 18 }, (_, i) => ({ id: String(i), company: `Synthetic Company ${i}`, role: `Unique Role ${i}`,
      bullets: Array.from({ length: 8 }, (_, j) => `Unique achievement ${i}-${j} verified with synthetic data and a sufficiently long description to exercise multi-page wrapping.`) })) });
  for (const template of ["modern", "classic", "executive", "tech"]) {
    const resume = newResume("PDF test", long, { template, accent: "#1a365d", keepEntriesTogether: true, breakBeforeEntry: null });
    await seed({ version: 1, resumes: [resume], activeId: resume.id, trash: [] });
    const html = await page.$eval("#resume-preview", node => { const clone = node.cloneNode(true); clone.dataset.keepEntries = "true"; return clone.outerHTML; });
    const response = await fetch("http://127.0.0.1:3001/api/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html, filename: "synthetic-test" }) });
    assert.equal(response.status, 200, `${template}: PDF request failed`);
    const pdf = await pdfParse(Buffer.from(await response.arrayBuffer()));
    assert.ok(pdf.numpages > 1, `${template}: expected multiple pages`);
    for (let i = 0; i < 18; i++) for (let j = 0; j < 8; j++) assert.ok(pdf.text.includes(`Unique achievement ${i}-${j}`), `${template}: missing achievement ${i}-${j}`);
    console.log(`Passed: ${template} multi-page PDF (${pdf.numpages} pages), all 144 achievements retained.`);
  }
  assert.deepEqual(errors, [], "Browser runtime errors");
} finally { await browser.close(); }
