function createAI(env = process.env, { fetchImpl = fetch, AnthropicSDK } = {}) {
  const provider = (env.AI_PROVIDER || "anthropic").toLowerCase();
  const configs = {
    anthropic: { baseURL: "https://api.anthropic.com/v1", model: env.ANTHROPIC_MODEL || "claude-sonnet-4-6", apiKey: env.ANTHROPIC_API_KEY },
    ollama: { baseURL: env.OLLAMA_BASE_URL || "http://localhost:11434/v1", model: env.OLLAMA_MODEL || "llama3.2", apiKey: "ollama" },
    llamacpp: { baseURL: env.LLAMACPP_BASE_URL || "http://localhost:8080/v1", model: env.LLAMACPP_MODEL || "local-model", apiKey: env.LLAMACPP_API_KEY || "no-key-needed" },
  };
  const config = configs[provider];
  if (!config) throw new Error("Unknown AI_PROVIDER. Use anthropic, ollama, or llamacpp.");
  const endpoint = new URL(config.baseURL);
  if (!["http:", "https:"].includes(endpoint.protocol)) throw new Error("AI provider URL must use HTTP or HTTPS.");
  const dataLeavesDevice = provider === "anthropic" || /(?:-cloud|:cloud)(?:$|[/:])/i.test(config.model)
    || !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
  let client;
  async function callAI(prompt) {
    if (provider === "anthropic") {
      if (!config.apiKey || config.apiKey === "your_api_key_here") throw new Error("Configure your Anthropic key before using AI.");
      if (!client) {
        const SDK = AnthropicSDK || require("@anthropic-ai/sdk");
        client = new SDK({ apiKey: config.apiKey, timeout: 120000, maxRetries: 0 });
      }
      const message = await client.messages.create({ model: config.model, max_tokens: 4096, messages: [{ role: "user", content: prompt }] });
      return message.content.map(block => block.text || "").join("");
    }
    const response = await fetchImpl(`${config.baseURL.replace(/\/$/, "")}/chat/completions`, {
      signal: AbortSignal.timeout(120000), method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 4096 }),
    });
    if (!response.ok) throw new Error("The AI provider rejected the request.");
    return (await response.json()).choices?.[0]?.message?.content || "";
  }
  return { provider, config, callAI, dataLeavesDevice };
}
module.exports = { createAI };
