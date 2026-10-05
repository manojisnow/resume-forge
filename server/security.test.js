const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
process.env.AI_PROVIDER = "ollama";
const app = require("./index");
let server, baseURL;

before(async () => {
  server = await new Promise(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

async function post(route, body, headers = {}) {
  return fetch(`${baseURL}${route}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("rejects cross-origin requests before AI or PDF work", async () => {
  const response = await post("/api/pdf", { html: "<p>Hello</p>" }, { Origin: "https://example.com" });
  assert.equal(response.status, 403);
});

test("permits the local frontend and does not expose configured provider URLs", async () => {
  const response = await fetch(`${baseURL}/api/health`, { headers: { Origin: "http://localhost:3000" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal((await response.json()).baseURL, undefined);
});

test("rejects malformed inputs with JSON errors instead of crashing", async () => {
  for (const [route, body] of [
    ["/api/parse/text", { text: 123 }],
    ["/api/ai/improve", { text: {} }],
    ["/api/ai/improve", { text: "hello", context: null }],
    ["/api/ai/tailor", { jobDescription: "job" }],
    ["/api/ai/tailor", { jobDescription: "job", resume: { experience: [null], skills: [] } }],
    ["/api/pdf", { html: {} }],
    ["/api/pdf", { html: "<p>Hello</p>", filename: 123 }],
  ]) {
    const response = await post(route, body);
    assert.equal(response.status, 400, route);
    assert.equal(typeof (await response.json()).error, "string");
  }
});

test("limits request size", async () => {
  const response = await post("/api/pdf", { html: "x".repeat(1024 * 1024) });
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /limit/);
});

test("rejects unsupported document uploads with a JSON error", async () => {
  const form = new FormData();
  form.append("file", new Blob(["text"], { type: "text/plain" }), "resume.txt");
  const response = await fetch(`${baseURL}/api/parse/file`, { method: "POST", body: form });
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).error, "string");
});
