const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const net = require("node:net");
const { createRequire } = require("node:module");
const JSZip = createRequire(require.resolve("mammoth"))("jszip");
let model, server, baseURL, prompt;

before(async () => {
  model = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      prompt = JSON.parse(body).messages[0].content;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ personal: { name: "Synthetic upload" } }) } }] }));
    });
  });
  await new Promise(resolve => model.listen(0, "127.0.0.1", resolve));
  process.env.AI_PROVIDER = "ollama";
  process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${model.address().port}/v1`;
  const app = require("./index");
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => model.close(resolve))]);
});

function syntheticPDF() { return require("./fixtures/synthetic-pdf.cjs"); }

async function sendFile(buffer, type, name, extra) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type }), name);
  if (extra) extra(form);
  return fetch(`${baseURL}/api/parse/file`, { method: "POST", body: form });
}

test("valid PDF upload extracts real text and returns validated AI output", async () => {
  const response = await sendFile(syntheticPDF(), "application/pdf", "synthetic.pdf");
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).personal.name, "Synthetic upload");
  assert.match(prompt, /Uploaded Synthetic PDF/);
});

test("valid DOCX upload extracts real text and returns validated AI output", async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Uploaded Synthetic DOCX</w:t></w:r></w:p></w:body></w:document>');
  const response = await sendFile(await zip.generateAsync({ type: "nodebuffer" }), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "synthetic.docx");
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).personal.name, "Synthetic upload");
  assert.match(prompt, /Uploaded Synthetic DOCX/);
});

test("oversized uploads are rejected with 413 before AI work", async () => {
  prompt = null;
  const response = await sendFile(Buffer.alloc(10 * 1024 * 1024 + 1), "application/pdf", "large.pdf");
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /10 MB/);
  assert.equal(prompt, null);
});

test("extra fields and multiple files are rejected before AI work", async () => {
  for (const extra of [form => form.append("unwanted", "value"), form => form.append("file", new Blob(["second"], { type: "application/pdf" }), "second.pdf")]) {
    prompt = null;
    const response = await sendFile(syntheticPDF(), "application/pdf", "synthetic.pdf", extra);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Upload rejected/);
    assert.equal(prompt, null);
  }
});

test("truncated multipart requests return JSON and leave the API healthy", async () => {
  const response = await fetch(`${baseURL}/api/parse/file`, {
    method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=incomplete" },
    body: '--incomplete\r\nContent-Disposition: form-data; name="file"; filename="synthetic.pdf"\r\nContent-Type: application/pdf\r\n\r\npartial',
  });
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).error, "string");
  assert.equal((await fetch(`${baseURL}/api/health`)).status, 200);
});

test("malformed PDF documents fail safely and a subsequent valid upload succeeds", async () => {
  prompt = null;
  const invalid = await sendFile(Buffer.from("%PDF-1.4\nnot a valid document"), "application/pdf", "invalid.pdf");
  assert.equal(invalid.status, 500);
  assert.equal(typeof (await invalid.json()).error, "string");
  assert.equal(prompt, null);
  const valid = await sendFile(syntheticPDF(), "application/pdf", "synthetic.pdf");
  assert.equal(valid.status, 200);
  assert.match(prompt, /Uploaded Synthetic PDF/);
});

test("disconnected upload clients do not crash the API", async () => {
  await new Promise((resolve, reject) => {
    const socket = net.connect(server.address().port, "127.0.0.1", () => {
      socket.write('POST /api/parse/file HTTP/1.1\r\nHost: localhost\r\nContent-Type: multipart/form-data; boundary=aborted\r\nContent-Length: 1000000\r\n\r\n--aborted\r\nContent-Disposition: form-data; name="file"; filename="synthetic.pdf"\r\nContent-Type: application/pdf\r\n\r\npartial', () => socket.end());
    });
    socket.on("error", reject);
    socket.on("data", () => {});
    socket.on("close", resolve);
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error("Aborted connection did not close")); });
  });
  assert.equal((await fetch(`${baseURL}/api/health`)).status, 200);
});
