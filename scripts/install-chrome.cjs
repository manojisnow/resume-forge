// Build-only installer: official Stable archive, pinned version and checksum.
const fs = require("node:fs/promises");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const pin = require("./chrome.json");

(async () => {
  const architecture = process.env.TARGETARCH;
  const platform = { amd64: "linux64", arm64: "linux-arm64" }[architecture];
  const expected = pin.sha256[architecture];
  if (!platform || !expected) throw new Error(`Unsupported browser architecture: ${architecture}`);
  const url = `https://storage.googleapis.com/chrome-for-testing-public/${pin.version}/${platform}/chrome-${platform}.zip`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Browser download failed: ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const actual = createHash("sha256").update(archive).digest("hex");
  if (actual !== expected) throw new Error(`Browser checksum mismatch for ${architecture}`);
  await fs.writeFile("/tmp/chrome.zip", archive);
  execFileSync("unzip", ["-q", "/tmp/chrome.zip", "-d", "/opt"]);
  await fs.rename(`/opt/chrome-${platform}`, "/opt/chrome");
  await fs.copyFile(require.resolve("./chrome.json"), "/opt/chrome/version.json");
  await fs.unlink("/tmp/chrome.zip");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
