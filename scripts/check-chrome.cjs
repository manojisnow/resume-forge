// Fails the scheduled check when a newer Stable browser needs review.
const pin = require("./chrome.json");
(async () => {
  const response = await fetch("https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json", { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Stable metadata request failed: ${response.status}`);
  const stable = (await response.json()).channels.Stable;
  for (const platform of ["linux64", "linux-arm64"]) {
    if (!stable.downloads.chrome.some(download => download.platform === platform)) throw new Error(`Stable browser missing ${platform}`);
  }
  if (stable.version !== pin.version) throw new Error(`Chrome Stable is ${stable.version}; review scripts/chrome.json (${pin.version}), refresh both checksums, and retest PDF export.`);
  console.log(`Chrome ${pin.version} matches the current Stable channel on both architectures.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
