const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createAI } = require("./ai.cjs");

for (const provider of ["ollama", "llamacpp"]) test(`${provider} sends the configured model and validates provider errors`, async () => {
  let request;
  const ai = createAI({ AI_PROVIDER: provider }, { fetchImpl: async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "Synthetic reply" } }] }) };
  } });
  assert.equal(await ai.callAI("Synthetic prompt"), "Synthetic reply");
  assert.match(request.url, /\/v1\/chat\/completions$/);
  assert.equal(JSON.parse(request.options.body).messages[0].content, "Synthetic prompt");
  assert.equal(JSON.parse(request.options.body).model, ai.config.model);
  assert.ok(request.options.signal);
  const failing = createAI({ AI_PROVIDER: provider }, { fetchImpl: async () => ({ ok: false }) });
  await assert.rejects(failing.callAI("prompt"), /rejected/);
});
test("Anthropic uses its SDK with a bounded timeout and combines text blocks", async () => {
  let options, payload;
  class SDK {
    constructor(config) { options = config; this.messages = { create: async value => {
      payload = value; return { content: [{ type: "text", text: "First" }, { type: "text", text: " second" }, { type: "tool_use" }] };
    } }; }
  }
  const ai = createAI({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "synthetic-test-placeholder" }, { AnthropicSDK: SDK });
  assert.equal(await ai.callAI("Synthetic prompt"), "First second");
  assert.equal(payload.messages[0].content, "Synthetic prompt");
  assert.equal(options.timeout, 120000);
  assert.equal(options.maxRetries, 0);
});
test("cloud disclosure includes Ollama cloud models and remote endpoints", () => {
  assert.equal(createAI({ AI_PROVIDER: "ollama", OLLAMA_MODEL: "gpt-oss:120b-cloud" }).dataLeavesDevice, true);
  assert.equal(createAI({ AI_PROVIDER: "ollama", OLLAMA_BASE_URL: "https://example.com/v1" }).dataLeavesDevice, true);
  assert.equal(createAI({ AI_PROVIDER: "llamacpp" }).dataLeavesDevice, false);
  assert.equal(createAI({ AI_PROVIDER: "anthropic" }).dataLeavesDevice, true);
  assert.throws(() => createAI({ AI_PROVIDER: "invalid" }));
});
test("missing Anthropic credentials do not prevent manual editing or PDF startup", async () => {
  const ai = createAI({ AI_PROVIDER: "anthropic" });
  await assert.rejects(ai.callAI("prompt"), /Configure/);
});
