// Execute inside the image: docker compose exec -T app node < scripts/container-check.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const { execFileSync } = require("node:child_process");
const { readPDF: pdfParse } = require("./server/read-pdf.cjs");

(async () => {
  assert.notEqual(process.getuid(), 0, "Container must run as non-root");
  for (const file of ["server/.env", ".env", ".local", ".git"]) {
    assert.equal(fs.existsSync(file), false, `${file} must not enter the image`);
  }
  assert.equal(fs.existsSync("/usr/local/lib/node_modules/npm"), false, "Runtime does not need npm");
  const browserPin = JSON.parse(fs.readFileSync("/opt/chrome/version.json", "utf8"));
  const browserVersion = execFileSync(process.env.PUPPETEER_EXECUTABLE_PATH, ["--version"], { encoding: "utf8" });
  assert.ok(browserVersion.includes(browserPin.version), "Image must use the pinned Stable browser");
  assert.equal(fs.existsSync("/usr/bin/chromium"), false, "Debian Chromium must not remain in the image");
  const base = `http://127.0.0.1:${process.env.PORT || 8080}`;
  const frontend = await fetch(base);
  assert.equal(frontend.status, 200);
  assert.match(await frontend.text(), /<div id="root">/);
  const health = await fetch(`${base}/api/health`);
  assert.equal((await health.json()).ok, true);
  const unknown = await fetch(`${base}/api/nonexistent`);
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get("content-type"), /json/);
  const hostile = await fetch(`${base}/api/pdf`, {
    method: "POST", headers: { Origin: "https://untrusted.example", "Content-Type": "application/json" },
    body: JSON.stringify({ html: "<p>Blocked</p>" }),
  });
  assert.equal(hostile.status, 403);

  let externalRequests = 0;
  const canary = http.createServer((req, res) => { externalRequests++; res.end("unexpected"); });
  await new Promise(resolve => canary.listen(0, "127.0.0.1", resolve));
  try {
    const port = canary.address().port;
    const response = await fetch(`${base}/api/pdf`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: (process.env.ALLOWED_ORIGINS || "http://localhost:8080").split(",")[0] },
      body: JSON.stringify({ html: `<p>Container PDF first page</p><img src="http://127.0.0.1:${port}/image"><script>fetch('http://127.0.0.1:${port}/script')</script><p style="break-before:page">Container PDF second page</p>` }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get("content-type"), /application\/pdf/);
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    const pdf = await pdfParse(buffer);
    assert.equal(pdf.numpages, 2);
    assert.match(pdf.text, /Container PDF first page/);
    assert.match(pdf.text, /Container PDF second page/);
    assert.equal(externalRequests, 0, "PDF content must not make network requests");
  } finally { await new Promise(resolve => canary.close(resolve)); }
  console.log("Container checks passed: non-root, clean image, frontend/API, origin protection, two-page PDF, blocked external requests.");
})().catch(error => { console.error(error); process.exitCode = 1; });
