const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
let model, server, baseURL, modelResponse;
before(async () => {
  model = http.createServer((req, res) => {
    req.resume(); res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: modelResponse } }] }));
  });
  await new Promise(resolve => model.listen(0, "127.0.0.1", resolve));
  process.env.AI_PROVIDER = "ollama";
  process.env.OLLAMA_MODEL = "synthetic-local";
  process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${model.address().port}/v1`;
  const app = require("./index");
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => model.close(resolve))]);
});
const post = (route, body) => fetch(`${baseURL}${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
test("AI parsing returns normalized, validated resume data", async () => {
  modelResponse = JSON.stringify({ personal: { name: "Synthetic" }, skills: [{ category: "Tools", items: "JS, Go" }] });
  const response = await post("/api/parse/text", { text: "Synthetic document" });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).skills[0].items, ["JS", "Go"]);
});
test("invalid JSON and invalid resume shapes return 422 instead of unsafe data", async () => {
  for (const output of ["not JSON", '{"personal":', '{"personal":[],"experience":[]}', '{"personal":{},"experience":"incorrect"}']) {
    modelResponse = output;
    const response = await post("/api/parse/text", { text: "Synthetic document" });
    assert.equal(response.status, 422);
    assert.equal(typeof (await response.json()).error, "string");
  }
});
test("tailoring rejects suggestions that target fabricated resume entries", async () => {
  modelResponse = JSON.stringify({ score: 50, missingKeywords: [], suggestions: [{ itemId: "invented", bulletIndex: 0, original: "original", improved: "improved" }] });
  const response = await post("/api/ai/tailor", { resume: { personal: {}, experience: [{ id: "real", bullets: ["original"] }], skills: [] }, jobDescription: "Synthetic job" });
  assert.equal(response.status, 422);
});
test("an empty rewrite is rejected rather than replacing existing text", async () => {
  modelResponse = " ";
  const response = await post("/api/ai/improve", { text: "Existing text", action: "improve" });
  assert.equal(response.status, 422);
});
